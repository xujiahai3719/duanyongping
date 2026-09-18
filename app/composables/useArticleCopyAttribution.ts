import { buildArticleCopyContent, type ArticleShareSource } from '~/utils/articleShare'

// 读者在正文里选中文字复制时，往剪贴板里补一段标题 + 原文链接的尾注。
// 只接管落在正文容器内的选区；选区跨出正文（比如连侧边栏一起框选）就让浏览器按默认行为复制。
// cloneContents 会把 Vue 的 fragment 锚点（<!--[--> / <!--]-->）一起复制出去，粘贴到别处是噪音
function stripComments(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const comments: Comment[] = []
  while (walker.nextNode()) comments.push(walker.currentNode as Comment)
  for (const comment of comments) comment.remove()
}

export function useArticleCopyAttribution(
  contentId: string,
  source: MaybeRefOrGetter<ArticleShareSource>,
) {
  onMounted(() => {
    const onCopy = (event: ClipboardEvent) => {
      const root = document.getElementById(contentId)
      const selection = window.getSelection()
      if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return
      if (!event.clipboardData) return

      const range = selection.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) return

      const text = selection.toString().trim()
      if (!text) return

      const holder = document.createElement('div')
      holder.append(range.cloneContents())
      stripComments(holder)

      const content = buildArticleCopyContent(toValue(source), { html: holder.innerHTML, text })
      event.clipboardData.setData('text/plain', content.text)
      event.clipboardData.setData('text/html', content.html)
      event.preventDefault()
    }

    document.addEventListener('copy', onCopy)
    onBeforeUnmount(() => document.removeEventListener('copy', onCopy))
  })
}
