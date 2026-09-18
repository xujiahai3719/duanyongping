<script setup lang="ts">
import { buildArticleShareText } from '~/utils/articleShare'

const props = defineProps<{
  title: string
  slug: string
}>()

const articleUrl = useArticleShareUrl(() => props.slug)

const state = ref<'idle' | 'copying' | 'copied' | 'failed'>('idle')
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function clearFeedbackTimer() {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = undefined
}

function showTemporaryState(nextState: 'copied' | 'failed') {
  clearFeedbackTimer()
  state.value = nextState
  feedbackTimer = setTimeout(() => {
    state.value = 'idle'
    feedbackTimer = undefined
  }, 1500)
}

async function shareArticle() {
  clearFeedbackTimer()
  state.value = 'copying'
  try {
    await navigator.clipboard.writeText(buildArticleShareText({
      title: props.title,
      url: articleUrl.value,
    }))
    showTemporaryState('copied')
  } catch {
    showTemporaryState('failed')
  }
}

onBeforeUnmount(clearFeedbackTimer)
</script>

<template>
  <div class="share-action">
    <button class="share-btn" :disabled="state === 'copying'" :title="state === 'idle' ? '分享' : undefined" @click="shareArticle">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path
          d="M11.5 1.5h-5a2 2 0 0 0-2 2v1m7-3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1m1-9V1.5ZM8.5 5.5h-5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2Z"
          stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>{{ state === 'copying' ? '复制中...' : state === 'copied' ? '已复制' : state === 'failed' ? '复制失败' : '分享' }}</span>
    </button>
  </div>
</template>

<style scoped>
.share-action {
  margin-top: 20px;
}

.share-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--subtle);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 3px;
  cursor: pointer;
  letter-spacing: 0.02em;
  transition: color 0.2s var(--ease-out), border-color 0.2s var(--ease-out);
}

.share-btn:hover {
  color: var(--fg);
  border-color: var(--fg);
}

.share-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
