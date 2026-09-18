# 大道总纲 · 段永平投资问答录知识库

整理段永平公开投资问答、访谈与经营理念的中文资料站，提供分类阅读、全文搜索、章节导航和阅读位置恢复。

使用 Nuxt 4、Vue 3、Nuxt Content v3，将 Markdown 内容预渲染为静态站点。源码仓库为 [Esdeath/website_dao](https://github.com/Esdeath/website_dao)，发布目录为 `.output/public`。

## 功能

- 按访谈实录、投资问答录、核心概念、公司与人物、推荐书单组织内容。
- 搜索文章标题、分类与正文，显示命中片段并跳转到对应小节。
- 提供浅色、深色、护眼三种主题，以及 90%–130% 的五档正文字号。
- 保存每篇文章的阅读位置，支持分享链接和复制正文时附带出处。
- 可选接入 Twikoo 评论；构建时生成 sitemap、robots、LLM 文本索引和搜索索引。

## 本地开发

需要 Node.js 22.12 或以上版本及 npm；提交部署脚本还需要 Git 和 Python 3。依赖版本以 `package-lock.json` 为准。

```bash
npm ci
npm run dev
```

按 `.env.example` 创建或更新本地 `.env`。正式构建前填写真实站点地址；不启用评论时，将评论地址留空：

```dotenv
NUXT_PUBLIC_SITE_URL=https://your-domain
NUXT_PUBLIC_COMMENT_ENV_ID=
# 可选：指定部署时使用的 Git 远程
DEPLOY_GIT_REMOTE=origin
```

`.env` 不入库。`NUXT_PUBLIC_SITE_URL` 用于 sitemap、robots、SEO 结构化数据及文章链接；评论地址指向独立部署的 Twikoo 服务。静态站点的这些配置在构建时注入，修改后需要重新构建。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run typecheck` | Nuxt 类型检查 |
| `node --test tests/*.test.mjs` | 运行单元与集成测试 |
| `SKIP_DEPLOY=1 npm run generate` | 生成静态站点，不提交、不推送 |
| `npm run preview` | 预览已有构建产物 |
| `npm run build` | 执行 Nuxt 构建；静态发布使用 `generate` |
| `npm run og` | 生成 `public/og-image.png`，需要 Puppeteer 浏览器 |
| `npm run deploy -- "提交信息"` | 提交当前改动并推送当前分支 |

**`npm run generate` 不带 `SKIP_DEPLOY=1` 时，会在构建成功后自动执行部署脚本，提交并推送。** 日常验证使用表格中的本地构建命令；内容较多时可增大 Node 内存：

```bash
SKIP_DEPLOY=1 NODE_OPTIONS=--max-old-space-size=8192 npm run generate
```

浏览器回归测试需要先启动开发服务器，并安装 Puppeteer 所用的浏览器。在另一个终端执行：

```bash
TEST_BASE_URL=http://127.0.0.1:3000 node --test tests/*.e2e.mjs
```

## 目录结构

```text
app/
  pages/             首页与文章详情页
  layouts/           阅读布局、侧边栏与滚动容器
  components/        搜索、阅读工具、分享与评论
  composables/       主题、字号、锚点跳转等状态与行为
  utils/             搜索、链接、滚动等辅助函数
  assets/css/        全局样式与自托管字体声明
content/dao/
  concepts/          核心概念与推荐书单
  speeches/          访谈实录
  qanda/             四卷投资问答及主题总目录
  company-people/    公司与人物档案
public/              图片、字体、评论脚本与重定向规则
server/routes/       预渲染的 sitemap、robots、文本和搜索索引
server/utils/        搜索索引构建逻辑
scripts/             内容整理、目录同步、字体处理及 Git 部署工具
tests/               单元、集成及浏览器回归测试
```

## 维护文章

文章统一放在 `content/dao/` 下，集合定义见 `content.config.ts`。最小 frontmatter 示例：

```yaml
---
title: "文章标题"
slug: "article-slug"
description: "文章简介"
seoTitle: "文章标题｜段永平投资问答录"
seoDescription: "用于搜索引擎的文章简介"
category: "投资理念"
order: 100
---
```

前五个字段必填，`slug` 必须全站唯一，文章链接使用 `/<slug>`，不由文件名决定。`category` 和 `order` 控制分类展示与排序；其他可选字段见 `content.config.ts`。

问答章节使用 `type: "qanda-chapter"`，并填写 `volume`、`volumeOrder`、`chapterOrder`。四卷为「投资原则与方法」「商业模式与经营」「公司案例」「人生与成长」，入口为 `/wenda-topic-index`。

修改文章后：

1. 检查字段、分类、站内链接和 slug；新增分类时同步首页与侧边栏配置。
2. 修改问答小节标题时，运行 `node scripts/sync-topic-index.mjs` 检查总目录；需要更新时添加 `--write`。
3. 执行类型检查、相关测试和本地静态构建，检查页面、搜索索引及 `.output/public/sitemap.xml`。
4. 修改已有 URL 时，在 `public/_redirects` 中保留旧地址到有效新地址的重定向。

内容批量导入、字体子集更新和关键实现约定见 [AGENTS.md](./AGENTS.md)。

## 发布

本地 `origin` 指向 `git@github.com:Esdeath/website_dao.git`，主要分支为 `main`。仓库可连接 Cloudflare Pages；连接及生产分支配置需在托管平台完成，Git 推送本身不代表站点已经部署成功。

静态发布使用以下构建配置：

| 配置 | 值 |
| --- | --- |
| 构建命令 | `SKIP_DEPLOY=1 npm run generate` |
| 输出目录 | `.output/public` |
| 生产分支 | `main` |
| 环境变量 | 正式的 `NUXT_PUBLIC_SITE_URL`，以及可选的评论服务地址 |

也可以将 `.output/public` 部署到其他静态服务器；使用其他托管方式时，需要按服务器规则配置 `public/_redirects` 中的重定向。

本地推送入口：

```bash
npm run deploy -- "docs: update site documentation"
# 等价于
./deploy.sh "docs: update site documentation"
```

`deploy.sh` 读取 `.env`，再调用 `scripts/deploy.py`：暂存所有未忽略的改动，有改动时提交，最后以 `git push -u` 推送当前分支。未提供提交信息时使用 `chore: deploy`，执行前应检查本次改动范围。

远程选择顺序为 `DEPLOY_GIT_REMOTE` → 名为 `github` 的远程 → 首个远程；本项目当前为 `origin`。`SKIP_DEPLOY=1`、非空的 `CI` 或 `CF_PAGES` 会让部署脚本跳过提交与推送。脚本不会上传静态产物，也不会自动拉取或变基。

## 开发文档

- [AGENTS.md](./AGENTS.md)：完整架构、维护约定与验证流程。
- [CLAUDE.md](./CLAUDE.md)：Claude Code 的工作入口，引用同一份维护约定。
