// Renders src/static/apple-touch-icon.png (from favicon.svg) and src/static/og.jpg (the hero, cat awake).
// Run after a build: node tools/make-static.mjs
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = 8081;
const srv = spawn('node', ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const icon = await b.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(`<body style="margin:0;background:#0b0820">${fs.readFileSync('src/static/favicon.svg', 'utf8').replace('<svg ', '<svg width="180" height="180" ')}</body>`);
await icon.screenshot({ path: 'src/static/apple-touch-icon.png' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await p.addStyleTag({ content: '.topbar,.lives,.wake__cue,.kicker{display:none!important}' });
await p.mouse.move(600, 300);
await p.waitForTimeout(4200);
await p.screenshot({ path: 'src/static/og.jpg', type: 'jpeg', quality: 84 });
await b.close(); srv.kill();
console.log('wrote src/static/apple-touch-icon.png, src/static/og.jpg');
