// 侧边栏搜索的全文索引（含小节锚点）。
//
// 这份索引刻意独立于页面 payload：如果把 body 放进 layout 的 queryCollection，
// Nuxt 会把整站全文序列化进每一个路由的 _payload.json，导致每次侧边栏跳转都要
// 重新下载数 MB。这里改成单一 URL 的静态文件，浏览器缓存一次即可，且只在用户
// 首次使用搜索框时才由客户端拉取。
//
// 结构见 server/utils/searchIndex.mjs 的 IndexEntry：
//   { [slug]: { title, cat, type, v, n, tag, text, sections } }
//   text     —— 正文纯文本（小写、空白已折叠）
//   sections —— 小节锚点 { id, start, h }：id 取自 minimark AST 里 MDC 生成的
//                props.id（与页面上 <h2 id="..."> 一致），start 是小节正文在 text
//                中的字符偏移，h 是小节标题文本
//
// 构建逻辑放在 server/utils/searchIndex.mjs：那里是纯函数，能被
// tests/search-index.test.mjs 用真实内容数据直接验证，不必靠"跑一遍构建再看产物"。

import { buildIndex } from '../utils/searchIndex.mjs'

export default defineEventHandler(async (event) => {
  // @ts-expect-error server queryCollection requires (event, collection)
  const items: Array<Record<string, any>> = await queryCollection(event, 'dao')
    .select('title', 'slug', 'type', 'body', 'category', 'volume', 'chapterOrder')
    .all()

  setHeader(event, 'content-type', 'application/json; charset=utf-8')

  return buildIndex(items)
})
