<script setup lang="ts">
// 搜索命中结果浮层：每条 = 文章名 + 分类/小节面包屑 + 正文命中片段（命中词高亮）。
import type { SearchHit } from '~/composables/useArticleSearchIndex'

const props = defineProps<{
  results: SearchHit[]
  total: number
  query: string
  loading: boolean
  failed: boolean
  /**
   * 搜索框（含外框）相对视口的矩形，用来把浮层贴在它正下方。
   * left/right 取自 .sidebar-search 这个带边框的容器，浮层与它左右对齐。
   */
  rect: { left: number, right: number, top: number, bottom: number } | null
}>()

const emit = defineEmits<{
  select: [hit: SearchHit]
  close: []
}>()

const listRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)

/** 浮层位置：与搜索框同宽、左右边缘严格对齐，贴在它正下方（超出视口时自动收窄） */
const panelStyle = computed(() => {
  const rect = props.rect
  if (!rect || typeof window === 'undefined') return {}

  const gap = 6
  // 贴齐搜索框优先：这里只用极小的边距兜住"浮层贴到屏幕边上"的极端情况，
  // 绝不能大到把左边缘从搜索框上顶开（那正是之前没对齐的原因）
  const edgeGuard = 4
  const viewportWidth = window.innerWidth

  const left = Math.max(edgeGuard, rect.left)
  const available = viewportWidth - edgeGuard - left
  const width = Math.min(rect.right - rect.left, available)

  const top = rect.bottom + gap
  const maxHeight = Math.max(200, window.innerHeight - top - 8)

  return {
    left: `${left}px`,
    width: `${width}px`,
    top: `${top}px`,
    maxHeight: `${Math.min(maxHeight, 460)}px`,
  }
})

function crumbText(hit: SearchHit) {
  return [hit.cat, hit.sectionLabel].filter(Boolean).join(' › ')
}

// 与输入框的 aria-activedescendant 对应，屏幕阅读器才知道当前高亮的是哪一条
function rowId(slug: string, headingId: string) {
  return `search-hit-${slug}-${headingId || 'top'}`.replace(/[^a-zA-Z0-9-_]/g, '-')
}

defineExpose({ onKeydown, activeDescendant: computed(() => {
  const hit = props.results[activeIndex.value]
  return hit ? rowId(hit.slug, hit.headingId) : undefined
}) })

function scrollActiveIntoView() {
  const list = listRef.value
  if (!list) return
  const row = list.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
  row?.scrollIntoView({ block: 'nearest' })
}

function move(delta: number) {
  if (!props.results.length) return
  const next = activeIndex.value + delta
  activeIndex.value = Math.max(0, Math.min(props.results.length - 1, next))
  nextTick(scrollActiveIntoView)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
  // Enter 交给侧边栏统一处理（@keydown.enter）：这里再处理一次会跳两回
}

// 结果变化后把高亮复位到第一条
watch(() => props.query, () => {
  activeIndex.value = 0
})
watch(() => props.results.length, (length) => {
  if (activeIndex.value >= length) activeIndex.value = Math.max(0, length - 1)
})

</script>

<template>
  <Teleport to="body">
    <div
      class="search-panel"
      :style="panelStyle"
      role="listbox"
      aria-label="搜索结果"
      @mousedown.prevent
    >
      <p v-if="loading && !results.length" class="search-panel-status">
        <span class="search-panel-spinner" aria-hidden="true" />
        正在检索全文
      </p>
      <p v-else-if="failed" class="search-panel-status">全文暂不可用，已按标题与摘要搜索</p>
      <p v-else-if="!query.trim()" class="search-panel-status">输入关键词搜索标题、摘要与正文</p>
      <p v-else-if="!results.length" class="search-panel-status">没有找到相关文章</p>

      <ul v-else ref="listRef" class="search-panel-list">
        <li
          v-for="(hit, index) in results"
          :key="`${hit.slug}-${hit.headingId}-${index}`"
          :id="rowId(hit.slug, hit.headingId)"
          :data-index="index"
          role="option"
          :aria-selected="index === activeIndex"
          class="search-hit"
          :class="{ active: index === activeIndex }"
          @click="emit('select', hit)"
          @mousemove="activeIndex = index"
        >
          <div class="search-hit-head">
            <span class="search-hit-title">{{ hit.label }}</span>
            <span class="search-hit-rank">{{ hit.titleHit ? '标题' : hit.matchRank === 1 ? '摘要' : '正文' }}</span>
          </div>
          <p v-if="crumbText(hit)" class="search-hit-crumb">{{ crumbText(hit) }}</p>
          <p v-if="hit.snippet" class="search-hit-snippet">
            <span v-if="hit.snippet.truncatedStart">…</span>
            <template v-for="(segment, segmentIndex) in hit.snippet.segments" :key="segmentIndex">
              <em v-if="segment.hit" class="search-hit-mark">{{ segment.text }}</em>
              <template v-else>{{ segment.text }}</template>
            </template>
            <span v-if="hit.snippet.truncatedEnd">…</span>
          </p>
        </li>
      </ul>

      <p v-if="total > results.length" class="search-panel-more">
        还有 {{ total - results.length }} 条命中，继续输入可缩小范围
      </p>
      <p v-else-if="results.length" class="search-panel-more">
        共 {{ total }} 条命中 · ↑↓ 选择，Enter 跳转，Esc 关闭
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.search-panel {
  position: fixed;
  /* 层级约定：页面内容 < 阅读进度条(50) < 移动端遮罩(55)/抽屉(56) < 搜索浮层(60) < 工具面板(80)。
     搜索浮层必须压在移动端遮罩之上，否则点击会被遮罩截胡（曾经就是这样点不动结果行）。 */
  z-index: 60;

  /* 浮层被 Teleport 到 body，脱离了 .sidebar，拿不到那里定义的 --sb-*；
     令牌统一在 main.css 的 :root 里按主题定义，这里只是换个短名字。 */
  --sb-bg: var(--sidebar-token-bg);
  --sb-fg: var(--sidebar-token-fg);
  --sb-muted: var(--sidebar-token-muted);
  --sb-subtle: var(--sidebar-token-subtle);
  --sb-line: var(--sidebar-token-line);
  --sb-surface: var(--sidebar-token-surface);
  --sb-accent: var(--sidebar-token-accent);
  --sb-accent-soft: var(--sidebar-token-accent-soft);

  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--sb-line);
  border-radius: 8px;
  /* 比页面底色略抬一档，三套主题下都读得出是"浮起来的一层" */
  background: color-mix(in srgb, var(--sb-bg) 96%, var(--sb-fg));
  color: var(--sb-fg);
  box-shadow: 0 16px 40px color-mix(in srgb, var(--sb-fg) 18%, transparent);
}

.search-panel-status {
  margin: 0;
  padding: 14px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sb-subtle);
}

.search-panel-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border: 1.5px solid color-mix(in srgb, var(--sb-subtle) 30%, transparent);
  border-top-color: var(--sb-accent);
  border-radius: 50%;
  animation: search-panel-spin 0.7s linear infinite;
}

@keyframes search-panel-spin {
  to { transform: rotate(360deg); }
}

.search-panel-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.search-hit {
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s var(--ease-out, ease-out);
}

.search-hit + .search-hit {
  border-top: 1px solid color-mix(in srgb, var(--sb-line) 45%, transparent);
}

.search-hit.active {
  background: var(--sb-accent-soft);
}

.search-hit-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.search-hit-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--sb-fg);
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.search-hit-rank {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--sb-fg) 6%, transparent);
  font-size: 9px;
  font-weight: 600;
  color: var(--sb-subtle);
}

.search-hit.active .search-hit-rank {
  background: var(--sb-accent-soft);
  color: var(--sb-accent);
}

.search-hit-crumb {
  margin: 3px 0 0;
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--sb-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-hit-snippet {
  margin: 4px 0 0;
  font-family: var(--reading, inherit);
  font-size: 12px;
  line-height: 1.6;
  color: var(--sb-muted);
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.search-hit-mark {
  padding: 0 1px;
  border-radius: 2px;
  background: var(--sb-accent-soft);
  color: var(--sb-accent);
  font-style: normal;
  font-weight: 600;
}

.search-panel-more {
  flex-shrink: 0;
  margin: 0;
  padding: 7px 12px;
  border-top: 1px solid color-mix(in srgb, var(--sb-line) 60%, transparent);
  background: color-mix(in srgb, var(--sb-bg) 92%, var(--sb-fg));
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--sb-subtle);
}

@media (prefers-reduced-motion: reduce) {
  .search-hit,
  .search-panel-spinner {
    transition: none;
    animation: none;
  }
}
</style>
