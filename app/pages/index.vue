<script setup lang="ts">
const daoCategoryOrder = ['访谈实录', '投资问答录', '核心哲学', '投资理念', '企业经营', '品格与心性', '财务指标', '公司与人物', '推荐书单']

const categoryMeta: Record<string, { icon: string; desc: string }> = {
  '核心哲学': { icon: '道', desc: '段永平的核心思想体系：本分、平常心、做对的事情。商业与人生的底层逻辑。' },
  '投资理念': { icon: '投', desc: '买股票就是买公司。关于价值投资、安全边际、能力圈的深度思考。' },
  '企业经营': { icon: '商', desc: '商业模式、差异化竞争、企业文化、品牌战略等经营智慧。' },
  '品格与心性': { icon: '心', desc: '理性、耐心、诚信、平常心——投资与经营背后的品格修养。' },
  '财务指标': { icon: '数', desc: '现金流、净资产、真实利润等关键财务指标的理解与应用。' },
  '访谈实录': { icon: '录', desc: '历年演讲、采访、对话实录，还原段永平商业思想的完整脉络。' },
  '投资问答录': { icon: '问', desc: '精选雪球问答与投资者对话，涵盖个股分析、投资方法与人生感悟。' },
  '公司与人物': { icon: '人', desc: '段永平高度评价、明显关注或正在重估的公司与人物档案。' },
  '推荐书单': { icon: '书', desc: '段永平历年亲口推荐、读过称赞、以及明确不推荐的书，一份带出处的清单。' },
}

type Book = { title: string; cover: string; url: string; comment: string; cite: string }
const bookCategories: Array<{ name: string; books: Book[] }> = [
  { name: '投资金融类', books: [
    { title: '大道段永平投资问答录', cover: '/books/dadao-touzi-wenda.jpeg', comment: '本站问答多辑录自此书——段永平历年在雪球等平台公开投资问答的合集。', cite: '编者按', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BAUYJK1olWAcFXF1UAUwQCl8IHl4VXwUDXG4ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYHUV5fC0ofHDZNRwYbGVlaCgEhXB5PUwpYTVcWMwdsVG4Jfz1tZGpaEzkSL3NaEikAbwBcBSZeF1clXDYBVVxUC00fA2gMK2sVWjZQOlZVAE8SAW0MHVwWbQcyVFhUCE4SAW0PHV8dVTYFVFdtUx55BGYKHQ9HWAdWVVpUCHsnM2w4HFscSQBwFQxJDjknM284GGsVXAYKV15eDUsVA3MIG1IXVQYeVFhUCE4SAW0LGlscWDYAVV9ZAXsn3eK4bF1UW3gBBidZVQlgdhJuRYWY7Rd-I1dfCk8GM2t4Eh9iI15QLg4WYQ9Vez9LHgVzNEJALB05SkpqCgEKH1gRHX5iHzUkbyxMRA93ZjklWDYCUl5fOA' },
    { title: '巴菲特致股东的信', cover: '/books/bafeite-zhigudong-xin.jpeg', comment: '头号推荐。他称这是“本人唯一看过的书”，“看懂了巴菲特，别的书不看也没关系”。', cite: '段永平 2010', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcKUltVAE0QAF8IHloRWQILUW4ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYHVVpZDEISHDZNRwYlJXFpDD5cfSN1SwlNcxATKl1qHFYnaEcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4AV1xZDUgeCl8JK1sTVAYHUVxZD0MeC2k4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGl4SVQ8DVldBCEoSC2wJB1sTVAYHUVxZDEIUA2s4GVoUWQ8yZIDQuDEUcRdSExJoD3R-ERg-STjJjt8ZaSsVXwQCRW4meytrcwdafV8RVUZ-JgAHaxxnRy90aQVDWlBAUz4zCkwSRicLW1NLNAEFHQM5UzxUM2o4G10VXzY' },
    { title: '巴菲特忠告中国股民', cover: '/books/bafeite-zhonggao.jpeg', comment: '专门推荐给价值投资初学者：“作者对巴菲特的理解非常好……值得一看。”', cite: '段永平 2011-01-04', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcKUltVAE0QAF8IGFkdWAYGV24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYBVlZYCE8UHDZNRwYlVHJgKT0aWg13cS9rUAZHWV5qTiBZaEcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4AV1xZDUgeCl8JK1sTVAYHUVxaC0gTC2Y4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGlkQWAEBV19BCEsSBGwMB1sTVAYHUVxaC0oVCm04GVoUWQ8yZIDQuD1kcQRoGBJuKV4FEg0dCgLJjt8ZZz8RXQcHRW4JTEIXWBBIbQNGG3kCNyQFfyJxShAIeCFvWFIGH1czCkITZDRRQh1xVXVxDg0aaxFxM2o4G10VXzY' },
    { title: '穷查理宝典', cover: '/books/qiongchali-baodian.jpeg', comment: '“这本书不错，在此再次推荐一下。”尤其称赞李录写的序。', cite: '段永平 2010', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BAUYJK1olWAcFXF1UAUwQCl8IGVkVWwEBV24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYAVl5bD0gUHDZNRwYbGVlaCgEhXB5PUwpYTVcWMwdsVG45bhdsQWhMbDlmGW0HKDcASA8WZxpoF1clXDYBVVxUC00fA2gMK2sVWjZQOlZVAE8SAW0MHVwWbQcyVFhUCE4SAWgPEloUXDYFVFdtUx55BGYKHQ9HWAdWVVpUCHsnM2w4HFscSQBwFQxJDjknM284GGsVXAYDUF1eDE0VB3MIGFgQXwQeVFhUCE4SAWgMH18WWDYAVV9ZAXsn3eK4YSxTJk0HECAAfyhCRQ1Xb4WY7RdwJF5ZCU0GMwRPHjJtWVJDNCYEdSJfAzxeYz9dIG9KVD8rXhFtBgEKfS9TNn5mDR4-TQ5nZmtITgQlWDYCUl5fOA' },
    { title: '富爸爸穷爸爸', cover: '/books/fubaba-qiongbaba.jpeg', comment: '给初学者：“觉得巴菲特一时不好懂，可以看看这本书。”', cite: '段永平 2010-05-26', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BAUUJK1olWAcKUltVAE0QAF8IGFwRWgYCUW4ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYBU1paCEsSHDZNRwYbGVlaCgEhXB5PUwpYTVcWMwdsVG4GSilgcDpRUzhNP3NlKCI5XC1KSAleF1clXDYBVVxUC00fA2gMK2sVWjZQOlZVAEkUAWsNGFIcbQcyVFhUCE4SAWkNE1gTXTYFVFdtUx55BGYKHQ9HWAdWVVpUCHsnM2w4HFscSQBwFQxJDjknM284GGsVXAYDU1peDUgXBHMIHl8QXwQeVFhUCE4SAWkIGlodXTYAVV9ZAXsn3eK4fC9zGXMLCilcahlpRQ9UfIWY7RdwP15ZDVonS2YNf1xUA3FFLwA8bD1gQRJQfQV0OXB1ICAhSyMSbW1AXxJzJnBcUx49aB1JXDVpSWsQbQYEVFxt' },
  ] },
  { name: '企业管理类', books: [
    { title: '从优秀到卓越', cover: '/books/cong-youxiu-dao-zhuoyue.jpeg', comment: '常和《基业长青》一起推荐：“建议看下《基业长青》和《从优秀到卓越》这两本书。”', cite: '段永平 2019-03-23', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcFXF1UAUwQCl8IGF0XWAAAV24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYBUlxYDkkUHDZNRwYlPXgGKlwpcyh3Xw1xYzlOCnkcEBleeEcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4GUVxfDE0QAF8JK1sTVAYHUVxUDU0RAm84HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGl8XWQAFVFtBCEgVAGsMB1sTVAYHUVxbDk8TBG44GVoUWQ8yZIDQuDkVSxZrHgNCHn9rL18HQTjJjt8ZZywRWg8CRW4DQSJDazNTTiJVPwRWKAEiUSxfW21cZwQTFV5UCjczCi5_QBVOfzlmA0dDVDheayBpM2o4G10VXzY' },
    { title: '基业长青', cover: '/books/jiye-changqing.jpeg', comment: '“是本好书啊，确实值得看。”印象最深的是书里的 stop-doing list（不为清单）。', cite: '段永平 2012 / 2013', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATEJK1olWAcFXF1UAUwQCl8IGF0XWAAHU24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYBUlxYDk4QHDZNRwYlPlUDVAwhSD11VmgOGzlTXAMKIQ0EXkcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4GUVxfDE0QAF8JK1sTVAYHUVxUAUwVA2w4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGl8QWAIDXV9BCEwXBGwKB1sTVAYHUVxUDk4TBmk4GVoUWQ8yZIDQuDljABp4HhpDWWZ5MAwCdyzJjt8ZaTAVWQMTZCIkaDVOeBRceQNQO3h1Vx0ffx8SZRF_GBBBJWUHNDBfay5xXGxRXiBhGUJ8MCVcWy0nBl8IHVsXbQ' },
    { title: '赢 Winning', cover: '/books/ying-winning.jpeg', comment: '讲企业文化如何传递，他多次“建议看韦尔奇的《赢》”。', cite: '段永平', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcKUltVAE0QAF8IGFoTXQQKUG4ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYBVVhdCkMTHDZNRwYlVVFDVSM9QS5yXBkNTCdVW0ZyVSwCXkcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4AV1xZDUgeCl8JK1sTVAYHUVxVAU8WBms4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGl8UWQIGUVlBCEsSBWYAB1sTVAYHUVxVD0sQAWw4GVoUWQ8yZIDQuC4RdwRAGBlTHnVrIiUebx_Jjt8ZaSsXWQAFRW5eSCtLeRl2egZVHwFePAYpVxtld2hUcwNtAEJVCT4zCkt3BG16XhkVPFJWMS4qaSNTM2o4G10VXzY' },
    { title: '因为独特', cover: '/books/yinwei-dute.jpeg', comment: '极力推荐，“大学毕业后第一本读完了的书”，反复让人“先好好看看这本书”。', cite: '段永平 2026', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcKUlxVDU4RC18IHlwdWQ8DV24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYHU1ZZAUoUHDZNRwYlWkdKKycfXyB1RXV1UzpVPF4BUgYgeEcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4BVVpVDkMVA18JK1sTVAYHUVtcD0geA2k4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGl4SVQAKXVpBCE8fBm0JB1sTVAYHUVtcDEkWB2s4GVoUWQ8yZIDQuDFkczoLax1wAkZ5HF0mbj7Jjt8ZaSsVXwQCRW4ufysfeGZsU118GkAKKiM2aAhKcykAZSYSAgFRED4zChJMARJObhxtXnZyEQo0Wz5CM2o4G10VXzY' },
  ] },
  { name: '人物传记类', books: [
    { title: '乔布斯传', cover: '/books/qiaobusi-zhuan.jpeg', comment: '最后一章乔布斯的自述，他说“我反复读了很多遍……一个虽有阴暗面却始终闪亮的灵魂”。', cite: '段永平', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcKUlxVDU4RC18IGVISXAcGU24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYAXVlcCU8QHDZNRwYlPnRnMwRDbChycDtwTg50D3NSPB4aXkcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4BVVpVDkMVA18JK1sTVAYHUVtdCUoWAGo4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGlwWWAUDU1xBCEwUB2wIB1sTVAYHUVtcAU4SAG44GVoUWQ8yZIDQuC0Udmx2HFtvAG8ALiwqehfJjt8ZcCIVVQ4ERW4pXE5JBw5rGy5sOF9cPQ0eYBlnaDZWcghzGH51LVszCg5fdCkKGj5KXWBkDR9ecAp3M2o4G10VXzY' },
    { title: '杰克·韦尔奇自传', cover: '/books/weierqi-zizhuan.jpeg', comment: '对他建立企业文化“印象最深”，也是巴菲特向股东推荐过的书。', cite: '段永平', url: 'https://union-click.jd.com/jdc?e=618%7Cpc%7C&p=JF8BATIJK1olWAcKUltVAE0QAF8IGFscWQMAV24ZVxNJXF9RXh5UHw0cSgYYXBcIWDoXSQVJQwYBVFdZDUkUHDZNRwYlC1NWVRgqdTJ3YzNRWzpoA11LN1kueEcbM244GFoXVAUEXF5aDHsnA2g4STUdVQ4AV1xZDUgeCl8JK1sTVAYHUVtdDk8VB2Y4HFscbV1XOllUCk1DUWoJT1oRVAYyZG5eOEwXCnsOaRpHSQBwZG5dOEgnA24IGl4SVQ8BV1lBCE4eBW4JB1sTVAYHUVtdD0seA2k4GVoUWQ8yZIDQuDdjcwZUHT5wBgReCScDSDzJjt8ZaSsXWQAFRW4AXytIYjdqRCAROmRdCjskUElBCw1XRT5HB1R_KT4zCjt1Wxd8STxyDl9bMl5UD0hXM2o4G10VXzY' },
  ] },
]

// 在预渲染时把每本书的京东链接生成二维码（SVG），随静态 HTML 一起产出；
// 用动态 import + useAsyncData 保证仅在服务端生成、结果序列化到 payload，不进客户端包。
const { data: bookQrs } = await useAsyncData('book-qrs', async () => {
  const QRCode = (await import('qrcode')).default
  const out: Record<string, string> = {}
  for (const cat of bookCategories) {
    for (const book of cat.books) {
      out[book.title] = await QRCode.toString(book.url, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'L',
        color: { dark: '#1a1a1a', light: '#ffffff' },
      })
    }
  }
  return out
})

const { data: daoArticles } = await useAsyncData('library-dao', () =>
  queryCollection('dao').select('title', 'slug', 'category', 'order', 'type').order('order', 'ASC').all()
)

type Article = { title: string; slug: string; category: string; order: number; type?: string }

type Group = { category: string; items: Article[]; count: number; icon: string; desc: string; href: string }

const groups = computed<Group[]>(() => {
  const articles = (daoArticles.value as Article[]) || []
  const map = new Map<string, Article[]>()
  for (const article of articles.filter((article) => article.type !== 'legacy-index')) {
    const list = map.get(article.category) || []
    list.push(article)
    map.set(article.category, list)
  }

  return daoCategoryOrder
    .filter((cat) => map.has(cat))
    .map((cat) => {
      const items = map.get(cat)!
      const isQanda = cat === '投资问答录'
      return {
        category: cat,
        items,
        count: isQanda ? items.filter((article) => article.type === 'qanda-chapter').length : items.length,
        icon: categoryMeta[cat]?.icon || '文',
        desc: categoryMeta[cat]?.desc || '',
        href: isQanda ? '/wenda-topic-index' : (items[0] ? `/${items[0].slug}` : '/'),
      }
    })
})

const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl || '').replace(/\/$/, '')

useSeoMeta({
  title: '大道总纲｜段永平投资问答录',
  description: '大道总纲精华——价值投资核心阅读资料。',
  ogTitle: '大道总纲',
  ogDescription: '大道总纲精华——价值投资核心阅读资料。',
  twitterCard: 'summary_large_image',
  ogImage: `${siteUrl}/og-image.png`
})

const duanyongpingPerson = {
  '@type': 'Person',
  name: '段永平',
  alternateName: ['Duan Yongping', 'BBQ'],
  description: '步步高、OPPO、vivo 创始人；心平基金创办人；价值投资者。',
  sameAs: [
    'https://xueqiu.com/u/1247347556',
    'https://www.oppo.com/',
    'https://zh.wikipedia.org/wiki/%E6%AE%B5%E6%B0%B8%E5%B9%B3',
  ],
}

const collectionSchema = computed(() => {
  const articles = ((daoArticles.value as Article[]) || [])
    .filter((article) => article.type !== 'legacy-index')
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '大道总纲｜段永平投资问答录',
    description: '整理段永平公开的投资与经营问答、演讲与访谈。',
    url: siteUrl || '/',
    inLanguage: 'zh-CN',
    about: duanyongpingPerson,
    isPartOf: { '@type': 'WebSite', name: '大道总纲｜段永平投资问答录', url: siteUrl },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: articles.length,
      itemListElement: articles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${siteUrl}/${a.slug}`,
        name: a.title,
      })),
    },
  }
})

useHead({
  link: [{ rel: 'canonical', href: '/' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        ...duanyongpingPerson,
      })),
    },
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify(collectionSchema.value)),
    },
  ],
})
</script>

<template>
  <div class="home-content">
    <section class="book-cover">
      <div class="cover-accent-line"></div>
      <h1 class="cover-title">大 道 总 纲</h1>
      <div class="cover-accent-line"></div>
      <p class="cover-quotes">"买股票就是买公司。人们关注我们往往是因为我们做了的那些事情，其实我们之所以成为我们，很大程度上还因为我们不做的那些事情。"</p>
      <div class="author-cards">
        <a href="https://xueqiu.com/u/1247347556" target="_blank" rel="noopener" class="author-card">
          <div class="author-card-body">
            <span class="author-card-label">大道：段永平雪球主页</span>
            <span class="author-card-url">xueqiu.com/u/1247347556</span>
          </div>
          <svg class="author-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </a>
        <a href="https://xueqiu.com/u/lovelive" target="_blank" rel="noopener" class="author-card">
          <div class="author-card-body">
            <span class="author-card-label">作者：随水而行的 Star</span>
            <span class="author-card-url">xueqiu.com/u/lovelive</span>
          </div>
          <svg class="author-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </a>
      </div>
    </section>

    <div class="overview-grid">
      <NuxtLink v-for="(group, i) in groups" :key="group.category" class="overview-card"
        :to="group.href" :style="{ animationDelay: `${0.1 + i * 0.06}s` }">
        <div class="card-icon-wrap">
          <span class="card-icon">{{ group.icon }}</span>
        </div>
        <div class="card-body">
          <div class="card-top">
            <h2>{{ group.category }}</h2>
            <span class="card-count">{{ group.count }} 篇</span>
          </div>
          <p class="card-desc">{{ group.desc }}</p>
        </div>
      </NuxtLink>
    </div>

    <section class="book-shelf">
      <div class="shelf-divider"><span>段永平荐读书单</span></div>
      <p class="shelf-hint">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        附段永平本人评点 · 点击书封或扫码即可前往京东购买正版
      </p>
      <div v-for="cat in bookCategories" :key="cat.name" class="shelf-group">
        <h3 class="shelf-cat">{{ cat.name }}</h3>
        <ul class="book-list">
          <li v-for="book in cat.books" :key="book.title" class="book-row">
            <a class="book-cover-link" :href="book.url" target="_blank" rel="noopener noreferrer sponsored"
              :title="`前往京东购买正版《${book.title}》`">
              <img :src="book.cover" :alt="book.title" loading="lazy" width="80" height="120" />
              <span class="book-buy">京东购买 ›</span>
            </a>
            <div class="book-info">
              <a class="book-row-title" :href="book.url" target="_blank" rel="noopener noreferrer sponsored">{{
                book.title }}</a>
              <p class="book-comment">{{ book.comment }}</p>
              <div class="book-meta">
                <span v-if="book.cite" class="book-cite">{{ book.cite }}</span>
                <a class="book-buy-link" :href="book.url" target="_blank" rel="noopener noreferrer sponsored">京东购买正版
                  ›</a>
              </div>
            </div>
            <a class="book-qr" :href="book.url" target="_blank" rel="noopener noreferrer sponsored"
              :title="`扫码或点击购买《${book.title}》`" aria-label="扫码购买">
              <span class="book-qr-img" v-html="bookQrs?.[book.title] || ''"></span>
              <span class="book-qr-label">扫码购买</span>
            </a>
          </li>
        </ul>
      </div>
      <NuxtLink class="shelf-source" to="/tuijianshudan">评点摘自《段永平推荐书单》（按出处时间核对）›</NuxtLink>
    </section>

  </div>
</template>

<style scoped>
.home-content {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 20px var(--px) 56px;
  animation: fadeInUp 0.5s var(--ease-out) both;
}

/* ── Book Cover Hero ── */

.book-cover {
  text-align: center;
  padding: 30px 0 28px;
  margin-bottom: 30px;
}

.cover-accent-line {
  width: 88px;
  height: 2px;
  background: var(--accent);
  margin: 0 auto;
}

.cover-title {
  margin: 18px 0;
  font-family: var(--serif);
  font-size: 32px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.18em;
  color: var(--fg);
}

.cover-quotes {
  max-width: 600px;
  margin: 24px auto;
  font-family: var(--reading);
  font-size: 16px;
  line-height: 1.8;
  color: var(--muted);
}

/* ── Author Cards ── */

.author-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  max-width: 600px;
  margin: 24px auto 0;
  text-align: left;
}

.author-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 6px;
  text-decoration: none;
  color: var(--fg);
  transition: border-color 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
}

.author-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(181, 70, 42, 0.08);
  color: var(--fg);
}

.author-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author-card-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.author-card-url {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.author-card-arrow {
  flex-shrink: 0;
  color: var(--muted);
  transition: color 0.2s var(--ease-out), transform 0.2s var(--ease-out);
}

.author-card:hover .author-card-arrow {
  color: var(--accent);
  transform: translateX(2px);
}

/* ── Book Shelf ── */

.book-shelf {
  margin-bottom: 40px;
}

.shelf-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.shelf-divider::before,
.shelf-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line);
}

.shelf-divider span {
  font-family: var(--serif);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--fg);
  white-space: nowrap;
}

.shelf-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: -8px 0 22px;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  color: var(--accent);
}

.shelf-hint svg {
  flex-shrink: 0;
  opacity: 0.85;
}

.shelf-group + .shelf-group {
  margin-top: 28px;
}

.shelf-cat {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 700;
  color: var(--muted);
}

.shelf-cat::before {
  content: "";
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--accent);
}

.book-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* One book per row: cover · commentary · QR */
.book-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--line);
}

.book-row:last-child {
  border-bottom: 1px solid var(--line);
}

/* ── Cover (clickable to buy) ── */
.book-cover-link {
  position: relative;
  flex-shrink: 0;
  align-self: flex-start;
  display: block;
  width: 64px;
  border-radius: 5px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 3px 10px rgba(26, 24, 20, 0.1);
  transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
}

.book-cover-link img {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: contain;
}

/* Hover overlay — "buy genuine" affordance (desktop) */
.book-buy {
  display: none;
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  padding: 5px 4px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: #fff;
  background: linear-gradient(to top, rgba(181, 70, 42, 0.96), rgba(181, 70, 42, 0.78));
  transform: translateY(100%);
  transition: transform 0.25s var(--ease-out);
}

.book-cover-link:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 22px rgba(181, 70, 42, 0.18);
}

.book-cover-link:hover .book-buy {
  transform: translateY(0);
}

/* ── Commentary column ── */
.book-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.book-row-title {
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--fg);
  text-decoration: none;
  transition: color 0.2s var(--ease-out);
}

.book-row-title:hover {
  color: var(--accent);
}

.book-comment {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted);
}

.book-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 8px;
  padding-top: 0;
}

.book-cite {
  font-size: 12px;
  color: var(--subtle);
}

.book-buy-link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}

.book-buy-link:hover {
  text-decoration: underline;
}

/* ── QR column (scan to buy) ── white box keeps it scannable in dark mode ── */
.book-qr {
  flex-shrink: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 96px;
  text-decoration: none;
}

.book-qr-img {
  display: block;
  width: 96px;
  height: 96px;
  padding: 6px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 6px;
  box-sizing: border-box;
  transition: border-color 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
}

.book-qr-img :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.book-qr:hover .book-qr-img {
  border-color: var(--accent);
  box-shadow: 0 4px 14px rgba(181, 70, 42, 0.16);
}

.book-qr-label {
  font-size: 11.5px;
  color: var(--subtle);
  letter-spacing: 0.02em;
  transition: color 0.2s var(--ease-out);
}

.book-qr:hover .book-qr-label {
  color: var(--accent);
}

/* ── Source attribution ── */
.shelf-source {
  display: inline-block;
  margin-top: 18px;
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.2s var(--ease-out);
}

.shelf-source:hover {
  color: var(--accent);
}

/* ── Category Cards Grid ── */

.overview-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 40px;
}

.overview-card {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  box-shadow: none;
  transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out), border-color 0.3s var(--ease-out);
  animation: cardIn 0.5s var(--ease-out) both;
}

.overview-card:hover {
  transform: none;
  box-shadow: none;
  border-color: var(--accent);
}

:root .overview-card {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

:root .overview-card:hover {
  border-color: var(--accent);
}

/* ── Card Icon ── */

.card-icon-wrap {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: var(--accent-soft);
  transition: background 0.25s var(--ease-out);
}

.overview-card:hover .card-icon-wrap {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.card-icon {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}

/* ── Card Body ── */

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.overview-card h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  transition: color 0.2s var(--ease-out);
}

.overview-card:hover h2 {
  color: var(--accent);
}

.card-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
  opacity: 0.7;
}

.card-desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Card entrance animation ── */

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Responsive ── */

@media (min-width: 721px) {
  .home-content {
    padding: 32px var(--px) 72px;
  }

  .book-cover {
    padding: 42px 0 36px;
    margin-bottom: 38px;
  }

  .cover-accent-line {
    width: 112px;
  }

  .cover-title {
    font-size: 38px;
    letter-spacing: 0.28em;
  }

  .cover-quotes {
    font-size: 19px;
  }

  .author-cards,
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .author-card {
    padding: 14px 16px;
  }

  .book-row {
    gap: 16px;
    padding: 18px 0;
  }

  .book-cover-link {
    width: 76px;
  }

  .book-row-title {
    font-size: 16px;
  }

  .book-comment {
    font-size: 13.5px;
  }

  .book-meta {
    margin-top: auto;
    padding-top: 10px;
  }

  .author-card-label {
    font-size: 15px;
  }

  .overview-card {
    padding: 20px 22px;
    background: var(--bg-elevated);
    border: 1.5px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: 6px;
  }

  .overview-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(181, 70, 42, 0.1);
  }

  .card-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 8px;
  }
}

@media (min-width: 1025px) {
  .home-content {
    padding: 36px var(--px) 72px;
  }

  .book-cover {
    padding: 48px 0 40px;
    margin-bottom: 40px;
  }

  .cover-accent-line {
    width: 120px;
  }

  .cover-title {
    font-size: 42px;
    letter-spacing: 0.35em;
  }

  .cover-quotes {
    margin: 30px auto;
    font-size: 21px;
    line-height: 1.85;
  }

  .author-cards {
    margin-top: 28px;
  }

  .shelf-divider {
    gap: 16px;
    margin-bottom: 24px;
  }

  .shelf-divider span {
    font-size: 19px;
  }

  .shelf-hint {
    margin: -12px 0 24px;
  }

  .book-row {
    gap: 18px;
  }

  .book-cover-link {
    width: 80px;
  }

  .book-buy {
    display: block;
  }

  .book-qr {
    display: flex;
  }

  .overview-card {
    gap: 16px;
    padding: 22px 24px;
  }

  .overview-card h2 {
    font-size: 20px;
  }
}
</style>
