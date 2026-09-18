# 段永平投资问答录

整理段永平相关投资与经营文章的中文静态站点。技术栈：Nuxt 4 + Vue 3 + Nuxt Content v3，产物为预渲染静态文件，托管在 Cloudflare Pages。

> 面向贡献者 / Claude Code 的详细架构说明见 [`CLAUDE.md`](./CLAUDE.md)。

## 开发

```bash
npm install
npm run dev
```

## 验证

```bash
npm run typecheck
npx nuxt generate     # 本地生成 .output/public（不推送），含 sitemap.xml / robots.txt
```

## 部署

站点托管在 Cloudflare Pages，监听 GitHub 仓库并在 push 后自动构建上线：

```bash
./deploy.sh                    # 提交、推送；已配置 OSS 时也会同步到 OSS
./deploy.sh "提交信息"          # 同上，自定义提交信息
npm run deploy                 # 同上
npm run deploy -- "提交信息"     # 同上，自定义提交信息
npm run generate               # 本地生成成功后，也会自动 commit+push（postgenerate 钩子）
npm run deploy:oss             # 本地生成后同步 .output/public 到阿里云 OSS
npm run deploy:oss:upload      # 跳过生成，仅上传现有 .output/public
```

只想本地构建、不推送：`npx nuxt generate` 或 `SKIP_DEPLOY=1 npm run generate`。

阿里云 OSS 发布前，推荐用 `aliyun configure --mode OAuth` 配置浏览器授权，
然后设置 `ALIYUN_CLI_PROFILE` 与 `ALIYUN_OSS_BUCKET`；也兼容
`ossutil config` 配置。默认地域为 `cn-hangzhou`；只有显式设置
`OSS_DELETE_STALE=1` 才会删除 Bucket 中本地产物不存在的文件。
把这些 OSS 变量写入 `.env` 后，日常执行 `./deploy.sh` 会自动发布
GitHub/Cloudflare 与 OSS；设置 `DEPLOY_OSS=0` 可单次跳过 OSS。
默认只有 `main` 会发布到 OSS，避免 preview 分支覆盖正式镜像；需要调整时设置
`OSS_DEPLOY_BRANCH`。

环境变量写在根目录 `.env`（已被 `.gitignore` 忽略，参考 `.env.example`）：

```bash
NUXT_PUBLIC_SITE_URL=https://your-domain                              # 影响 sitemap / robots / JSON-LD
NUXT_PUBLIC_COMMENT_ENV_ID=https://twikoo-cloudflare.xxx.workers.dev  # Twikoo 评论后端；为空则不渲染评论区
```

## 内容维护

- 文章放在 `content/dao/<section>/*.md`（section 划分见 `CLAUDE.md`）。
- 每篇 frontmatter 必填 `title / slug / description / seoTitle / seoDescription`，可选 `category / order / date`；`slug` 全局唯一。
- 新增文章后运行 `npm run generate`，确认 `.output/public/sitemap.xml` 含新 slug。
