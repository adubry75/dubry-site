// Drives the preview with Playwright and screenshots every life at desktop + phone sizes.
//   node tools/shoot.mjs [filter]      -> shots/<viewport>-<step>.png
// Env: RM=1 (prefers-reduced-motion), Q="?scores=empty" (page query)
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = +(process.env.PORT || 8077);
const srv = spawn('node', ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const filter = process.argv[2] || '';
const VPS = [
  { name: 'desk', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
].filter((v) => !process.env.VP || v.name === process.env.VP);
fs.mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const errors = [];
for (const vp of VPS) {
  const ctx = await browser.newContext({ ...vp, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${vp.name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${vp.name}] PAGEERROR ${e.message}`));
  await page.goto(`http://localhost:${PORT}/${process.env.Q || ''}`, { waitUntil: 'load' });
  const tag = (process.env.RM ? 'rm-' : '') + vp.name;
  const shot = async (n) => {
    if (filter && !n.includes(filter)) return;
    await page.screenshot({ path: `shots/${tag}-${n}.png` });
  };
  await page.waitForTimeout(1000); await shot('01a-wake-sleep');
  await page.mouse.move(200, 200); await page.mouse.move(400, 300);
  await page.waitForTimeout(2600); await shot('01b-wake');
  // walk the page in small steps so lazy modules + the cat keep up
  const go = async (sel, frac = 0, wait = 900) => {
    const y = await page.evaluate(([s, f]) => {
      const el = document.querySelector(s); const r = el.getBoundingClientRect();
      return r.top + scrollY + (r.height - innerHeight) * f;
    }, [sel, frac]);
    const from = await page.evaluate(() => scrollY);
    const steps = 12;
    for (let i = 1; i <= steps; i++) { await page.evaluate((v) => scrollTo(0, v), from + (y - from) * i / steps); await page.waitForTimeout(40); }
    await page.waitForTimeout(wait);
  };
  await page.evaluate(() => scrollTo(0, 120)); await page.waitForTimeout(150); await page.evaluate(() => scrollTo(0, 330)); await page.waitForTimeout(160); await shot('01c-wake-scroll');
  await go('#arcade', 0, 1200); await shot('02a-arcade');
  await go('#arcade', 0.5); await shot('02b-arcade-mid');
  await go('#arcade', 1); await shot('02c-arcade-end');
  await go('#scores', -0.1, 1500); await shot('03a-scores');
  await go('#scores', 0.5); await shot('03b-scores-more');
  await go('#big', 0); await shot('04a-big');
  await go('.poster:nth-child(1)', 0); await shot('04b-poster1');
  await go('.poster:nth-child(2)', -0.5, 600); await shot('04c-poster2-entering');
  await go('.poster:nth-child(2)', 0); await shot('04d-poster2');
  await go('.poster:nth-child(3)', 0); await shot('04e-poster3');
  await go('.poster:nth-child(4)', 0); await shot('04f-poster4');
  await go('.poster:nth-child(5)', 0); await shot('04g-poster5');
  await go('#gallery', 0, 1500); await shot('06a-gallery');
  await go('#gallery', 0.5, 1500); await shot('06b-gallery-mid');
  await go('#trail', 0); await shot('07a-trail');
  await go('#trail', 0.2); await shot('07b-trail-20');
  await go('#trail', 0.6); await shot('07c-trail-60');
  await go('#trail', 1); await shot('07d-trail-end');
  await go('#office', 0); await shot('08a-office');
  await go('#office', 0.6); await shot('08b-office-more');
  await go('#nap', 1, 2500); await shot('09-nap');
  await ctx.close();
}
await browser.close();
srv.kill();
console.log(errors.length ? errors.join('\n') : 'no console errors');
