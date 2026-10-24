// Renders every cat pose + a gait strip to shots/cat-poses.png for visual review.
import { chromium } from './pw.mjs';
import { staticSVG, solve, gaitPose, rigMarkup, POSES } from '../src/js/cat-rig.js';
import fs from 'node:fs';
const cells = [];
for (const k of ['stand', 'sit', 'stretch', 'leapUp', 'leapDown', 'curl']) cells.push([k, staticSVG(k)]);
for (const g of ['walk', 'trot', 'sprint']) for (let i = 0; i < 6; i++) {
  cells.push([`${g} ${i}/6`, `<svg class="catsvg" viewBox="-78 -96 156 104">${rigMarkup(solve(gaitPose(g, i / 6)))}</svg>`]);
}
const html = `<style>body{background:#0b0820;margin:0;display:grid;grid-template-columns:repeat(6,220px);gap:8px;padding:10px;font:12px sans-serif;color:#aaa}
.c{border-bottom:1px solid #333}.catsvg{width:210px;overflow:visible}
.cat-lines path{fill:none;stroke:#ffe6fa;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.cat-lines .far{opacity:.45}.cat-lines .thin{stroke-width:1.1;opacity:.8}.cat-lines .fill,.cat-lines .eye{fill:#ffe6fa;stroke-width:1.4}
.catsvg{filter:drop-shadow(0 0 3px #ff4fd8) drop-shadow(0 0 8px #ff4fd8aa)}</style>
${cells.map(([n, s]) => `<div class="c">${s}<div>${n}</div></div>`).join('')}`;
fs.mkdirSync('shots', { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
await p.setContent(html); await p.screenshot({ path: 'shots/cat-poses.png', fullPage: true }); await b.close();
