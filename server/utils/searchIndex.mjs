// /search-index.json 的构建逻辑。
//
// 刻意放在 .mjs：它既要被 Nitro server route 调用（server/routes/search-index.json.ts），
// 又要被 node --test 直接用真实内容数据验证（tests/search-index.test.mjs），
// 这样算法不必靠"跑一遍构建再看产物"来验证；放在 server/utils 是为了不依赖别名。
//
// 产出的结构见 IndexEntry：
//   text     —— 该文正文纯文本（已小写、已折叠空白），用于命中判断与片段截取
//   sections —— 小节锚点：id 直接取自 minimark AST 里 MDC 生成的 props.id
//                （与页面上 <h2 id="..."> 完全一致，所以不需要重实现 slugify），
//                start 是该小节正文在 text 中的字符偏移，h 是该小节标题文本
//
// 只存"偏移"而不是"每节一段文本"，是为了不把正文存两遍：客户端用相邻 start 切出小节。
// 标题文本不进 text（否则搜小节名会切出没有命中高亮的空片段），单独放 sections[].h 参与匹配。

/** @typedef {string | number | boolean | null | undefined | MinimarkElement | BodyNode[]} BodyNode */
/** @typedef {[string, Record<string, unknown>, ...BodyNode[]]} MinimarkElement */
/** @typedef {{ id: string, start: number, h?: string }} IndexSection */
/**
 * @typedef {object} IndexEntry
 * @property {string} title
 * @property {string} [cat] 分类（category）
 * @property {string} [type] index | company | person | topic | topic-index | qanda-chapter
 * @property {string} [v] volume，投资问答录分卷名
 * @property {number} [n] chapterOrder，投资问答录章节号
 * @property {string} [tag] 供元数据匹配的短语：分卷名 + 类型中文名
 * @property {string} text
 * @property {IndexSection[]} sections
 */
/** @typedef {Record<string, IndexEntry>} SearchIndex */

const SKIP_TAGS = new Set(['script', 'style'])

// li/td/th 是"同一段里的并列项"，文本之间要补一个空格，否则 "甲" "乙" 会粘成 "甲乙"
const INLINE_SEPARATOR_TAGS = new Set(['li', 'td', 'th'])

const SECTION_LEVEL = /^h[1-6]$/

const TYPE_TAGS = {
  index: '概览',
  company: '公司',
  person: '人物',
  topic: '专题',
  'topic-index': '主题总目录',
  'qanda-chapter': '问答章节',
}

/**
 * @param {BodyNode} node
 * @returns {node is MinimarkElement}
 */
function isElement(node) {
  return Array.isArray(node) && typeof node[0] === 'string' && typeof node[1] === 'object' && node[1] !== null
}

/**
 * @param {MinimarkElement} node
 */
function tagOf(node) {
  return node[0].toLocaleLowerCase('en-US')
}

// flattenNode 的产物：正文片段 / 小节边界
/** @typedef {{ kind: 'text', text: string } | { kind: 'section', id: string, h: string }} FlatPiece */

/**
 * 单次 AST 遍历：把 minimark 节点拆成正文片段与小节边界。
 *
 * minimark 元素形如 [tag, props, ...children]，也可能出现"数组套数组"，
 * 所以这里只认 isElement() 判定通过的那种三元结构，其余数组一律当子节点列表继续走。
 *
 * @param {BodyNode} node
 * @param {FlatPiece[]} out
 * @returns {FlatPiece[]}
 */
export function flattenNode(node, out) {
  if (node == null || typeof node === 'boolean') return out

  if (typeof node === 'string' || typeof node === 'number') {
    const raw = String(node).replace(/\s+/g, ' ').trim()
    if (raw) out.push({ kind: 'text', text: raw })
    return out
  }

  if (!Array.isArray(node)) return out

  // 非元素数组：当子节点列表继续走
  if (!isElement(node)) {
    for (const child of node) flattenNode(child, out)
    return out
  }

  const tag = tagOf(node)
  if (SKIP_TAGS.has(tag)) return out

  if (SECTION_LEVEL.test(tag)) {
    const id = typeof node[1].id === 'string' ? node[1].id : ''
    const heading = textOf(node).toLocaleLowerCase('zh-CN')
    // 标题文本不进 text（否则搜小节名会切出没有命中高亮的空片段），
    // 只记一个小节边界；id 用 MDC 生成的 props.id，与页面 <h2 id> 一致
    if (id && heading) out.push({ kind: 'section', id, h: heading })
    return out
  }

  // 块级元素本身就是"段"的边界：相邻两段最终会被 join(' ') 分开，这里不需要再插占位。
  // 唯一例外是同一段内的并列项（li/td/th），它们之间必须显式补一个空格。
  if (INLINE_SEPARATOR_TAGS.has(tag)) out.push({ kind: 'text', text: ' ' })

  for (const child of node.slice(2)) flattenNode(child, out)
  return out
}

/**
 * 把 minimark AST 拍平成「纯文本 + 小节锚点」。
 *
 * 两遍构建，不靠"累计长度"预估偏移：
 *   第一遍 flattenNode 拆出正文片段与小节边界（文本片段带序号）；
 *   第二遍按 parts.join(' ') 的真实下标定位每段起点（partStarts），
 *   小节正文 = 紧跟该标题的那个片段的起点（把前面那个分隔空格一并算进小节范围）。
 *
 * 分隔空格还有个作用：文本不会跨段落误匹配。
 *
 * @param {BodyNode[] | undefined} value
 * @returns {{ text: string, sections: IndexSection[] }}
 */
export function flattenBody(value) {
  /** @type {FlatPiece[]} */
  const pieces = []
  for (const node of value || []) flattenNode(node, pieces)

  /** @type {string[]} */
  const parts = []
  /** @type {Array<{ id: string, h: string, partIndex: number }>} */
  const boundaries = []

  for (const piece of pieces) {
    if (piece.kind === 'text') {
      parts.push(piece.text)
      continue
    }
    // 标题之后的下一个文本片段就是该小节的正文（标题自身不产生片段）
    boundaries.push({ id: piece.id, h: piece.h, partIndex: parts.length })
  }

  // 每段在最终 text 里的真实起始下标：边拼边记，不做事后估算
  // （事后按"[累计长度 + 1]"估算会与 join 后的折叠空格对不上）
  /** @type {number[]} */
  const partStarts = []
  /** @type {string[]} */
  const textParts = []
  let cursor = 0
  for (const part of parts) {
    partStarts.push(cursor)
    textParts.push(part)
    cursor += part.length + 1
  }

  const text = textParts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('zh-CN')

  // 小节的正文范围 = [partIndex, 下一个标题的 partIndex)；
  // 首尾的**空片段**（块级占位产生的 ""）不属于任何小节，必须排除，
  // 否则小节起点会落在占位符上、切片还会把上一小节的尾巴带进来。
  /** @type {Array<{ id: string, h: string, from: number, to: number }>} */
  const ranges = []
  for (let index = 0; index < boundaries.length; index++) {
    const rawFrom = boundaries[index].partIndex
    const rawTo = boundaries[index + 1]?.partIndex ?? parts.length

    // 跳过紧跟在标题后面的空片段（块级占位产生的 ""），它们不属于正文
    let from = rawFrom
    while (from < rawTo && parts[from].trim() === '') from += 1

    let to = rawTo
    while (to > from && parts[to - 1].trim() === '') to -= 1

    ranges.push({ id: boundaries[index].id, h: boundaries[index].h, from, to })
  }

  /** @type {IndexSection[]} */
  const sections = []
  for (const range of ranges) {
    // 标题下面确实有正文才算一个可跳转的小节
    if (range.to <= range.from) continue

    const partStart = partStarts[range.from]
    sections.push({
      id: range.id,
      // 前一个分隔空格也属于本小节，好让相邻小节的切片刚好衔接
      start: Math.max(0, partStart - 1),
      h: range.h,
    })
  }

  return { text, sections: clampSections(sections, text) }
}

// 标题自身的纯文本（拼接所有后代的字符串/数字节点）
/**
 * @param {MinimarkElement} node
 * @returns {string}
 */
function textOf(node) {
  /** @type {string[]} */
  const out = []
  /** @param {BodyNode} child */
  const collect = (child) => {
    if (child == null) return
    if (typeof child === 'string' || typeof child === 'number') {
      out.push(String(child))
      return
    }
    if (Array.isArray(child) && isElement(child)) {
      for (const grandChild of child.slice(2)) collect(grandChild)
    }
  }
  for (const child of node.slice(2)) collect(child)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

// 相邻 start 必须单调不减，否则切分会错位
/**
 * @param {IndexSection[]} sections
 * @param {string} text
 * @returns {IndexSection[]}
 */
function clampSections(sections, text) {
  /** @type {IndexSection[]} */
  const out = []
  for (const section of sections) {
    const start = Math.min(section.start, text.length)
    const previous = out[out.length - 1]
    if (previous && start < previous.start) continue
    out.push({ ...section, start })
  }
  return out
}

/**
 * @param {Array<Record<string, any>>} items
 * @returns {SearchIndex}
 */
export function buildIndex(items) {
  /** @type {SearchIndex} */
  const index = {}

  for (const item of items) {
    if (!item?.slug || item.type === 'legacy-index') continue

    const flat = flattenBody(item.body?.value)
    if (!flat.text) continue

    const tag = [item.volume, TYPE_TAGS[item.type]].filter(Boolean).join(' ')

    /** @type {IndexEntry} */
    const entry = {
      title: String(item.title || item.slug),
      text: flat.text,
      sections: flat.sections,
    }
    if (item.category) entry.cat = String(item.category)
    if (item.type) entry.type = String(item.type)
    if (item.volume) entry.v = String(item.volume)
    if (typeof item.chapterOrder === 'number') entry.n = item.chapterOrder
    if (tag) entry.tag = tag.toLocaleLowerCase('zh-CN')

    index[String(item.slug)] = entry
  }

  return index
}
