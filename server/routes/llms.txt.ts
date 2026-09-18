export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  return `# 段永平投资问答录｜段永平投资问答录

> 整理段永平公开的投资与经营问答、演讲与访谈，关于价值投资、商业本质与人生哲学的中文资料站。本站为整理性二手资料，原文版权归段永平本人。

## 主要分类

- 核心哲学：本分、平常心、做对的事情、Stop doing list 等底层理念
- 投资理念：买股票就是买公司、安全边际、能力圈、价值投资方法论
- 企业经营：商业模式、差异化竞争、企业文化、品牌战略
- 品格与心性：理性、耐心、诚信、平常心
- 财务指标：现金流、净资产、真实利润等关键指标
- 访谈实录：历年演讲、采访、对话实录
- 投资问答录：雪球问答与投资者对话精选

## 推荐入口

- 首页 / 目录：${siteUrl}/
- 本分：${siteUrl}/benfen
- 平常心：${siteUrl}/pingchangxin
- 不做什么 (Stop doing list)：${siteUrl}/buzuoshenme
- 价值投资：${siteUrl}/jiazhitouzi
- 安全边际：${siteUrl}/anquanbianji
- 能力圈：${siteUrl}/nengliquan
- 商业模式：${siteUrl}/shangyemoshi
- 护城河：${siteUrl}/huchenghe
- 企业文化：${siteUrl}/qiyewenhua

## 资源

- 全站文章索引：${siteUrl}/llms-full.txt
- 站点地图：${siteUrl}/sitemap.xml
`
})
