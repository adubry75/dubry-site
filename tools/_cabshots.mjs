// temp: capture title + gameplay frames of every arcade cabinet from the live site
import { chromium } from './pw.mjs';
import { ARCADE, EXTRA_CABINETS } from '../src/data/content.js';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
for (const g of [...ARCADE, ...EXTRA_CABINETS]) {
  const p = await b.newPage({ viewport: { width: 960, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto('https://dubry.com' + g.href, { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/${g.id}-t.png` });
    await p.mouse.click(480, 400); await p.keyboard.press('Enter'); await p.keyboard.press('Space');
    await p.waitForTimeout(1200);
    for (let k = 0; k < 6; k++) { await p.keyboard.down(k % 2 ? 'ArrowLeft' : 'ArrowRight'); await p.keyboard.press('Space'); await p.waitForTimeout(250); await p.keyboard.up(k % 2 ? 'ArrowLeft' : 'ArrowRight'); await p.mouse.move(300 + k * 70, 300 + (k % 3) * 60); }
    await p.screenshot({ path: `${out}/${g.id}-g.png` });
    console.log('ok', g.id, errs.length ? 'errors:' + errs[0].slice(0, 80) : '');
  } catch (e) { console.log('FAIL', g.id, e.message.slice(0, 100)); }
  await p.close();
}
await b.close();
