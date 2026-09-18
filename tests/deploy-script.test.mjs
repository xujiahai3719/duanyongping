import assert from 'node:assert/strict'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const deployScript = path.join(projectRoot, 'scripts', 'deploy.py')

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  })
}

function git(cwd, ...args) {
  const result = run('git', args, { cwd })
  assert.equal(
    result.status,
    0,
    `git ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`,
  )
  return result.stdout.trimEnd()
}

function deployEnv(overrides = {}) {
  const env = { ...process.env }
  delete env.CF_PAGES
  delete env.CI
  delete env.DEPLOY_GIT_REMOTE
  delete env.SKIP_DEPLOY
  delete env.DEPLOY_OSS
  delete env.DEPLOY_FROM_GENERATE
  delete env.ALIYUN_OSS_BUCKET
  delete env.ALIYUN_CLI_PROFILE
  delete env.OSS_REGION
  return { ...env, ...overrides }
}

function createRepository(t, { withRemote = true } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'website-duan-deploy-'))
  const repo = path.join(root, 'repo')
  const remote = path.join(root, 'remote.git')

  t.after(() => rmSync(root, { recursive: true, force: true }))

  git(root, 'init', '--initial-branch=main', repo)
  git(repo, 'config', 'user.name', 'Deploy Test')
  git(repo, 'config', 'user.email', 'deploy-test@example.com')
  git(repo, 'config', 'core.hooksPath', '/dev/null')
  writeFileSync(path.join(repo, 'tracked.txt'), 'initial\n')
  git(repo, 'add', 'tracked.txt')
  git(repo, 'commit', '-m', 'initial')

  if (withRemote) {
    git(root, 'init', '--bare', remote)
    git(repo, 'remote', 'add', 'github', remote)
    git(repo, 'push', '-u', 'github', 'main')
  }

  return { repo, remote }
}

function runDeploy(repo, args = [], env = deployEnv()) {
  return run('python3', [deployScript, ...args], { cwd: repo, env })
}

test('deploy commits with the default message and pushes the current branch', (t) => {
  const { repo, remote } = createRepository(t)
  writeFileSync(path.join(repo, 'tracked.txt'), 'changed\n')

  const result = runDeploy(repo)

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(repo, 'log', '-1', '--pretty=%s'), 'chore: deploy')
  assert.equal(git(remote, 'show', 'refs/heads/main:tracked.txt'), 'changed')
})

test('deploy accepts a custom commit message', (t) => {
  const { repo } = createRepository(t)
  writeFileSync(path.join(repo, 'tracked.txt'), 'custom message\n')

  const result = runDeploy(repo, ['docs: publish articles'])

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(repo, 'log', '-1', '--pretty=%s'), 'docs: publish articles')
})

test('deploy skips the commit for a clean tree and still pushes successfully', (t) => {
  const { repo } = createRepository(t)
  const headBefore = git(repo, 'rev-parse', 'HEAD')

  const result = runDeploy(repo)

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(repo, 'rev-parse', 'HEAD'), headBefore)
  assert.match(result.stdout, /no changes/i)
})

test('SKIP_DEPLOY=1 leaves local changes uncommitted and does not push', (t) => {
  const { repo, remote } = createRepository(t)
  const headBefore = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(path.join(repo, 'tracked.txt'), 'not published\n')

  const result = runDeploy(repo, [], deployEnv({ SKIP_DEPLOY: '1' }))

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(repo, 'rev-parse', 'HEAD'), headBefore)
  assert.equal(git(remote, 'show', 'refs/heads/main:tracked.txt'), 'initial')
  assert.equal(readFileSync(path.join(repo, 'tracked.txt'), 'utf8'), 'not published\n')
  assert.match(result.stdout, /SKIP_DEPLOY=1/)
})

test('deploy fails clearly when the repository has no remote', (t) => {
  const { repo } = createRepository(t, { withRemote: false })

  const result = runDeploy(repo)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /no Git remote configured/i)
})

test('deploy rejects an explicitly configured remote that does not exist', (t) => {
  const { repo } = createRepository(t)
  const headBefore = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(path.join(repo, 'tracked.txt'), 'must not publish\n')

  const result = runDeploy(
    repo,
    [],
    deployEnv({ DEPLOY_GIT_REMOTE: 'typo-remote' }),
  )

  assert.notEqual(result.status, 0)
  assert.equal(git(repo, 'rev-parse', 'HEAD'), headBefore)
  assert.match(result.stderr, /remote.*typo-remote.*not configured/i)
})

test('DEPLOY_GIT_REMOTE publishes only to the selected remote', (t) => {
  const { repo, remote: githubRemote } = createRepository(t)
  const selectedRemote = path.join(path.dirname(githubRemote), 'selected.git')
  git(path.dirname(selectedRemote), 'init', '--bare', selectedRemote)
  git(repo, 'remote', 'add', 'selected', selectedRemote)
  writeFileSync(path.join(repo, 'tracked.txt'), 'selected remote\n')

  const result = runDeploy(
    repo,
    [],
    deployEnv({ DEPLOY_GIT_REMOTE: 'selected' }),
  )

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(selectedRemote, 'show', 'refs/heads/main:tracked.txt'), 'selected remote')
  assert.equal(git(githubRemote, 'show', 'refs/heads/main:tracked.txt'), 'initial')
})

test('deploy prefers github when multiple remotes are configured', (t) => {
  const { repo, remote: githubRemote } = createRepository(t)
  const firstRemote = path.join(path.dirname(githubRemote), 'aaa.git')
  git(path.dirname(firstRemote), 'init', '--bare', firstRemote)
  git(repo, 'remote', 'add', 'aaa', firstRemote)
  assert.equal(git(repo, 'remote'), 'aaa\ngithub')
  writeFileSync(path.join(repo, 'tracked.txt'), 'github preferred\n')

  const result = runDeploy(repo)

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(githubRemote, 'show', 'refs/heads/main:tracked.txt'), 'github preferred')
})

test('deploy falls back to the only configured remote', (t) => {
  const { repo, remote } = createRepository(t, { withRemote: false })
  git(path.dirname(remote), 'init', '--bare', remote)
  git(repo, 'remote', 'add', 'origin', remote)
  git(repo, 'push', '-u', 'origin', 'main')
  writeFileSync(path.join(repo, 'tracked.txt'), 'origin fallback\n')

  const result = runDeploy(repo)

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(git(remote, 'show', 'refs/heads/main:tracked.txt'), 'origin fallback')
})

test('CI and Cloudflare environments skip deployment', (t) => {
  for (const variable of ['CI', 'CF_PAGES']) {
    const { repo } = createRepository(t)
    const headBefore = git(repo, 'rev-parse', 'HEAD')
    writeFileSync(path.join(repo, 'tracked.txt'), `${variable} skip\n`)

    const result = runDeploy(repo, [], deployEnv({ [variable]: '1' }))

    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(git(repo, 'rev-parse', 'HEAD'), headBefore)
    assert.match(result.stdout, /CI\/Cloudflare environment/)
  }
})

test('deploy rejects a detached HEAD before staging changes', (t) => {
  const { repo } = createRepository(t)
  git(repo, 'checkout', '--detach')
  writeFileSync(path.join(repo, 'tracked.txt'), 'detached\n')

  const result = runDeploy(repo)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /detached HEAD/i)
  assert.equal(git(repo, 'diff', '--cached', '--name-only'), '')
})

test('root entry publishes its own project when called from another directory', (t) => {
  const { repo, remote } = createRepository(t)
  const wrapper = path.join(repo, 'deploy.sh')
  const pythonScript = path.join(repo, 'scripts', 'deploy.py')
  mkdirSync(path.dirname(pythonScript))
  copyFileSync(path.join(projectRoot, 'deploy.sh'), wrapper)
  copyFileSync(deployScript, pythonScript)
  chmodSync(wrapper, 0o755)
  writeFileSync(path.join(repo, 'tracked.txt'), 'published by wrapper\n')

  const result = run(wrapper, [], {
    cwd: os.tmpdir(),
    env: deployEnv(),
  })

  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  assert.equal(
    git(remote, 'show', 'refs/heads/main:tracked.txt'),
    'published by wrapper',
  )
})

test('root entry publishes to OSS after pushing when OSS is configured', (t) => {
  const { repo } = createRepository(t)
  const wrapper = path.join(repo, 'deploy.sh')
  const pythonScript = path.join(repo, 'scripts', 'deploy.py')
  const ossScript = path.join(repo, 'scripts', 'deploy-oss.sh')
  mkdirSync(path.dirname(pythonScript))
  copyFileSync(path.join(projectRoot, 'deploy.sh'), wrapper)
  copyFileSync(deployScript, pythonScript)
  writeFileSync(ossScript, '#!/bin/sh\nprintf called > oss-invocation.txt\n')
  chmodSync(wrapper, 0o755)
  chmodSync(ossScript, 0o755)

  const result = run(wrapper, [], {
    cwd: os.tmpdir(),
    env: deployEnv({ ALIYUN_OSS_BUCKET: 'test-bucket' }),
  })

  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  assert.equal(readFileSync(path.join(repo, 'oss-invocation.txt'), 'utf8'), 'called')
})

test('root entry does not publish a preview branch to OSS', (t) => {
  const { repo } = createRepository(t)
  const wrapper = path.join(repo, 'deploy.sh')
  const pythonScript = path.join(repo, 'scripts', 'deploy.py')
  const ossScript = path.join(repo, 'scripts', 'deploy-oss.sh')
  mkdirSync(path.dirname(pythonScript))
  copyFileSync(path.join(projectRoot, 'deploy.sh'), wrapper)
  copyFileSync(deployScript, pythonScript)
  writeFileSync(ossScript, '#!/bin/sh\nprintf called > oss-invocation.txt\n')
  chmodSync(wrapper, 0o755)
  chmodSync(ossScript, 0o755)
  git(repo, 'checkout', '-b', 'preview')

  const result = run(wrapper, [], {
    cwd: os.tmpdir(),
    env: deployEnv({ ALIYUN_OSS_BUCKET: 'test-bucket' }),
  })

  assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  assert.match(result.stdout, /skipping OSS deployment.*preview/i)
  assert.throws(() => readFileSync(path.join(repo, 'oss-invocation.txt'), 'utf8'))
})
