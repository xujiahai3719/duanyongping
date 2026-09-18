<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = withDefaults(defineProps<{
  placement?: 'top-start' | 'bottom-end'
}>(), {
  placement: 'top-start',
})

const {
  percentage,
  canDecrease,
  canIncrease,
  decrease,
  increase,
  reset,
} = useArticleFontSize()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const resetButton = ref<HTMLButtonElement | null>(null)
const panelId = `font-size-panel-${useId().replaceAll(':', '')}`

async function openPanel() {
  open.value = true
  await nextTick()
  resetButton.value?.focus()
}

function closePanel(restoreFocus = false) {
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function togglePanel() {
  if (open.value) closePanel()
  else openPanel()
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' && canDecrease.value) {
    event.preventDefault()
    decrease()
  } else if (event.key === 'ArrowRight' && canIncrease.value) {
    event.preventDefault()
    increase()
  } else if (event.key === 'Home') {
    event.preventDefault()
    reset()
  }
}

function onDocumentPointerdown(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) closePanel()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    event.preventDefault()
    closePanel(true)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerdown)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerdown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div ref="root" class="font-size-picker">
    <button
      ref="trigger"
      class="font-size-trigger"
      type="button"
      aria-label="调整正文字号"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      :title="`调整正文字号，当前 ${percentage}%`"
      @click="togglePanel"
    >
      <span class="font-size-glyph" aria-hidden="true"><strong>A</strong><small>a</small></span>
      <svg class="font-size-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <Transition name="font-size-panel">
      <div
        v-if="open"
        :id="panelId"
        class="font-size-panel"
        :class="`font-size-panel--${props.placement}`"
        role="dialog"
        aria-label="调整正文字号"
        @keydown="onPanelKeydown"
      >
        <span class="font-size-label">正文字号</span>
        <div class="font-size-controls" role="group" aria-label="正文字号">
          <button type="button" aria-label="减小正文字号" :disabled="!canDecrease" @click="decrease">A−</button>
          <button ref="resetButton" class="font-size-value" type="button" aria-label="恢复默认正文字号" @click="reset">{{ percentage }}%</button>
          <button type="button" aria-label="增大正文字号" :disabled="!canIncrease" @click="increase">A+</button>
        </div>
        <span class="visually-hidden" aria-live="polite">当前正文字号 {{ percentage }}%</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.font-size-picker {
  position: relative;
  display: inline-flex;
}

.font-size-trigger {
  display: grid;
  grid-template-columns: 18px 12px;
  place-items: center;
  gap: 2px;
  width: 40px;
  height: 40px;
  padding: 0 4px;
  border: 1px solid var(--font-picker-border, var(--theme-picker-border, var(--line)));
  border-radius: 8px;
  background: var(--font-picker-control-bg, var(--theme-picker-control-bg, var(--bg-elevated)));
  color: var(--font-picker-fg, var(--theme-picker-fg, var(--muted)));
  cursor: pointer;
  transition: color 0.2s var(--ease-out), border-color 0.2s var(--ease-out), background 0.2s var(--ease-out);
}

.font-size-trigger:hover,
.font-size-trigger[aria-expanded="true"] {
  border-color: var(--font-picker-hover-border, var(--theme-picker-hover-border, var(--fg)));
  background: var(--font-picker-hover-bg, var(--theme-picker-hover-bg, var(--surface)));
  color: var(--font-picker-hover-fg, var(--theme-picker-hover-fg, var(--fg)));
}

.font-size-trigger:focus-visible,
.font-size-controls button:focus-visible {
  outline: 2px solid var(--font-picker-focus, var(--theme-picker-focus, var(--accent)));
  outline-offset: 2px;
}

.font-size-glyph {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  width: 18px;
  font-family: var(--sans);
  line-height: 1;
  letter-spacing: 0;
}

.font-size-glyph strong {
  font-size: 15px;
  font-weight: 700;
}

.font-size-glyph small {
  font-size: 9px;
  font-weight: 700;
}

.font-size-chevron {
  transition: transform 0.2s var(--ease-out);
}

.font-size-trigger[aria-expanded="true"] .font-size-chevron {
  transform: rotate(180deg);
}

.font-size-panel {
  position: absolute;
  z-index: 80;
  width: 172px;
  padding: 9px;
  border: 1px solid var(--font-picker-menu-border, var(--theme-picker-menu-border, var(--line)));
  border-radius: 6px;
  background: var(--font-picker-menu-bg, var(--theme-picker-menu-bg, var(--bg-elevated)));
  color: var(--font-picker-menu-fg, var(--theme-picker-menu-fg, var(--fg)));
  box-shadow: 0 12px 30px rgba(24, 28, 24, 0.16);
}

.font-size-panel--top-start {
  bottom: calc(100% + 8px);
  left: 0;
}

.font-size-panel--bottom-end {
  top: calc(100% + 8px);
  right: 0;
}

.font-size-label {
  display: block;
  margin: 1px 2px 8px;
  color: var(--font-picker-option-fg, var(--theme-picker-option-fg, var(--muted)));
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.font-size-controls {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  overflow: hidden;
  border: 1px solid var(--font-picker-menu-border, var(--theme-picker-menu-border, var(--line)));
  border-radius: 4px;
}

.font-size-controls button {
  min-width: 0;
  height: 40px;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--font-picker-menu-border, var(--theme-picker-menu-border, var(--line)));
  background: transparent;
  color: var(--font-picker-option-fg, var(--theme-picker-option-fg, var(--muted)));
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.font-size-controls button:last-child {
  border-right: 0;
}

.font-size-controls button:hover:not(:disabled),
.font-size-controls button:focus-visible {
  background: var(--font-picker-option-hover, var(--theme-picker-option-hover, var(--surface)));
  color: var(--font-picker-menu-fg, var(--theme-picker-menu-fg, var(--fg)));
}

.font-size-controls button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.font-size-controls .font-size-value {
  color: var(--font-picker-active, var(--theme-picker-active, var(--accent)));
  font-variant-numeric: tabular-nums;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.font-size-panel-enter-active,
.font-size-panel-leave-active {
  transition: opacity 0.16s var(--ease-out), transform 0.16s var(--ease-out);
}

.font-size-panel-enter-from,
.font-size-panel-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .font-size-trigger,
  .font-size-chevron,
  .font-size-panel-enter-active,
  .font-size-panel-leave-active {
    transition: none;
  }
}
</style>
