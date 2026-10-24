// Renders every cabinet screen to shots/art-sheet.png for review.
import { chromium } from './pw.mjs';
import { screenSVG } from '../src/js/art.js';
import { ARCADE, EXTRA_CABINETS } from '../src/data/content.js';
import fs from 'node:fs';
const all = [...ARCADE, ...EXTRA_CABINETS];
const html = `<style>body{background:#111;margin:0;display:grid;grid-template-columns:repeat(7,190px);gap:8px;padding:8px;font:11px sans-serif;color:#aaa}svg{width:190px;height:142px;display:block}</style>` +
  all.map((g, i) => `<div>${screenSVG(g, i)}${g.title}</div>`).join('');
fs.mkdirSync('shots', { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.setContent(html); await p.screenshot({ path: 'shots/art-sheet.png', fullPage: true }); await b.close();
