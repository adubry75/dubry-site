// Lofi Cat Radio offline renderer: N minutes of the generative music to WAV and/or MP3, deterministic per seed.
//
//   node tools/render-audio.mjs --minutes 60 --seed 42 --mode lofi --out lofi-1h.mp3
//   node tools/render-audio.mjs --minutes 60 --seed 7 --mode ambient --weather rain --out rain-ambient.wav
//
// Options
//   --minutes N        length (default 3)
//   --seed N           any integer; the same seed always renders the same music (default 1)
//   --mode M           lofi | ambient (default lofi)
//   --weather W        clear | rain | snow | fog (default clear): mixes the matching weather sounds in
//   --out FILE         .wav, .mp3 or .flac (default lofi-<mode>-<seed>.mp3); MP3/FLAC need ffmpeg on PATH
//   --wav              with an .mp3/.flac --out, also keep the .wav next to it
//   --rate HZ          sample rate (default 48000, the rate YouTube uses)
//   --bitrate K        MP3 bitrate in kbps (default 192)
//   --fade S           fade in/out seconds at the ends (default 4)
//
// Renders run much faster than real time (roughly 1 hour of audio in a few minutes).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Engine } from '../lofi/js/engine.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
if (flag('help') || flag('h')) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }

const minutes = parseFloat(opt('minutes', '3'));
const seed = parseInt(opt('seed', '1'), 10) >>> 0;
const mode = opt('mode', 'lofi');
const weather = opt('weather', 'clear');
const rate = parseInt(opt('rate', '48000'), 10);
const bitrate = parseInt(opt('bitrate', '192'), 10);
const fadeS = parseFloat(opt('fade', '4'));
const out = path.resolve(opt('out', `lofi-${mode}-${seed}.mp3`));
const ext = path.extname(out).toLowerCase();
if (!['lofi', 'ambient'].includes(mode)) throw new Error('--mode must be lofi or ambient');
const W = { clear: {}, rain: { rain: 1 }, snow: { snow: 1 }, fog: { fog: 1 } }[weather];
if (!W) throw new Error('--weather must be clear, rain, snow or fog');

const total = Math.round(minutes * 60 * rate);
const engine = new Engine({ sampleRate: rate, seed, mode });
engine.setWeather({ rain: 0, snow: 0, fog: 0, ...W });
engine.weather.rain = W.rain || 0; engine.weather.snow = W.snow || 0; engine.weather.fog = W.fog || 0; // start at full strength
const infos = [];
engine.onInfo = (i) => { const last = infos[infos.length - 1]; if (!last || last.key !== i.key || last.bpm !== i.bpm) infos.push({ at: engine.t / rate, ...i }); };

// WAV header for 16-bit stereo PCM
function wavHeader(frames) {
  const b = Buffer.alloc(44), data = frames * 4;
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(data, 40);
  return b;
}

const wavPath = ext === '.wav' ? out : (flag('wav') ? out.replace(/\.\w+$/, '.wav') : null);
const sinks = [];
if (wavPath) { const f = fs.openSync(wavPath, 'w'); fs.writeSync(f, wavHeader(total)); sinks.push({ write: (b) => fs.writeSync(f, b), end: () => fs.closeSync(f) }); }
let ff = null;
if (ext === '.mp3' || ext === '.flac') {
  const codec = ext === '.mp3' ? ['-c:a', 'libmp3lame', '-b:a', `${bitrate}k`] : ['-c:a', 'flac'];
  ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(rate), '-ac', '2', '-i', 'pipe:0', ...codec,
    '-metadata', `title=Lofi Cat Radio (${mode}, seed ${seed})`, '-metadata', 'artist=Lofi Cat Radio', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('error', (e) => { console.error('ffmpeg failed to start (is it installed and on PATH?):', e.message); process.exit(1); });
  sinks.push({ write: (b) => new Promise((res) => (ff.stdin.write(b) ? res() : ff.stdin.once('drain', res))), end: () => ff.stdin.end() });
}
if (!sinks.length) throw new Error('--out must end in .wav, .mp3 or .flac');

const N = 4096, L = new Float32Array(N), R = new Float32Array(N), fadeN = Math.round(fadeS * rate);
let peak = 0, done = 0, lastPct = -1;
const t0 = Date.now();
while (done < total) {
  const n = Math.min(N, total - done);
  // 128-frame quanta, exactly like the browser's AudioWorklet, so a seed renders the same music as the page
  for (let i = 0; i < n; i += 128) { const m = Math.min(128, n - i); engine.process(L.subarray(i, i + m), R.subarray(i, i + m), m); }
  const buf = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const k = done + i;
    let g = 1;
    if (k < fadeN) g = k / fadeN; else if (k > total - fadeN) g = (total - k) / fadeN;
    g = g * g * (3 - 2 * g);
    const l = L[i] * g, r = R[i] * g;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l * 32767))), i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r * 32767))), i * 4 + 2);
  }
  for (const s of sinks) await s.write(buf);
  done += n;
  const pct = Math.floor((done / total) * 100);
  if (pct !== lastPct && pct % 10 === 0) { lastPct = pct; process.stderr.write(`\r${pct}%`); }
}
for (const s of sinks) s.end();
if (ff) await new Promise((res) => ff.on('close', res));
process.stderr.write('\n');
const secs = (Date.now() - t0) / 1000;
console.log(`Rendered ${minutes} min of ${mode} (seed ${seed}, ${weather}) in ${secs.toFixed(1)} s (${((minutes * 60) / secs).toFixed(1)}x real time). Peak ${(20 * Math.log10(peak || 1e-9)).toFixed(2)} dBFS.`);
for (const i of infos) console.log(`  ${new Date(i.at * 1000).toISOString().slice(14, 19)}  ${i.key.padEnd(16)} ${String(i.bpm).padStart(3)} bpm`);
console.log('Wrote', [wavPath, ff ? out : null].filter(Boolean).join(' and '));
