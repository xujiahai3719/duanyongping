// 生成站点社交分享封面图 public/og-image.png（1200×630）
// 用 puppeteer 渲染一段 HTML 再截图，复用「段永平投资问答录」书封美学。
// 用法：npm run og
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "og-image.png");

const W = 1200;
const H = 630;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(120% 140% at 50% 0%, #fbf8f3 0%, #f4efe7 100%);
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #2c2c2c;
  }
  .frame {
    position: absolute;
    inset: 28px;
    border: 1px solid rgba(181, 70, 42, 0.28);
    border-radius: 4px;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0;
  }
  .rule { width: 130px; height: 3px; background: #b5462a; }
  .title {
    font-family: "Songti SC", "STSong", "SimSun", serif;
    font-size: 116px;
    font-weight: 700;
    letter-spacing: 0.32em;
    /* 字间距会在右侧多出一截，左移半个字距视觉居中 */
    text-indent: 0.32em;
    line-height: 1.1;
    margin: 34px 0;
    color: #1f1d1b;
  }
  .subtitle {
    margin-top: 30px;
    font-size: 30px;
    letter-spacing: 0.28em;
    text-indent: 0.28em;
    color: #6a625a;
  }
  .quote {
    margin-top: 26px;
    font-family: "Songti SC", "STSong", serif;
    font-size: 30px;
    color: #9a4a36;
    letter-spacing: 0.04em;
  }
  .domain {
    position: absolute;
    bottom: 52px;
    left: 0;
    width: 100%;
    text-align: center;
    font-size: 20px;
    letter-spacing: 0.06em;
    color: #b0a89e;
  }
</style>
</head>
<body>
  <div class="frame"></div>
  <div class="col">
    <div class="rule"></div>
    <div class="title">段永平投资问答录</div>
    <div class="rule"></div>
    <div class="subtitle">段永平投资问答录</div>
    <div class="quote">买股票就是买公司</div>
  </div>
  <div class="domain">duan.ayaseeri.com</div>
</body>
</html>`;

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  // 等字体真正就绪，避免截到 fallback 字体
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: OUT,
    type: "png",
    clip: { x: 0, y: 0, width: W, height: H },
  });
  console.log(`✅ 已生成 ${OUT} (${W}×${H} @2x)`);
} finally {
  await browser.close();
}
