// 搜索命中关键词在正文里的临时高亮。
//
// 用 DOM 包裹而不是改渲染输出：正文来自预渲染 payload，重渲染代价大且会破坏
// 已有的锚点/评论挂载；这里只在 #article-share-content 的文本节点上做包裹，
// 几秒后原样撤回，并可随时清理（路由切换 / 组件卸载）。

const MARK_CLASS = 'search-hit'
const WRAP_SELECTOR = `mark.${MARK_CLASS}`

/** 这些元素里的文本不包裹：会破坏排版或语义 */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'A', 'MARK', 'TEXTAREA', 'INPUT'])

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}

/**
 * 在某个容器内高亮命中词。
 *
 * @param terms 检索词（未小写、未分词都可以，这里统一处理）
 * @param options.max 最多包裹多少处，避免长文章里铺满高亮
 * @returns 实际插入的 <mark> 数量
 */
export function highlightTerms(container: HTMLElement | null, terms: string[], options: { max?: number } = {}): number {
  if (!container || !terms.length) return 0

  const tokens = [...new Set(
    terms
      .flatMap((term) => String(term || '').toLocaleLowerCase('zh-CN').split(/\s+/))
      .map((token) => token.trim())
      .filter(Boolean),
  )]
  if (!tokens.length) return 0

  const max = options.max ?? 20
  const patterns = tokens.map((token) => new RegExp(escapeRegExp(token), 'i'))
  let wrapped = 0

  for (const node of collectTextNodes(container)) {
    if (wrapped >= max) break

    const text = node.nodeValue || ''
    // 命中位置：同一段里多个词取最早的第一个
    let matchStart = -1
    let matchEnd = -1
    for (const pattern of patterns) {
      const found = pattern.exec(text)
      if (!found || !found[0].length) continue
      if (matchStart === -1 || found.index < matchStart) {
        matchStart = found.index
        matchEnd = found.index + found[0].length
      }
    }
    if (matchStart === -1) continue

    const range = document.createRange()
    range.setStart(node, matchStart)
    range.setEnd(node, matchEnd)

    const mark = document.createElement('mark')
    mark.className = MARK_CLASS
    try {
      range.surroundContents(mark)
      wrapped += 1
    } catch {
      // surroundContents 在跨元素边界时会抛错，跳过这一处即可
    }
  }

  return wrapped
}

/** 撤回所有高亮并合并被拆开的文本节点 */
export function clearHighlights(container: HTMLElement | null): void {
  if (!container) return

  const marks = [...container.querySelectorAll(WRAP_SELECTOR)]
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
    parent.normalize()
  }
}
