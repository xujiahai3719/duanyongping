<script setup lang="ts">
import type { Theme } from '~/composables/useTheme'
import { chapterLabel } from '~/utils/chineseNumber.mjs'
import { rememberSearchTerms } from '~/composables/useArticleHashScroll'
import type { SearchHit } from '~/composables/useArticleSearchIndex'

type Article = {
  title: string
  slug: string
  category: string
  order: number
  type?: string
  description?: string
  volume?: string
  volumeOrder?: number
  chapterOrder?: number
}

const props = defineProps<{
  sections: Array<{
    name: string
    articles: Article[]
    categoryOrder?: string[]
  }>
  currentSlug: string
  theme: Theme
}>()

const emit = defineEmits<{
  selectTheme: [theme: Theme]
}>()

type ArticleSubgroup = { label: string; items: Article[] }
type Group = { category: string; items: Article[]; count: number; subgroups: ArticleSubgroup[] }

const articleTypeLabels: Record<string, string> = {
  index: '概览',
  company: '公司',
  person: '人物',
  topic: '专题',
  'topic-index': '主题总目录',
}

const articleTypeOrder = ['index', 'company', 'person', 'topic']

function getSubgroups(category: string, items: Article[]): ArticleSubgroup[] {
  if (category === '投资问答录') {
    const index = items.filter((item) => item.type === 'topic-index')
    const volumes = new Map<string, Article[]>()
    for (const item of items.filter((article) => article.type === 'qanda-chapter')) {
      const label = item.volume || '其他'
      const list = volumes.get(label) || []
      list.push(item)
      volumes.set(label, list)
    }
    const volumeGroups = [...volumes.entries()]
      .sort((left, right) => (left[1][0]?.volumeOrder || 999) - (right[1][0]?.volumeOrder || 999))
      .map(([label, volumeItems]) => ({
        label,
        items: volumeItems.sort((left, right) => (left.chapterOrder || 999) - (right.chapterOrder || 999)),
      }))
    return [
      ...(index.length ? [{ label: '主题总目录', items: index }] : []),
      ...volumeGroups,
    ]
  }

  if (category !== '公司与人物') {
    return [{ label: '', items }]
  }

  const map = new Map<string, Article[]>()
  for (const item of items) {
    const type = item.type || 'other'
    const list = map.get(type) || []
    list.push(item)
    map.set(type, list)
  }

  const orderedTypes = [
    ...articleTypeOrder.filter((type) => map.has(type)),
    ...Array.from(map.keys()).filter((type) => !articleTypeOrder.includes(type)),
  ]

  return orderedTypes.map((type) => ({
    label: articleTypeLabels[type] || '其他',
    items: map.get(type)!,
  }))
}

// Flatten: since there's only one section, go straight to categories
const groups = computed(() => {
  const section = props.sections[0]
  if (!section) return []

  const map = new Map<string, Article[]>()
  for (const article of section.articles) {
    const list = map.get(article.category) || []
    list.push(article)
    map.set(article.category, list)
  }

  const categoryOrder = section.categoryOrder || []
  const orderedCategories = [
    ...categoryOrder.filter((category) => map.has(category)),
    ...Array.from(map.keys()).filter((category) => !categoryOrder.includes(category)),
  ]

  return orderedCategories.map((category) => {
    const items = map.get(category)!
    return { category, items, count: groupCount(category, items), subgroups: getSubgroups(category, items) }
  })
})

function groupCount(category: string, items: Article[]) {
  if (category === '投资问答录') return items.filter((item) => item.type === 'qanda-chapter').length
  return items.length
}

function articleLabel(article: Article) {
  return chapterLabel(article)
}

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchTerm = computed(() => normalizeSearch(searchQuery.value).trim().replace(/\s+/g, ' '))
const searchTokens = computed(() => searchTerm.value.split(' ').filter(Boolean))

function normalizeSearch(value: string | undefined) {
  return (value || '').toLocaleLowerCase('zh-CN')
}

// 正文全文按需加载，索引到位前先按元数据匹配
const {
  index: fullTextIndex,
  status: fullTextStatus,
  load: loadFullTextIndex,
  search: runSearch,
} = useArticleSearchIndex()

const metaSearchCache = new Map<string, string>()

// 目录过滤用的元数据检索文本（标题/摘要/分类/分卷），索引未就绪时也能先搜
function getArticleMetaSearchText(article: Article) {
  let meta = metaSearchCache.get(article.slug)
  if (meta === undefined) {
    meta = normalizeSearch([
      article.title,
      article.slug,
      article.description,
      article.category,
      article.volume,
      articleTypeLabels[article.type || ''],
    ].filter(Boolean).join(' '))
    metaSearchCache.set(article.slug, meta)
  }

  return meta
}

// 结果浮层里的元数据（标题/分类/分卷）直接取自 layout 已加载的目录，不再单独拉一份
const articleBySlug = computed(() => {
  const map = new Map<string, Article>()
  for (const article of props.sections[0]?.articles || []) map.set(article.slug, article)
  return map
})

function searchMetaFor(slug: string) {
  const article = articleBySlug.value.get(slug)
  if (!article) return undefined
  return {
    title: article.title,
    category: article.category,
    description: article.description,
    chapterOrder: article.chapterOrder,
    volume: article.volume,
    type: article.type,
  }
}

// 浮层里的分段命中结果（标题命中 / 摘要命中 / 正文命中，带小节锚点）
const searchHits = computed(() => {
  if (!searchTerm.value) return { results: [], total: 0 }
  return runSearch(searchTerm.value, searchMetaFor)
})

const panelOpen = ref(false)
const searchRect = ref<{ left: number, right: number, top: number, bottom: number } | null>(null)
const searchPanelRef = ref<{
  onKeydown: (event: KeyboardEvent) => void
  activeDescendant?: string
} | null>(null)

function measureSearchInput() {
  const el = searchInputRef.value
  if (!el) return
  const input = el.getBoundingClientRect()
  // 用带边框的 .sidebar-search 作为左右对齐基准，浮层才会与搜索框的可见边缘贴齐
  // （只量 input 的话，右边会差一个清空按钮的宽度）
  const box = (el.closest('.sidebar-search') || el).getBoundingClientRect()
  searchRect.value = {
    left: Math.round(box.left),
    right: Math.round(box.right),
    top: input.top,
    bottom: input.bottom,
  }
}

function openSearchPanel() {
  measureSearchInput()
  panelOpen.value = true
}

function closeSearchPanel() {
  panelOpen.value = false
}

function onSearchSubmit() {
  const hit = searchHits.value.results[0]
  if (hit) selectHit(hit)
}

function selectHit(hit: SearchHit) {
  closeSearchPanel()
  // 关键词交给文章页做临时高亮（走 sessionStorage，不污染 URL）
  rememberSearchTerms([searchTerm.value])
  searchQuery.value = ''
  // 结果落在某个小节时带上锚点；文章页负责滚动与页内高亮
  const path = hit.headingId ? `/${hit.slug}#${hit.headingId}` : `/${hit.slug}`
  navigateTo(path)
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    onSearchSubmit()
    return
  }

  if (!panelOpen.value) return
  searchPanelRef.value?.onKeydown(event)
}

function onSearchFocus() {
  loadFullTextIndex()
}

// 点输入框总是展开浮层：有输入就列结果，没输入就提示可以搜什么
function onSearchClick() {
  loadFullTextIndex()
  openSearchPanel()
}

function onSearchInput() {
  loadFullTextIndex()
  // 用真实输入值判断：v-model 在这个事件里还没更新，searchTerm 会慢一拍
  const value = searchInputRef.value?.value?.trim()
  if (value) openSearchPanel()
  else closeSearchPanel()
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!panelOpen.value) return
  const target = event.target as Node | null
  if (searchInputRef.value?.contains(target)) return
  // 浮层自己被 Teleport 到 body，需要单独放行
  if (target instanceof Element && target.closest('.search-panel')) return
  closeSearchPanel()
}

function onViewportChange() {
  if (panelOpen.value) measureSearchInput()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

function articleEntry(article: Article) {
  return fullTextIndex.value?.[article.slug] as { text?: string, sections?: Array<{ h?: string }> } | undefined
}

function articleMatchesSearch(article: Article) {
  const meta = getArticleMetaSearchText(article)
  const entry = articleEntry(article)
  const body = entry?.text || ''
  const headings = (entry?.sections || []).map((section) => section.h || '').join(' ')
  return searchTokens.value.every((token) => meta.includes(token) || body.includes(token) || headings.includes(token))
}

function articleMatchesMeta(article: Article) {
  const meta = getArticleMetaSearchText(article)
  return searchTokens.value.every((token) => meta.includes(token))
}

function articleMatchRank(article: Article) {
  const title = normalizeSearch(article.title)
  if (searchTokens.value.every((token) => title.includes(token))) return 0
  if (articleMatchesMeta(article)) return 1
  return 2
}

const filteredGroups = computed(() => {
  if (!searchTerm.value) return groups.value

  return groups.value
    .map((group) => {
      const subgroups = group.subgroups
        .map((subgroup) => {
          const items = subgroup.items
            .filter(articleMatchesSearch)
            .sort((left, right) => articleMatchRank(left) - articleMatchRank(right))

          return {
            ...subgroup,
            items,
            searchRank: Math.min(...items.map(articleMatchRank)),
          }
        })
        .filter((subgroup) => subgroup.items.length > 0)
        .sort((left, right) => left.searchRank - right.searchRank)

      return {
        ...group,
        count: subgroups.reduce((total, subgroup) => total + subgroup.items.length, 0),
        subgroups,
        searchRank: Math.min(...subgroups.map((subgroup) => subgroup.searchRank)),
      }
    })
    .filter((group) => group.count > 0)
    .sort((left, right) => left.searchRank - right.searchRank)
})

const searchResultCount = computed(() =>
  filteredGroups.value.reduce((total, group) => total + group.count, 0)
)

function clearSearch() {
  searchQuery.value = ''
  closeSearchPanel()
  searchInputRef.value?.focus()
}

// Auto-open category of current article
const currentCategory = computed(() => {
  const section = props.sections[0]
  if (!section) return null
  const article = section.articles.find((a) => a.slug === props.currentSlug)
  return article?.category || null
})

const openCategories = ref(new Set<string>(
  currentCategory.value ? [currentCategory.value] : []
))

function onToggleCategory(cat: string, event: Event) {
  if (searchTerm.value) return

  const details = event.target as HTMLDetailsElement
  if (details.open) {
    openCategories.value.add(cat)
  } else {
    openCategories.value.delete(cat)
  }
}

const activeRef = ref<HTMLElement | null>(null)
const navRef = ref<HTMLElement | null>(null)

function scrollToActive(behavior: ScrollBehavior = 'instant') {
  nextTick(() => {
    const el = (activeRef.value as { $el?: HTMLElement } | null)?.$el || activeRef.value
    const container = navRef.value
    if (!el || !container) return

    const elRect = el.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const offset = elRect.top - containerRect.top - container.clientHeight / 2 + el.clientHeight / 2

    container.scrollBy({ top: offset, behavior })
  })
}

onMounted(() => {
  scrollToActive('instant')
})

watch(() => props.currentSlug, () => {
  scrollToActive('smooth')
})
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar-header">
      <NuxtLink to="/" class="sidebar-brand">
        <!-- Seal / stamp logo — a stylized 道 character in a rounded square -->
        <svg class="brand-seal" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="26" height="26" rx="4" stroke="currentColor" stroke-width="1.5"/>
          <text x="14" y="20.5" text-anchor="middle" font-family="serif" font-size="17" font-weight="700" fill="currentColor">道</text>
        </svg>
        <span class="brand-text">段永平投资问答录</span>
      </NuxtLink>
    </header>

    <div ref="navRef" class="sidebar-nav">
      <div class="sidebar-search" :aria-busy="fullTextStatus === 'loading'">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/>
          <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="搜索全站文章"
          aria-label="搜索全部文章的标题、摘要和正文"
          role="combobox"
          aria-controls="sidebar-search-panel"
          :aria-expanded="panelOpen"
          :aria-activedescendant="searchPanelRef?.activeDescendant"
          autocomplete="off"
          @focus="onSearchFocus"
          @click="onSearchClick"
          @input="onSearchInput"
          @keydown="onSearchKeydown"
          @keydown.enter="onSearchSubmit"
          @keydown.esc="clearSearch"
        >
        <button
          v-if="searchQuery"
          type="button"
          class="search-clear"
          aria-label="清空搜索"
          @click="clearSearch"
        >
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <p v-if="searchTerm && fullTextStatus === 'loading'" class="search-status" aria-live="polite">
        <span class="search-spinner" aria-hidden="true"></span>
        正在检索全文
      </p>
      <p v-else-if="searchTerm && fullTextStatus === 'error'" class="search-status search-status-error" aria-live="polite">
        全文暂不可用，已按标题与摘要搜索
      </p>
      <p v-else-if="searchTerm && searchResultCount" class="search-status" aria-live="polite">
        目录中命中 {{ searchResultCount }} 篇
      </p>

      <details
        v-for="group in filteredGroups"
        :key="group.category"
        class="category-group"
        :class="{ 'search-open': !!searchTerm }"
        :open="openCategories.has(group.category)"
        @toggle="onToggleCategory(group.category, $event)"
      >
        <summary class="category-summary">
          <svg class="chevron" width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="category-label">{{ group.category }}</span>
          <span class="category-count">{{ group.count }}</span>
        </summary>

        <div class="article-list">
          <div v-for="subgroup in group.subgroups" :key="subgroup.label || group.category" class="article-subgroup">
            <details
              v-if="group.category === '投资问答录' && subgroup.items.some((article) => article.type === 'qanda-chapter')"
              class="article-volume"
              :class="{ 'search-open': !!searchTerm }"
              :open="subgroup.items.some((article) => article.slug === currentSlug)"
            >
              <summary class="article-volume-summary">{{ subgroup.label }}</summary>
              <nav class="article-subgroup-links" :aria-label="subgroup.label">
                <NuxtLink
                  v-for="article in subgroup.items"
                  :key="article.slug"
                  :ref="article.slug === currentSlug ? (el) => { activeRef = el as any } : undefined"
                  :to="`/${article.slug}`"
                  :class="{ active: article.slug === currentSlug }"
                >
                  {{ articleLabel(article) }}
                  <span v-if="searchTerm && !articleMatchesMeta(article)" class="search-match-source">正文</span>
                </NuxtLink>
              </nav>
            </details>
            <template v-else>
              <div v-if="subgroup.label" class="article-subgroup-label">{{ subgroup.label }}</div>
              <nav class="article-subgroup-links" :aria-label="subgroup.label || group.category">
                <NuxtLink
                  v-for="article in subgroup.items"
                  :key="article.slug"
                  :ref="article.slug === currentSlug ? (el) => { activeRef = el as any } : undefined"
                  :to="`/${article.slug}`"
                  :class="{ active: article.slug === currentSlug }"
                >
                  {{ articleLabel(article) }}
                  <span v-if="searchTerm && !articleMatchesMeta(article)" class="search-match-source">正文</span>
                </NuxtLink>
              </nav>
            </template>
          </div>
        </div>
      </details>

      <p v-if="searchTerm && fullTextStatus !== 'loading' && filteredGroups.length === 0" class="search-empty">目录中没有相关文章</p>
    </div>

    <SearchResultsPanel
      v-if="panelOpen"
      id="sidebar-search-panel"
      ref="searchPanelRef"
      :results="searchHits.results"
      :total="searchHits.total"
      :query="searchTerm"
      :loading="fullTextStatus === 'loading'"
      :failed="fullTextStatus === 'error'"
      :rect="searchRect"
      @select="selectHit"
      @close="closeSearchPanel"
    />

    <div class="sidebar-footer">
      <div class="sidebar-tools">
        <FontSizePicker placement="top-start" />
        <ThemePicker :theme="theme" placement="top-start" @select="emit('selectTheme', $event)" />
      </div>
      <a class="icp-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备17053536号-2</a>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  --sb-bg: var(--bg);
  --sb-fg: var(--fg);
  --sb-muted: color-mix(in srgb, var(--fg) 72%, var(--bg));
  --sb-subtle: color-mix(in srgb, var(--fg) 68%, var(--bg));
  --sb-line: var(--line);
  --sb-surface: var(--surface);
  --sb-accent: var(--accent);
  --sb-accent-soft: var(--accent-soft);
  --theme-picker-control-bg: transparent;
  --theme-picker-fg: var(--sb-muted);
  --theme-picker-border: var(--sb-line);
  --theme-picker-hover-border: color-mix(in srgb, var(--sb-fg) 30%, transparent);
  --theme-picker-hover-bg: var(--sb-surface);
  --theme-picker-hover-fg: var(--sb-fg);
  --theme-picker-menu-bg: color-mix(in srgb, var(--sb-bg) 94%, var(--sb-fg));
  --theme-picker-menu-border: var(--sb-line);
  --theme-picker-menu-fg: var(--sb-fg);
  --theme-picker-option-fg: var(--sb-muted);
  --theme-picker-option-hover: var(--sb-surface);
  --theme-picker-active: var(--sb-accent);
  --theme-picker-focus: var(--sb-accent);

  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--sb-line);
  background: var(--sb-bg);
  color: var(--sb-fg);
}

/* ── Header / Brand ── */
.sidebar-header {
  flex-shrink: 0;
  padding: 24px 20px 20px;
  border-bottom: 1px solid var(--sb-line);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--sb-fg);
  transition: color 0.25s var(--ease-out);
}

.sidebar-brand:hover {
  color: var(--sb-accent);
}

.brand-seal {
  flex-shrink: 0;
  color: var(--sb-accent);
  transition: transform 0.3s var(--ease-out);
}

.sidebar-brand:hover .brand-seal {
  transform: scale(1.06);
}

.brand-text {
  font-family: var(--reading);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--sb-fg);
}

/* ── Navigation ── */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 24px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--sb-line) 50%, transparent) transparent;
}

.sidebar-nav::-webkit-scrollbar {
  width: 3px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--sb-line) 50%, transparent);
  border-radius: 3px;
}

.sidebar-nav:hover::-webkit-scrollbar-thumb {
  background: var(--sb-subtle);
}

/* Search */
.sidebar-search {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  margin: 0 0 8px;
  padding: 0 8px 0 10px;
  border: 1px solid color-mix(in srgb, var(--sb-line) 78%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--sb-bg) 92%, var(--sb-surface));
  color: var(--sb-subtle);
}

.sidebar-search:focus-within {
  border-color: color-mix(in srgb, var(--sb-accent) 58%, var(--sb-line));
  color: var(--sb-muted);
  box-shadow: 0 0 0 2px var(--sb-accent-soft);
}

.search-icon {
  pointer-events: none;
}

.search-input {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--sb-fg);
  font: inherit;
  font-size: 13px;
  line-height: 1;
}

.search-input::placeholder {
  color: var(--sb-subtle);
}

.search-input::-webkit-search-cancel-button {
  display: none;
}

.search-clear {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--sb-subtle);
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
}

.search-clear:hover {
  background: var(--sb-surface);
  color: var(--sb-fg);
}

.search-empty {
  margin: 18px 8px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sb-subtle);
  text-align: center;
}

.search-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  margin: -2px 8px 6px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--sb-subtle);
}

.search-status-error {
  color: var(--sb-muted);
}

.search-spinner {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border: 1.5px solid color-mix(in srgb, var(--sb-subtle) 30%, transparent);
  border-top-color: var(--sb-accent);
  border-radius: 50%;
  animation: search-spin 0.7s linear infinite;
}

.search-match-source {
  margin-left: 5px;
  font-size: 9px;
  font-weight: 500;
  color: var(--sb-accent);
  white-space: nowrap;
}

@keyframes search-spin {
  to { transform: rotate(360deg); }
}

/* Category */
.category-group + .category-group {
  margin-top: 1px;
}

.category-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  list-style: none;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sb-muted);
  user-select: none;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
}

.category-summary::-webkit-details-marker {
  display: none;
}

.category-summary:hover {
  background: var(--sb-surface);
  color: var(--sb-fg);
}

.category-label {
  flex: 1;
  min-width: 0;
}

.category-count {
  font-size: 10px;
  font-weight: 500;
  color: var(--sb-subtle);
  font-variant-numeric: tabular-nums;
}

/* Chevron */
.chevron {
  flex-shrink: 0;
  color: var(--sb-subtle);
  transition: transform 0.25s var(--ease-out), color 0.25s var(--ease-out);
}

.category-summary:hover .chevron {
  color: var(--sb-subtle);
}

.category-group[open] > .category-summary > .chevron {
  transform: rotate(90deg);
}

/* 搜索时目录整体展开：用 class 而不是 :open 属性。旧实现直接把 :open 绑成 true，
   输入清空后 <details> 的 open 被重置，整棵目录会莫名折起来。
   <details> 关闭时子元素被浏览器隐藏，所以这里要显式 display 才能展开。 */
.category-group.search-open > .article-list,
.article-volume.search-open > .article-subgroup-links {
  display: flex !important;
}

.category-group.search-open > .category-summary > .chevron,
.article-volume.search-open > .article-volume-summary::before {
  transform: rotate(90deg);
}

/* Article links */
.article-list {
  display: flex;
  flex-direction: column;
  padding: 2px 0 6px 18px;
  margin-left: 4px;
  border-left: 1px solid color-mix(in srgb, var(--sb-line) 60%, transparent);
}

.article-subgroup + .article-subgroup {
  margin-top: 8px;
}

.article-subgroup-label {
  padding: 8px 10px 3px;
  font-size: 10px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--sb-muted);
  letter-spacing: 0.12em;
}

.article-volume-summary {
  cursor: pointer;
  list-style: none;
  padding: 8px 10px 4px;
  font-size: 10px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--sb-muted);
  letter-spacing: 0.08em;
}

.article-volume-summary::-webkit-details-marker {
  display: none;
}

.article-volume-summary::before {
  content: '›';
  display: inline-block;
  margin-right: 5px;
  transition: transform 0.2s var(--ease-out);
}

.article-volume[open] > .article-volume-summary::before {
  transform: rotate(90deg);
}

.article-subgroup-links {
  display: flex;
  flex-direction: column;
}

.article-list a {
  display: block;
  padding: 4px 10px;
  margin-left: -1px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--sb-subtle);
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  transition: color 0.2s var(--ease-out), background 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-list a:hover {
  color: var(--sb-fg);
  background: var(--sb-surface);
}

.article-list a.active {
  color: var(--sb-accent);
  font-weight: 600;
  border-left-color: var(--sb-accent);
  background: var(--sb-accent-soft);
}

/* ── Footer ── */
.sidebar-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid color-mix(in srgb, var(--sb-line) 50%, transparent);
}

.sidebar-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icp-link {
  font-size: 10px;
  color: var(--sb-subtle);
  transition: color 0.2s var(--ease-out);
}

.icp-link:hover {
  color: var(--sb-subtle);
}

@media (max-width: 1024px) {
  .sidebar-header {
    padding: 20px 18px 16px;
  }

  .brand-text {
    font-size: 15px;
    letter-spacing: 0.05em;
  }

  .sidebar-nav {
    padding: 8px 8px 20px;
  }

  .sidebar-search {
    grid-template-columns: 14px minmax(0, 1fr) 40px;
    min-height: 42px;
    margin-bottom: 10px;
    padding-right: 2px;
  }

  .search-input {
    height: 40px;
    font-size: 16px;
  }

  .search-clear {
    width: 40px;
    height: 40px;
  }

  .category-summary {
    padding: 10px 10px;
    font-size: 14px;
  }

  .article-list {
    padding-left: 16px;
  }

  .article-list a {
    display: -webkit-box;
    min-height: 34px;
    padding: 6px 10px;
    font-size: 13px;
    white-space: normal;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .sidebar-footer {
    padding: 14px 18px;
  }

  .icp-link {
    font-size: 10px;
  }

}
</style>
