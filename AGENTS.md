This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

中文静态站点「段永平投资问答录 / 段永平投资问答录」，整理段永平相关投资与经营文章。技术栈：Nuxt 4 + Vue 3 + Nuxt Content v3。最终产物是预渲染的静态文件，部署到 Nginx / Cloudflare Pages 等。

注意：根目录 `README.md` 描述的是更早期的"模型文章 + `content/models`"形态，与当前实际内容结构不一致；以本文件为准。

## Commands

```bash
npm run dev         # 本地开发
npm run typecheck   # Nuxt 类型检查
npm run generate    # 静态生成 .output/public（含 sitemap/robots 预渲染），生成后自动 commit+push 到 GitHub → CF 上线
npm run deploy      # 不重新构建，直接 commit+push 当前分支到 GitHub → CF 上线（可加 -- "提交信息"）
npm run deploy:oss  # 本地生成后用 ossutil 同步 .output/public 到阿里云 OSS
npm run preview     # 预览生成结果
npm run book        # 由 content/dao 生成电子书（默认 epub+pdf）
npm run book:epub   # 仅 epub
npm run book:pdf    # 仅 pdf（依赖 puppeteer / 本地 Chromium）
```

大量 markdown 时本地 generate 可能 OOM；出现时用 `NODE_OPTIONS=--max-old-space-size=8192 npm run generate`。

部署相关环境变量：

```bash
NUXT_PUBLIC_SITE_URL=https://your-domain   # 影响 sitemap.xml / robots.txt / JSON-LD 中的站点 URL
NUXT_PUBLIC_COMMENT_ENV_ID=https://twikoo-cloudflare.xxx.workers.dev   # Twikoo 评论后端地址；为空则文章页不渲染评论区
```

环境变量写在根目录 `.env`（已被 `.gitignore` 忽略），可参考 `.env.example`。

### 部署（Cloudflare Pages）

- 站点托管在 Cloudflare Pages，监听 GitHub 仓库 `git@github.com:Esdeath/website_duan.git`（git 远程名 `origin`）；push 后 CF 自动构建上线，**不需要手动上传产物**。生产分支是 `main`。
- 根目录入口 `./deploy.sh` 调用 `scripts/deploy.py`：`git add -A` → commit（默认信息 `chore: deploy`，有改动才提交）→ `git push origin` 当前分支；当 `.env` 配置了 `ALIYUN_OSS_BUCKET` 且当前为 `main`（或 `OSS_DEPLOY_BRANCH` 指定分支）时，随后也会构建并同步 OSS。
  - `npm run generate` 生成成功后通过 `package.json` 的 `postgenerate` 钩子自动调用它；此时会上传刚生成的 `.output/public`。`npm run deploy` 则先推送再生成并上传 OSS。
  - 只想本地构建、不推送：`SKIP_DEPLOY=1 NODE_OPTIONS=--max-old-space-size=8192 npm run generate`。
  - 脚本在 CI / Cloudflare 构建环境（检测 `CF_PAGES` / `CI`）会自动跳过推送，避免构建时自我推送/死循环。
- 注意：CF 只对「生产分支」做正式部署，其他分支 push 后是 preview 预览部署，不更新正式站点。

### 文章评论（Twikoo）

- 每篇文章正文下方的评论区由 `app/components/ArticleComments.vue` 渲染，仅客户端运行，懒加载本地脚本 `public/vendor/twikoo.all.min.js`（已 vendored，固定 1.7.x），按 `/<slug>` 隔离每篇评论。
- 后端是独立部署的 `twikoojs/twikoo-cloudflare`（Cloudflare Worker + D1），其 URL 作为 `NUXT_PUBLIC_COMMENT_ENV_ID` 注入；未配置时评论区静默不渲染。
- 评论为客户端加载，不进预渲染 HTML，不影响 SEO / sitemap / generate。审核走 Twikoo 自带管理面板（首次进评论区设管理员密码）。

## Architecture

### 内容层（@nuxt/content v3）

- 所有内容存放在 `content/dao/**/*.md`，由 `content.config.ts` 定义为名为 `dao` 的集合（type: "page"）。
- 集合 schema 要求每个 md 同时具备 `title / slug / description / seoTitle / seoDescription`，以及可选 `category / order / date`。新增文章必须填齐这些字段，否则 typecheck / generate 报错。
- 一级目录约定（用于电子书章节切分，见 `scripts/generate-books.mjs` 的 `SECTIONS`）：
  - `concepts/` 核心概念，再按 frontmatter `category` 分到「核心哲学 / 投资理念 / 企业经营 / 品格与心性 / 财务指标」
  - `speeches/` 访谈实录
  - `qanda/` 投资问答录（唯一问答目录）：含「投资逻辑篇 / 商业逻辑篇 / 公司案例 / 人生与成长」四卷全部问答章节；分卷靠 frontmatter `volume` / `volumeOrder` / `chapterOrder`，本书章节切分见 `generate-books.mjs` 的 `QANDA_VOLUMES`。旧书章节入口页（legacy-index）已删除，旧 URL 统一 301 到 `/wenda-topic-index`（见 `public/_redirects`）
- 首页分类顺序与文案在 `app/pages/index.vue` 顶部的 `daoCategoryOrder` 和 `categoryMeta` 写死；新增 `category` 需要同步更新这两处，否则首页不会展示。

### 路由

- 仅两个页面文件：`app/pages/index.vue`（首页 / 目录）和 `app/pages/[slug].vue`（文章详情）。
- `[slug].vue` 用 `queryCollection('dao').where('slug', '=', slug).first()` 直接按 frontmatter 的 `slug` 字段查文章，**不是文件名**。`slug` 必须全局唯一；文章内部交叉链接用 `/<slug>`（例如 `/pingchangxin`）。
- `server/routes/sitemap.xml.ts` 和 `server/routes/robots.txt.ts` 是 Nitro server route，靠 `nuxt.config.ts` 的 `nitro.prerender.routes` 显式列入预渲染；sitemap 通过遍历 `dao` 集合生成所有 `/slug` 路径，所以新文章只要 slug 合规就会自动入 sitemap。

### 侧边栏搜索（结果浮层 + 锚点跳转）

- 输入框在 `app/components/LibrarySidebar.vue`：点一下弹 `app/components/SearchResultsPanel.vue`（Teleport 到 body、`position: fixed` 钉在输入框下方），每条结果 = 文章名 + 分类/小节面包屑 + 正文命中片段（命中词高亮）；同时保留原有「目录同步过滤」的行为。
- 数据来自 `/search-index.json`（`server/routes/search-index.json.ts` 预渲染，构建逻辑在 `server/utils/searchIndex.mjs`）：`{ [slug]: { title, cat, type, v, n, tag, text, sections } }`，`text` 是小写折叠过的正文纯文本，`sections` 是 `{ id, start, h }` —— `id` 直接取 minimark AST 里 MDC 生成的 `props.id`（与页面 `<h2 id="...">` 一模一样），`start` 是该小节正文在 `text` 里的字符偏移，`h` 是小节标题文本（标题不进 `text`，否则只搜小节名时会切出没有高亮的空片段）。
- 检索/排序/片段在 `app/utils/searchSnippet.mjs`（纯函数，`tests/search-index.test.mjs` 单测）：标题命中 < 元数据命中 < 正文命中，每篇最多 4 条、总共 40 条。**这个文件是 `.mjs` 而不是 `.ts`**，就是为了让 `node --test` 能直接跑。
- 点结果 → `/<slug>#<小节锚点>`（无小节时只跳文章顶部）→ `app/composables/useArticleHashScroll.ts` 负责滚动：滚动容器是 layout 的 `.main-area`（不是 window，原生 hash 滚动无效），找不到目标时 rAF 轮询重试 ~800ms，并在 ~450ms 后校正一次位置（防止别的滚动把它冲掉）。命中的关键词通过 `sessionStorage`（`dyp:search-terms`）传给文章页，用 `app/utils/highlightTerms.ts` 包 `<mark class="search-hit">`，4 秒后撤回。
- **layout 里 `watch(route.path)` 的"回到顶部"必须跳过带 hash 的跳转**（`app/layouts/default.vue`），否则会在锚点滚动之后把位置重置回顶部。
- 层级约定（踩过坑）：页面内容 < 阅读进度条(50) < 移动端遮罩(55) < 抽屉(56) < 搜索浮层(60) < 工具面板(80)。浮层必须压在移动端遮罩之上，否则移动端点结果会被遮罩截住。

### 主题与样式

- 全局样式在 `app/assets/css/main.css`，深色模式靠 `<html class="dark">`。
- `nuxt.config.ts` 中有一段内联脚本在页面渲染前根据 `localStorage.theme` / `prefers-color-scheme` 给 `<html>` 加 `dark` 类，避免 FOUC——改主题切换逻辑时要同时改这段 inline script 和 `app/composables/useTheme.ts`。

### 电子书生成

`scripts/generate-books.mjs` 独立于 Nuxt 运行，自己读 `content/dao` 的 markdown + frontmatter，用 markdown-it 渲染 HTML，再分别通过 `epub-gen-memory` 出 epub、`puppeteer` 出 pdf，产物在 `output/`。章节顺序由脚本里的 `SECTIONS` 与各文章 frontmatter 的 `order` 控制，与网站首页是两套独立的排序逻辑。

## 新增/修改文章时的检查清单

1. 放到正确的 `content/dao/<section>/` 子目录。
2. frontmatter 五个必填字段齐全；`slug` 全局唯一。
3. 若引入新的 `category`，同步更新 `app/pages/index.vue` 的 `daoCategoryOrder` 和 `categoryMeta`。
4. 文章内交叉引用使用 `/<slug>` 形式，便于上线后跳转。
5. 跑 `SKIP_DEPLOY=1 NODE_OPTIONS=--max-old-space-size=8192 npm run generate`，确认 `.output/public/sitemap.xml` 含新 slug。
