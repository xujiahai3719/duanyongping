<script setup lang="ts">
const { theme, setTheme } = useTheme()

const daoCategoryOrder = ['访谈实录', '投资问答录', '核心哲学', '投资理念', '企业经营', '品格与心性', '财务指标', '公司与人物', '推荐书单']

// 不要在这里 select 'body'：本查询在每个路由都会跑，其结果会被序列化进每个页面的
// _payload.json，带上 body 等于把整站全文塞进每一次跳转（实测 5.2MB / 压缩后 1.9MB）。
// 侧边栏搜索所需的正文文本改由 /search-index.json 懒加载，见 LibrarySidebar.vue。
const { data: daoArticles } = await useAsyncData('layout-dao', () =>
  queryCollection('dao').select('title', 'slug', 'description', 'category', 'order', 'type', 'volume', 'volumeOrder', 'chapterOrder').order('order', 'ASC').all()
)

const visibleDaoArticles = computed(() =>
  ((daoArticles.value as any[]) || []).filter((article) => article.type !== 'legacy-index')
)

const sections = computed(() => [
  { name: '段永平投资问答录', articles: visibleDaoArticles.value, categoryOrder: daoCategoryOrder }
])

const mobileMenuOpen = ref(false)
const mainArea = ref<HTMLElement | null>(null)
const route = useRoute()
const currentSlug = computed(() => String(route.params.slug || ''))

watch(() => route.path, () => {
  mobileMenuOpen.value = false
  nextTick(() => {
    // 带 #锚点 进来（搜索结果点击 / 分享链接）是"要落到正文某一节"，
    // 这里的"回到顶部"会紧接着把刚滚到的小节位置冲掉，所以让位给文章页的锚点滚动
    if (route.hash) return
    mainArea.value?.scrollTo({ top: 0, behavior: 'instant' })
  })
})
</script>

<template>
  <div class="shell">
    <LibrarySidebar
      :sections="sections"
      :current-slug="currentSlug"
      :theme="theme"
      class="desktop-sidebar"
      @select-theme="setTheme"
    />

    <div ref="mainArea" class="main-area">
      <!-- Mobile top bar -->
      <div class="mobile-topbar">
        <button class="mobile-menu-btn" @click="mobileMenuOpen = true" aria-label="打开目录">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
        <div class="mobile-tools">
          <FontSizePicker placement="bottom-end" />
          <ThemePicker :theme="theme" placement="bottom-end" @select="setTheme" />
        </div>
      </div>

      <main>
        <slot />
      </main>
    </div>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false">
          <div class="mobile-drawer" @click.stop>
            <div class="mobile-drawer-head">
              <span>目录</span>
              <button class="mobile-close" @click="mobileMenuOpen = false" aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <!-- 搜索浮层被 Teleport 到 body，点它的 click 仍会沿 DOM 冒泡到遮罩，
                 所以再包一层 @click.stop：否则"点搜索结果"会先把抽屉关掉、
                 把结果行从文档里摘掉，点击就落空了 -->
            <div class="mobile-drawer-body" @click.stop>
              <LibrarySidebar
                :sections="sections"
                :current-slug="currentSlug"
                :theme="theme"
                @select-theme="setTheme"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  height: 100dvh;
  min-height: 100vh;
  overflow: hidden;
  max-width: 1440px;
  margin: 0 auto;
}

.desktop-sidebar {
  height: 100dvh;
  min-height: 0;
}

.main-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.mobile-topbar {
  display: none;
}

.mobile-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Mobile drawer */
.mobile-overlay {
  position: fixed;
  inset: 0;
  /* 层级约定：阅读进度条(50) < 遮罩(55) < 抽屉(56) < 侧边栏搜索浮层(60) < 工具面板(80)。
     搜索浮层（Teleport 到 body）必须压在遮罩之上，否则移动端点搜索结果会被遮罩截住。 */
  z-index: 55;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.mobile-drawer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 56;
  width: min(360px, 92vw);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.1);
}

.mobile-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.mobile-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.mobile-close:hover {
  background: var(--surface);
  color: var(--fg);
}

.mobile-drawer-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mobile-drawer :deep(.sidebar) {
  position: static;
  height: auto;
  flex: 1;
  overflow-y: auto;
  border-right: none;
}

/* Drawer transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s var(--ease-out);
}

.drawer-enter-active .mobile-drawer,
.drawer-leave-active .mobile-drawer {
  transition: transform 0.35s var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .mobile-drawer,
.drawer-leave-to .mobile-drawer {
  transform: translateX(-100%);
}

@media (max-width: 1024px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .desktop-sidebar {
    display: none;
  }

  .mobile-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 58px;
    padding: 10px var(--px);
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    flex-shrink: 0;
  }

  .mobile-menu-btn {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-elevated);
    color: var(--muted);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .mobile-menu-btn:hover {
    color: var(--fg);
    border-color: var(--fg);
  }
}

@media (min-width: 1025px) {
  .mobile-overlay {
    display: none;
  }
}
</style>
