import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { MERGED_COMPANY_REDIRECTS } from '../scripts/qanda-cleaning-config.mjs'
import { normalizeForDuplicate } from '../scripts/qanda-cleaning-lib.mjs'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('public catalogue and sidebar filter legacy migration guides', () => {
  const layout = read('app/layouts/default.vue')
  const home = read('app/pages/index.vue')

  assert.match(layout, /article\.type !== 'legacy-index'/)
  assert.match(home, /article\.type !== 'legacy-index'/)
  assert.ok((home.match(/article\.type !== 'legacy-index'/g) || []).length >= 2)
})

test('article page renders tags and selects schema type from content type', () => {
  const article = read('app/pages/[slug].vue')

  assert.match(article, /class="article-tags"/)
  assert.match(article, /schemaType/)
  assert.match(article, /schema\.keywords = d\.tags/)
  assert.match(article, /topic-index.*CollectionPage/)
  assert.match(article, /legacy-index.*WebPage/)
})

test('content schema and sidebar expose volume chapter hierarchy', () => {
  const schema = read('content.config.ts')
  const layout = read('app/layouts/default.vue')
  const sidebar = read('app/components/LibrarySidebar.vue')

  assert.match(schema, /volume: z\.string\(\)\.optional\(\)/)
  assert.match(schema, /volumeOrder: z\.number\(\)\.optional\(\)/)
  assert.match(schema, /chapterOrder: z\.number\(\)\.optional\(\)/)
  assert.match(layout, /volume.*volumeOrder.*chapterOrder/)
  assert.match(sidebar, /category === '投资问答录'/)
  assert.match(sidebar, /qanda-chapter/)
  assert.match(sidebar, /主题总目录/)
  assert.match(sidebar, /第.*章/)
})

test('homepage counts qanda chapters and chapter page renders sibling navigation', () => {
  const home = read('app/pages/index.vue')
  const article = read('app/pages/[slug].vue')

  assert.match(home, /qanda-chapter/)
  assert.match(home, /wenda-topic-index/)
  assert.match(article, /chapterNavigation/)
  assert.match(article, /上一章/)
  assert.match(article, /返回本卷目录/)
  assert.match(article, /下一章/)
})

test('LLM index excludes topic and legacy navigation pages', () => {
  const llms = read('server/routes/llms-full.txt.ts')

  assert.match(llms, /item\.type !== 'legacy-index'.*item\.type !== 'topic-index'/s)
})

test('sitemap excludes legacy routes while Nuxt still prerenders the 20 source guides', () => {
  const sitemap = read('server/routes/sitemap.xml.ts')
  const nuxtConfig = read('nuxt.config.ts')

  assert.match(sitemap, /type: string/)
  assert.match(sitemap, /filter\(.*legacy-index/s)
  assert.match(nuxtConfig, /legacyQandaRoutes/)
  assert.match(nuxtConfig, /dadaotouziwendalu-diyizhangtouzidadao/)
  assert.match(nuxtConfig, /duanyongping-shangyeluoji-di7jie-stop-doing-list-buweiqingdan/)
})

test('all historical qanda part URLs keep permanent redirects after regeneration', () => {
  const redirects = read('public/_redirects')
  const partRedirects = redirects.match(/^\/wenda-.*-part-\d+\s+\/wenda-\S+\s+301$/gm) || []
  const removedTargets = new Set([...MERGED_COMPANY_REDIRECTS.keys()].map((slug) => `/${slug}`))

  assert.equal(partRedirects.length, 208)
  assert.ok(partRedirects.every((line) => !removedTargets.has(line.split(/\s+/)[1])))
})

test('removed company article URLs redirect directly to five active industry chapters', () => {
  const redirects = read('public/_redirects')
  const lines = new Set(redirects.split(/\r?\n/).map((line) => line.trim()))

  assert.equal(MERGED_COMPANY_REDIRECTS.size, 19)
  for (const [from, to] of MERGED_COMPANY_REDIRECTS) {
    assert.ok(lines.has(`/${from} /${to} 301`), `${from} should redirect to ${to}`)
  }
})

test('company and person pages link directly to active merged company chapters', () => {
  const directory = new URL('../content/dao/company-people/', import.meta.url)
  const removedSlugs = [...MERGED_COMPANY_REDIRECTS.keys()]
  const staleLinks = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .flatMap((name) => {
      const body = fs.readFileSync(new URL(name, directory), 'utf8')
      return removedSlugs.filter((slug) => body.includes(`(/${slug})`)).map((slug) => `${name}: /${slug}`)
    })

  assert.deepEqual(staleLinks, [])
})

test('life chapter one has no repeated substantive paragraphs', () => {
  const chapter = read('content/dao/qanda/wenda-life-01.md')
  const paragraphs = chapter
    .split(/\n\s*\n+/)
    .map((paragraph) => ({
      paragraph,
      normalized: normalizeForDuplicate(paragraph),
    }))
    .filter(({ normalized }) => Array.from(normalized).length >= 12)
  const seen = new Map()

  for (const { paragraph, normalized } of paragraphs) {
    const occurrences = seen.get(normalized) || []
    occurrences.push(paragraph)
    seen.set(normalized, occurrences)
  }

  const duplicates = [...seen.values()].filter((occurrences) => occurrences.length > 1)
  assert.deepEqual(duplicates, [])
})
