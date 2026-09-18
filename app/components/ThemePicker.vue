<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import type { Theme } from '~/composables/useTheme'

const props = withDefaults(defineProps<{
  theme: Theme
  placement?: 'top-start' | 'bottom-end'
}>(), {
  placement: 'top-start',
})

const emit = defineEmits<{
  select: [theme: Theme]
}>()

const themeOrder: Theme[] = ['light', 'dark', 'green']
const themeMetadata: Record<Theme, { label: string; color: string }> = {
  light: { label: '浅色', color: '#f8f5f0' },
  dark: { label: '墨黑', color: '#1a1a1a' },
  green: { label: '护眼绿', color: '#c0edc6' },
}
const themeOptions = themeOrder.map((value) => ({ value, ...themeMetadata[value] }))

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const optionButtons = ref<HTMLButtonElement[]>([])
const focusedIndex = ref(0)
const menuId = `theme-menu-${useId().replaceAll(':', '')}`
const currentOption = computed(() => ({ value: props.theme, ...themeMetadata[props.theme] }))

function setOptionRef(element: Element | null, index: number) {
  if (element instanceof HTMLButtonElement) optionButtons.value[index] = element
}

function focusOption(index: number) {
  focusedIndex.value = index
  optionButtons.value[index]?.focus()
}

async function openMenu() {
  open.value = true
  await nextTick()
  const currentIndex = themeOptions.findIndex((option) => option.value === props.theme)
  focusOption(Math.max(currentIndex, 0))
}

function closeMenu(restoreFocus = false) {
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function toggleMenu() {
  if (open.value) closeMenu()
  else openMenu()
}

function selectTheme(theme: Theme) {
  emit('select', theme)
  closeMenu(true)
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    closeMenu()
    return
  }

  const focusedIndex = optionButtons.value.indexOf(document.activeElement as HTMLButtonElement)
  let nextIndex = focusedIndex

  if (event.key === 'ArrowDown') nextIndex = (Math.max(focusedIndex, -1) + 1) % themeOptions.length
  else if (event.key === 'ArrowUp') nextIndex = (focusedIndex <= 0 ? themeOptions.length : focusedIndex) - 1
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = themeOptions.length - 1
  else return

  event.preventDefault()
  focusOption(nextIndex)
}

function onDocumentPointerdown(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) closeMenu()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape') {
    event.preventDefault()
    closeMenu(true)
  }
}

function onFocusout(event: FocusEvent) {
  const nextTarget = event.relatedTarget
  if (open.value && (!(nextTarget instanceof Node) || !root.value?.contains(nextTarget))) closeMenu()
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
  <div ref="root" class="theme-picker" @focusout="onFocusout">
    <button
      ref="trigger"
      class="theme-trigger"
      type="button"
      :aria-label="`选择主题，当前：${currentOption.label}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      :title="`选择主题，当前：${currentOption.label}`"
      @click="toggleMenu"
    >
      <span class="theme-trigger-swatch" :style="{ background: currentOption.color }" aria-hidden="true" />
      <svg class="theme-trigger-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <Transition name="theme-menu">
      <div
        v-if="open"
        :id="menuId"
        class="theme-menu"
        :class="`theme-menu--${placement}`"
        role="menu"
        aria-label="选择主题"
        @keydown="onMenuKeydown"
      >
        <button
          v-for="(option, index) in themeOptions"
          :key="option.value"
          :ref="(element) => setOptionRef(element as Element | null, index)"
          class="theme-option"
          :class="{ active: option.value === theme }"
          type="button"
          role="menuitemradio"
          :aria-checked="option.value === theme"
          :tabindex="index === focusedIndex ? 0 : -1"
          @focus="focusedIndex = index"
          @click="selectTheme(option.value)"
        >
          <span class="theme-option-swatch" :style="{ background: option.color }" aria-hidden="true" />
          <span>{{ option.label }}</span>
          <svg v-if="option.value === theme" class="theme-option-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m20 6-11 11-5-5" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.theme-picker {
  position: relative;
  display: inline-flex;
}

.theme-trigger {
  display: grid;
  grid-template-columns: 18px 12px;
  place-items: center;
  gap: 2px;
  width: 40px;
  height: 40px;
  padding: 0 4px;
  border: 1px solid var(--theme-picker-border, var(--line));
  border-radius: 8px;
  background: var(--theme-picker-control-bg, var(--bg-elevated));
  color: var(--theme-picker-fg, var(--muted));
  cursor: pointer;
  transition: color 0.2s var(--ease-out), border-color 0.2s var(--ease-out), background 0.2s var(--ease-out);
}

.theme-trigger:hover,
.theme-trigger[aria-expanded="true"] {
  border-color: var(--theme-picker-hover-border, var(--fg));
  background: var(--theme-picker-hover-bg, var(--surface));
  color: var(--theme-picker-hover-fg, var(--fg));
}

.theme-trigger:focus-visible,
.theme-option:focus-visible {
  outline: 2px solid var(--theme-picker-focus, var(--accent));
  outline-offset: 2px;
}

.theme-trigger-swatch,
.theme-option-swatch {
  display: block;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.theme-trigger-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.theme-trigger-chevron {
  transition: transform 0.2s var(--ease-out);
}

.theme-trigger[aria-expanded="true"] .theme-trigger-chevron {
  transform: rotate(180deg);
}

.theme-menu {
  position: absolute;
  z-index: 80;
  width: 172px;
  padding: 6px;
  border: 1px solid var(--theme-picker-menu-border, var(--line));
  border-radius: 6px;
  background: var(--theme-picker-menu-bg, var(--bg-elevated));
  color: var(--theme-picker-menu-fg, var(--fg));
  box-shadow: 0 12px 30px rgba(24, 28, 24, 0.16);
}

.theme-menu--top-start {
  bottom: calc(100% + 8px);
  left: 0;
}

.theme-menu--bottom-end {
  top: calc(100% + 8px);
  right: 0;
}

.theme-option {
  display: grid;
  grid-template-columns: 20px 1fr 18px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 7px 9px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--theme-picker-option-fg, var(--muted));
  font-family: var(--sans);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.theme-option:hover,
.theme-option:focus-visible {
  background: var(--theme-picker-option-hover, var(--surface));
  color: var(--theme-picker-menu-fg, var(--fg));
}

.theme-option.active {
  color: var(--theme-picker-active, var(--accent));
  font-weight: 700;
}

.theme-option-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.theme-option-check {
  justify-self: end;
}

.theme-menu-enter-active,
.theme-menu-leave-active {
  transition: opacity 0.16s var(--ease-out), transform 0.16s var(--ease-out);
}

.theme-menu-enter-from,
.theme-menu-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .theme-trigger,
  .theme-trigger-chevron,
  .theme-menu-enter-active,
  .theme-menu-leave-active {
    transition: none;
  }
}
</style>
