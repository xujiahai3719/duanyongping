# Claude Code 工作指南

本仓库是「大道总纲 · 段永平投资问答录」中文静态站点，使用 Nuxt 4、Vue 3 和 Nuxt Content v3。

## 开始工作

先完整阅读 [AGENTS.md](./AGENTS.md)，按其中的架构、内容维护和验证约定执行。项目使用与发布说明见 [README.md](./README.md)。维护规则统一保存在 AGENTS.md；本文件保留工作入口和常用命令，避免重复说明产生分歧。

检查 `git status --short --branch` 和相关差异，识别已有改动，再阅读任务涉及的代码。实际命令、内容字段和构建配置分别以 `package.json`、`content.config.ts`、`nuxt.config.ts` 为准。

## 常用命令

```bash
npm ci
npm run dev
npm run typecheck
node --test tests/*.test.mjs
SKIP_DEPLOY=1 NODE_OPTIONS=--max-old-space-size=8192 npm run generate
```

浏览器测试需要先启动服务：

```bash
TEST_BASE_URL=http://127.0.0.1:3000 node --test tests/*.e2e.mjs
```

普通静态构建始终使用 `SKIP_DEPLOY=1`。裸跑 `npm run generate` 会触发 `postgenerate`，随后暂存、提交并推送改动；`npm run deploy` 和 `./deploy.sh` 也会直接提交推送。仅在任务包含发布工作时使用这些入口，并先核对提交范围。

## 关键实现约定

- 内容集合是 `dao`，文章位于 `content/dao/`；路由按 frontmatter `slug` 查询。
- 首页、侧边栏和章节导航只查询列表所需元数据，避免将全部正文放入各页面 payload。
- 正文滚动容器是 `.main-area`；锚点跳转优先于阅读位置恢复和回到顶部。
- 正文节点 `#article-share-content` 同时服务于阅读恢复、复制出处和搜索高亮，修改时检查所有调用方。
- 主题及字号修改需同步 `nuxt.config.ts` 中的首屏初始化脚本。
- 字体使用 `public/fonts/` 内的自托管资源；评论脚本使用 `public/vendor/` 内的本地资源。
- `scripts/` 中部分内容整理工具依赖本地素材或历史审计数据，使用前核对输入和写入范围，详见 AGENTS.md。

## 完成前

按改动范围执行 AGENTS.md 的验证流程。文档改动核对命令、路径、链接与实际实现即可；代码和内容改动执行相应检查。交付时说明完成内容、验证结果及仍未解决的问题，并明确是否提交或推送。
