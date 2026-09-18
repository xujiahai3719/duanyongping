type DaoItem = {
  slug: string
  title: string
  description: string
  category?: string
  order?: number
  type?: string
}

const CATEGORY_ORDER = ['核心哲学', '投资理念', '企业经营', '品格与心性', '财务指标', '访谈实录', '投资问答录']

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')

  // @ts-expect-error server queryCollection requires (event, collection)
  const items: DaoItem[] = await queryCollection(event, 'dao')
    .select('slug', 'title', 'description', 'category', 'order', 'type')
    .all()

  const grouped = new Map<string, DaoItem[]>()
  for (const item of items) {
    if (item.type !== 'legacy-index' && item.type !== 'topic-index') {
      const key = item.category || '其他'
      const list = grouped.get(key) || []
      list.push(item)
      grouped.set(key, list)
    }
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
  }

  const orderedKeys = [
    ...CATEGORY_ORDER.filter((c) => grouped.has(c)),
    ...[...grouped.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  const lines: string[] = []
  lines.push('# 段永平投资问答录｜段永平投资问答录 — 全站文章索引')
  lines.push('')
  lines.push('> 整理段永平公开的投资与经营问答、演讲与访谈。本站为整理性二手资料，原文版权归段永平本人。')
  lines.push('')

  for (const key of orderedKeys) {
    lines.push(`## ${key}`)
    lines.push('')
    for (const item of grouped.get(key) || []) {
      lines.push(`- [${item.title}](${siteUrl}/${item.slug}): ${item.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
})
