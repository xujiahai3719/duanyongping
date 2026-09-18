// 中文数字：章节号 → 汉字（第一章、第十二章……）
//
// 放在 .mjs 里是因为它同时被浏览器端（侧边栏、搜索面板）和 node --test 使用，
// 见 tests/search-index.test.mjs。

/**
 * @param {number} value
 * @returns {string}
 */
export function chineseNumber(value) {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (!Number.isFinite(value) || value < 0) return String(value)
  if (value < 10) return digits[value]
  if (value < 20) return `十${value % 10 ? digits[value % 10] : ''}`
  return `${digits[Math.floor(value / 10)]}十${value % 10 ? digits[value % 10] : ''}`
}

/**
 * 投资问答录章节在页面上显示为「第三章 品牌没有溢价」。
 *
 * @param {{ type?: string, title?: string, n?: number }} entry
 * @returns {string}
 */
export function chapterLabel(entry) {
  const title = entry?.title || ''
  if (entry?.type !== 'qanda-chapter' || !entry.n) return title
  return `第${chineseNumber(entry.n)}章 ${title}`
}
