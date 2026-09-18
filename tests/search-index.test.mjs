// /search-index.json 的构建与检索逻辑单测。
//
// 数据源是本地内容库 .data/content/contents.sqlite（Nuxt Content 的落库文件，
// 已 gitignore；CI 上没有时自动跳过，与 tests/qanda-site-integration.test.mjs 同款做法）。
//
// 这里直接断言"算法产出与页面渲染出的锚点一致"，而不是断言构建产物长什么样：
// 页面上的 <h2 id> 由 MDC 写进 AST，索引里的 sections[].id 取自同一个字段。

import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

import { buildIndex, flattenBody, flattenNode } from '../server/utils/searchIndex.mjs'
import {
  buildSnippet,
  displayLabel,
  matchRanges,
  queryTokens,
  searchIndex,
  sectionIndexAt,
} from '../app/utils/searchSnippet.mjs'

const DB_PATH = new URL('../.data/content/contents.sqlite', import.meta.url).pathname
const hasDb = existsSync(DB_PATH)

function loadRows() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true })
  const rows = db.prepare('select title, slug, type, body, category, volume, chapterOrder from _content_dao').all()
  db.close()
  return rows.map((row) => ({
    ...row,
    body: row.body ? JSON.parse(row.body) : undefined,
  }))
}

const rows = hasDb ? loadRows() : []
const index = hasDb ? buildIndex(rows) : {}

// 锚点用 flattenNode 自己抽（避免测试里再写一份会走样的遍历 —— 曾经的坑：
// 探针函数漏掉首个小节，于是把索引正确的结果误判成错误），
// 并复刻"标题下面确实有正文才算小节"的规则：连续两个标题之间的空标题会被丢掉。
function headingIds(body) {
  const pieces = flattenNode(body.value, [])
  const parts = []
  const bounds = []
  for (const piece of pieces) {
    if (piece.kind === 'text') parts.push(piece.text)
    else bounds.push({ id: piece.id, partIndex: parts.length })
  }
  return bounds
    .filter((boundary, index) => {
      const end = bounds[index + 1]?.partIndex ?? parts.length
      return parts.slice(boundary.partIndex, end).join(' ').trim().length > 0
    })
    .map((boundary) => boundary.id)
}

test('索引覆盖全部文章，且不含 legacy-index', { skip: !hasDb }, () => {
  const expected = rows.filter((row) => row.type !== 'legacy-index')
  assert.equal(Object.keys(index).length, expected.length)
  assert.ok(Object.keys(index).length > 100)
  assert.ok(!Object.keys(index).some((slug) => index[slug].type === 'legacy-index'))
})

test('每篇都有正文文本，且正文不含 h1 标题（标题单独放在 sections[].h）', { skip: !hasDb }, () => {
  for (const [slug, entry] of Object.entries(index)) {
    assert.ok(entry.text.length > 0, `${slug} 应有正文文本`)

    const h1 = rows.find((row) => row.slug === slug)?.body?.value?.[0]
    const title = h1Title(h1)
    if (title) assert.ok(!entry.text.includes(title), `${slug} 的正文不应包含 h1 标题`)
  }
})

// h1 的文本可能是字符串，也可能是嵌套数组（minimark 的两种形态）
function h1Title(node) {
  if (!Array.isArray(node) || node[0] !== 'h1') return ''
  const out = []
  const collect = (child) => {
    if (typeof child === 'string') out.push(child)
    else if (Array.isArray(child)) child.slice(2).forEach(collect)
  }
  node.slice(2).forEach(collect)
  return out.join(' ').toLocaleLowerCase('zh-CN').trim()
}

test('小节标题可被搜索到，且结果仍指向该小节锚点', { skip: !hasDb }, () => {
  const entry = index['wenda-business-01']
  assert.equal(entry.sections[0].h, '第一节 伟大企业的标准')

  const { results } = searchIndex(index, '长坡厚雪')
  const hit = results.find((result) => result.slug === 'wenda-business-01')
  assert.ok(hit && hit.headingId, '应命中带锚点的小节')

  // 只搜小节标题（正文里没有这个词）也要给出可跳转的结果
  const fake = {
    demo: {
      title: '示例文章',
      text: '正文里没有那个词。',
      sections: [{ id: '第一节-只有标题命中', start: 0, h: '第一节 只有标题命中' }],
    },
  }
  const onlyHeading = searchIndex(fake, '只有标题命中')
  assert.equal(onlyHeading.results.length, 1)
  assert.equal(onlyHeading.results[0].headingId, '第一节-只有标题命中')
  assert.ok(onlyHeading.results[0].snippet.segments.some((segment) => segment.hit))
})

test('sections 的 id 与顺序和页面渲染的标题锚点一致', { skip: !hasDb }, () => {
  for (const row of rows) {
    if (row.type === 'legacy-index') continue
    const entry = index[row.slug]
    const ids = headingIds(row.body)
    assert.deepEqual(entry.sections.map((section) => section.id), ids, `${row.slug} 锚点应一致`)
  }
})

test('sections 的 start 落在文本范围内且单调不减', { skip: !hasDb }, () => {
  for (const [slug, entry] of Object.entries(index)) {
    let previous = -1
    for (const section of entry.sections) {
      assert.ok(section.start >= previous, `${slug} 的 start 应单调不减`)
      assert.ok(section.start <= entry.text.length, `${slug} 的 start 应在文本范围内`)
      previous = section.start
    }
  }
})

test('小节切分与该小节标题下的正文一致', { skip: !hasDb }, () => {
  const entry = index['wenda-business-01']
  assert.equal(entry.sections.length, 2)
  assert.equal(entry.sections[0].id, '第一节-伟大企业的标准')
  assert.equal(entry.sections[0].start, 0, '首个标题紧跟文章开头时小节从 0 开始')

  const first = entry.text.slice(entry.sections[0].start, entry.sections[1].start)
  assert.ok(first.includes('伟大企业的定义如下'))
  assert.ok(!first.includes('长坡厚雪'), '第一节不应包含第二节的小节名')
  assert.ok(!first.includes(entry.sections[0].h), '正文里不应重复小节标题')

  // 第二节正文里没有"长坡厚雪"这四个字（只有小节名里有），正好验证「只搜到小节名」
  // 时依然能跳到该小节
  const second = entry.text.slice(entry.sections[1].start)
  assert.equal(entry.sections[1].h, '第二节 长坡厚雪')
  assert.ok(!second.includes('长坡厚雪'))
  assert.ok(second.includes('长长的坡上滚着厚厚的雪'))
})

test('无标题的文章（访谈实录）sections 为空但仍可搜索', { skip: !hasDb }, () => {
  const speech = Object.entries(index).find(([, entry]) => entry.sections.length === 0)
  assert.ok(speech, '应存在没有小节的文章')
  const [slug, entry] = speech
  assert.ok(entry.text.length > 100)
  const { results } = searchIndex(index, entry.text.slice(20, 26))
  assert.ok(results.some((result) => result.slug === slug), `应能搜到 ${slug}`)
})

test('搜到的结果带小节锚点，可定位到该小节标题', { skip: !hasDb }, () => {
  const { results } = searchIndex(index, '长坡厚雪')
  assert.ok(results.length > 0)

  const hit = results.find((result) => result.slug === 'wenda-business-01')
  assert.ok(hit, '应命中 wenda-business-01')
  assert.equal(hit.headingId, '第二节-长坡厚雪')
  assert.ok(hit.snippet.segments.some((segment) => segment.hit))
  assert.ok(hit.snippet.segments.filter((segment) => segment.hit).every((segment) => segment.text.includes('长坡厚雪')))
})

test('同一篇文章多个小节命中时给出多条结果，锚点各不相同', { skip: !hasDb }, () => {
  const { results } = searchIndex(index, '段永平')
  const bySlug = new Map()
  for (const result of results) bySlug.set(result.slug, (bySlug.get(result.slug) || 0) + 1)

  const multi = [...bySlug.entries()].filter(([, count]) => count > 1)
  assert.ok(multi.length > 0, '应有文章命中多个小节')

  for (const [slug] of multi) {
    const anchors = results.filter((result) => result.slug === slug).map((result) => result.headingId)
    assert.equal(new Set(anchors).size, anchors.length, `${slug} 的锚点不应重复`)
  }
})

test('每篇文章的结果数量与总数都受限，避免浮层被单篇刷屏', { skip: !hasDb }, () => {
  const { results, total } = searchIndex(index, '段永平')
  assert.ok(total > results.length || total === results.length)

  const counts = new Map()
  for (const result of results) counts.set(result.slug, (counts.get(result.slug) || 0) + 1)
  for (const [slug, count] of counts) assert.ok(count <= 4, `${slug} 不应超过 4 条`)

  const capped = searchIndex(index, '段永平', { limit: 5 })
  assert.equal(capped.results.length, 5)
  assert.equal(capped.total, total)
})

test('标题命中排在正文命中之前', { skip: !hasDb }, () => {
  const { results } = searchIndex(index, '长坡厚雪')
  const ranks = results.map((result) => result.matchRank)
  assert.deepEqual(ranks, [...ranks].sort((left, right) => left - right))
  assert.ok(results.some((result) => result.titleHit || result.matchRank === 0))
})

test('空查询不返回结果', { skip: !hasDb }, () => {
  assert.deepEqual(searchIndex(index, ''), { results: [], total: 0 })
  assert.deepEqual(searchIndex(index, '   '), { results: [], total: 0 })
})

test('章节标题带「第N章」前缀显示', () => {
  assert.equal(displayLabel({ type: 'qanda-chapter', title: '品牌没有溢价', chapterOrder: 3 }), '第三章 品牌没有溢价')
  assert.equal(displayLabel({ type: 'company', title: '苹果' }), '苹果')
  assert.equal(displayLabel({ type: 'qanda-chapter', title: '主题目录' }), '主题目录')
})

test('flattenBody 不会跨段落误匹配，段落之间保留空格', () => {
  const value = [
    // h1 与 h2 之间没有正文：连续标题里前一个切不出内容，只保留带正文的那个
    ['h1', { id: 't' }, '标题'],
    ['h2', { id: 'a' }, '第一节'],
    ['p', {}, '前半段'],
    ['p', {}, '后半段'],
    ['h2', { id: 'b' }, '第二节'],
    ['p', {}, '尾'],
  ]
  const { text, sections } = flattenBody(value)
  assert.equal(text, '前半段 后半段 尾')
  assert.ok(!text.includes('前半段后半段'), '段落之间必须留空格')

  assert.deepEqual(sections.map((section) => [section.id, section.h]), [
    ['a', '第一节'],
    ['b', '第二节'],
  ])

  // 小节范围必须严丝合缝：甲段结尾 = 乙段开头，既不留缝也不重叠
  const slice = (index) => text.slice(sections[index].start, sections[index + 1]?.start ?? text.length)
  assert.ok(slice(0).startsWith('前半段 后半段'))
  assert.equal(slice(1).trim(), '尾')
})

test('flattenBody 处理行内链接、列表与重复标题', () => {
  const value = [
    ['h2', { id: 'x' }, '重复'],
    ['p', {}, '正文一'],
    ['h2', { id: 'x-1' }, '重复'],
    ['ul', {}, ['li', {}, '甲'], ['li', {}, '乙']],
    ['p', {}, '见', ['a', { href: '/jiazhitouzi' }, '价值投资'], '一文'],
  ]
  const { text, sections } = flattenBody(value)
  assert.deepEqual(sections.map((section) => section.id), ['x', 'x-1'])
  assert.ok(text.includes('甲 乙'))
  assert.ok(text.includes('见 价值投资 一文'))
})

test('flattenBody 跳过空段落与脚本内容', () => {
  const value = [
    ['p', {}, ' '],
    ['script', {}, 'var a = 1'],
    ['p', {}, '正文'],
  ]
  const { text } = flattenBody(value)
  assert.equal(text, '正文')
})

test('片段：重叠区间合并，命中分段只含命中词', () => {
  const ranges = matchRanges('价值投资 价值投资', ['价值投资', '投资'])
  assert.deepEqual(ranges, [[0, 4], [5, 9]])

  const text = `${'前'.repeat(30)}价值投资${'后'.repeat(30)}`
  const snippet = buildSnippet(text, matchRanges(text, ['价值投资']), { before: 10, after: 10 })
  assert.ok(snippet)
  assert.equal(snippet.text.length, 24)
  assert.equal(snippet.segments.filter((segment) => segment.hit).map((segment) => segment.text).join(''), '价值投资')
  assert.equal(snippet.truncatedStart, true)
  assert.equal(snippet.truncatedEnd, true)
})

test('片段：正则元字符按字面量处理，token 大小写不敏感', () => {
  const text = 'PE（市盈率）与 10% 的 (a+b)'
  for (const token of ['10%', '(a+b)', 'pe（市盈率）', '市盈率']) {
    const snippet = buildSnippet(text, matchRanges(text, [token]))
    assert.ok(snippet, `${token} 应能命中`)
    assert.ok(snippet.segments.some((segment) => segment.hit))
  }
})

test('片段：截断标记指示前后还有内容', () => {
  const text = `${'前'.repeat(200)}命中${'后'.repeat(200)}`
  const snippet = buildSnippet(text, matchRanges(text, ['命中']))
  assert.equal(snippet.truncatedStart, true)
  assert.equal(snippet.truncatedEnd, true)
  assert.ok(snippet.text.length < text.length)
})

test('sectionIndexAt：命中在首个标题之前返回 -1', () => {
  const entry = { sections: [{ id: 'a', start: 10 }, { id: 'b', start: 40 }] }
  assert.equal(sectionIndexAt(entry, 0), -1)
  assert.equal(sectionIndexAt(entry, 10), 0)
  assert.equal(sectionIndexAt(entry, 39), 0)
  assert.equal(sectionIndexAt(entry, 40), 1)
  assert.equal(sectionIndexAt({}, 5), -1)
})

test('queryTokens 折叠空白并小写', () => {
  assert.deepEqual(queryTokens('  段永平   Apple '), ['段永平', 'apple'])
})
