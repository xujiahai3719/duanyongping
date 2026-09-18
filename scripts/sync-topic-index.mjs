#!/usr/bin/env node

// 把 content/dao/qanda/wenda-topic-index.md 里每章的书签列表，重建成章节 md 里真实的
// `## 第N节 …` / `### 子标题`。卷标题、章标题、frontmatter 一律原样保留。
//
// 目录里出现找不到章节文件的 slug 时一律报错退出，绝不静默删掉那一章的书签。
//
// 用法：
//   node scripts/sync-topic-index.mjs            # 只检查，不同步就 exit 1
//   node scripts/sync-topic-index.mjs --write    # 写回目录文件

import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 投资问答录全部章节（投资逻辑篇 / 商业逻辑篇 / 公司与人生）都在 qanda/ 这一个目录里。
const CONTENT_DIRS = ['content/dao/qanda']
const INDEX_PATH = path.join(ROOT, 'content/dao/qanda/wenda-topic-index.md')
const CHAPTER_FILE_RE = /^wenda-(?:invest|business|company|life)-.+\.md$/
const CHAPTER_HEADING_RE = /^### 第.+?章 \[.+?\]\(\/([\w-]+)\)\s*$/

export function anchorFor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function chapterBookmarks(chapterText) {
  const body = chapterText.startsWith('---')
    ? chapterText.slice(chapterText.indexOf('\n---\n') + 5)
    : chapterText
  return [...body.matchAll(/^(#{2,3}) (.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    title: match[2].trim(),
  }))
}

// 护栏报错专用：只有这类异常才把 message 当人话直接打印，其余异常照旧连堆栈一起抛出来。
class TopicIndexError extends Error {}

export function syncTopicIndex(indexText, chapters) {
  const lines = indexText.split('\n')
  const output = []
  const missing = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    output.push(line)
    index += 1
    const match = CHAPTER_HEADING_RE.exec(line)
    if (!match) continue

    // 跳过原有的空行 + 书签列表；遇到任何其它内容（散文、注释）立刻停手，不吞掉手写内容
    while (index < lines.length && (lines[index].trim() === '' || /^\s*- \[/.test(lines[index]))) {
      index += 1
    }

    const chapter = chapters.get(match[1])
    if (!chapter) {
      // 找不到章节文件就没有书签可写，继续走下去等于把这章原有书签整段删光。
      // 收齐所有缺失的 slug 后统一报错，一次把问题说完。
      missing.push(match[1])
      continue
    }
    output.push('')
    for (const bookmark of chapterBookmarks(chapter)) {
      const indent = bookmark.level === 3 ? '  ' : ''
      output.push(`${indent}- [${bookmark.title}](/${match[1]}#${anchorFor(bookmark.title)})`)
    }
    output.push('')
  }
  if (missing.length) {
    throw new TopicIndexError(
      `主题目录里有 ${missing.length} 章找不到对应的章节文件：${missing.join('、')}。\n`
        + `可能原因：文件名不在 wenda-(invest|business|company|life)-*.md 白名单里；`
        + `文件不在 ${CONTENT_DIRS.join('、')} 这几个目录里；或者文件名与 frontmatter 的 slug 不一致。\n`
        + '拒绝同步，以免把这些章的书签整段删掉。',
    )
  }
  return `${output.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '')}\n`
}

async function main() {
  const chapters = new Map()
  for (const dir of CONTENT_DIRS) {
    for (const name of await readdir(path.join(ROOT, dir))) {
      if (!CHAPTER_FILE_RE.test(name)) continue
      chapters.set(name.replace(/\.md$/, ''), await readFile(path.join(ROOT, dir, name), 'utf8'))
    }
  }
  const current = await readFile(INDEX_PATH, 'utf8')
  const next = syncTopicIndex(current, chapters)
  if (next === current) {
    console.log('主题目录已同步，无需改动。')
    return
  }
  if (!process.argv.includes('--write')) {
    console.log('主题目录与章节不同步。加 --write 写入。')
    process.exitCode = 1
    return
  }
  await writeFile(INDEX_PATH, next, 'utf8')
  console.log(`已同步 ${chapters.size} 章的主题目录。`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // 护栏报错是写给人看的中文提示，只打印 message；其余异常仍连堆栈一起打印，方便排查。
    console.error(error instanceof TopicIndexError ? error.message : error)
    process.exitCode = 1
  })
}
