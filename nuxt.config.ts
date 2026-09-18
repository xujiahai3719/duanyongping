export default defineNuxtConfig({
  modules: ["@nuxt/content"],
  css: ["~/assets/css/fonts.css", "~/assets/css/main.css"],
  compatibilityDate: "2026-04-27",
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      meta: [
        { name: "theme-color", content: "#f8f5f0" },
        { name: "format-detection", content: "telephone=no" },
        {
          name: "keywords",
          content:
            "段永平,大道,芒格,查理芒格,巴菲特,价值投资,安全边际,商业模式,生意模式,企业文化,管理层,价值观,能力圈",
        },
        {
          name: "description",
          content: "整理段永平投资问答录，关于投资与商业本质的思考集。",
        },
        { property: "og:site_name", content: "段永平投资问答录" },
        { property: "og:locale", content: "zh_CN" },
      ],
      script: [
        {
          innerHTML: `(function(){try{var s=null;try{s=localStorage.getItem('theme')}catch(e){}var t=s==='light'||s==='dark'||s==='green'?s:window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';var e=document.documentElement;e.classList.remove('dark','green');if(t!=='light')e.classList.add(t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#1a1a1a':t==='green'?'#c0edc6':'#f8f5f0')}catch(e){}})()`,
          type: "text/javascript",
        },
        {
          innerHTML: `(function(){try{var s=localStorage.getItem('article-font-size-percent');var n=Number(s);if(n===90||n===100||n===110||n===120||n===130)document.documentElement.style.setProperty('--article-font-scale',n+'%')}catch(e){}})()`,
          type: "text/javascript",
        },
        {
          type: "application/ld+json",
          innerHTML: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "段永平投资问答录",
            url: process.env.NUXT_PUBLIC_SITE_URL,
            description: "整理段永平投资问答录，关于投资与商业本质的思考集。",
            inLanguage: "zh-CN",
          }),
        },
        {
          innerHTML: `var _hmt = _hmt || [];
            (function() {
              var hm = document.createElement("script");
              hm.src = "https://hm.baidu.com/hm.js?e97a58a44fcce296ad36ac8b713018ef";
              var s = document.getElementsByTagName("script")[0];
              s.parentNode.insertBefore(hm, s);
            })();`,
          type: "text/javascript",
        },
      ],
      // 字体已自托管，见 app/assets/css/fonts.css —— 不要再引 fonts.googleapis.com，
      // 那是个阻塞首屏的第三方样式表，且在大陆不稳定。
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL,
      // Twikoo 评论后端地址（Cloudflare Worker URL）；为空则文章页不渲染评论区
      commentEnvId: process.env.NUXT_PUBLIC_COMMENT_ENV_ID,
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      concurrency: 5,
      routes: ["/sitemap.xml", "/robots.txt", "/llms.txt", "/llms-full.txt", "/search-index.json"],
    },
  },
});
