export type Theme = 'light' | 'dark' | 'green'

export const themeMetaColors: Record<Theme, string> = {
  light: '#f8f5f0',
  dark: '#1a1a1a',
  green: '#c0edc6',
}

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'green'
}

const theme = ref<Theme>('light')

function applyTheme(t: Theme) {
  document.documentElement.classList.remove('dark', 'green')
  if (t !== 'light') document.documentElement.classList.add(t)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeMetaColors[t])
}

export function useTheme() {
  const setTheme = (nextTheme: Theme) => {
    theme.value = nextTheme
    applyTheme(nextTheme)
    try {
      localStorage.setItem('theme', nextTheme)
    } catch {
      // The active page can still honor the choice when persistence is unavailable.
    }
  }

  onMounted(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem('theme')
    } catch {
      // A storage policy should not prevent the visible theme from initializing.
    }
    if (isTheme(stored)) {
      theme.value = stored
    } else {
      theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    applyTheme(theme.value)
  })

  return { theme: readonly(theme), setTheme }
}
