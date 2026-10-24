// Local preview server for the Nine Lives page.
//   /                -> dist/index.html          /nine-lives/*  -> dist/nine-lives/*
//   /games/scores.php -> fake scores API (seeded). Mode comes from the page URL:
//        /?scores=empty  every board empty      /?scores=fail  every request 500s
//        /?scores=slow   2.5 s latency          (default: a realistic mix)
//   anything else    -> fixtures/_gen/* (art portfolio, Power BI page, bench photos)
//   unknown *.html or folder URLs -> a small stub page, so every link can be clicked.
// Usage: node tools/serve.mjs [port]   (run `npm run fixtures` once first)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ARCADE } from '../src/data/content.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(root, 'dist');
const FIX = path.join(root, 'fixtures', '_gen');
const port = +(process.argv[2] || process.env.PORT || 8054);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };

const NAMES = ['KAT', 'MOCHI', 'ZEN', 'TOAST', 'PIXEL', 'LUNA', 'BEANS', 'NOVA', 'OREO', 'MIKO', 'JINX', 'TUNA', 'ACE', 'GUS'];
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function fakeScores(id) {
  const i = ARCADE.findIndex((g) => g.id === id);
  const r = rand(i * 7919 + 13);
  const boards = {};
  if (i % 5 !== 1 && i % 7 !== 3) { // plenty of games stay empty
    const metrics = [['score', 'wave', 'time', 'level', 'reach', 'total', 'cap', 'sector', 'station', 'pinch'][i % 10]];
    if (i % 4 === 0) metrics.push('level');
    for (const m of metrics) {
      const n = 2 + Math.floor(r() * 8);
      let v = m === 'score' || m === 'total' ? 50000 : 60;
      boards[m] = Array.from({ length: n }, (_, k) => {
        v = Math.max(1, Math.round(v * (0.6 + r() * 0.35)));
        const name = NAMES[Math.floor(Math.pow(r(), 1.6) * NAMES.length)];
        return { name, date: `2025-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`, [m]: v };
      });
    }
  }
  return { game: id, boards };
}

function send(req, res, code, type, body) {
  const gz = /gzip/.test(req.headers['accept-encoding'] || '') && /text|javascript|json|svg/.test(type);
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
  if (gz) { body = zlib.gzipSync(body); headers['Content-Encoding'] = 'gzip'; }
  res.writeHead(code, headers);
  res.end(body);
}
const stub = (p) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>${p}</title>
<body style="margin:0;min-height:100vh;display:grid;place-content:center;gap:12px;background:#07060d;color:#f4efff;font:16px system-ui;text-align:center">
<h1 style="font-size:20px">Fixture stub</h1><p><code>${p.replace(/</g, '&lt;')}</code> lives on dubry.com — not part of this build.</p><p><a style="color:#3df2ff" href="/">← back to Nine Lives</a></p>`;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p.includes('..')) return send(req, res, 400, 'text/plain', 'bad path');

  if (p === '/games/scores.php') {
    const mode = new URL(req.headers.referer || 'http://x/').searchParams.get('scores');
    const go = () => {
      if (mode === 'fail' || (url.searchParams.get('game') === 'turf-war' && !process.env.NO_FAIL)) return send(req, res, 500, 'application/json', '{"error":"nope"}');
      const data = fakeScores(url.searchParams.get('game'));
      if (mode === 'empty') data.boards = {};
      send(req, res, 200, 'application/json', JSON.stringify(data));
    };
    return mode === 'slow' ? setTimeout(go, 2500) : go();
  }
  const tryFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
  let file = null;
  if (p === '/' || p === '/index.html') file = path.join(DIST, 'index.html');
  else if (p.startsWith('/nine-lives/')) file = tryFile(path.join(DIST, p));
  else file = tryFile(path.join(FIX, p)) || (p.endsWith('/') && tryFile(path.join(FIX, p, 'index.html')));
  if (file) return send(req, res, 200, TYPES[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
  if (p.endsWith('.html') || p.endsWith('/')) return send(req, res, 200, TYPES['.html'], stub(p));
  send(req, res, 404, 'text/plain', 'not found: ' + p);
}).listen(port, () => console.log(`Nine Lives preview → http://localhost:${port}/`));
