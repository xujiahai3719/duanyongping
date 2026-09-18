<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode: number
    statusMessage?: string
  }
}>()

const title = computed(() =>
  props.error.statusCode === 404 ? '页面不存在' : '出了点问题'
)

const description = computed(() =>
  props.error.statusCode === 404
    ? '你访问的页面可能已被移动或删除。'
    : props.error.statusMessage || '服务器遇到了意外错误。'
)

useSeoMeta({
  title: () => `${props.error.statusCode}｜${title.value}`
})
</script>

<template>
  <div class="error-page">
    <span class="error-code">{{ error.statusCode }}</span>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <a href="/">回到首页 &rarr;</a>
  </div>
</template>

<style scoped>
.error-page {
  display: grid;
  place-content: center;
  min-height: 100vh;
  padding: 48px 20px;
  text-align: center;
  font-family: "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
}

.error-code {
  font-family: "Instrument Serif", Georgia, serif;
  font-size: clamp(80px, 20vw, 180px);
  line-height: 1;
  color: var(--line, #e0e0e0);
}

h1 {
  margin: 16px 0 8px;
  font-size: 24px;
  font-weight: 700;
}

p {
  margin: 0 0 32px;
  color: var(--muted, #555);
  font-size: 16px;
}

a {
  color: var(--muted, #555);
  font-size: 14px;
  font-weight: 500;
  transition: color 0.15s;
}

a:hover {
  color: var(--accent, #d4512a);
}
</style>
