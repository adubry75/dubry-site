// Render the social share image (src/static/og.jpg, 1200×630) from the real game art.
// Usage: npm run build && node tools/serve.mjs &  then  node tools/make-og.mjs
// (needs the preview server for the self-hosted fonts and the poster/cabinet images)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './pw.mjs';
import { ARCADE, EXTRA_CABINETS, BIG_GAMES } from '../src/data/content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://localhost:8054/';
const posters = BIG_GAMES.filter((g) => g.img).map((g) => `/nine-lives/posters/${g.img.src}`);
const cabs = ['pounce', 'neon-chomp', 'catfish-river', 'hissy-halls', 'fish-bowl', 'yarn-breaker', 'tuna-tower', 'gridstorm']
  .map((id) => `/nine-lives/cabs/${id}.webp`);
const nCabs = ARCADE.length + EXTRA_CABINETS.length;

const html = `<!doctype html><html><head><style>
@font-face { font-family: 'Unbounded'; src: url(/nine-lives/fonts/unbounded.woff2) format('woff2'); font-weight: 200 900; }
@font-face { font-family: 'Space Grotesk'; src: url(/nine-lives/fonts/space-grotesk.woff2) format('woff2'); font-weight: 300 700; }
@font-face { font-family: 'Silkscreen'; src: url(/nine-lives/fonts/silkscreen.woff2) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; position: relative; color: #f4efff; font-family: 'Space Grotesk';
  background: radial-gradient(60% 70% at 78% 40%, #ff4fd833, transparent 70%), radial-gradient(50% 60% at 10% 90%, #3df2ff1f, transparent 70%), linear-gradient(160deg, #150a2e, #07060d 70%); }
.floor { position: absolute; inset: auto 0 0; height: 170px; opacity: .35;
  background: repeating-linear-gradient(90deg, #ff4fd8 0 1px, transparent 1px 60px), repeating-linear-gradient(#ff4fd8 0 1px, transparent 1px 34px);
  transform: perspective(300px) rotateX(55deg); transform-origin: bottom; mask: linear-gradient(transparent, #000); }
.copy { position: absolute; left: 64px; top: 92px; width: 520px; }
h1 { font: 900 78px/.9 'Unbounded'; letter-spacing: -.05em; }
h1 span { color: #3df2ff; }
p { margin-top: 26px; font-size: 27px; line-height: 1.35; color: #d9d3ea; }
.stats { display: flex; gap: 22px; margin-top: 30px; font: 400 14px/1 'Silkscreen'; letter-spacing: .08em; text-transform: uppercase; color: #a99fc4; }
.stats b { font: 800 22px/1 'Unbounded'; color: #ffe45c; margin-right: 8px; }
.fan { position: absolute; right: 22px; top: 46px; width: 540px; height: 420px; }
.fan img { position: absolute; width: 272px; border-radius: 16px; box-shadow: 0 0 0 2px #ffffff30, 0 30px 50px -10px #000c; }
.cabs { position: absolute; left: 0; right: 0; bottom: 22px; display: flex; gap: 14px; justify-content: center; }
.cabs img { width: 128px; height: 96px; border-radius: 10px; object-fit: cover; box-shadow: 0 0 0 3px #120c1f, 0 0 0 4px #ffffff26, 0 14px 24px -8px #000; }
</style></head><body>
<div class="floor"></div>
<div class="copy">
  <h1>dubry<span>.com</span></h1>
  <p>Cat-powered games &amp; art.<br>One scroll. One very curious cat.</p>
  <div class="stats"><span><b>${nCabs}</b>arcade games</span><span><b>${BIG_GAMES.length}</b>big games</span><span><b>1</b>cat</span></div>
</div>
<div class="fan">${posters.map((src, i) => {
  // a loose 2×2: wide capsules on top, the squarer covers below, every logo left showing
  const pos = { 'meowntain.webp': [4, -6, -4], 'purrbricks.webp': [252, -16, 4], 'purrpendicular.webp': [14, 160, -3], 'catridge.webp': [258, 166, 4] }[src.split('/').pop()] || [i * 40, i * 40, 0];
  return `<img src="${src}" style="left:${pos[0]}px;top:${pos[1]}px;rotate:${pos[2]}deg;z-index:${i + 1}">`;
}).join('')}</div>
<div class="cabs">${cabs.map((src) => `<img src="${src}">`).join('')}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const out = path.join(root, 'src/static/og.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote', path.relative(root, out), (fs.statSync(out).size / 1024).toFixed(1), 'KB');
