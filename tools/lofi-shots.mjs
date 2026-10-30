// Lofi Cat Radio: Playwright checks. Serves the repo root, then for desktop (1920×1080) and a phone:
// screenshots every weather × time of day, collects console errors, and measures frame times.
//   node tools/lofi-shots.mjs [--only desktop|phone] [--times 07:50,13:00] [--weathers rain] [--view lake] [--room cabin] [--out shots/lofi]
//   node tools/lofi-shots.mjs --soak 10     (10-minute run: frame times + JS heap over time)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './pw.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(root, opt('out', 'shots/lofi'));
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/lofi/`;

const DEVICES = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const times = (opt('times', '02:00,06:55,07:50,13:00,17:55,18:30,21:30')).split(',');
const weathers = (opt('weathers', 'clear,cloudy,rain,storm,snow,fog')).split(',');
const only = opt('only', null);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const errors = [];

async function open(dev, params) {
  const ctx = await browser.newContext(DEVICES[dev]);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${dev} ${params}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${dev} ${params}] pageerror: ${e.message}`));
  await page.goto(base + '?' + params);
  return { ctx, page };
}

const soak = opt('soak', null);
if (soak) {
  const mins = parseFloat(soak);
  const { ctx, page } = await open('desktop', `record=1&seed=5&weather=auto&fast=120`);
  await page.mouse.click(960, 540); // starts the audio
  const samples = [];
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  for (let i = 0; i <= mins * 2; i++) {
    const s = await page.evaluate(() => { const st = window.__lofi.stats; const r = { frames: st.frames, avg: st.work / Math.max(1, st.frames), worst: st.worst }; st.frames = 0; st.work = 0; st.worst = 0; return r; });
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const m = await cdp.send('Performance.getMetrics');
    const heap = m.metrics.find((x) => x.name === 'JSHeapUsedSize').value / 1048576;
    const nodes = m.metrics.find((x) => x.name === 'Nodes').value;
    samples.push({ t: i * 30, fps: s.frames / 30, avg: s.avg, worst: s.worst, heap, nodes });
    console.log(`t=${String(i * 30).padStart(4)}s  fps ${(s.frames / 30).toFixed(1).padStart(5)}  frame work avg ${s.avg.toFixed(2)} ms, worst ${s.worst.toFixed(1)} ms  heap ${heap.toFixed(1)} MB  nodes ${nodes}`);
    if (i < mins * 2) await page.waitForTimeout(30000);
  }
  fs.writeFileSync(path.join(out, 'soak.json'), JSON.stringify(samples, null, 1));
  await page.screenshot({ path: path.join(out, 'soak-end.png') });
  await ctx.close();
} else {
  for (const dev of Object.keys(DEVICES)) {
    if (only && only !== dev) continue;
    for (const w of weathers) for (const t of times) {
      const params = `record=1&freeze=1&instant=1&seed=3&awake=${t === '13:00' ? 1 : 0}&weather=${w}&time=2026-10-30T${t}:00-07:00&view=${opt('view', 'town')}&room=${opt('room', 'cozy')}`;
      const { ctx, page } = await open(dev, params);
      await page.waitForTimeout(1500);
      const file = path.join(out, `${dev}-${w}-${t.replace(':', '')}.png`);
      await page.screenshot({ path: file });
      await ctx.close();
      process.stdout.write('.');
    }
  }
  // the controls (awake) on both devices
  for (const dev of Object.keys(DEVICES)) {
    if (only && only !== dev) continue;
    const { ctx, page } = await open(dev, 'freeze=1&seed=3&time=2026-10-30T20:15:00-07:00&weather=rain&instant=1');
    await page.waitForTimeout(800);
    await page.mouse.click(DEVICES[dev].viewport.width / 2, DEVICES[dev].viewport.height / 2);
    await page.mouse.move(100, 100); await page.mouse.move(200, 200);
    await page.waitForTimeout(2500);
    await page.mouse.move(210, 210);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${dev}-controls.png`) });
    const fr = await page.evaluate(() => { const s = window.__lofi.stats; return { frames: s.frames, avg: s.work / s.frames, worst: s.worst }; });
    console.log(`\n${dev}: ${fr.frames} frames, avg frame work ${fr.avg.toFixed(2)} ms, worst ${fr.worst.toFixed(1)} ms`);
    await ctx.close();
  }
}
console.log(errors.length ? '\nConsole problems:\n' + [...new Set(errors)].join('\n') : '\nNo console errors or warnings.');
await browser.close();
server.close();
