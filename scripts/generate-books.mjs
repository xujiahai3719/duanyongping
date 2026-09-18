#!/usr/bin/env node
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import epubGen from "epub-gen-memory";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "dao");
const OUTPUT_DIR = path.join(ROOT, "output");
const BOOK_TITLE = "段永平投资问答录";
const AUTHOR = "随水而行的Star";
const XUEQIU_URL = "https://xueqiu.com/u/lovelive";

const SECTIONS = [
  {
    key: "concepts",
    title: "核心概念",
    dir: "concepts",
    categoryOrder: ["核心哲学", "投资理念", "企业经营", "品格与心性", "财务指标"],
  },
  { key: "speeches", title: "访谈实录", dir: "speeches" },
  // 投资问答录全部内容（投资逻辑篇 / 商业逻辑篇 / 公司与人生）已合并到 qanda/ 一个目录，
  // 章节切分靠 frontmatter 的 volume / volumeOrder / chapterOrder（见 QANDA_VOLUMES）。
  { key: "qanda", title: "问答录", dir: "qanda" },
];

const QANDA_VOLUMES = [
  { name: "投资原则与方法", title: "第一卷 投资原则与方法", order: 1 },
  { name: "商业模式与经营", title: "第二卷 商业模式与经营", order: 2 },
  { name: "公司案例", title: "第三卷 公司案例", order: 3 },
  { name: "人生与成长", title: "第四卷 人生与成长", order: 4 },
];

const CSS = `
:root {
  --fg: #2c2c2c;
  --accent: #b5462a;
  --bg: #ffffff;
  --line: #dddddd;
  --muted: #6b6258;
  --surface: rgba(26,24,20,0.03);
  --accent-soft: rgba(181,70,42,0.08);
}
html, body {
  background-color: #ffffff;
}
body {
  color: #2c2c2c;
  font-family: "LXGW WenKai TC", "Noto Serif SC", Georgia, serif;
  font-size: 17px;
  line-height: 1.7;
  letter-spacing: 0.01em;
  margin: 0;
}
.prose { font-family: "LXGW WenKai TC", "Noto Serif SC", Georgia, serif; }
h1 {
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 0.6em;
  color: #2c2c2c;
}
h2 {
  margin: 1.8em 0 0.4em;
  padding-top: 1.2em;
  border-top: 1px solid #dddddd;
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}
h2:first-child { margin-top: 0; padding-top: 0; border-top: none; }
h3 {
  margin: 1.4em 0 0.3em;
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
}
h4, h5 {
  margin: 1.2em 0 0.3em;
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: #6b6258;
}
p, ul, ol { margin: 0 0 0.7em; }
li + li { margin-top: 6px; }
blockquote {
  margin: 1em 0;
  padding: 0.6em 1em;
  border-left: 3px solid #b5462a;
  background: rgba(26,24,20,0.03);
  font-size: 16px;
  line-height: 1.7;
  color: #6b6258;
  border-radius: 0 4px 4px 0;
}
blockquote p { margin: 0 0 0.5em; }
blockquote p:last-child { margin-bottom: 0; }
hr {
  margin: 48px auto;
  border: none;
  width: 48px;
  height: 1px;
  background: #dddddd;
}
a {
  color: #b5462a;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: rgba(181,70,42,0.25);
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
table {
  width: 100%;
  margin: 1em 0;
  border-collapse: separate;
  border-spacing: 0;
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  background: #ffffff;
  border: 1px solid #d3c6b7;
  border-radius: 6px;
  overflow: hidden;
}
th, td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-right: 1px solid #d3c6b7;
  border-bottom: 1px solid #d3c6b7;
}
th:last-child, td:last-child { border-right: none; }
tr:last-child td { border-bottom: none; }
th {
  background: #f1e9df;
  font-weight: 600;
  color: #2c2c2c;
}
code {
  padding: 2px 6px;
  background: rgba(26,24,20,0.03);
  border: 1px solid #dddddd;
  border-radius: 3px;
  font-size: 0.85em;
}
pre {
  overflow-x: auto;
  margin: 1em 0;
  padding: 16px 20px;
  background: #282c34;
  color: #abb2bf;
  border-radius: 6px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-wrap: break-word;
}
pre code { padding: 0; background: transparent; border: none; color: inherit; font-size: 14px; }
strong { font-weight: 700; }
section.article { margin: 0 0 3em; }
`;

/* 封面：PDF 与 EPUB 共用，两边只在页高/断页规则上各自补充 */
const COVER_CSS = `
.cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.cover .ornament {
  width: 60px; height: 1px; background: #b5462a; margin: 18px auto;
}
.cover h1.cover-title {
  font-family: "LXGW WenKai TC", "Noto Serif SC", serif;
  font-size: 58px; font-weight: 700; color: #b5462a;
  margin: 0; letter-spacing: 0.2em; text-indent: 0.2em;
  border: none; padding: 0; white-space: nowrap;
}
.cover .overline {
  font-family: "LXGW WenKai TC", "Noto Serif SC", serif;
  font-size: 52px; color: #6b6258;
  letter-spacing: 0.4em; text-indent: 0.4em;
}
.credits {
  text-align: center; font-size: 14px; line-height: 2.1; color: #6b6258;
  font-family: "PingFang SC", system-ui, sans-serif;
}
.credits a { color: #6b6258; text-decoration: none; }
.cover .credits { margin-top: 90px; }
`;

/* 阅读器屏幕比 A4 窄，nowrap 的标题会被裁掉，按视口降一档 */
const EPUB_EXTRA_CSS = `
.cover { min-height: 90vh; }
/* EPUB 没有分卷页，署名放在每卷正文开头，用一条细线与正文隔开 */
.chapter-credits {
  margin: 0 0 2.6em; padding-bottom: 1.4em;
  border-bottom: 1px solid #dddddd;
  font-size: 13px; line-height: 1.9;
}
@media (max-width: 600px) {
  .cover h1.cover-title { font-size: 32px; }
  .cover .overline { font-size: 28px; }
  .cover .credits { margin-top: 48px; font-size: 13px; }
}
`;

const PDF_EXTRA_CSS = `
@page { size: A4; margin: 25mm 20mm; }
html, body { background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { padding: 0; max-width: none; position: relative; }
/* Chromium PDF 只在首页绘制 body 背景，position:fixed 伪元素会在每页重复绘制 */
body::before {
  content: "";
  position: fixed;
  top: -25mm; left: -20mm; right: -20mm; bottom: -25mm;
  background-color: #ffffff;
  z-index: -1;
}
section.article { page-break-before: always; }
section.article:first-of-type { page-break-before: auto; }
.cover, .toc { page-break-after: always; }
.cover { min-height: 247mm; }
.toc h1 {
  font-family: "PingFang SC", system-ui, sans-serif;
  font-size: 32px; text-align: center; margin: 0 0 2em;
}
.toc .toc-section { margin: 0 0 1.6em; }
.toc .toc-section-title {
  font-family: "PingFang SC", system-ui, sans-serif;
  font-size: 18px; font-weight: 700; color: #b5462a;
  border-bottom: 1px solid #dddddd; padding-bottom: 6px; margin: 0 0 0.6em;
}
.toc ul { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 4px 0; line-height: 1.6; }
.toc a { color: #2c2c2c; font-weight: 400; text-decoration: none; }
section.article h1 {
  font-family: "PingFang SC", system-ui, sans-serif;
  border-bottom: 2px solid #b5462a;
  padding-bottom: 0.3em;
  margin-bottom: 1em;
}
.section-divider {
  page-break-before: always;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 247mm;
  text-align: center;
}
.section-divider .label {
  font-family: "PingFang SC", system-ui, sans-serif;
  font-size: 16px; color: #6b6258; letter-spacing: 0.3em;
}
.section-divider .title {
  font-family: "LXGW WenKai TC", "Noto Serif SC", serif;
  font-size: 56px; color: #b5462a; margin-top: 24px; letter-spacing: 0.15em;
}
.section-divider .ornament {
  width: 60px; height: 1px; background: #b5462a; margin: 32px auto;
}
.section-divider .credits { margin-top: 40px; }
`;

function parseArgs() {
  const args = process.argv.slice(2);
  let format = "all";
  let only = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      format = args[i + 1];
      i++;
    } else if (args[i] === "--only" && args[i + 1]) {
      only = args[i + 1].split(",").map((s) => s.trim()).filter(Boolean);
      i++;
    }
  }
  if (only) {
    const valid = SECTIONS.map((s) => s.key);
    const bad = only.filter((key) => !valid.includes(key));
    if (bad.length) {
      throw new Error(`--only 不认识的分区：${bad.join(", ")}；可选：${valid.join(", ")}`);
    }
  }
  return { format, only };
}

async function listMarkdown(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(dir, e.name));
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { data: {}, content: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { data: {}, content: raw };
  const fmText = raw.slice(3, end).trim();
  const content = raw.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  // Match key: value where value may be quoted or bare; tolerant to nested quotes in value.
  const lineRe = /^([A-Za-z0-9_]+):\s*(.*)$/;
  for (const line of fmText.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }
    if (/^-?\d+$/.test(val)) data[key] = parseInt(val, 10);
    else data[key] = val;
  }
  return { data, content };
}

async function loadSectionArticles(section) {
  const dir = path.join(CONTENT_DIR, section.dir);
  const files = await listMarkdown(dir);
  const articles = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const { data, content } = parseFrontmatter(raw);
    if (data.type === "legacy-index" || data.type === "topic-index") continue;
    if (!data.slug || !data.title) {
      console.warn(`⚠️ 缺少 slug/title: ${file}`);
      continue;
    }
    articles.push({
      file,
      slug: data.slug,
      title: data.title,
      type: data.type || "",
      volume: data.volume || "",
      volumeOrder: typeof data.volumeOrder === "number" ? data.volumeOrder : 0,
      chapterOrder: typeof data.chapterOrder === "number" ? data.chapterOrder : 0,
      category: data.category || "",
      order: typeof data.order === "number" ? data.order : 0,
      raw: content,
    });
  }
  return articles;
}

function organizeSection(section, articles) {
  if (section.categoryOrder) {
    const grouped = new Map();
    for (const cat of section.categoryOrder) grouped.set(cat, []);
    for (const a of articles) {
      if (!grouped.has(a.category)) grouped.set(a.category, []);
      grouped.get(a.category).push(a);
    }
    const ordered = [];
    for (const [cat, list] of grouped) {
      list.sort((a, b) => a.order - b.order);
      for (const a of list) ordered.push(a);
    }
    return ordered;
  }
  return [...articles].sort((a, b) => a.order - b.order);
}

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

const LINK_RE = /\[([^\]]+)\]\(\/([a-zA-Z0-9_-]+)\)/g;
const IMG_LINK_RE = /!\[([^\]]+)\]\(\/([a-zA-Z0-9_-]+)\)/g;

/* slugs = { included: 本书收录的 slug, all: 全站 slug }。全量出书时两者相同；
   用 --only 只出部分分区时，指向未收录文章的链接会变成死锚点，这里降级成纯文本。 */
function rewriteInternalLinks(rawMd, slugs, stats) {
  const { included, all } = slugs;
  // 1) `![text](/slug)` 是源文件中误写的图片语法（实际是中文叹号紧接 `[` 触发），
  //    全部还原为普通链接 `[text](#slug)`，避免 markdown-it 生成 <img>。
  let out = rawMd.replace(IMG_LINK_RE, (m, text, slug) => {
    if (included.has(slug)) {
      stats.imgFixed = (stats.imgFixed || 0) + 1;
      return `[${text}](#${slug})`;
    }
    if (all.has(slug)) return text;
    return m;
  });
  // 2) 正常 `[text](/slug)` → `[text](#slug)`
  out = out.replace(LINK_RE, (m, text, slug) => {
    stats.total++;
    if (included.has(slug)) {
      stats.matched++;
      return `[${text}](#${slug})`;
    }
    if (all.has(slug)) {
      stats.dropped = (stats.dropped || 0) + 1;
      return text;
    }
    return m;
  });
  return out;
}

function renderArticleHtml(article) {
  return `<section id="${article.slug}" class="article"><h1>${escapeHtml(articleDisplayTitle(article))}</h1>${md.render(article.raw)}</section>`;
}

function chineseNumber(value) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value < 10) return digits[value];
  if (value < 20) return `十${value % 10 ? digits[value % 10] : ""}`;
  return `${digits[Math.floor(value / 10)]}十${value % 10 ? digits[value % 10] : ""}`;
}

function articleDisplayTitle(article) {
  if (article.type !== "qanda-chapter" || !article.chapterOrder) return article.title;
  return `第${chineseNumber(article.chapterOrder)}章 ${article.title}`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadAll() {
  const loadedSections = [];
  const allSlugs = new Set();
  for (const sec of SECTIONS) {
    const raw = await loadSectionArticles(sec);
    for (const a of raw) allSlugs.add(a.slug);
    const ordered = organizeSection(sec, raw);
    loadedSections.push({ ...sec, articles: ordered });
  }
  const chapters = loadedSections
    .flatMap((section) => section.articles)
    .filter((article) => article.type === "qanda-chapter");
  const volumeSections = QANDA_VOLUMES.map((volume) => ({
    key: `qanda-volume-${volume.order}`,
    baseKey: "qanda",
    title: volume.title,
    volumeOrder: volume.order,
    articles: chapters
      .filter((article) => article.volumeOrder === volume.order)
      .sort((left, right) => left.chapterOrder - right.chapterOrder),
  }));
  const sections = [];
  for (const section of loadedSections) {
    if (section.key === "qanda") sections.push(...volumeSections);
    const remaining = section.articles.filter((article) => article.type !== "qanda-chapter");
    if (remaining.length) sections.push({ ...section, baseKey: section.key, articles: remaining });
  }
  return { sections, allSlugs };
}

function describeLinkStats(stats) {
  const dropped = stats.dropped ? `，${stats.dropped} 条指向未收录文章已降级为纯文本` : "";
  return `链接重写：${stats.matched}/${stats.total} 命中${dropped}`;
}

function buildDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/* 署名区块：封面、PDF 分卷页、EPUB 每卷开头共用 */
function buildCreditsHtml(extraClass = "") {
  return `<div class="credits${extraClass ? ` ${extraClass}` : ""}">
        <div>作者：${AUTHOR}</div>
        <div>时间 ${buildDate()}</div>
        <div>雪球地址：<a href="${XUEQIU_URL}">${XUEQIU_URL}</a></div>
      </div>`;
}

function buildCoverHtml() {
  return `
    <div class="cover">
      <div class="overline">大道总纲</div>
      <div class="ornament"></div>
      <h1 class="cover-title">${BOOK_TITLE}</h1>
      <div class="ornament"></div>
      ${buildCreditsHtml()}
    </div>
  `;
}

/* epub-gen-memory 默认按 `${index}_${slugify(title)}.xhtml` 命名，中文标题 slug 后会被
   过滤成空串（实际产物是 0_.xhtml、1_.xhtml……）。这里显式指定文件名，跨章锚点才有效，
   也不会因为封面章插到最前而整体错位。 */
const epubChapterFile = (i, key) => `${i}_${key}.xhtml`;

async function generateEpub(sections, slugs, bookName) {
  const linkStats = { total: 0, matched: 0 };
  const slugToChapter = new Map();
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const chapterFile = epubChapterFile(i, sec.key);
    for (const a of sec.articles) slugToChapter.set(a.slug, chapterFile);
  }

  const chapters = sections.map((sec, i) => {
    const articlesHtml = sec.articles
      .map((a) => {
        const rewritten = rewriteInternalLinks(a.raw, slugs, linkStats);
        return `<section id="${a.slug}" class="article"><h2>${escapeHtml(articleDisplayTitle(a))}</h2>${md.render(rewritten)}</section>`;
      })
      .join("\n");

    const currentChapterFile = epubChapterFile(i, sec.key);
    const finalHtml = articlesHtml.replace(/href="#([a-zA-Z0-9_-]+)"/g, (m, slug) => {
      const target = slugToChapter.get(slug);
      if (!target) return m;
      if (target === currentChapterFile) return `href="#${slug}"`;
      return `href="${target}#${slug}"`;
    });

    return {
      title: sec.title,
      filename: currentChapterFile,
      content: `<h1>${escapeHtml(sec.title)}</h1>${buildCreditsHtml("chapter-credits")}${finalHtml}`,
    };
  });

  const coverChapter = {
    title: "封面",
    filename: "cover.xhtml",
    content: buildCoverHtml(),
    beforeToc: true,
    excludeFromToc: true,
  };

  const options = {
    title: bookName,
    author: AUTHOR,
    publisher: BOOK_TITLE,
    description: "段永平大道至简，关于投资与商业本质的思考集。",
    lang: "zh",
    tocTitle: "目录",
    css: CSS + COVER_CSS + EPUB_EXTRA_CSS,
    fonts: [],
    prependChapterTitles: false,
  };

  console.log(`EPUB ${describeLinkStats(linkStats)}`);

  const epub = new epubGen.EPub(options, [coverChapter, ...chapters]);
  const buf = await epub.genEpub();
  const outPath = path.join(OUTPUT_DIR, `${bookName}.epub`);
  await writeFile(outPath, buf);
  return outPath;
}

async function generatePdf(sections, slugs, bookName) {
  const linkStats = { total: 0, matched: 0 };

  const coverHtml = buildCoverHtml();

  const tocSections = sections
    .map((sec) => {
      const items = sec.articles
        .map((a) => `<li><a href="#${a.slug}">${escapeHtml(articleDisplayTitle(a))}</a></li>`)
        .join("");
      return `<div class="toc-section"><div class="toc-section-title">${escapeHtml(sec.title)}</div><ul>${items}</ul></div>`;
    })
    .join("");

  const tocHtml = `<div class="toc"><h1>目 录</h1>${tocSections}</div>`;

  const bodyHtml = sections
    .map((sec, idx) => {
      const dividerLabel = sec.volumeOrder
        ? `第 ${chineseNumber(sec.volumeOrder)} 卷`
        : `第 ${["一", "二", "三", "四", "五"][idx] || idx + 1} 篇`;
      const divider = `<div class="section-divider"><div class="label">${dividerLabel}</div><div class="title">${escapeHtml(sec.title)}</div><div class="ornament"></div>${buildCreditsHtml()}</div>`;
      const articles = sec.articles
        .map((a) => {
          const rewritten = rewriteInternalLinks(a.raw, slugs, linkStats);
          return `<section id="${a.slug}" class="article"><h1>${escapeHtml(articleDisplayTitle(a))}</h1>${md.render(rewritten)}</section>`;
        })
        .join("\n");
      return divider + articles;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${bookName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${CSS}${COVER_CSS}${PDF_EXTRA_CSS}</style>
</head>
<body>
${coverHtml}
${tocHtml}
${bodyHtml}
</body>
</html>`;

  console.log(`PDF ${describeLinkStats(linkStats)}`);

  const browser = await puppeteer.launch({ headless: true, protocolTimeout: 600000 });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 120000 });
    const outPath = path.join(OUTPUT_DIR, `${bookName}.pdf`);
    await page.pdf({
      path: outPath,
      format: "A4",
      margin: { top: "25mm", bottom: "25mm", left: "20mm", right: "20mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#6b6258;font-family:'PingFang SC',sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      preferCSSPageSize: true,
      timeout: 600000,
    });
    return outPath;
  } finally {
    await browser.close();
  }
}

async function main() {
  const { format, only } = parseArgs();
  if (!existsSync(OUTPUT_DIR)) await mkdir(OUTPUT_DIR, { recursive: true });

  console.log("加载 content/dao/**/*.md ...");
  const { sections: allSections, allSlugs } = await loadAll();

  const sections = only ? allSections.filter((sec) => only.includes(sec.baseKey)) : allSections;
  if (!sections.length) throw new Error(`--only ${only.join(",")} 没有匹配到任何文章`);

  // 封面/书名保持不变，只在文件名上加分区后缀，避免覆盖全量产物
  const bookName = only
    ? `${BOOK_TITLE}-${only.map((key) => SECTIONS.find((s) => s.key === key).title).join("+")}`
    : BOOK_TITLE;

  const includedSlugs = new Set();
  for (const sec of sections) for (const a of sec.articles) includedSlugs.add(a.slug);
  const slugs = { included: includedSlugs, all: allSlugs };

  let total = 0;
  for (const sec of sections) {
    console.log(`  ${sec.title}：${sec.articles.length} 篇`);
    total += sec.articles.length;
  }
  console.log(`共 ${total} 篇，${allSlugs.size} 个唯一 slug；输出《${bookName}》`);

  const tasks = [];
  if (format === "all" || format === "epub") tasks.push(["epub", () => generateEpub(sections, slugs, bookName)]);
  if (format === "all" || format === "pdf") tasks.push(["pdf", () => generatePdf(sections, slugs, bookName)]);

  for (const [name, fn] of tasks) {
    console.log(`\n=== 生成 ${name.toUpperCase()} ===`);
    const out = await fn();
    console.log(`✅ ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
