// 跳到文章内锚点的工具。
//
// 正文滚动发生在 layout 的 .main-area（overflow-y: auto）里，不是 window，
// 所以不能依赖浏览器原生 hash 滚动；这里自己找滚动容器再滚。

function resolveScroller(element: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = element.parentElement
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node
    node = node.parentElement
  }
  return window
}

/**
 * 在正文里找锚点元素。id 里可能含中文/空格（MDC 生成），getElementById 兼容。
 */
export function findAnchorTarget(id: string): HTMLElement | null {
  if (!id) return null
  const root = document.getElementById('article-share-content')
  const scope: ParentNode = root || document
  return scope.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)
    || document.getElementById(id)
}

/**
 * 平滑滚到锚点位置，并给被定位的标题一个短暂高亮，让用户知道落点在哪。
 *
 * @param id 小节锚点 id
 * @param options.offset 标题上方预留的空白（移动端有 58px 吸顶栏）
 * @param options.reassert 稍后再校正一次位置：客户端跳转时可能有别的滚动
 *        （布局的"回顶部"、浏览器滚动恢复）排在本函数之后执行
 * @returns 是否真的找到了目标
 */
export function scrollToAnchor(id: string, options: { offset?: number, flash?: boolean, reassert?: boolean } = {}): boolean {
  const element = findAnchorTarget(id)
  if (!element) return false

  const offset = options.offset ?? 72
  const scroller = resolveScroller(element)

  // 目标当前离滚动容器顶部的距离（未减 offset）
  const measure = () => (scroller === window
    ? window.scrollY + element.getBoundingClientRect().top
    : (scroller as HTMLElement).scrollTop + element.getBoundingClientRect().top
      - (scroller as HTMLElement).getBoundingClientRect().top)

  const scrollTo = (top: number, behavior: ScrollBehavior) => {
    const target = Math.max(0, top - offset)
    if (scroller === window) window.scrollTo({ top: target, behavior })
    else (scroller as HTMLElement).scrollTo({ top: target, behavior })
  }

  scrollTo(measure(), 'smooth')

  if (options.reassert) {
    // 用户在动画期间自己滚了就别再纠正，否则会有"被拽回去"的感觉
    let userMoved = false
    const onUserScroll = () => { userMoved = true }
    scroller.addEventListener('wheel', onUserScroll, { passive: true, once: true })
    scroller.addEventListener('touchstart', onUserScroll, { passive: true, once: true })

    window.setTimeout(() => {
      if (!userMoved) scrollTo(measure(), 'instant')
      scroller.removeEventListener('wheel', onUserScroll)
      scroller.removeEventListener('touchstart', onUserScroll)
    }, 450)
  }

  if (options.flash !== false) {
    element.classList.remove('anchor-flash')
    // 强制 reflow，保证同一个锚点连续跳两次时动画能重放
    void element.offsetWidth
    element.classList.add('anchor-flash')
    window.setTimeout(() => element.classList.remove('anchor-flash'), 1600)
  }

  return true
}
