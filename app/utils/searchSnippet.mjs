// 搜索命中片段、高亮分段，以及索引检索（排序 / 去重 / 截断）。
//
// 放在 .mjs 是为了能直接单测（tests/search-index.test.mjs）。片段里需要高亮的
// 命中词只以「分段」形式返回，不做 HTML 拼接，渲染端一律用文本插值，避免 v-html。

import { chineseNumber } from './chineseNumber.mjs'

/** @typedef {{ text: string, hit: boolean }} SnippetSegment */
/** @typedef {{ text: string, truncatedStart: boolean, truncatedEnd: boolean, segments: SnippetSegment[] }} Snippet */
/** @typedef {{ title?: string, cat?: string, type?: string, v?: string, n?: number, tag?: string, text?: string, sections?: Array<{ id: string, start: number, h?: string }> }} SearchEntry */
/** @typedef {{ title?: string, category?: string, description?: string, chapterOrder?: number, volume?: string, type?: string }} SearchMeta */
/** @typedef {{ slug: string, matchRank: number, titleHit: boolean, headingId: string, sectionIndex: number, snippet: Snippet | null }} SearchRow */
/** @typedef {{ slug: string, title: string, label: string, cat: string, sectionLabel: string, matchRank: number, titleHit: boolean, headingId: string, sectionIndex: number, snippet: Snippet | null }} SearchResult */

export const DEFAULT_PAGE_SIZE = 40
export const DEFAULT_ROWS_PER_ENTRY = 4
export const DEFAULT_BEFORE = 90
export const DEFAULT_AFTER = 120

export const MATCH_TITLE = 0
export const MATCH_META = 1
export const MATCH_CONTENT = 2

const TYPE_LABELS = {
  index: '概览',
  company: '公司',
  person: '人物',
  topic: '专题',
  'topic-index': '主题总目录',
  'qanda-chapter': '问答章节',
}

/**
 * 与侧边栏过滤保持一致：小写 + 折叠空白。
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeQuery(value) {
  return String(value ?? '').toLocaleLowerCase('zh-CN').trim().replace(/\s+/g, ' ')
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function queryTokens(value) {
  const normalized = normalizeQuery(value)
  return normalized ? normalized.split(' ').filter(Boolean) : []
}

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 用 | 合并所有 token：只要拿到命中位置，不依赖任何正则方言。
// token 一律先过 normalizeQuery，避免调用方漏了小写而与索引文本对不上。
/**
 * @param {string[]} tokens
 * @returns {RegExp | null}
 */
export function buildMatchRegex(tokens) {
  const escaped = queryTokens(tokens.join(' ')).map(escapeRegExp)
  if (!escaped.length) return null
  return new RegExp(escaped.join('|'), 'g')
}

/**
 * 收集 [start, end) 命中区间，重叠/相邻的合并（英文多词查询不该被切成碎片）。
 *
 * @param {string} text
 * @param {string[]} tokens
 * @returns {Array<[number, number]>}
 */
export function matchRanges(text, tokens) {
  const regex = buildMatchRegex(tokens)
  if (!regex || !text) return []

  // 只小写、不折叠空白：偏移必须与传入文本一一对应，索引文本本身就是折叠过的
  const haystack = text.toLocaleLowerCase('zh-CN')

  /** @type {Array<[number, number]>} */
  const ranges = []
  for (const match of haystack.matchAll(regex)) {
    if (!match[0].length) continue

    const start = match.index ?? 0
    const end = start + match[0].length
    const last = ranges[ranges.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else ranges.push([start, end])
  }

  return ranges
}

/**
 * 取命中点前后的一个小窗口，并切成「命中 / 非命中」分段。
 *
 * @param {string} text
 * @param {Array<[number, number]>} ranges
 * @param {{ before?: number, after?: number, maxHits?: number }} [options]
 * @returns {Snippet | null}
 */
export function buildSnippet(text, ranges, options = {}) {
  if (!text || !ranges.length) return null

  const before = options.before ?? DEFAULT_BEFORE
  const after = options.after ?? DEFAULT_AFTER
  const maxHits = options.maxHits ?? 6

  const [firstStart, firstEnd] = ranges[0]
  const start = Math.max(0, firstStart - before)
  const end = Math.min(text.length, firstEnd + after)

  /** @type {SnippetSegment[]} */
  const segments = []
  let cursor = start

  for (const [rangeStart, rangeEnd] of ranges.slice(0, maxHits)) {
    if (rangeEnd <= start) continue
    if (rangeStart >= end) break

    const hitStart = Math.max(rangeStart, start)
    const hitEnd = Math.min(rangeEnd, end)
    if (hitEnd <= hitStart) continue

    if (hitStart > cursor) segments.push({ text: text.slice(cursor, hitStart), hit: false })
    segments.push({ text: text.slice(hitStart, hitEnd), hit: true })
    cursor = hitEnd
  }

  if (cursor < end) segments.push({ text: text.slice(cursor, end), hit: false })
  if (!segments.some((segment) => segment.hit)) return null

  return {
    text: text.slice(start, end),
    truncatedStart: start > 0,
    truncatedEnd: end < text.length,
    segments,
  }
}

/**
 * 组合：给定文本，取首个命中的片段。
 *
 * @param {string} text
 * @param {string[]} tokens
 * @param {{ before?: number, after?: number }} [options]
 * @returns {Snippet | null}
 */
export function snippetFor(text, tokens, options) {
  return buildSnippet(text, matchRanges(text, tokens), options)
}

/**
 * 命中位置 → 小节下标。sections 已按 start 升序（见 searchIndex.mjs）。
 *
 * @param {{ sections?: Array<{ id: string, start: number }> }} entry
 * @param {number} position
 * @returns {number} 命中落在首个标题之前时返回 -1，表示跳文章顶部
 */
export function sectionIndexAt(entry, position) {
  const sections = entry?.sections || []
  let found = -1
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].start <= position) found = i
    else break
  }
  return found
}

/**
 * 页面上的标题带章节前缀（投资问答录），搜索面板照此显示。
 *
 * @param {{ title?: string, type?: string, chapterOrder?: number }} meta
 * @returns {string}
 */
export function displayLabel(meta) {
  const title = meta?.title || ''
  if (meta?.type !== 'qanda-chapter' || !meta.chapterOrder) return title
  return `第${chineseNumber(meta.chapterOrder)}章 ${title}`
}

/**
 * @param {{ category?: string, volume?: string }} meta
 * @returns {string}
 */
export function categoryLabel(meta) {
  return [meta?.category, meta?.volume].filter(Boolean).join(' · ') || '未分类'
}

/**
 * 元数据检索文本（与侧边栏过滤口径一致）。
 *
 * @param {{ title?: string, slug?: string, description?: string, category?: string, volume?: string, type?: string }} meta
 * @returns {string}
 */
export function metaSearchText(meta) {
  return normalizeQuery([
    meta?.title,
    meta?.slug,
    meta?.description,
    meta?.category,
    meta?.volume,
    TYPE_LABELS[meta?.type || ''],
  ].filter(Boolean).join(' '))
}

/**
 * @param {string} haystack
 * @param {string[]} tokens
 */
function containsAll(haystack, tokens) {
  return Boolean(haystack) && tokens.every((token) => haystack.includes(token))
}

/**
 * 把某个小节的命中收成一行结果。
 *
 * 优先用正文命中的片段；只在标题文本命中时，片段退化成标题 + 该小节正文开头，
 * 并把标题部分标成命中（否则用户看到的就是"没有高亮的结果"）。
 *
 * @param {object} params
 * @param {string} params.slug
 * @param {SearchEntry} params.entry
 * @param {string[]} params.tokens
 * @param {boolean} params.titleHit
 * @param {number} params.sectionIndex -1 表示「整篇」范围
 * @param {SearchRow[]} params.rows
 */
function collectSectionRows({ slug, entry, tokens, titleHit, sectionIndex, rows }) {
  const sections = entry.sections || []
  const text = entry.text || ''

  const start = sectionIndex >= 0 ? sections[sectionIndex].start : 0
  const end = sectionIndex >= 0 && sectionIndex + 1 < sections.length
    ? sections[sectionIndex + 1].start
    : text.length

  const chunk = text.slice(start, end)
  const heading = sectionIndex >= 0 ? (sections[sectionIndex].h || '') : ''
  const snippet = snippetFor(chunk, tokens) || snippetForHeading(heading, chunk, tokens)
  if (!snippet) return

  rows.push({
    slug,
    matchRank: MATCH_CONTENT,
    titleHit,
    headingId: sectionIndex >= 0 ? sections[sectionIndex].id : '',
    sectionIndex,
    snippet,
  })
}

/**
 * 标题命中而正文没命中时的片段：「小节标题 + 正文开头」，只标标题里的命中词。
 *
 * @param {string} heading
 * @param {string} chunk
 * @param {string[]} tokens
 * @returns {Snippet | null}
 */
function snippetForHeading(heading, chunk, tokens) {
  if (!heading || !queryTokens(tokens.join(' ')).every((token) => heading.includes(token))) return null

  const tail = chunk.slice(0, 80)
  const source = tail ? `${heading} ${tail}` : heading
  return buildSnippet(source, matchRanges(source, tokens))
}

/**
 * 排序规则：标题命中 < 元数据命中 < 正文命中；同级保持输入顺序（文章顺序）。
 *
 * @param {Record<string, SearchEntry>} index
 * @param {unknown} query
 * @param {object} [options]
 * @param {(slug: string) => SearchMeta | undefined} [options.lookup]
 * @param {number} [options.limit]
 * @param {number} [options.rowsPerEntry]
 * @returns {{ results: SearchResult[], total: number }}
 */
export function searchIndex(index, query, options = {}) {
  const tokens = queryTokens(query)
  const lookup = options.lookup
  const limit = options.limit ?? DEFAULT_PAGE_SIZE
  const rowsPerEntry = options.rowsPerEntry ?? DEFAULT_ROWS_PER_ENTRY

  if (!tokens.length) return { results: [], total: 0 }

  /** @type {Array<{ slug: string, rows: SearchRow[] }>} */
  const grouped = []

  for (const [slug, entry] of Object.entries(index || {})) {
    if (!entry) continue

    const meta = lookup?.(slug)
    const title = normalizeQuery(entry.title || meta?.title || '')
    const titleHit = tokens.every((token) => title.includes(token))
    const metaHit = containsAll([meta ? metaSearchText(meta) : '', entry.tag || ''].filter(Boolean).join(' '), tokens)
    const bodyHit = containsAll(normalizeQuery(entry.text || ''), tokens)
    // 小节标题单独存在 sections[].h 里，不参与 bodyHit，需要单独判定
    const headingHit = (entry.sections || []).some((section) => containsAll(section.h || '', tokens))

    if (!titleHit && !metaHit && !bodyHit && !headingHit) continue

    /** @type {SearchRow[]} */
    const rows = []
    const sections = entry.sections || []
    const text = entry.text || ''

    // 只在正文里逐节找：标题/元数据命中由标题行代表，避免同一处命中出现两遍
    for (let i = 0; i < sections.length; i++) {
      collectSectionRows({ slug, entry, tokens, titleHit, sectionIndex: i, rows })
      if (rows.length >= rowsPerEntry) break
    }

    // 首个标题之前也可能有正文命中（引言段）；没有小节的文章（访谈实录）整篇都算这里
    if (!rows.some((row) => row.sectionIndex === 0)) {
      collectSectionRows({ slug, entry, tokens, titleHit, sectionIndex: -1, rows })
    }

    if (!rows.length && (titleHit || metaHit)) {
      // 只有标题/元数据命中：给一条可跳转的结果，片段用摘要（摘要没命中就退化成正文开头）
      const snippet = (meta?.description ? snippetFor(normalizeQuery(meta.description), tokens) : null)
        || (text ? { text: text.slice(0, 160), truncatedStart: false, truncatedEnd: text.length > 160, segments: [{ text: text.slice(0, 160), hit: false }] } : null)

      rows.push({
        slug,
        matchRank: titleHit ? MATCH_TITLE : MATCH_META,
        titleHit,
        headingId: '',
        sectionIndex: -1,
        snippet,
      })
    }

    if (!rows.length) continue

    rows.sort((left, right) => left.matchRank - right.matchRank)
    grouped.push({ slug, rows: rows.slice(0, rowsPerEntry) })
  }

  const ranked = grouped
    .map((group, order) => ({ group, order, rank: Math.min(...group.rows.map((row) => row.matchRank)) }))
    .sort((left, right) => left.rank - right.rank || left.order - right.order)
    .flatMap((item) => item.group.rows)

  /** @type {SearchResult[]} */
  const results = ranked.slice(0, limit).map((row) => {
    const entry = index[row.slug]
    const meta = lookup?.(row.slug)
    const title = meta?.title || entry?.title || row.slug
    const section = row.sectionIndex >= 0 ? (entry?.sections || [])[row.sectionIndex] : undefined

    return {
      slug: row.slug,
      title,
      label: displayLabel({ ...meta, title }),
      cat: categoryLabel(meta || {}),
      sectionLabel: section?.h || '',
      matchRank: row.matchRank,
      titleHit: row.titleHit,
      headingId: row.headingId,
      sectionIndex: row.sectionIndex,
      snippet: row.snippet,
    }
  })

  return { results, total: ranked.length }
}
