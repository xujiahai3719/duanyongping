export const ARTICLE_FONT_SIZE_LEVELS = [90, 100, 110, 120, 130] as const
export const ARTICLE_FONT_SIZE_DEFAULT = 100
export const ARTICLE_FONT_SIZE_STORAGE_KEY = 'article-font-size-percent'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
type StyleLike = Pick<CSSStyleDeclaration, 'setProperty'>

export function normalizeArticleFontSizePercent(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return ARTICLE_FONT_SIZE_LEVELS.includes(parsed as typeof ARTICLE_FONT_SIZE_LEVELS[number])
    ? parsed
    : ARTICLE_FONT_SIZE_DEFAULT
}

export function stepArticleFontSizePercent(value: unknown, direction: -1 | 1): number {
  const current = normalizeArticleFontSizePercent(value)
  const currentIndex = ARTICLE_FONT_SIZE_LEVELS.indexOf(current as typeof ARTICLE_FONT_SIZE_LEVELS[number])
  const nextIndex = Math.min(
    ARTICLE_FONT_SIZE_LEVELS.length - 1,
    Math.max(0, currentIndex + direction),
  )
  return ARTICLE_FONT_SIZE_LEVELS[nextIndex] ?? ARTICLE_FONT_SIZE_DEFAULT
}

export function loadArticleFontSizePercent(storage: Pick<StorageLike, 'getItem'>): number {
  return normalizeArticleFontSizePercent(storage.getItem(ARTICLE_FONT_SIZE_STORAGE_KEY))
}

export function applyArticleFontSizePercent(style: StyleLike, value: unknown): number {
  const normalized = normalizeArticleFontSizePercent(value)
  style.setProperty('--article-font-scale', `${normalized}%`)
  return normalized
}

export function saveArticleFontSizePercent(
  storage: Pick<StorageLike, 'setItem'>,
  style: StyleLike,
  value: unknown,
): number {
  const normalized = applyArticleFontSizePercent(style, value)
  storage.setItem(ARTICLE_FONT_SIZE_STORAGE_KEY, String(normalized))
  return normalized
}
