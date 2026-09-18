import { computed, onMounted, readonly, ref } from 'vue'
import {
  ARTICLE_FONT_SIZE_DEFAULT,
  ARTICLE_FONT_SIZE_LEVELS,
  applyArticleFontSizePercent,
  loadArticleFontSizePercent,
  normalizeArticleFontSizePercent,
  saveArticleFontSizePercent,
  stepArticleFontSizePercent,
} from '~/utils/articleFontSize'

const percentage = ref(ARTICLE_FONT_SIZE_DEFAULT)

export function useArticleFontSize() {
  const setPercentage = (value: unknown) => {
    const normalized = normalizeArticleFontSizePercent(value)
    percentage.value = normalized

    if (import.meta.client) {
      try {
        saveArticleFontSizePercent(localStorage, document.documentElement.style, normalized)
      } catch {
        applyArticleFontSizePercent(document.documentElement.style, normalized)
      }
    }

    return normalized
  }

  const decrease = () => setPercentage(stepArticleFontSizePercent(percentage.value, -1))
  const increase = () => setPercentage(stepArticleFontSizePercent(percentage.value, 1))
  const reset = () => setPercentage(ARTICLE_FONT_SIZE_DEFAULT)
  const canDecrease = computed(() => percentage.value > ARTICLE_FONT_SIZE_LEVELS[0])
  const canIncrease = computed(() => percentage.value < ARTICLE_FONT_SIZE_LEVELS.at(-1)!)

  onMounted(() => {
    let stored = ARTICLE_FONT_SIZE_DEFAULT
    try {
      stored = loadArticleFontSizePercent(localStorage)
    } catch {
      // Storage can be unavailable in hardened browser modes; the CSS default remains usable.
    }
    percentage.value = applyArticleFontSizePercent(document.documentElement.style, stored)
  })

  return {
    percentage: readonly(percentage),
    canDecrease,
    canIncrease,
    decrease,
    increase,
    reset,
  }
}
