// Behaviour + accessibility checks against the local preview (fixtures).
//   node tools/check.mjs        -> prints PASS/FAIL lines, writes shots/check-*.png + shots/aria.yml
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 8078;
const BASE = `http://localhost:${PORT}/`;
const srv = spawn('node', ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch();
fs.mkdirSync('shots', { recursive: true });
let failures = 0;
const ok = (cond, msg, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${extra ? '  — ' + extra : ''}`); if (!cond) failures++; };
const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
}
async function scrollThrough(page) {
  for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 500) {
    await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(30);
  }
  await page.waitForTimeout(800);
}

// 1 ── axe-core scan (after every lazy life has loaded) ─────────────
{
  const page = await newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await scrollThrough(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: axeSrc });
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  ok(res.length === 0, 'axe-core: no WCAG violations', res.map((v) => `${v.id}(${v.impact}) x${v.n}: ${v.help} [${v.sample.join(' | ')}]`).join('\n      '));
  ok(page.errors.length === 0, 'no uncaught page errors', page.errors.join('; '));

  // landmarks / headings / labels
  const info = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    h2: [...document.querySelectorAll('h2')].map((h) => h.textContent.trim()),
    unnamedLinks: [...document.querySelectorAll('a[href]')].filter((a) => !a.closest('[aria-hidden="true"]') && !(a.getAttribute('aria-label') || a.textContent.trim() || a.querySelector('img[alt]:not([alt=""])'))).length,
    imgsNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
    catHidden: document.querySelector('.cat').getAttribute('aria-hidden'),
    cabs: document.querySelectorAll('.cab').length,
    benches: document.querySelectorAll('.bench').length,
    art: document.querySelectorAll('.frame:not(.frame--ghost):not(.frame--egg)').length,
    pbi: document.querySelectorAll('.monitor__btn').length,
    eggs: [...document.querySelectorAll('a.egg, .frame--egg a')].map((a) => a.getAttribute('href')),
  }));
  ok(info.h1 === 1, 'exactly one <h1>');
  ok(info.h2.length === 8, 'eight life <h2> headings (life 1 is the h1)', info.h2.join(' / '));
  ok(info.unnamedLinks === 0, 'every link has an accessible name', String(info.unnamedLinks));
  ok(info.imgsNoAlt === 0, 'every <img> has alt');
  ok(info.catHidden === 'true', 'decorative cat is aria-hidden');
  ok(info.cabs === 34, '34 arcade cabinets', String(info.cabs));
  ok(info.benches === 54, '54 benches', String(info.benches));
  ok(info.art === 59, 'gallery parsed 59 artworks from /art-portfolio/', String(info.art));
  ok(info.pbi === 6, 'office parsed 6 Power BI screenshots', String(info.pbi));
  ok(info.eggs.includes('/grumpycat/') && info.eggs.includes('/ratsrus/'), 'easter eggs link to /grumpycat/ and /ratsrus/', info.eggs.join(', '));
  fs.writeFileSync('shots/aria.yml', await page.locator('body').ariaSnapshot());
  await page.context().close();
}

// 2 ── keyboard: tab order reaches the games, focus stays visible ──
{
  const page = await newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => document.activeElement.textContent.trim());
  ok(/skip/i.test(skip), 'first Tab lands on the skip link', skip);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const offscreen = [];
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    const f = await page.evaluate(() => {
      const el = document.activeElement; const r = el.getBoundingClientRect();
      return { name: (el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 40), cls: el.className, inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
    });
    seen.push(f.name);
    if (String(f.cls).includes('cab') && !f.inView) offscreen.push(f.name);
  }
  ok(seen.some((s) => /Bird Brigade/.test(s)), 'skip link → first cabinet reachable by keyboard', seen.slice(0, 4).join(' | '));
  ok(offscreen.length === 0, 'focused cabinets are scrolled into view (pinned scrub)', offscreen.join(', '));
  await page.screenshot({ path: 'shots/check-keyboard.png' });
  await page.context().close();
}

// 3 ── reduced motion: static, unpinned, no live cat ───────────────
{
  const page = await newPage({ reducedMotion: 'reduce' });
  await page.goto(BASE, { waitUntil: 'load' });
  await scrollThrough(page);
  const st = await page.evaluate(() => ({
    cat: getComputedStyle(document.querySelector('.cat')).display,
    heroStatic: getComputedStyle(document.querySelector('.wake__cat-static')).visibility,
    napStatic: getComputedStyle(document.querySelector('.nap__static')).visibility,
    arcadeH: document.querySelector('#arcade').offsetHeight,
    trackOverflow: getComputedStyle(document.querySelector('.cabrow')).overflowX,
    navCurrent: !!document.querySelector('[data-nav][aria-current]'),
    trailDrawn: getComputedStyle(document.querySelector('.trail__path')).strokeDashoffset,
  }));
  ok(st.cat === 'none', 'reduced motion: live cat hidden');
  ok(st.heroStatic === 'visible' && st.napStatic === 'visible', 'reduced motion: static hero + nap cats shown');
  ok(st.arcadeH < 1400 && st.trackOverflow === 'auto', 'reduced motion: arcade unpinned, rows scroll natively', `${st.arcadeH}px, ${st.trackOverflow}`);
  ok(st.navCurrent, 'reduced motion: nav still tracks the current life');
  ok(st.trailDrawn === '0px' || st.trailDrawn === '0', 'reduced motion: trail fully drawn', st.trailDrawn);
  ok(page.errors.length === 0, 'reduced motion: no page errors', page.errors.join('; '));
  await page.context().close();
}

// 4 ── lightbox: open, arrow, Esc, focus ───────────────────────────
{
  const page = await newPage();
  await page.goto(BASE + '#trail', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const pic = page.locator('.bench__pic').nth(2);
  await pic.scrollIntoViewIfNeeded();
  await pic.click();
  await page.waitForTimeout(900);
  const open1 = await page.evaluate(() => ({ open: document.querySelector('.lb').open, cap: document.querySelector('.lb__cap').textContent, focusIn: document.querySelector('.lb').contains(document.activeElement) }));
  ok(open1.open && /3 – Red Osier/.test(open1.cap), 'bench opens in the lightbox with its caption', open1.cap);
  ok(open1.focusIn, 'focus moves into the dialog');
  await page.screenshot({ path: 'shots/check-lightbox.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  ok(/4 – Trillium/.test(await page.textContent('.lb__cap')), 'ArrowRight goes to the next bench');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  ok(!(await page.evaluate(() => document.querySelector('.lb').open)), 'Esc closes the lightbox');
  await page.context().close();
}

// 5 ── launch: cabinet click → transition → game URL ───────────────
{
  const page = await newPage();
  await page.goto(BASE + '#arcade', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const cab = page.locator('.cab', { hasText: 'Pounce' });
  await cab.focus();
  await page.waitForTimeout(300);
  await Promise.all([page.waitForURL('**/games/pounce.html', { timeout: 5000 }).catch(() => {}), cab.click()]);
  ok(page.url().endsWith('/games/pounce.html'), 'clicking a cabinet launches /games/pounce.html', page.url());
  await page.goBack();
  await page.waitForTimeout(800);
  ok(await page.evaluate(() => document.querySelector('.launch').hidden), 'back button restores the page (launch overlay hidden)');
  await page.context().close();
}

// 6 ── score hall states ───────────────────────────────────────────
for (const mode of ['empty', 'fail']) {
  const page = await newPage();
  await page.goto(BASE + `?scores=${mode}#scores`, { waitUntil: 'load' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => document.querySelector('#scores').scrollIntoView());
  await page.waitForTimeout(2000);
  const txt = await page.textContent('#scores');
  if (mode === 'empty') ok(/No crowns yet/.test(txt) && /Unclaimed crowns/.test(txt), 'scores: all-empty boards render an inviting empty state');
  else ok(/napping/.test(txt) && (await page.locator('#scores button', { hasText: 'Try again' }).count()) === 1, 'scores: API failure shows retry');
  await page.locator('.hall__crt').screenshot({ path: `shots/check-scores-${mode}.png` });
  await page.context().close();
}

// 7 ── cache: second load reads sessionStorage instead of refetching ─
{
  const page = await newPage();
  let calls = 0;
  page.on('request', (r) => { if (r.url().includes('scores.php')) calls++; });
  await page.goto(BASE + '#scores', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const first = calls;
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => document.querySelector('#scores').scrollIntoView());
  await page.waitForTimeout(1500);
  ok(first === 31 && calls === first, 'scores: 31 parallel fetches, then served from sessionStorage', `${first} then ${calls - first}`);
  await page.context().close();
}

await browser.close();
srv.kill();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
