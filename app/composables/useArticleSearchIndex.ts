// 侧边栏搜索用的全文索引，由 server/routes/search-index.json.ts 在构建时预渲染。
//
// 刻意不放进页面 payload：layout 的 queryCollection 结果会被序列化进每个路由的
// _payload.json，带上正文就等于每次跳转都重下整站全文。这里改成单一 URL，只在
// 用户第一次使用搜索框时拉一次，之后走浏览器缓存，跳转路径上零开销。
//
// 模块级单例：桌面侧边栏与移动端抽屉是两个组件实例，共享同一次请求。

import { searchIndex } from '~/utils/searchSnippet.mjs'

/** 搜索面板渲染一行结果需要的字段（片段见 searchSnippet.mjs 的 Snippet） */
export type SearchMeta = {
  title?: string
  category?: string
  description?: string
  chapterOrder?: number
  volume?: string
  type?: string
}

export type SearchHit = {
  slug: string
  title: string
  label: string
  cat: string
  /** 命中所在小节的标题文本（面包屑用），无小节时为空 */
  sectionLabel: string
  matchRank: number
  titleHit: boolean
  /** 命中所在小节的锚点 id；为空表示跳到文章顶部 */
  headingId: string
  sectionIndex: number
  snippet: { text: string, truncatedStart: boolean, truncatedEnd: boolean, segments: Array<{ text: string, hit: boolean }> } | null
}

// 索引整体替换、内部不做响应式追踪，所以包一层 ref 就够
const index = ref<Record<string, any> | undefined>(undefined)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let request: Promise<void> | null = null

/** 拉取/复用全文索引；索引未就绪时检索会自动退回标题与摘要 */
export function useArticleSearchIndex() {
  const load = () => {
    if (!import.meta.client || request || index.value) return request

    status.value = 'loading'
    request = $fetch<Record<string, any>>('/search-index.json')
      .then((data) => {
        index.value = data
        status.value = 'ready'
      })
      .catch(() => {
        // 拉取失败时退回元数据搜索，并允许下次输入重试
        status.value = 'error'
        request = null
      })

    return request
  }

  const search = (
    query: string,
    lookup?: (slug: string) => SearchMeta | undefined,
    options: { limit?: number, rowsPerEntry?: number } = {},
  ): { results: SearchHit[], total: number } => searchIndex(index.value || {}, query, {
    lookup,
    limit: options.limit ?? 40,
    rowsPerEntry: options.rowsPerEntry ?? 4,
  })

  return {
    index: readonly(index),
    status: readonly(status),
    load,
    search,
  }
}
