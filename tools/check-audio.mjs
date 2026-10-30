// Lofi Cat Radio: a level check for rendered WAVs (16-bit stereo, as tools/render-audio.mjs writes them).
//   node tools/check-audio.mjs file.wav [--png out.png]
// Reports peak, clipped samples, loudness over time (RMS in 1 s windows), silence gaps, the biggest
// jump in level between neighbouring seconds, and the integrated loudness (LUFS) via ffmpeg if present.
// --png also draws a spectrogram + level plot with ffmpeg, to look at.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const file = process.argv[2];
if (!file) { console.log('usage: node tools/check-audio.mjs file.wav [--png out.png]'); process.exit(1); }
const buf = fs.readFileSync(file);
let off = 12, rate = 48000, ch = 2, data = null;
while (off < buf.length) {
  const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
  if (id === 'fmt ') { ch = buf.readUInt16LE(off + 10); rate = buf.readUInt32LE(off + 12); }
  if (id === 'data') { data = buf.subarray(off + 8, off + 8 + size); break; }
  off += 8 + size;
}
const frames = data.length / (2 * ch);
const win = rate; // 1 s
const rms = [];
let peak = 0, clipped = 0, sum = 0, cnt = 0;
for (let f = 0; f < frames; f++) {
  for (let c = 0; c < ch; c++) {
    const v = data.readInt16LE((f * ch + c) * 2) / 32768;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a >= 0.999) clipped++;
    sum += v * v; cnt++;
  }
  if ((f + 1) % win === 0) { rms.push(Math.sqrt(sum / cnt)); sum = 0; cnt = 0; }
}
const db = (x) => 20 * Math.log10(x + 1e-12);
const inner = rms.slice(5, -5); // skip the fade-in/out
const dbs = inner.map(db);
const min = Math.min(...dbs), max = Math.max(...dbs), avg = dbs.reduce((a, b) => a + b, 0) / dbs.length;
let jump = 0, jumpAt = 0;
for (let i = 1; i < dbs.length; i++) { const j = Math.abs(dbs[i] - dbs[i - 1]); if (j > jump) { jump = j; jumpAt = i + 5; } }
const gaps = dbs.map((d, i) => [d, i + 5]).filter(([d]) => d < -45);
console.log(`${file}`);
console.log(`  length ${(frames / rate / 60).toFixed(2)} min @ ${rate} Hz`);
console.log(`  peak ${db(peak).toFixed(2)} dBFS, clipped samples: ${clipped}`);
console.log(`  RMS per second: avg ${avg.toFixed(1)} dBFS, min ${min.toFixed(1)}, max ${max.toFixed(1)} (range ${(max - min).toFixed(1)} dB)`);
console.log(`  biggest second-to-second change: ${jump.toFixed(1)} dB at ${Math.floor(jumpAt / 60)}:${String(jumpAt % 60).padStart(2, '0')}`);
console.log(`  silence gaps (< -45 dBFS): ${gaps.length ? gaps.map(([, i]) => `${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`).join(', ') : 'none'}`);
const strip = dbs.map((d) => ' ▁▂▃▄▅▆▇█'[Math.max(0, Math.min(8, Math.round((d + 36) / 3)))]).join('');
for (let i = 0; i < strip.length; i += 90) console.log('  ' + strip.slice(i, i + 90));
const ff = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
if (ff.status === 0) {
  // short-term (3 s) loudness, sampled each second: how the level feels, transitions included
  const st = [...ff.stderr.matchAll(/t:\s*([\d.]+)\s+TARGET.*?S:\s*(-?[\d.]+|-inf)/g)]
    .map((m) => [parseFloat(m[1]), parseFloat(m[2])]).filter(([t]) => Math.abs(t - Math.round(t)) < 0.05 && t > 6 && t < frames / rate - 6);
  if (st.length) {
    const v = st.map(([, x]) => x);
    let j = 0, ja = 0;
    for (let i = 1; i < v.length; i++) { const d = Math.abs(v[i] - v[i - 1]); if (d > j) { j = d; ja = st[i][0]; } }
    console.log(`  short-term loudness: ${Math.min(...v).toFixed(1)} to ${Math.max(...v).toFixed(1)} LUFS; biggest 1 s change ${j.toFixed(1)} LU at ${Math.floor(ja / 60)}:${String(Math.round(ja % 60)).padStart(2, '0')}`);
  }
  const s = ff.stderr.split('Summary:')[1] || '';
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(s), LRA = /LRA:\s+([\d.]+) LU/.exec(s), TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(s);
  if (I) console.log(`  integrated loudness ${I[1]} LUFS, loudness range ${LRA ? LRA[1] : '?'} LU, true peak ${TP ? TP[1] : '?'} dBFS`);
}
const pi = process.argv.indexOf('--png');
if (pi > 0) {
  const png = process.argv[pi + 1];
  spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-lavfi', 'showspectrumpic=s=1400x500:legend=1:scale=log:stop=12000', png]);
  console.log('  spectrogram:', png);
}
