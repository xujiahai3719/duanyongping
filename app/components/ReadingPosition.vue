<script setup lang="ts">
const props = defineProps<{
  slug: string
}>()

interface SavedPosition {
  i: number
  o: number
}

// 保存语义上的正文块及块内偏移，字号或窗口宽度变化后仍能回到相近内容。
const BLOCK_SELECTOR = 'p, h2, h3, h4, blockquote, li, pre, figure, table'
const REFERENCE_LINE = 100
const SAVE_DELAY_MS = 400

const storageKey = computed(() => `dyp:read-pos:${props.slug}`)

let scroller: HTMLElement | Window | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let restoreFrame: number | null = null

function currentScroller(): HTMLElement | Window {
  return scroller || window
}

function isWindow(target: HTMLElement | Window): target is Window {
  return target === window
}

function resolveScroller(): HTMLElement | Window {
  let el = document.getElementById('article-share-content')?.parentElement || null
  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return el
    el = el.parentElement
  }
  return window
}

function getScrollTop(): number {
  const target = currentScroller()
  return isWindow(target) ? target.scrollY : target.scrollTop
}

function getViewportHeight(): number {
  const target = currentScroller()
  return isWindow(target) ? target.innerHeight : target.clientHeight
}

function getContentHeight(): number {
  const target = currentScroller()
  return isWindow(target) ? document.documentElement.scrollHeight : target.scrollHeight
}

function getScrollerTop(): number {
  const target = currentScroller()
  return isWindow(target) ? 0 : target.getBoundingClientRect().top
}

function getBlocks(): HTMLElement[] {
  const root = document.getElementById('article-share-content')
  return root ? Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) : []
}

function removeSavedPosition() {
  try {
    localStorage.removeItem(storageKey.value)
  } catch {
    // 存储不可用时，阅读本身不应受到影响。
  }
}

function readSavedPosition(): SavedPosition | null {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { i?: unknown, o?: unknown }
    if (!Number.isInteger(parsed.i) || Number(parsed.i) <= 0) return null
    return {
      i: Number(parsed.i),
      // 兼容旧记录：旧版只保存块索引，并把目标块放在距顶部约 80px 处。
      o: Number.isFinite(parsed.o) ? Math.max(0, Number(parsed.o)) : 20,
    }
  } catch {
    return null
  }
}

function nearBottom(): boolean {
  return getScrollTop() + getViewportHeight() >= getContentHeight() - 200
}

function save() {
  const top = getScrollTop()
  if (nearBottom() || top < REFERENCE_LINE) {
    removeSavedPosition()
    return
  }

  const blocks = getBlocks()
  const line = getScrollerTop() + REFERENCE_LINE
  let index = 0
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i]!.getBoundingClientRect().top <= line) index = i
    else break
  }

  if (index <= 0) {
    removeSavedPosition()
    return
  }

  const offset = Math.max(0, line - blocks[index]!.getBoundingClientRect().top)
  try {
    localStorage.setItem(storageKey.value, JSON.stringify({ i: index, o: offset, t: Date.now() }))
  } catch {
    // 隐私模式或配额限制下静默放弃。
  }
}

function scheduleSave() {
  if (saveTimer != null) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    save()
  }, SAVE_DELAY_MS)
}

function restore() {
  // hash 表示用户明确指定了落点；浏览器自己恢复过滚动时也不覆盖它。
  if (location.hash || getScrollTop() > REFERENCE_LINE) return

  const saved = readSavedPosition()
  if (!saved) return

  const block = getBlocks()[saved.i]
  if (!block) {
    removeSavedPosition()
    return
  }

  const maxOffset = Math.max(0, block.getBoundingClientRect().height - 1)
  const offset = Math.min(saved.o, maxOffset)
  const top = getScrollTop()
    + block.getBoundingClientRect().top
    - getScrollerTop()
    + offset
    - REFERENCE_LINE
  currentScroller().scrollTo({ top: Math.max(0, top), behavior: 'instant' })
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') save()
}

onMounted(() => {
  nextTick(() => {
    // 等 layout 的路由切换回顶逻辑完成，再执行续读恢复。
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = null
      scroller = resolveScroller()
      restore()
      currentScroller().addEventListener('scroll', scheduleSave, { passive: true })
    })
  })
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', save)
})

onBeforeUnmount(() => {
  // SPA 内切换页面不会触发 pagehide，需要在组件卸载前保存最后位置。
  if (scroller) save()
  currentScroller().removeEventListener('scroll', scheduleSave)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', save)
  if (saveTimer != null) clearTimeout(saveTimer)
  if (restoreFrame != null) cancelAnimationFrame(restoreFrame)
})
</script>

<template>
  <span v-if="false" />
</template>
