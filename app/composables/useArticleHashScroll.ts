// 带 #锚点 进入文章时：滚动到对应小节，并把搜索命中的关键词临时高亮。
//
// 两种来源共用这一条路径：
//   1. 搜索结果点击（LibrarySidebar 先写 sessionStorage，再带着 hash 跳转）；
//   2. 直接分享/粘贴带锚点的链接（此时没有关键词，只有滚动与落点提示）。
//
// 文章页的滚动容器是 layout 的 .main-area，原生 hash 滚动不生效，所以必须自己滚。

import { scrollToAnchor } from '~/utils/scrollToAnchor'
import { clearHighlights, highlightTerms } from '~/utils/highlightTerms'

const TERMS_KEY = 'dyp:search-terms'
const HIGHLIGHT_MS = 4000
const CONTENT_ID = 'article-share-content'

/** 只认"刚刚提交的"检索词，避免很久以后再打开文章时还去高亮 */
function takePendingTerms(): string[] {
  try {
    const raw = sessionStorage.getItem(TERMS_KEY)
    if (!raw) return []
    sessionStorage.removeItem(TERMS_KEY)

    const parsed = JSON.parse(raw) as { terms?: string[], at?: number }
    if (!parsed || !Array.isArray(parsed.terms)) return []
    if (parsed.at && Date.now() - parsed.at > 60_000) return []
    return parsed.terms.map((term) => String(term)).filter(Boolean)
  } catch {
    return []
  }
}

/** 记录本次检索词，供文章页读取（跳转前调用） */
export function rememberSearchTerms(terms: string[]): void {
  if (!terms.length) return
  try {
    sessionStorage.setItem(TERMS_KEY, JSON.stringify({ terms, at: Date.now() }))
  } catch {
    // sessionStorage 不可用时静默放弃：只是少了个高亮
  }
}

export function useArticleHashScroll(options: { terms?: () => string[] } = {}) {
  const route = useRoute()
  const container = () => document.getElementById(CONTENT_ID)

  let highlightTimer: ReturnType<typeof setTimeout> | null = null
  let scrollFrame: number | null = null
  let scrollDeadline = 0

  function stopPendingScroll() {
    if (scrollFrame != null) {
      cancelAnimationFrame(scrollFrame)
      scrollFrame = null
    }
  }

  function scheduleHighlight(terms: string[]) {
    if (highlightTimer) clearTimeout(highlightTimer)
    clearHighlights(container())
    if (!terms.length) return

    // 等正文渲染完（客户端跳转时 payload 同步，一般首帧就有内容）
    nextTick(() => {
      highlightTerms(container(), terms)
      highlightTimer = setTimeout(() => clearHighlights(container()), HIGHLIGHT_MS)
    })
  }

  /**
   * 目标元素可能比路由晚一两帧才挂载（尤其客户端跳转），所以短轮询重试。
   */
  function scrollToHash(hash: string) {
    const id = decodeURIComponent(hash.replace(/^#/, ''))
    if (!id) return

    stopPendingScroll()
    scrollDeadline = performance.now() + 800

    const attempt = () => {
      if (scrollToAnchor(id, { reassert: true })) {
        scrollFrame = null
        return
      }
      if (performance.now() > scrollDeadline) {
        scrollFrame = null
        return
      }
      scrollFrame = requestAnimationFrame(attempt)
    }

    nextTick(attempt)
  }

  function run() {
    const hash = route.hash
    if (!hash) return
    scrollToHash(hash)
  }

  onMounted(() => {
    nextTick(() => {
      // 只有带锚点的跳转才取用检索词：普通浏览不该被"上次搜的词"高亮打扰
      const terms = route.hash ? (options.terms?.() || takePendingTerms()) : []
      run()
      if (terms.length) scheduleHighlight(terms)
    })
  })

  // 同一篇文章内换锚点（点浮层里另一条结果）：不触发组件重建，需要单独响应
  watch(() => route.hash, (hash, previous) => {
    if (!hash || hash === previous) return
    nextTick(() => {
      scrollToHash(hash)
      const terms = takePendingTerms()
      if (terms.length) scheduleHighlight(terms)
    })
  })

  onBeforeUnmount(() => {
    stopPendingScroll()
    if (highlightTimer) clearTimeout(highlightTimer)
    clearHighlights(container())
  })
}
