// Lofi Cat Radio offline video renderer: a finished MP4 (picture + music) with no screen recording.
// It opens the page in headless Chromium on a virtual clock, steps it frame by frame, and renders the music
// with the same engine in Node in lockstep: weather sounds follow what's on screen, and every lightning
// flash gets its rumble. Slower than real time on most machines, but frame-perfect, and it can run unattended.
//
//   node tools/render-video.mjs --minutes 60 --seed 7 --mode lofi --weather rain --cat daisy --out lofi-rain-1h.mp4
//   node tools/render-video.mjs --minutes 60 --fast 3600 --time 05:30 --out whole-day.mp4   (sunrise → night in an hour)
//
// Options
//   --minutes N     length (default 1)
//   --seed N        music + scene seed (default 1)
//   --mode M        lofi | jazz | ambient (default lofi)
//   --weather W     auto | clear | cloudy | rain | storm | snow | fog (default auto)
//   --cat C         daisy | nero | jammies | callie | black (default daisy)
//   --room R        cozy | cabin | blue (default cozy)
//   --time T        Medford start time, HH:MM today or an ISO date (default: now)
//   --fast S        a whole day passes every S seconds (default: real time)
//   --fps N         frames per second (default 30)
//   --size WxH      video size (default 1920x1080)
//   --crf N         x264 quality, lower is better (default 18)
//   --out FILE      output .mp4 (default lofi-cat-radio.mp4)
//   --still FILE    instead of a video, save one frame as PNG (e.g. a thumbnail: --size 1280x720 --still thumb.png)
// Needs Playwright's Chromium and ffmpeg (with libx264) on PATH.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from './pw.mjs';
import { Engine } from '../lofi/js/engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
if (args.includes('--help')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }

const minutes = parseFloat(opt('minutes', '1'));
const seed = parseInt(opt('seed', '1'), 10) >>> 0;
const mode = opt('mode', 'lofi'), weather = opt('weather', 'auto'), cat = opt('cat', 'daisy');
const fps = parseInt(opt('fps', '30'), 10);
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const crf = opt('crf', '18');
const out = path.resolve(opt('out', 'lofi-cat-radio.mp4'));
const sr = 48000;
const frames = Math.round(minutes * 60 * fps);

// static server for the page
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);

const params = new URLSearchParams({ record: '1', manual: '1', quality: '1', seed: String(seed), mode, weather, cat, room: opt('room', 'cozy'), instant: '1' });
if (opt('time', null)) params.set('time', opt('time'));
if (opt('fast', null)) params.set('fast', opt('fast'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(`http://localhost:${server.address().port}/lofi/?${params}`);
await page.waitForFunction(() => window.__lofi && window.__lofi.step);
await page.evaluate(() => { window.__lofi.scene.playing = true; });

if (opt('still', null)) { // one frame (after a few seconds so everything has settled) → PNG
  for (let i = 0; i < 4 * fps; i++) await page.evaluate((dt) => window.__lofi.step(dt), 1 / fps);
  const png = await page.evaluate(() => window.__lofi.scene.canvas.toDataURL('image/png').slice(22));
  fs.writeFileSync(path.resolve(opt('still')), Buffer.from(png, 'base64'));
  console.log('Wrote', path.resolve(opt('still')));
  await browser.close(); server.close(); process.exit(0);
}
// video: JPEG frames from the canvas → x264
const tmpVideo = out.replace(/\.mp4$/i, '') + '.video.tmp.mp4', tmpAudio = out.replace(/\.mp4$/i, '') + '.audio.tmp.wav';
const fadeS = Math.min(3, minutes * 60 / 4);
const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
  '-vf', `fade=t=in:st=0:d=${fadeS},fade=t=out:st=${(frames / fps - fadeS).toFixed(3)}:d=${fadeS},format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-r', String(fps), '-movflags', '+faststart', tmpVideo], { stdio: ['pipe', 'inherit', 'inherit'] });
ff.on('error', (e) => { console.error('ffmpeg failed to start:', e.message); process.exit(1); });
const write = (b) => new Promise((res) => (ff.stdin.write(b) ? res() : ff.stdin.once('drain', res)));

// audio: same engine as the page, stepped alongside the frames
const engine = new Engine({ sampleRate: sr, seed, mode });
let flashes = 0;
engine.onFlash = () => { flashes++; };
const totalSamples = Math.round(frames / fps * sr), fadeN = Math.round(fadeS * sr);
const af = fs.openSync(tmpAudio, 'w');
{ // 16-bit stereo WAV header
  const b = Buffer.alloc(44), data = totalSamples * 4;
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(data, 40);
  fs.writeSync(af, b);
}
const qL = new Float32Array(128), qR = new Float32Array(128);
let pendL = qL, pendR = qR, pendAt = 128, written = 0;

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const fl = flashes; flashes = 0;
  const res = await page.evaluate(([dt, fl]) => {
    const w = window.__lofi.step(dt, fl);
    return { w, jpg: window.__lofi.scene.canvas.toDataURL('image/jpeg', 0.93).slice(23) };
  }, [1 / fps, fl]);
  await write(Buffer.from(res.jpg, 'base64'));
  engine.setWeather(res.w);
  // audio for this frame, in 128-frame quanta like the browser
  const need = Math.round((f + 1) / fps * sr) - written;
  const buf = Buffer.alloc(need * 4);
  for (let i = 0; i < need; i++) {
    if (pendAt >= 128) { engine.process(qL, qR, 128); pendL = qL; pendR = qR; pendAt = 0; }
    const k = written + i;
    let g = k < fadeN ? k / fadeN : k > totalSamples - fadeN ? (totalSamples - k) / fadeN : 1;
    g = Math.max(0, g); g = g * g * (3 - 2 * g);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pendL[pendAt] * g * 32767))), i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pendR[pendAt] * g * 32767))), i * 4 + 2);
    pendAt++;
  }
  fs.writeSync(af, buf); written += need;
  if (f % (fps * 10) === 0 || f === frames - 1) {
    const el = (Date.now() - t0) / 1000, rate = (f + 1) / el;
    process.stderr.write(`\r${(100 * (f + 1) / frames).toFixed(1)}%  ${rate.toFixed(1)} fps  ETA ${Math.round((frames - f - 1) / rate / 60)} min   `);
  }
}
fs.closeSync(af);
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close(); server.close();
process.stderr.write('\nMuxing…\n');
await new Promise((resolve, reject) => {
  const mux = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmpVideo, '-i', tmpAudio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-metadata', `title=Lofi Cat Radio (${mode}, seed ${seed})`, '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
  mux.on('close', (c) => (c === 0 ? resolve() : reject(new Error('mux failed'))));
});
fs.rmSync(tmpVideo); fs.rmSync(tmpAudio);
console.log(`Wrote ${out}: ${minutes} min, ${W}×${H} @ ${fps} fps, in ${((Date.now() - t0) / 60000).toFixed(1)} min.`);
if (problems.length) console.log('Page errors:', problems);
