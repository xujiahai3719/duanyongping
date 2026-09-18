// 分享按钮与「复制正文自动带出处」共用同一个绝对链接，避免两处兜底域名写歪。
// 本地 dev 一般没配 NUXT_PUBLIC_SITE_URL，这里兜底成线上域名，保证复制出去的链接可点。
export function useArticleShareUrl(slug: MaybeRefOrGetter<string>) {
  const config = useRuntimeConfig()

  return computed(() => {
    const base = String(config.public.siteUrl || 'https://duan.ayaseeri.com').replace(/\/$/, '')
    return `${base}/${toValue(slug)}`
  })
}
