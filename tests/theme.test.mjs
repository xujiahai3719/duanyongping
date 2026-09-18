import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { parse } from '@vue/compiler-sfc'

function createBrowserHarness({ storedTheme = null, prefersDark = false, failStorageRead = false, failStorageWrite = false } = {}) {
  const classes = new Set()
  const storage = new Map(storedTheme ? [['theme', storedTheme]] : [])
  const meta = {
    content: '',
    setAttribute(name, value) {
      if (name === 'content') this.content = value
    },
  }
  let mounted

  globalThis.ref = (value) => ({ value })
  globalThis.readonly = (value) => value
  globalThis.onMounted = (callback) => { mounted = callback }
  globalThis.localStorage = {
    getItem(key) {
      if (failStorageRead) throw new Error('storage read blocked')
      return storage.get(key) ?? null
    },
    setItem(key, value) {
      if (failStorageWrite) throw new Error('storage write blocked')
      storage.set(key, value)
    },
  }
  globalThis.window = {
    matchMedia: () => ({ matches: prefersDark }),
  }
  globalThis.document = {
    documentElement: {
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle(name, force) {
          if (force === true) classes.add(name)
          else if (force === false) classes.delete(name)
          else if (classes.has(name)) classes.delete(name)
          else classes.add(name)
        },
        contains: (name) => classes.has(name),
      },
    },
    querySelector: () => meta,
  }

  return {
    classes,
    meta,
    mount: () => mounted(),
    stored: (key) => storage.get(key),
  }
}

test('selecting the green theme applies and persists every browser-facing state', async () => {
  const browser = createBrowserHarness()
  const { useTheme } = await import(`../app/composables/useTheme.ts?test=${Date.now()}`)
  const { theme, setTheme } = useTheme()

  browser.mount()
  assert.equal(typeof setTheme, 'function', 'useTheme should expose an explicit theme selector')
  setTheme('green')

  assert.equal(theme.value, 'green')
  assert.equal(browser.classes.has('green'), true)
  assert.equal(browser.classes.has('dark'), false)
  assert.equal(browser.stored('theme'), 'green')
  assert.equal(browser.meta.content, '#c0edc6')
})

test('an unknown stored theme falls back to the system preference', async () => {
  const browser = createBrowserHarness({ storedTheme: 'sepia', prefersDark: true })
  const { useTheme } = await import(`../app/composables/useTheme.ts?invalid=${Date.now()}`)
  const { theme } = useTheme()

  browser.mount()

  assert.equal(theme.value, 'dark')
  assert.equal(browser.classes.has('dark'), true)
  assert.equal(browser.classes.has('sepia'), false)
  assert.equal(browser.meta.content, '#1a1a1a')
})

test('a blocked storage read still applies the system theme', async () => {
  const browser = createBrowserHarness({ prefersDark: true, failStorageRead: true })
  const { useTheme } = await import(`../app/composables/useTheme.ts?read-failure=${Date.now()}`)
  const { theme } = useTheme()

  assert.doesNotThrow(() => browser.mount())
  assert.equal(theme.value, 'dark')
  assert.equal(browser.classes.has('dark'), true)
  assert.equal(browser.meta.content, '#1a1a1a')
})

test('a blocked storage write does not interrupt a visible theme change', async () => {
  const browser = createBrowserHarness({ failStorageWrite: true })
  const { useTheme } = await import(`../app/composables/useTheme.ts?write-failure=${Date.now()}`)
  const { theme, setTheme } = useTheme()

  browser.mount()
  assert.doesNotThrow(() => setTheme('green'))
  assert.equal(theme.value, 'green')
  assert.equal(browser.classes.has('green'), true)
  assert.equal(browser.meta.content, '#c0edc6')
})

test('the sidebar inherits every semantic color from the active site theme', () => {
  const source = readFileSync(new URL('../app/components/LibrarySidebar.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const css = descriptor.styles.map((style) => style.content).join('\n')
  const stylesheet = postcss.parse(css)
  const sidebarRule = stylesheet.nodes.find((node) => node.type === 'rule' && node.selector === '.sidebar')
  const declarations = new Map()

  assert.ok(sidebarRule, 'LibrarySidebar should define a .sidebar style rule')
  sidebarRule.walkDecls((declaration) => declarations.set(declaration.prop, declaration.value))

  const expectedTokens = {
    '--sb-bg': 'var(--bg)',
    '--sb-fg': 'var(--fg)',
    '--sb-muted': 'color-mix(in srgb, var(--fg) 72%, var(--bg))',
    '--sb-subtle': 'color-mix(in srgb, var(--fg) 68%, var(--bg))',
    '--sb-line': 'var(--line)',
    '--sb-surface': 'var(--surface)',
    '--sb-accent': 'var(--accent)',
    '--sb-accent-soft': 'var(--accent-soft)',
  }
  for (const [property, value] of Object.entries(expectedTokens)) {
    assert.equal(declarations.get(property), value, `${property} should inherit ${value}`)
  }

  const themeOverrides = new Set()
  stylesheet.walkRules((rule) => {
    if (!/html\.(dark|green).*\.sidebar/.test(rule.selector)) return
    rule.walkDecls(/^--sb-/, (declaration) => themeOverrides.add(declaration.prop))
  })
  assert.deepEqual([...themeOverrides], [])
})

test('small sidebar labels keep an undiluted accessible text token', () => {
  const source = readFileSync(new URL('../app/components/LibrarySidebar.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const stylesheet = postcss.parse(descriptor.styles.map((style) => style.content).join('\n'))
  const expectedColors = {
    '.search-input::placeholder': 'var(--sb-subtle)',
    '.category-count': 'var(--sb-subtle)',
    '.chevron': 'var(--sb-subtle)',
    '.article-subgroup-label': 'var(--sb-muted)',
    '.article-volume-summary': 'var(--sb-muted)',
    '.icp-link': 'var(--sb-subtle)',
  }

  for (const [selector, expectedColor] of Object.entries(expectedColors)) {
    const rule = stylesheet.nodes.find((node) => node.type === 'rule' && node.selector === selector)
    assert.ok(rule, `LibrarySidebar should define ${selector}`)
    const color = rule.nodes.find((node) => node.type === 'decl' && node.prop === 'color')
    assert.equal(color?.value, expectedColor, `${selector} should use ${expectedColor}`)
  }
})

test('the sidebar search stays in the directory scroll flow', () => {
  const source = readFileSync(new URL('../app/components/LibrarySidebar.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const stylesheet = postcss.parse(descriptor.styles.map((style) => style.content).join('\n'))
  const searchRule = stylesheet.nodes.find((node) => node.type === 'rule' && node.selector === '.sidebar-search')
  const navRule = stylesheet.nodes.find((node) => node.type === 'rule' && node.selector === '.sidebar-nav')
  const searchDeclarations = new Map()
  const navDeclarations = new Map()

  assert.ok(searchRule, 'LibrarySidebar should define .sidebar-search')
  assert.ok(navRule, 'LibrarySidebar should define .sidebar-nav')
  searchRule.walkDecls((declaration) => searchDeclarations.set(declaration.prop, declaration.value))
  navRule.walkDecls((declaration) => navDeclarations.set(declaration.prop, declaration.value))

  assert.equal(navDeclarations.get('overflow-y'), 'auto')
  assert.equal(searchDeclarations.get('position') ?? 'static', 'static')
  assert.equal(searchDeclarations.has('top'), false)
  assert.equal(searchDeclarations.has('z-index'), false)
})
