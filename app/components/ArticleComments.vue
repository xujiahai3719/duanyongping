<script setup lang="ts">
const props = defineProps<{
  // 每篇文章评论的隔离键，传 `/<slug>`
  path: string
}>()

const TWIKOO_SRC = '/vendor/twikoo.all.min.js'

const config = useRuntimeConfig()
const envId = String(config.public.commentEnvId || '')

const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

// 懒加载 vendored 脚本：window.twikoo 已存在则直接复用，否则插入一次 <script>
function loadTwikoo(): Promise<any> {
  const w = window as any
  if (w.twikoo) return Promise.resolve(w.twikoo)

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TWIKOO_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).twikoo))
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = TWIKOO_SRC
    s.async = true
    s.onload = () => resolve((window as any).twikoo)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

onMounted(async () => {
  if (!envId) return // 未配置后端地址：静默不渲染评论
  status.value = 'loading'
  try {
    const twikoo = await loadTwikoo()
    await twikoo.init({
      envId,
      el: '#tcomment',
      // 显式传 path：twikoo-cloudflare 不做尾斜杠归一化，按 slug 隔离最稳
      path: props.path,
    })
    status.value = 'ready'
  } catch (e) {
    status.value = 'error'
    console.error('[ArticleComments] Twikoo 初始化失败', e)
  }
})
</script>

<template>
  <section v-if="envId" class="article-comments" aria-label="评论">
    <p class="comments-label">评论</p>
    <div id="tcomment" />
    <p v-if="status === 'loading'" class="comments-hint">评论加载中…</p>
    <p v-else-if="status === 'error'" class="comments-hint">评论加载失败，请稍后刷新重试。</p>
  </section>
</template>

<style scoped>
.article-comments {
  margin-top: 56px;
  padding-top: 28px;
  border-top: 1px dashed var(--line);
}

.comments-label {
  margin: 0 0 16px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--subtle);
}

.comments-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--muted);
}
</style>
