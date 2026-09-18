export interface ArticleShareSource {
  title: string
  url: string
}

export interface ArticleSelection {
  html: string
  text: string
}

export interface ArticleCopyContent {
  html: string
  text: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function buildArticleShareText(source: ArticleShareSource): string {
  return `${source.title}\n原文链接：${source.url}`
}

// 读者在正文里选中文字复制时，把同样的标题 + 原文链接接在选区后面。
export function buildArticleCopyContent(
  source: ArticleShareSource,
  selection: ArticleSelection,
): ArticleCopyContent {
  const safeTitle = escapeHtml(source.title)
  const safeUrl = escapeHtml(source.url)

  return {
    html: `${selection.html}<p>${safeTitle}<br>原文链接：<a href="${safeUrl}">${safeUrl}</a></p>`,
    text: `${selection.text}\n\n${buildArticleShareText(source)}`,
  }
}
