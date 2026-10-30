// Lofi Cat Radio: the music engine.
// Pure-JS DSP with no WebAudio nodes, so the same code runs in the browser's AudioWorklet and in
// tools/render-audio.mjs, and a seed always renders the same music. Two generators:
//   LofiGen     Rhodes chords with jazz voicings, a mellow bass, dusty drums, a sparse melody
//   AmbientGen  slow pads, a drone and airy swells: every envelope is slow, so no bells and no plucks
// plus rain/snow/fog sounds, vinyl crackle, tape wobble, a slow leveller and a peak limiter.

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

// ── Seeded randomness (mulberry32). Never Math.random: a seed must always render the same music.
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.weighted = (pairs) => { // [[item, weight], ...]
    let sum = 0; for (const p of pairs) sum += p[1];
    let x = r() * sum;
    for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };
  r.fork = () => rng(Math.floor(r() * 4294967296));
  return r;
}

// Fast deterministic noise for audio-rate use (xorshift32), returns -1..1.
function noiseGen(seed) {
  let s = (seed >>> 0) || 0x9E3779B9;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 2147483648) - 1; };
}

// Sine lookup with linear interpolation; phase in cycles.
const SIN_N = 4096;
const SIN = new Float64Array(SIN_N + 1);
for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin((i / SIN_N) * TAU);
function sinc(ph) { // ph: any real number of cycles
  ph -= Math.floor(ph);
  const x = ph * SIN_N, i = x | 0;
  return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i);
}

// ── Filters
class OnePole { // lowpass; hp() gives the complementary highpass
  constructor(sr, hz) { this.sr = sr; this.z = 0; this.set(hz); }
  set(hz) { this.a = 1 - Math.exp(-TAU * hz / this.sr); }
  lp(x) { return (this.z += this.a * (x - this.z)); }
  hp(x) { return x - (this.z += this.a * (x - this.z)); }
}
class SVF { // Simper/Cytomic TPT state-variable filter
  constructor(sr, hz, q = 0.707) { this.sr = sr; this.ic1 = 0; this.ic2 = 0; this.set(hz, q); }
  set(hz, q = this.q) {
    this.q = q;
    const g = Math.tan(Math.PI * clamp(hz, 10, this.sr * 0.45) / this.sr), k = 1 / q;
    this.k = k; this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1 + 1e-20; this.ic2 = 2 * v2 - this.ic2 + 1e-20;
    this.band = v1; this.low = v2;
    return v2;
  }
}

// ── Reverb: 8-line feedback delay network, Householder mixing, damped loops.
class FDN {
  constructor(sr, size, t60, dampHz, preMs = 12) {
    const base = [1031, 1327, 1523, 1871, 2053, 2311, 2647, 2851];
    this.n = 8; this.lines = []; this.idx = new Int32Array(8); this.g = new Float64Array(8);
    this.z = new Float64Array(8); this.d = new Float64Array(8);
    this.damp = 1 - Math.exp(-TAU * dampHz / sr);
    for (let i = 0; i < 8; i++) {
      const len = Math.max(64, Math.round(base[i] * size * sr / 44100));
      this.lines.push(new Float32Array(len));
      this.g[i] = Math.pow(10, (-3 * len) / (sr * t60));
    }
    this.pre = new Float32Array(Math.max(1, Math.round(preMs * sr / 1000)));
    this.pi = 0;
  }
  process(inL, inR, outL, outR, n, wet) {
    const L = this.lines, idx = this.idx, g = this.g, z = this.z, d = this.d, damp = this.damp, pre = this.pre;
    for (let s = 0; s < n; s++) {
      const x = pre[this.pi]; pre[this.pi] = (inL[s] + inR[s]) * 0.5;
      if (++this.pi >= pre.length) this.pi = 0;
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        const v = L[i][idx[i]];
        z[i] += damp * (v - z[i]);
        d[i] = z[i]; sum += z[i];
      }
      sum *= 0.25; // 2/N
      for (let i = 0; i < 8; i++) {
        const buf = L[i];
        buf[idx[i]] = (d[i] - sum) * g[i] + (i & 1 ? -x : x) + 1e-20;
        if (++idx[i] >= buf.length) idx[i] = 0;
      }
      outL[s] += (d[0] - d[2] + d[4] - d[6]) * wet;
      outR[s] += (d[1] - d[3] + d[5] - d[7]) * wet;
    }
  }
}

// ── Voices. Each renders into stereo buses from its start sample, and returns false when done.
const panGains = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

class Rhodes { // 2-op FM electric piano with a soft tremolo
  constructor(sr, start, midi, vel, durS, pan, bright = 1) {
    this.start = start; this.end = start + Math.round(durS * sr);
    this.inc = mtof(midi) / sr; this.ph = 0;
    const keyLo = clamp((76 - midi) / 36, 0, 1);
    this.dec = Math.exp(-1 / (sr * (1.1 + 2.4 * keyLo)));
    this.rel = Math.exp(-1 / (sr * 0.16));
    this.idx = (0.5 + vel * 1.5) * bright; this.idxDec = Math.exp(-1 / (sr * 0.22)); this.idxFloor = 0.18 * bright;
    this.env = 0; this.atk = 1 / (sr * 0.004);
    this.gain = vel * 0.2 * (1 - clamp((midi - 60) / 60, -0.3, 0.6));
    [this.gl, this.gr] = panGains(pan);
    this.tph = 0; this.tinc = 4.2 / sr;
    this.up = true;
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    let { ph, env, idx, tph } = this;
    const inc = this.inc, gl = this.gl * this.gain, gr = this.gr * this.gain;
    for (; i < n; i++) {
      const t = t0 + i;
      if (this.up) { env += this.atk; if (env >= 1) { env = 1; this.up = false; } }
      else env *= t < this.end ? this.dec : this.rel;
      idx = this.idxFloor + (idx - this.idxFloor) * this.idxDec;
      const y = sinc(ph + idx * sinc(ph) * 0.159) * env;
      ph += inc; if (ph > 1) ph -= 1;
      tph += this.tinc; if (tph > 1) tph -= 1;
      const tr = sinc(tph) * 0.12;
      L[i] += y * gl * (1 + tr); R[i] += y * gr * (1 - tr);
    }
    this.ph = ph; this.env = env; this.idx = idx; this.tph = tph;
    return !(t0 + n > this.end && env < 2e-4);
  }
}

class Piano { // soft felt piano: a few slightly stretched partials, the higher ones dying faster
  constructor(sr, start, midi, vel, durS, pan) {
    this.start = start; this.end = start + Math.round(durS * sr);
    const f = mtof(midi), B = 0.00035;
    this.p = [];
    for (let k = 1; k <= 6; k++) {
      const fk = f * k * Math.sqrt(1 + B * k * k);
      if (fk > sr * 0.4) break;
      const tau = (2.6 - clamp((midi - 48) / 40, 0, 1) * 1.4) / Math.pow(k, 0.7);
      this.p.push({ inc: fk / sr, ph: 0, a: Math.pow(k, -1.5) * (k === 1 ? 1 : 0.55 + vel * 0.5), d: Math.exp(-1 / (sr * tau)), e: 1 });
    }
    this.env = 0; this.atk = 1 / (sr * 0.006); this.up = true; this.rel = Math.exp(-1 / (sr * 0.22));
    this.lp = new OnePole(sr, 1400 + vel * 2600); this.lp2 = new OnePole(sr, 1400 + vel * 2600);
    this.gain = vel * 0.16 * (1 - clamp((midi - 60) / 60, -0.3, 0.6));
    [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    const P = this.p;
    for (; i < n; i++) {
      const t = t0 + i;
      if (this.up) { this.env += this.atk; if (this.env >= 1) { this.env = 1; this.up = false; } }
      else if (t >= this.end) this.env *= this.rel;
      let y = 0;
      for (let k = 0; k < P.length; k++) { const q = P[k]; q.ph += q.inc; if (q.ph > 1) q.ph -= 1; y += sinc(q.ph) * q.a * q.e; q.e *= q.d; }
      y = this.lp2.lp(this.lp.lp(y)) * this.env * this.gain;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return !(t0 + n > this.end && this.env < 2e-4) && P[0].e > 1e-4;
  }
}

class Guitar { // soft nylon string (Karplus-Strong): a filtered noise pluck in a tuned, gently damped delay loop
  constructor(sr, start, midi, vel, durS, pan, noise) {
    this.start = start; this.end = start + Math.round(durS * sr);
    const len = sr / mtof(midi);
    this.N = Math.floor(len); this.frac = len - this.N; this.buf = new Float32Array(this.N + 2); this.w = 0;
    const lp = new OnePole(sr, 1100 + vel * 1400);
    for (let i = 0; i < this.buf.length; i++) this.buf[i] = lp.lp(noise()) * 1.4; // the pluck
    this.loss = 0.996 - clamp((midi - 50) / 400, 0, 0.004); this.last = 0; this.rel = Math.exp(-1 / (sr * 0.08)); this.e = 1;
    this.body = new SVF(sr, 220, 1.2); this.gain = vel * 0.65; [this.gl, this.gr] = panGains(pan); this.k = 0; this.maxK = 12 * sr; // never ring longer than 12 s
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    const B = this.buf, N = this.N + 1;
    for (; i < n; i++, this.k++) {
      const t = t0 + i;
      if (t >= this.end) this.e *= this.rel;
      const r1 = (this.w + 1) % N, r2 = (this.w + 2) % N;
      const out = B[r1] + (B[r2] - B[r1]) * this.frac;
      const y = (out + this.last) * 0.5 * this.loss; this.last = out;
      B[this.w] = y; this.w = r1;
      const fade = this.k < 32 ? this.k / 32 : 1;
      const v = (out + this.body.run(out) * 0.6) * this.e * this.gain * fade;
      L[i] += v * this.gl; R[i] += v * this.gr;
    }
    return !(t0 + n > this.end && this.e < 1e-4) && this.k < this.maxK;
  }
}

class Riser { // a soft noise swell that leads into the next section
  constructor(sr, start, durS, noise) {
    this.start = start; this.len = Math.round(durS * sr); this.k = 0; this.noise = noise;
    this.f = new SVF(sr, 400, 1.4); this.f2 = new SVF(sr, 400, 1.4);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n && this.k < this.len; i++, this.k++) {
      const u = this.k / this.len;
      if ((this.k & 63) === 0) { this.f.set(400 + 2600 * u * u, 1.4); this.f2.set(430 + 2700 * u * u, 1.4); }
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15) * 0.5), 3) * (u > 0.92 ? (1 - u) / 0.08 : 1) * 0.05;
      this.f.run(this.noise()); this.f2.run(this.noise());
      L[i] += this.f.band * env; R[i] += this.f2.band * env;
    }
    return this.k < this.len;
  }
}

class Bass { // round sine bass with a little harmonics and saturation
  constructor(sr, start, midi, vel, durS) {
    this.start = start; this.end = start + Math.round(durS * sr);
    this.inc = mtof(midi) / sr; this.ph = 0; this.env = 0; this.atk = 1 / (sr * 0.012);
    this.dec = Math.exp(-1 / (sr * 1.6)); this.rel = Math.exp(-1 / (sr * 0.07)); this.up = true;
    this.gain = 0.2 * vel;
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    let { ph, env } = this;
    for (; i < n; i++) {
      const t = t0 + i;
      if (this.up) { env += this.atk; if (env >= 1) { env = 1; this.up = false; } }
      else env *= t < this.end ? this.dec : this.rel;
      let y = sinc(ph) + 0.22 * sinc(2 * ph) + 0.07 * sinc(3 * ph);
      y = Math.tanh(y * 1.3) * env * this.gain;
      ph += this.inc; if (ph > 1) ph -= 1;
      L[i] += y; R[i] += y;
    }
    this.ph = ph; this.env = env;
    return !(t0 + n > this.end && env < 1e-4);
  }
}

class Kick {
  constructor(sr, start, vel, noise) {
    this.sr = sr; this.start = start; this.len = Math.round(0.5 * sr); this.ph = 0; this.vel = vel * 0.4;
    this.noise = noise; this.click = new OnePole(sr, 3000);
    this.kd = Math.exp(-1 / (sr * 0.045)); this.ad = Math.exp(-1 / (sr * 0.24)); this.cd = Math.exp(-1 / (sr * 0.004));
    this.pe = 1; this.ae = 1; this.ce = 1; this.k = 0;
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    const sr = this.sr;
    for (; i < n && this.k < this.len; i++, this.k++) {
      const f = 52 + 80 * this.pe; this.pe *= this.kd;
      this.ph += f / sr; if (this.ph > 1) this.ph -= 1;
      const fade = this.k < 48 ? this.k / 48 : 1;
      const y = (sinc(this.ph) * this.ae + this.click.lp(this.noise()) * this.ce * 0.35) * this.vel * fade;
      this.ae *= this.ad; this.ce *= this.cd;
      L[i] += y; R[i] += y;
    }
    return this.k < this.len;
  }
}

class Snare {
  constructor(sr, start, vel, noise, pan = 0.08, tone = 185, tail = 0.13) {
    this.sr = sr; this.start = start; this.len = Math.round(0.45 * sr); this.k = 0; this.vel = vel * 0.22;
    this.noise = noise; this.bp = new SVF(sr, 1700, 0.7); this.lp = new OnePole(sr, 5200);
    this.nd = Math.exp(-1 / (sr * tail)); this.td = Math.exp(-1 / (sr * 0.045));
    this.ne = 1; this.te = 1; this.ph = 0; this.inc = tone / sr;
    [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n && this.k < this.len; i++, this.k++) {
      this.bp.run(this.noise());
      const fade = this.k < 24 ? this.k / 24 : 1;
      const y = this.lp.lp(this.bp.band * 1.6 * this.ne + sinc(this.ph) * 0.55 * this.te) * this.vel * fade;
      this.ph += this.inc; this.ne *= this.nd; this.te *= this.td;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return this.k < this.len;
  }
}

class Hat {
  constructor(sr, start, vel, noise, open = false, pan = -0.2) {
    this.start = start; this.len = Math.round((open ? 0.5 : 0.12) * sr); this.k = 0; this.vel = vel * 0.075;
    this.noise = noise; this.h1 = new OnePole(sr, 6500); this.h2 = new OnePole(sr, 6500); this.lp = new OnePole(sr, 10500);
    this.d = Math.exp(-1 / (sr * (open ? 0.16 : 0.028))); this.e = 1;
    [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n && this.k < this.len; i++, this.k++) {
      const fade = this.k < 16 ? this.k / 16 : 1;
      const y = this.lp.lp(this.h2.hp(this.h1.hp(this.noise()))) * this.e * this.vel * fade;
      this.e *= this.d;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return this.k < this.len;
  }
}

class Shaker { // soft swish (attack + decay), an alternative to hats
  constructor(sr, start, vel, noise, pan = 0.25) {
    this.start = start; this.len = Math.round(0.11 * sr); this.k = 0; this.vel = vel * 0.06; this.sr = sr;
    this.noise = noise; this.bp = new SVF(sr, 5200, 1.2);
    [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n && this.k < this.len; i++, this.k++) {
      const t = this.k / this.len, env = Math.sin(Math.PI * Math.pow(t, 0.55));
      this.bp.run(this.noise());
      const y = this.bp.band * env * env * this.vel * 2;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return this.k < this.len;
  }
}

// Ambient pad: detuned PolyBLEP saws, per-voice lowpass that breathes, very slow attack and release.
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
class Pad {
  constructor(sr, r, start, midi, vel, durS, atkS, relS, cutoff = 1400) {
    this.sr = sr; this.start = start; this.end = start + Math.round(durS * sr);
    this.k = 0; this.atkN = Math.round(atkS * sr); this.rel = Math.exp(-1 / (sr * relS / 4.6));
    this.env = 0; this.relStart = 1;
    const f = mtof(midi), N = 4;
    this.inc = []; this.ph = []; this.gl = []; this.gr = [];
    for (let j = 0; j < N; j++) {
      const cents = (j - (N - 1) / 2) * r.range(4, 7) + r.range(-1.5, 1.5);
      this.inc.push(f * Math.pow(2, cents / 1200) / sr); this.ph.push(r());
      const [a, b] = panGains(clamp((j / (N - 1)) * 1.4 - 0.7 + r.range(-0.1, 0.1), -1, 1));
      this.gl.push(a); this.gr.push(b);
    }
    this.fL = new SVF(sr, cutoff, 0.6); this.fR = new SVF(sr, cutoff, 0.6);
    this.cut = cutoff * (0.9 + 0.2 * r()); this.lph = r(); this.linc = r.range(0.03, 0.07) / sr;
    this.gain = vel * 0.05 * (midi > 72 ? 0.7 : 1);
    this.subInc = f / 2 / sr; this.subPh = 0; this.sub = midi < 60 ? 0.35 : 0;
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    const N = this.inc.length;
    for (; i < n; i++, this.k++) {
      const t = t0 + i;
      if (t < this.end) {
        this.env = this.k < this.atkN ? 0.5 - 0.5 * Math.cos(Math.PI * this.k / this.atkN) : 1;
        this.relStart = this.env;
      } else this.env *= this.rel;
      if ((this.k & 63) === 0) {
        this.lph += this.linc * 64; if (this.lph > 1) this.lph -= 1;
        const c = this.cut * (0.75 + 0.35 * sinc(this.lph)) * (0.55 + 0.45 * this.env);
        this.fL.set(c, 0.6); this.fR.set(c, 0.6);
      }
      let l = 0, rr = 0;
      for (let j = 0; j < N; j++) {
        let p = this.ph[j] + this.inc[j]; if (p >= 1) p -= 1; this.ph[j] = p;
        const s = 2 * p - 1 - blep(p, this.inc[j]);
        l += s * this.gl[j]; rr += s * this.gr[j];
      }
      this.subPh += this.subInc; if (this.subPh > 1) this.subPh -= 1;
      const sub = sinc(this.subPh) * this.sub;
      const g = this.env * this.gain;
      L[i] += (this.fL.run(l) + sub) * g; R[i] += (this.fR.run(rr) + sub) * g;
    }
    return !(t0 + n > this.end && this.env < 1e-4);
  }
}

class Drone { // root + fifth + octave sines that slowly breathe and beat against each other
  constructor(sr, r, start, midi, durS, fadeS) {
    this.start = start; this.end = start + Math.round(durS * sr); this.k = 0;
    this.fadeN = Math.round(fadeS * sr); this.rel = Math.exp(-1 / (sr * fadeS / 4.6)); this.env = 0;
    const f = mtof(midi);
    this.parts = [[f, 0.5], [f * 1.0025, 0.3], [f * 1.5, 0.22], [f * 2, 0.16], [f * 2.996, 0.06]]
      .map(([hz, a]) => ({ inc: hz / sr, ph: r(), a }));
    this.lph = r(); this.linc = r.range(0.04, 0.08) / sr; this.gain = 0.075;
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    const P = this.parts;
    for (; i < n; i++, this.k++) {
      const t = t0 + i;
      if (t < this.end) this.env = this.k < this.fadeN ? 0.5 - 0.5 * Math.cos(Math.PI * this.k / this.fadeN) : 1;
      else this.env *= this.rel;
      this.lph += this.linc; if (this.lph > 1) this.lph -= 1;
      const breathe = 0.8 + 0.2 * sinc(this.lph);
      let y = 0;
      for (let j = 0; j < P.length; j++) { const p = P[j]; p.ph += p.inc; if (p.ph > 1) p.ph -= 1; y += sinc(p.ph) * p.a; }
      y *= this.env * breathe * this.gain;
      L[i] += y; R[i] += y;
    }
    return !(t0 + n > this.end && this.env < 1e-4);
  }
}

class AirSwell { // band-passed breath that swells in and out, sweeping slowly
  constructor(sr, r, start, durS, centre, noiseL, noiseR) {
    this.start = start; this.len = Math.round(durS * sr); this.k = 0;
    this.fL = new SVF(sr, centre, 2.2); this.fR = new SVF(sr, centre, 2.2);
    this.c0 = centre; this.c1 = centre * r.range(1.4, 2.4); this.nl = noiseL; this.nr = noiseR;
    this.gain = r.range(0.05, 0.085);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n && this.k < this.len; i++, this.k++) {
      const u = this.k / this.len, env = Math.pow(Math.sin(Math.PI * u), 2);
      if ((this.k & 127) === 0) { const c = this.c0 + (this.c1 - this.c0) * Math.sin(Math.PI * u); this.fL.set(c, 2.2); this.fR.set(c * 1.07, 2.2); }
      this.fL.run(this.nl()); this.fR.run(this.nr());
      L[i] += this.fL.band * env * this.gain; R[i] += this.fR.band * env * this.gain;
    }
    return this.k < this.len;
  }
}

class Breath { // a slow, soft lead tone: sine + octave, vibrato, long attack (never plucked)
  constructor(sr, r, start, midi, durS, atkS, relS, pan) {
    this.start = start; this.end = start + Math.round(durS * sr); this.k = 0;
    this.atkN = Math.round(atkS * sr); this.rel = Math.exp(-1 / (sr * relS / 4.6)); this.env = 0;
    this.inc = mtof(midi) / sr; this.ph = 0; this.vph = r(); this.vinc = r.range(4.2, 5.2) / sr;
    this.lp = new OnePole(sr, 2200); this.gain = 0.045; [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n; i++, this.k++) {
      const t = t0 + i;
      if (t < this.end) this.env = this.k < this.atkN ? 0.5 - 0.5 * Math.cos(Math.PI * this.k / this.atkN) : 1;
      else this.env *= this.rel;
      this.vph += this.vinc; if (this.vph > 1) this.vph -= 1;
      const vib = 1 + 0.0028 * sinc(this.vph) * Math.min(1, this.k / (this.atkN + 1));
      this.ph += this.inc * vib; if (this.ph > 1) this.ph -= 1;
      const y = this.lp.lp(sinc(this.ph) + 0.18 * sinc(2 * this.ph) + 0.05 * sinc(3 * this.ph)) * this.env * this.gain;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return !(t0 + n > this.end && this.env < 1e-4);
  }
}

// ── Harmony
// Chord qualities as intervals above the root, voiced without the root (the bass has it).
const QUAL = {
  maj9: [4, 7, 11, 14], maj7: [0, 4, 7, 11], '6/9': [4, 7, 9, 14], 'maj7#11': [4, 11, 14, 18],
  m9: [3, 7, 10, 14], m7: [0, 3, 7, 10], m11: [3, 10, 14, 17], m7b5: [0, 3, 6, 10],
  9: [4, 7, 10, 14], 13: [4, 10, 14, 21], '7b9': [4, 7, 10, 13], sus9: [5, 7, 10, 14],
};
const QNAME = { maj9: 'maj9', maj7: 'maj7', '6/9': '6/9', 'maj7#11': 'maj7♯11', m9: 'm9', m7: 'm7', m11: 'm11', m7b5: 'm7♭5', 9: '9', 13: '13', '7b9': '7♭9', sus9: '9sus4' };
export const chordName = (pc, q) => NOTE_NAMES[((pc % 12) + 12) % 12] + QNAME[q];

// Four-bar progressions: [semitones above the tonic, quality]. Major keys, then minor keys.
const PROG_MAJOR = [
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, '13']],
  [[2, 'm9'], [7, '9'], [0, 'maj9'], [0, '6/9']],
  [[5, 'maj9'], [4, 'm7'], [9, 'm9'], [0, 'maj9']],
  [[5, 'maj9'], [4, '7b9'], [9, 'm9'], [7, 'm9']],
  [[0, 'maj9'], [5, 'maj9'], [0, 'maj9'], [5, 'maj7#11']],
  [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus9']],
  [[5, 'maj9'], [5, 'm9'], [4, 'm7'], [9, 'm9']],
  [[2, 'm9'], [4, 'm7'], [5, 'maj9'], [7, '13']],
  [[2, 'm11'], [2, 'm11'], [0, 'maj9'], [0, 'maj9']],
  [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [5, 'm9']],
];
const PROG_MINOR = [
  [[0, 'm9'], [5, 'm9'], [10, '9'], [3, 'maj9']],
  [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'sus9']],
  [[0, 'm11'], [5, 'm9'], [0, 'm11'], [7, '7b9']],
  [[8, 'maj9'], [7, 'm7'], [0, 'm9'], [0, 'm9']],
  [[2, 'm7b5'], [7, '7b9'], [0, 'm9'], [0, 'm9']],
  [[0, 'm9'], [3, 'maj9'], [8, 'maj9'], [7, '7b9']],
];

// Choose an octave for each chord tone so the voicing moves as little as possible from the last one.
function voiceChord(rootPc, quality, prev, r, lo = 52, hi = 77) {
  const pcs = QUAL[quality].map((iv) => (rootPc + iv) % 12);
  const opts = pcs.map((pc) => { const o = []; for (let m = lo; m <= hi; m++) if (m % 12 === pc) o.push(m); return o; });
  let best = null, bestScore = Infinity;
  const pick = new Array(pcs.length);
  const rec = (i) => {
    if (i === pcs.length) {
      const v = pick.slice().sort((a, b) => a - b);
      for (let j = 1; j < v.length; j++) {
        if (v[j] === v[j - 1]) return;
        if (v[j] - v[j - 1] < 3 && v[j - 1] < 57) return; // no mud down low
      }
      if (v[v.length - 1] - v[0] > 16) return;
      let s = 0;
      if (prev) for (let j = 0; j < v.length; j++) s += Math.abs(v[j] - prev[Math.min(j, prev.length - 1)]);
      s += Math.abs((v[0] + v[v.length - 1]) / 2 - 64) * 0.6 + r() * 0.5;
      if (s < bestScore) { bestScore = s; best = v; }
      return;
    }
    for (const m of opts[i]) { pick[i] = m; rec(i + 1); }
  };
  rec(0);
  return best || pcs.map((pc) => 60 + pc).sort((a, b) => a - b);
}

// Rhodes comping rhythms per bar: [16th step, length in 16ths, velocity scale].
const COMP = [
  [[0, 15, 1]],
  [[0, 6, 1], [6, 9, 0.8]],
  [[0, 3, 1], [3, 5, 0.65], [10, 6, 0.8]],
  [[0, 8, 1], [8, 8, 0.75]],
  [[0, 10, 1], [10, 6, 0.7]],
  [[0, 4, 0.95], [6, 2, 0.6], [8, 8, 0.8]],
];
// Bass: [step, role, length]. R root, 5 fifth, O octave, A approach to next root, 7 seventh-ish.
const BASS = [
  [[0, 'R', 6], [6, 'R', 2], [10, '5', 4], [14, 'A', 2]],
  [[0, 'R', 10], [10, 'O', 2], [12, '5', 4]],
  [[0, 'R', 14], [14, 'A', 2]],
  [[0, 'R', 3], [3, 'R', 3], [8, '5', 6], [14, 'A', 2]],
  [[0, 'R', 7], [7, '5', 3], [10, 'R', 4], [14, 'A', 2]],
  [[0, 'R', 16]],
];
// Drum grooves on a 16-step bar. Hats: step -> velocity.
const GROOVES = [
  { k: [0, 10], s: [4, 12], g: [], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  { k: [0, 3, 10], s: [4, 12], g: [15], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  { k: [0, 8, 11], s: [4, 12], g: [7, 14], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  { k: [0, 6, 10], s: [4, 12], g: [], h: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14] },
  { k: [0, 7, 10], s: [4, 12], g: [9], h: [0, 2, 4, 6, 8, 10, 12, 14], shaker: true },
  { k: [0, 9], s: [4, 12], g: [3, 15], h: [2, 6, 10, 14], shaker: true },
];

// ── Lofi hip-hop generator
class LofiGen {
  constructor(sr, r, prev = null) {
    this.sr = sr; this.r = r; this.mode = 'lofi';
    this.voices = []; this.noise = noiseGen(r() * 4294967296);
    this.reverb = new FDN(sr, 0.8, 1.7, 4200, 18);
    this.revL = new Float32Array(0); this.revR = new Float32Array(0);
    this.drL = new Float32Array(0); this.drR = new Float32Array(0);
    this.lpL = new SVF(sr, 9000, 0.6); this.lpR = new SVF(sr, 9000, 0.6);
    this.cut = 1200; this.cutTarget = 1200; this.cutRate = 0;
    this.duck = 0; this.duckD = Math.exp(-1 / (sr * 0.22)); this.kicks = [];
    this.hold = 0; this.holdD = 0; this.crush = 0;
    this.barPos = 0; // absolute sample position (float) of the next bar to schedule
    this.prevVoicing = null;
    this.section = null;
    this.newSection(prev);
  }

  newSection(prev) {
    const r = this.r, last = this.section || prev;
    let tonic, minor;
    if (last) {
      // related keys keep the flow smooth: up a fourth, down a tone, relative minor/major...
      minor = r.chance(last.minor ? 0.55 : 0.3);
      const shift = r.pick([5, 7, -2, 2, 3, -3, 0, 5, -5]);
      tonic = (last.tonic + shift + 12) % 12;
      if (minor !== last.minor && r.chance(0.6)) tonic = minor ? (last.tonic + 9) % 12 : (last.tonic + 3) % 12;
    } else { tonic = r.int(0, 11); minor = r.chance(0.3); }
    let bpm = r.int(70, 90);
    if (last) { // drift a few BPM from the last section, bouncing off the 70–90 limits
      const d = r.pick([3, 4, 5, 6, 7]) * (r.chance(0.5) ? 1 : -1);
      bpm = Math.round(last.bpm + d);
      if (bpm > 90 || bpm < 70) bpm = Math.round(last.bpm - d);
      bpm = clamp(bpm, 70, 90);
    }
    const pool = this.pools ? this.pools(minor) : minor ? PROG_MINOR : PROG_MAJOR;
    const a = r.pick(pool), b = r.chance(0.5) ? a : r.pick(pool);
    const prog = [...a, ...b].map(([iv, q]) => [(tonic + iv) % 12, q]);
    const bars = r.pick([24, 32, 32, 40, 48]);
    this.section = {
      tonic, minor, bpm, prog, bars, bar: 0,
      swing: r.range(0.1, 0.24), groove: r.int(0, GROOVES.length - 1),
      comp: r.int(0, COMP.length - 1), bass: r.int(0, BASS.length - 1),
      intro: r.pick([2, 4, 4]), melodyOdds: r.range(0.25, 0.6), roll: r.chance(0.6), motif: null,
      keys: r.weighted([['rhodes', 0.5], ['piano', 0.3], ['guitar', 0.2]]), swing8: r.range(0.04, 0.12),
    };
    this.cutTarget = 2200; // filter starts half closed and opens through the intro
  }

  get info() {
    const s = this.section, ch = s.prog[s.bar % s.prog.length];
    return { mode: 'lofi', key: NOTE_NAMES[s.tonic] + (s.minor ? ' minor' : ' major'), bpm: s.bpm, chord: chordName(ch[0], ch[1]), keys: s.keys };
  }

  scheduleBar() {
    const r = this.r, sr = this.sr, s = this.section;
    const beat = 60 / s.bpm, barS = beat * 4, step = beat / 4;
    const t0 = this.barPos, bi = s.bar;
    const isIntro = bi < s.intro, isLast = bi === s.bars - 1, isFillBar = bi % 8 === 7 && !isLast;
    const [rootPc, q] = s.prog[bi % s.prog.length];
    const nextCh = s.prog[(bi + 1) % s.prog.length];
    const at = (st, jitterMs = 6) => {
      const sw = (st % 2 === 1 ? s.swing * step : 0) + (st % 4 === 2 ? s.swing8 * 2 * step : 0);
      return Math.round(t0 + (st * step + sw + r.range(-jitterMs, jitterMs) / 1000) * sr);
    };
    // filter: open over the intro, close a little for the last bar
    if (bi === 0) { this.cut = 2200; }
    this.cutTarget = isIntro ? 2200 + 6300 * ((bi + 1) / s.intro) : isLast ? 3800 : 8500;
    this.cutRate = (this.cutTarget - this.cut) / (barS * sr);

    // chords
    const voicing = voiceChord(rootPc, q, this.prevVoicing, r);
    this.prevVoicing = voicing;
    const comp = isLast ? [[0, 16, 0.9]] : (isIntro ? [[0, 15, 0.9]] : COMP[(s.comp + (bi % 8 === 4 && r.chance(0.4) ? 1 : 0)) % COMP.length]);
    if (s.keys === 'guitar' && !isLast) { // fingerpicking: a broken chord on the 8ths, each string left to ring
      const order = r.pick([[0, 2, 1, 3, 2, 1, 3, 2], [0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 3, 1, 2, 3, 1, 2]]);
      const steps = isIntro ? [0, 2, 4, 6, 8, 10, 12, 14].slice(0, 4 + (bi % 2) * 4) : [0, 2, 4, 6, 8, 10, 12, 14];
      steps.forEach((st, j) => {
        const m = voicing[order[j] % voicing.length];
        this.voices.push(new Guitar(sr, at(st, 6), m, r.range(0.45, 0.7) * (j === 0 ? 1.15 : 1), step * 7, ((order[j] / 3) * 0.5 - 0.25), this.noise));
      });
    } else for (const [st, len, vs] of comp) {
      const start = at(st, 5), vel = clamp(vs * r.range(0.55, 0.75), 0.2, 1);
      const durS = len * step * (isLast ? 2.2 : 0.95);
      voicing.forEach((m, j) => {
        const roll = s.roll ? j * r.range(0.008, 0.022) * sr : r.range(0, 0.006) * sr;
        const v = vel * r.range(0.85, 1.05), pan = (j / 3) * 0.6 - 0.3, at0 = start + Math.round(roll);
        this.voices.push(s.keys === 'piano' ? new Piano(sr, at0, m, v, durS, pan) : s.keys === 'guitar' ? new Guitar(sr, at0, m, v, durS, pan, this.noise) : new Rhodes(sr, at0, m, v, durS, pan));
      });
    }

    // bass
    {
      const pat = isIntro ? [[0, 'R', 15]] : isLast ? [[0, 'R', 16]] : BASS[(s.bass + (isFillBar ? 1 : 0)) % BASS.length];
      const rootM = 33 + ((rootPc - 33 % 12 + 24) % 12); // root in A1..G#2
      for (const [st, role, len] of pat) {
        let m = rootM;
        if (role === '5') m = rootM + 7;
        else if (role === 'O') m = rootM + 12;
        else if (role === 'A') { const nr = 33 + ((nextCh[0] - 33 % 12 + 24) % 12); m = nr + (r.chance(0.5) ? -1 : 1); if (nr === rootM) m = rootM + 7; }
        if (m > 52) m -= 12;
        this.voices.push(new Bass(sr, at(st, 4), m, r.range(0.8, 1), len * step * 0.92));
      }
    }

    // drums
    const g = GROOVES[s.groove];
    if (isLast) { const t = at(0, 3); this.voices.push(new Kick(sr, t, 0.8, this.noise)); this.kicks.push(t); this.voices.push(new Riser(sr, Math.round(t0 + barS * sr * 0.25), barS * 0.8, this.noise)); }
    if (!isIntro && !isLast) {
      const ks = isFillBar && r.chance(0.5) ? g.k.filter((x) => x < 8) : g.k;
      for (const st of ks) { const t = at(st, 3); this.voices.push(new Kick(sr, t, st === 0 ? 1 : r.range(0.7, 0.85), this.noise)); this.kicks.push(t); }
      for (const st of g.s) this.voices.push(new Snare(sr, at(st, 4) + Math.round(0.014 * sr), r.range(0.85, 1), this.noise));
      for (const st of g.g) if (r.chance(0.7)) this.voices.push(new Snare(sr, at(st, 6), r.range(0.18, 0.3), this.noise, 0.1, 200, 0.06));
      if (isFillBar) this.voices.push(new Snare(sr, at(14, 4), 0.35, this.noise, 0.1, 200, 0.07), new Snare(sr, at(15, 4), 0.45, this.noise, 0.1, 200, 0.08));
    }
    {
      const soft = isIntro ? 0.35 + 0.4 * (bi / s.intro) : isLast ? 0.5 : 1;
      for (const st of g.h) {
        if (isLast && st >= 8) break;
        const acc = st % 4 === 0 ? 1 : st % 2 === 0 ? 0.65 : 0.45;
        const v = acc * r.range(0.7, 1.05) * soft;
        if (g.shaker) this.voices.push(new Shaker(sr, at(st, 7), v, this.noise));
        else this.voices.push(new Hat(sr, at(st, 5), v, this.noise, isFillBar && st === 14));
      }
    }

    // melody: sparse phrases on the 8th grid, from the pentatonic, leaning on chord tones
    if (!isIntro && bi < s.bars - 2 && bi % 4 === 0) s.phrase = r.chance(s.melodyOdds) ? (s.motif && r.chance(0.6) ? 'repeat' : 'new') : null;
    if (s.phrase && !isIntro && !isLast) {
      if (bi % 4 === 0 && (s.phrase === 'new' || !s.motif)) s.motif = this.makeMotif();
      if (bi % 2 === 0 || r.chance(0.3)) {
        const scale = s.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
        const chordPcs = QUAL[q].map((iv) => (rootPc + iv) % 12);
        for (const [st, deg, len] of s.motif) {
          if (r.chance(0.12)) continue;
          const oct = Math.floor(deg / 5), pc = (s.tonic + scale[((deg % 5) + 5) % 5]) % 12;
          let m = 67 + ((pc - 67 % 12 + 12) % 12) + 12 * oct;
          if (st % 4 === 0 && !chordPcs.includes(m % 12)) { // strong beat: nudge to the nearest chord tone
            for (const d of [1, -1, 2, -2]) if (chordPcs.includes((m + d + 12) % 12)) { m += d; break; }
          }
          const mm = clamp(m, 64, 88), mv = r.range(0.45, 0.65), mp = r.range(-0.25, 0.25);
          this.voices.push(s.keys === 'piano' ? new Piano(sr, at(st, 8), mm, mv + 0.1, len * step * 1.5, mp) : new Rhodes(sr, at(st, 8), mm, mv, len * step, mp, 1.25));
        }
      }
    }

    this.barPos += barS * sr;
    s.bar++;
    if (s.bar >= s.bars) { this.newSection(); return true; }
    return bi === 0;
  }

  makeMotif() {
    const r = this.r, notes = [], n = r.int(3, 6);
    let st = r.pick([0, 2, 4]), deg = r.int(2, 6);
    for (let i = 0; i < n && st < 16; i++) {
      const len = r.pick([2, 2, 4, 4, 6]);
      notes.push([st, deg, len]);
      st += len + r.pick([0, 0, 2]);
      deg = clamp(deg + r.pick([-2, -1, -1, 1, 1, 2, 0]), 0, 9);
    }
    return notes;
  }

  process(t0, n, L, R, onInfo) {
    const sr = this.sr;
    while (this.barPos < t0 + n + 0.25 * sr) { if (this.scheduleBar() && onInfo) onInfo(this.info); }
    if (this.revL.length < n) { this.revL = new Float32Array(n); this.revR = new Float32Array(n); this.drL = new Float32Array(n); this.drR = new Float32Array(n); }
    const dL = this.drL.fill(0, 0, n), dR = this.drR.fill(0, 0, n);
    const mL = this.revL.fill(0, 0, n), mR = this.revR.fill(0, 0, n);
    const vs = this.voices;
    for (let i = vs.length - 1; i >= 0; i--) {
      const v = vs[i];
      const drum = v instanceof Kick || v instanceof Snare || v instanceof Hat || v instanceof Shaker || v instanceof Ride || v instanceof Brush;
      if (!v.process(drum ? dL : mL, drum ? dR : mR, t0, n)) vs.splice(i, 1);
    }
    // kicks duck the chords slightly
    const kk = this.kicks;
    for (let s = 0; s < n; s++) {
      const t = t0 + s;
      while (kk.length && kk[0] <= t) { kk.shift(); this.duck = 1; }
      const d = 1 - 0.22 * this.duck; this.duck *= this.duckD;
      // the "dusty" drum bus: hold every other sample (half sample rate) + soft clip
      if (!this.clean ? (t & 1) === 0 : true) { this.hL = dL[s]; this.hR = dR[s]; }
      const drl = Math.tanh((this.hL || 0) * 1.4) * 0.8, drr = Math.tanh((this.hR || 0) * 1.4) * 0.8;
      mL[s] = mL[s] * d + drl; mR[s] = mR[s] * d + drr;
    }
    // filter (opens through intros) then into the room
    for (let s = 0; s < n; s++) {
      if ((s & 31) === 0) {
        this.cut += this.cutRate * 32;
        if ((this.cutRate > 0 && this.cut > this.cutTarget) || (this.cutRate < 0 && this.cut < this.cutTarget)) this.cut = this.cutTarget;
        this.lpL.set(this.cut, 0.65); this.lpR.set(this.cut, 0.65);
      }
      mL[s] = this.lpL.run(mL[s]); mR[s] = this.lpR.run(mR[s]);
    }
    for (let s = 0; s < n; s++) { L[s] += mL[s]; R[s] += mR[s]; }
    this.reverb.process(mL, mR, L, R, n, 0.28);
  }
}

// ── Jazz generator: a late-night trio. Brushes and a ride, walking upright bass, comping on swung 8ths.
class Ride { // a soft ride cymbal: inharmonic partials + a little filtered noise
  constructor(sr, start, vel, noise, pan = 0.35) {
    this.start = start; this.len = Math.round(1.2 * sr); this.k = 0; this.noise = noise; this.vel = vel * 0.022;
    this.p = [3127, 4211, 5323, 6011, 7417, 8603].map((f, i) => ({ inc: f * (1 + i * 0.0031) / sr, ph: i * 0.17, a: 1 / (1 + i * 0.4) }));
    this.hp = new OnePole(sr, 4000); this.d = Math.exp(-1 / (sr * 0.55)); this.e = 1; this.ping = Math.exp(-1 / (sr * 0.02)); this.pe = 1;
    [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    const P = this.p;
    for (; i < n && this.k < this.len; i++, this.k++) {
      let y = 0;
      for (let j = 0; j < P.length; j++) { const q = P[j]; q.ph += q.inc; if (q.ph > 1) q.ph -= 1; y += (q.ph < 0.5 ? 1 : -1) * q.a; }
      y = this.hp.hp(y * 0.35 + this.noise() * 0.5) * this.e * (1 + 1.5 * this.pe) * this.vel * (this.k < 24 ? this.k / 24 : 1);
      this.e *= this.d; this.pe *= this.ping;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return this.k < this.len;
  }
}
class Brush { // a brush sweep on the snare: band-passed noise that swells and fades over a beat or two
  constructor(sr, start, durS, vel, noise, pan = -0.15) {
    this.start = start; this.len = Math.round(durS * sr); this.k = 0; this.noise = noise; this.vel = vel * 0.05;
    this.bp = new SVF(sr, 3200, 0.9); this.lp = new OnePole(sr, 7000); [this.gl, this.gr] = panGains(pan);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n && this.k < this.len; i++, this.k++) {
      const u = this.k / this.len, env = Math.pow(Math.sin(Math.PI * u), 1.5);
      if ((this.k & 63) === 0) this.bp.set(2600 + 1400 * Math.sin(Math.PI * u), 0.9);
      this.bp.run(this.noise());
      const y = this.lp.lp(this.bp.band) * env * this.vel;
      L[i] += y * this.gl; R[i] += y * this.gr;
    }
    return this.k < this.len;
  }
}
class Upright { // plucked-string-ish upright bass: sine + soft 2nd/3rd, a thumpy attack, gentle decay
  constructor(sr, start, midi, vel, durS) {
    this.start = start; this.end = start + Math.round(durS * sr);
    this.inc = mtof(midi) / sr; this.ph = 0; this.k = 0; this.sr = sr;
    this.d = Math.exp(-1 / (sr * 0.9)); this.rel = Math.exp(-1 / (sr * 0.06)); this.e = 1; this.gain = 0.24 * vel;
    this.lp = new OnePole(sr, 900);
  }
  process(L, R, t0, n) {
    let i = this.start - t0; if (i >= n) return true; if (i < 0) i = 0;
    for (; i < n; i++, this.k++) {
      const t = t0 + i;
      this.e *= t < this.end ? this.d : this.rel;
      const a = this.k < 96 ? this.k / 96 : 1;
      const bright = 1 + 2.2 * Math.exp(-this.k / (this.sr * 0.03));
      let y = sinc(this.ph) + 0.3 * bright * sinc(2 * this.ph) + 0.12 * bright * sinc(3 * this.ph);
      this.ph += this.inc; if (this.ph > 1) this.ph -= 1;
      y = this.lp.lp(Math.tanh(y * 1.2)) * this.e * a * this.gain;
      L[i] += y; R[i] += y;
    }
    return !(t0 + n > this.end && this.e < 1e-4);
  }
}
const PROG_JAZZ = [
  [[2, 'm9'], [7, '13'], [0, 'maj9'], [9, '7b9']],
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, '13']],
  [[4, 'm7'], [9, '7b9'], [2, 'm9'], [7, '13']],
  [[5, 'maj9'], [10, '9'], [0, 'maj9'], [0, '6/9']],
  [[2, 'm11'], [7, '7b9'], [0, '6/9'], [0, 'maj9']],
];
const PROG_JAZZ_MINOR = [
  [[2, 'm7b5'], [7, '7b9'], [0, 'm9'], [0, 'm9']],
  [[0, 'm9'], [5, 'm9'], [2, 'm7b5'], [7, '7b9']],
  [[0, 'm11'], [8, 'maj9'], [2, 'm7b5'], [7, '7b9']],
];
class JazzGen extends LofiGen {
  constructor(sr, r, prev = null) {
    super(sr, r, prev);
    this.mode = 'jazz'; this.clean = true;
    this.reverb = new FDN(sr, 1.1, 2.2, 5200, 20);
  }
  pools(minor) { return minor ? PROG_JAZZ_MINOR : PROG_JAZZ; }
  newSection(prev) { super.newSection(prev); if (this.section.keys === 'guitar') this.section.keys = 'piano'; }
  get info() { const i = super.info; i.mode = 'jazz'; return i; }
  scheduleBar() {
    const r = this.r, sr = this.sr, s = this.section;
    const beat = 60 / s.bpm, barS = beat * 4;
    const t0 = this.barPos, bi = s.bar;
    const isIntro = bi < Math.min(2, s.intro), isLast = bi === s.bars - 1;
    const [rootPc, q] = s.prog[bi % s.prog.length];
    const nextCh = s.prog[(bi + 1) % s.prog.length];
    const sw = 0.62 + (s.swing - 0.17) * 0.3; // triplet-ish swing for the off-beat 8ths
    const at = (b8, jitterMs = 7) => { const beatN = Math.floor(b8 / 2), off = b8 % 2 ? sw : 0; return Math.round(t0 + ((beatN + off) * beat + r.range(-jitterMs, jitterMs) / 1000) * sr); };
    this.cut = 6500; this.cutTarget = isLast ? 4200 : 9000; this.cutRate = (this.cutTarget - this.cut) / (barS * sr);
    // comping: Charleston rhythm, a push into the next bar, or long chords in intros and at the end
    const voicing = voiceChord(rootPc, q, this.prevVoicing, r);
    this.prevVoicing = voicing;
    const pattern = isIntro || isLast ? [[0, 8, 0.8]] : r.pick([[[0, 2, 0.8], [3, 3, 0.65]], [[0, 3, 0.75], [5, 2, 0.6]], [[1, 2, 0.7], [4, 3, 0.65]], [[0, 4, 0.75], [6, 2, 0.6]], [[3, 2, 0.7], [7, 1, 0.55]]]);
    for (const [b8, len8, vs] of pattern) {
      const start = at(b8, 6), vel = vs * r.range(0.55, 0.75);
      voicing.forEach((m, j) => {
        const v = vel * r.range(0.85, 1.05), pan = (j / 3) * 0.6 - 0.3, st = start + Math.round(j * r.range(0.003, 0.012) * sr);
        const dur = len8 * beat / 2 * (isLast ? 3 : 0.9);
        this.voices.push(s.keys === 'piano' ? new Piano(sr, st, m, v, dur, pan) : new Rhodes(sr, st, m, v, dur, pan));
      });
    }
    // walking bass: root, chord tones / scale steps, a chromatic approach on beat 4
    const rootM = 33 + ((rootPc - 33 % 12 + 24) % 12), nextRoot = 33 + ((nextCh[0] - 33 % 12 + 24) % 12);
    const tones = QUAL[q].map((iv) => iv % 12);
    const third = tones.includes(3) ? 3 : 4, fifth = q === 'm7b5' ? 6 : 7;
    if (isIntro || isLast) this.voices.push(new Upright(sr, at(0, 4), rootM, 0.9, barS * (isLast ? 1.5 : 0.95)));
    else {
      const line = r.pick([[0, third, fifth], [0, fifth, third], [0, 2, third], [0, 12, fifth], [0, fifth, 12 - 2]]);
      const approach = nextRoot + (r.chance(0.6) ? -1 : 1) + (Math.abs(nextRoot - rootM - line[2]) > 7 ? 0 : 0);
      [...line, approach - rootM].forEach((iv, b) => {
        let m = rootM + iv; while (m > 50) m -= 12; while (m < 31) m += 12;
        this.voices.push(new Upright(sr, at(b * 2, 5), m, b === 0 ? 1 : r.range(0.75, 0.9), beat * 0.92));
        if (r.chance(0.08) && b === 2) this.voices.push(new Upright(sr, at(b * 2 + 1, 5), m + (r.chance(0.5) ? 1 : -1), 0.6, beat * 0.3)); // a little skip
      });
    }
    // drums: ride "ding, ding-a, ding, ding-a", brushes swishing, feathered kick, soft cross-stick sometimes
    if (!isIntro) {
      const rideHits = isLast ? [0] : [0, 2, 3, 4, 6, 7];
      for (const b8 of rideHits) this.voices.push(new Ride(sr, at(b8, 4), (b8 % 2 ? 0.55 : b8 % 4 === 2 ? 0.95 : 0.8) * r.range(0.8, 1.05), this.noise));
      if (!isLast) {
        this.voices.push(new Brush(sr, at(0, 3), beat * 1.9, r.range(0.7, 1), this.noise, -0.2), new Brush(sr, at(4, 3), beat * 1.9, r.range(0.7, 1), this.noise, -0.1));
        for (const b of [1, 3]) this.voices.push(new Snare(sr, at(b * 2, 5) + Math.round(0.01 * sr), r.range(0.22, 0.32), this.noise, 0.05, 210, 0.05));
        for (const b of [0, 1, 2, 3]) if (b === 0 || r.chance(0.35)) { const t = at(b * 2, 3); this.voices.push(new Kick(sr, t, r.range(0.25, 0.35), this.noise)); }
      }
    } else if (bi === Math.min(2, s.intro) - 1) {
      this.voices.push(new Brush(sr, at(4, 3), beat * 2, 0.6, this.noise));
    }
    // melody now and then, like the lofi generator
    if (!isIntro && bi < s.bars - 2 && bi % 4 === 0) s.phrase = r.chance(s.melodyOdds * 0.8) ? 'new' : null;
    if (s.phrase && !isIntro && !isLast && (bi % 2 === 0)) {
      if (bi % 4 === 0) s.motif = this.makeMotif();
      const scale = s.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
      for (const [st, deg, len] of s.motif) {
        const pc = (s.tonic + scale[((deg % 5) + 5) % 5]) % 12;
        const m = clamp(67 + ((pc - 67 % 12 + 12) % 12) + 12 * Math.floor(deg / 5), 64, 88);
        const b8 = Math.round(st / 2);
        this.voices.push(new Rhodes(sr, at(b8, 8), m, r.range(0.4, 0.6), len * beat / 4, r.range(-0.25, 0.25), 1.15));
      }
    }
    this.barPos += barS * sr;
    s.bar++;
    if (s.bar >= s.bars) { this.newSection(); return true; }
    return bi === 0;
  }
}

// ── Ambient generator: no percussion, nothing plucked, every attack at least 1.5 s
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
};
// degrees that make pleasant open chords in each mode (avoid the diminished one)
const GOOD_DEG = { ionian: [0, 1, 2, 3, 4, 5], lydian: [0, 1, 2, 4, 5, 6], dorian: [0, 1, 2, 3, 4, 6], aeolian: [0, 2, 3, 4, 5, 6], mixolydian: [0, 1, 3, 4, 5, 6] };

class AmbientGen {
  constructor(sr, r, prev = null) {
    this.sr = sr; this.r = r; this.mode = 'ambient';
    this.voices = []; this.nL = noiseGen(r() * 4294967296); this.nR = noiseGen(r() * 4294967296);
    this.reverb = new FDN(sr, 2.1, 7.5, 3800, 40);
    this.busL = new Float32Array(0); this.busR = new Float32Array(0);
    this.lpL = new SVF(sr, 5000, 0.6); this.lpR = new SVF(sr, 5000, 0.6); this.lph = r(); this.lpInc = 0.011 / sr;
    this.next = 0; this.nextSwell = Math.round(r.range(6, 14) * sr); this.nextBreath = Math.round(r.range(20, 40) * sr);
    this.deg = 0; this.chordsLeft = 0; this.key = null;
    this.newKey(prev);
  }
  newKey(prev) {
    const r = this.r, last = this.key || prev;
    const tonic = last ? (last.tonic + r.pick([5, 7, -2, 2, -5, 3, -3])) % 12 : r.int(0, 11);
    const mode = r.weighted([['lydian', 3], ['ionian', 3], ['dorian', 2], ['aeolian', 2], ['mixolydian', 1]]);
    const bpm = r.int(70, 90);
    this.key = { tonic: (tonic + 12) % 12, mode, bpm };
    this.chordsLeft = r.int(9, 15);
    this.deg = 0;
    this.droneRoot = 31 + ((this.key.tonic - 31 % 12 + 24) % 12); // G1..F#2
  }
  get info() {
    const k = this.key;
    return { mode: 'ambient', key: NOTE_NAMES[k.tonic] + ' ' + k.mode, bpm: k.bpm, chord: this.chordLabel || '' };
  }
  scheduleChord() {
    const r = this.r, sr = this.sr, k = this.key, sc = MODES[k.mode];
    const holdBars = r.pick([4, 6, 6, 8]);
    const holdS = holdBars * 4 * 60 / k.bpm;
    const start = this.next;
    // stack thirds from the degree, keep an open spread
    const deg = this.deg;
    const tone = (d) => k.tonic + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const root = tone(deg);
    const shape = r.pick([[0, 4, 8, 9, 13], [0, 2, 4, 8, 11], [0, 4, 6, 9, 11], [0, 4, 8, 11, 13]]);
    let notes = shape.map((d) => tone(deg + d));
    const base = 48 + ((root - 48 % 12 + 24) % 12);
    notes = notes.map((m, i) => { let x = base + (m - root); if (i > 2) x += 12; while (x > 84) x -= 12; return x; });
    notes = [...new Set(notes)].sort((a, b) => a - b);
    const atk = r.range(3.5, 6.5), rel = r.range(7, 11);
    const overlap = r.range(2.5, 4.5);
    notes.forEach((m, i) => this.voices.push(new Pad(sr, r, start + Math.round(r.range(0, 1.2) * sr), m, r.range(0.75, 1) * (i === 0 ? 1.1 : 1), holdS + overlap, atk + r.range(0, 1.5), rel, r.range(900, 1700))));
    this.chordLabel = NOTE_NAMES[((root % 12) + 12) % 12] + ' ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][deg % 7].toLowerCase();
    this.next = start + Math.round(holdS * sr);
    // walk to the next degree: steps and fourths, home now and then
    const good = GOOD_DEG[k.mode];
    let nd;
    do { nd = (deg + r.pick([1, 3, 4, -1, -3, 2, 5])) % 7; nd = (nd + 7) % 7; } while (!good.includes(nd) || nd === deg);
    if (r.chance(0.2)) nd = 0;
    this.deg = nd;
    if (--this.chordsLeft <= 0) { this.newKey(); this.needDrone = true; return true; }
    return false;
  }
  process(t0, n, L, R, onInfo) {
    const sr = this.sr, r = this.r;
    if (this.drone === undefined || this.needDrone) {
      const fade = this.drone === undefined ? 6 : 14;
      if (this.drone) this.drone.end = Math.max(t0 + Math.round(4 * sr), this.drone.start);
      this.drone = new Drone(sr, r, t0 + (this.drone ? Math.round(2 * sr) : 0), this.droneRoot, 1e7, fade);
      this.voices.push(this.drone); this.needDrone = false;
    }
    while (this.next < t0 + n + 0.1 * sr) { this.scheduleChord(); if (onInfo) onInfo(this.info); }
    if (t0 >= this.nextSwell) {
      this.voices.push(new AirSwell(sr, r, t0, r.range(9, 16), r.range(700, 1600), this.nL, this.nR));
      if (r.chance(0.5)) { // a high, soft chord tone that blooms with the breath
        const k = this.key, sc = MODES[k.mode];
        const m = 72 + ((k.tonic + r.pick([sc[0], sc[2], sc[4], sc[1]]) - 72 % 12 + 24) % 12) + (r.chance(0.4) ? 12 : 0);
        this.voices.push(new Pad(sr, r, t0 + Math.round(sr), m, 0.6, r.range(5, 8), r.range(3, 5), r.range(6, 9), 2400));
      }
      this.nextSwell = t0 + Math.round(r.range(14, 38) * sr);
    }
    if (t0 >= this.nextBreath) { // a slow melodic line now and then
      const k = this.key, sc = MODES[k.mode];
      let st = t0, d = r.int(0, 4);
      const count = r.int(2, 4), pan = r.range(-0.4, 0.4);
      for (let i = 0; i < count; i++) {
        const dur = r.range(4, 7);
        const m = 67 + ((k.tonic + sc[d % 7] - 67 % 12 + 24) % 12);
        this.voices.push(new Breath(sr, r, st, m, dur, r.range(1.6, 2.6), r.range(3, 5), pan));
        st += Math.round((dur - r.range(0.5, 1.2)) * sr); d = clamp(d + r.pick([-2, -1, 1, 2]), 0, 6);
      }
      this.nextBreath = st + Math.round(r.range(25, 60) * sr);
    }
    if (this.busL.length < n) { this.busL = new Float32Array(n); this.busR = new Float32Array(n); }
    const bL = this.busL.fill(0, 0, n), bR = this.busR.fill(0, 0, n);
    const vs = this.voices;
    for (let i = vs.length - 1; i >= 0; i--) if (!vs[i].process(bL, bR, t0, n)) vs.splice(i, 1);
    for (let s = 0; s < n; s++) {
      if ((s & 63) === 0) { this.lph += this.lpInc * 64; if (this.lph > 1) this.lph -= 1; const c = 3200 + 1800 * sinc(this.lph); this.lpL.set(c, 0.6); this.lpR.set(c, 0.6); }
      bL[s] = this.lpL.run(bL[s]); bR[s] = this.lpR.run(bR[s]);
      L[s] += bL[s] * 0.55; R[s] += bR[s] * 0.55;
    }
    this.reverb.process(bL, bR, L, R, n, 0.55);
  }
}

// ── Weather sounds: rain (hiss + drops on the glass + eave drips), snow and fog (soft wind)
class WeatherSound {
  constructor(sr, r) {
    this.sr = sr; this.r = r; this.nL = noiseGen(r() * 4294967296); this.nR = noiseGen(r() * 4294967296);
    this.rain = 0; this.snow = 0; this.fog = 0; this.target = { rain: 0, snow: 0, fog: 0 };
    this.k = Math.exp(-1 / (sr * 3)); // 3 s smoothing so changes fade in and out
    this.pL = [0, 0, 0]; this.pR = [0, 0, 0];
    this.lpL = new OnePole(sr, 3200); this.lpR = new OnePole(sr, 3200); this.hpL = new OnePole(sr, 250); this.hpR = new OnePole(sr, 250);
    this.wL = new SVF(sr, 400, 0.9); this.wR = new SVF(sr, 430, 0.9); this.wph = r(); this.winc = 0.045 / sr; this.wph2 = r(); this.winc2 = 0.013 / sr;
    this.drops = [];
    // distant thunder for storms: a soft rumble a few seconds after each (visual) flash
    this.t = 0; this.nextThunder = Math.round(r.range(6, 20) * sr); this.rumbles = []; this.onFlash = null;
    this.brownL = 0; this.brownR = 0;
  }
  set(t) { Object.assign(this.target, t); }
  thunder() {
    const r = this.r, sr = this.sr, delay = r.range(1.5, 5);
    const f = new SVF(sr, r.range(90, 150), 0.8), f2 = new SVF(sr, r.range(90, 150), 0.8);
    this.rumbles.push({ start: this.t + Math.round(delay * sr), k: 0, atk: Math.round(r.range(0.5, 1.1) * sr), d: Math.exp(-1 / (sr * r.range(1.6, 2.8))), len: Math.round(10 * sr), e: 0,
      g: r.range(0.45, 0.9) * (1 - delay / 8), f, f2, m1: r.range(0.5, 0.9), m2: r.range(1.1, 1.7), ph: r() });
    if (this.onFlash) this.onFlash(delay);
  }
  process(L, R, n) {
    const sr = this.sr, T = this.target, k = this.k, r = this.r;
    if ((T.storm || 0) > 0.3 && this.t >= this.nextThunder) { this.thunder(); this.nextThunder = this.t + Math.round(r.range(22, 75) * sr); }
    for (let i = this.rumbles.length - 1; i >= 0; i--) {
      const q = this.rumbles[i];
      let s0 = q.start - this.t; if (s0 >= n) continue; if (s0 < 0) s0 = 0;
      for (let s = s0; s < n && q.k < q.len; s++, q.k++) {
        q.e = q.k < q.atk ? 0.5 - 0.5 * Math.cos(Math.PI * q.k / q.atk) : q.e * q.d;
        this.brownL = this.brownL * 0.995 + this.nL() * 0.06; this.brownR = this.brownR * 0.995 + this.nR() * 0.06;
        const u = q.k / sr, roll = 0.65 + 0.35 * Math.sin(TAU * (q.m1 * u + q.ph)) * Math.sin(TAU * q.m2 * u);
        const a = q.e * roll * q.g * 0.55;
        L[s] += q.f.run(this.brownL) * a; R[s] += q.f2.run(this.brownR) * a;
      }
      if (q.k >= q.len) this.rumbles.splice(i, 1);
    }
    this.t += n;
    for (let s = 0; s < n; s++) {
      this.rain = T.rain + (this.rain - T.rain) * k; this.snow = T.snow + (this.snow - T.snow) * k; this.fog = T.fog + (this.fog - T.fog) * k;
      let l = 0, rr = 0;
      if (this.rain > 1e-4) {
        // pinkish noise for the hiss of the rain
        const a = this.nL(), b = this.nR(), pL = this.pL, pR = this.pR;
        pL[0] = 0.99765 * pL[0] + a * 0.099; pL[1] = 0.963 * pL[1] + a * 0.2965; pL[2] = 0.57 * pL[2] + a * 1.0526;
        pR[0] = 0.99765 * pR[0] + b * 0.099; pR[1] = 0.963 * pR[1] + b * 0.2965; pR[2] = 0.57 * pR[2] + b * 1.0526;
        const hl = this.hpL.hp(this.lpL.lp(pL[0] + pL[1] + pL[2] + a * 0.1848));
        const hr = this.hpR.hp(this.lpR.lp(pR[0] + pR[1] + pR[2] + b * 0.1848));
        l += hl * 0.045 * this.rain; rr += hr * 0.045 * this.rain;
        // drops on the window: tiny upward-gliding blips; a slow drip from the eave
        if (r() < (22 * this.rain) / sr && this.drops.length < 24) this.drops.push({ f: r.range(1800, 5200), ph: 0, e: r.range(0.02, 0.07) * this.rain, d: Math.exp(-1 / (sr * r.range(0.004, 0.012))), p: r.range(-0.9, 0.9) });
        if (r() < (0.5 * this.rain) / sr && this.drops.length < 24) this.drops.push({ f: r.range(700, 1100), ph: 0, e: 0.05 * this.rain, d: Math.exp(-1 / (sr * 0.03)), p: r.range(-0.5, 0.5) });
      }
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.ph += d.f / sr; d.f *= 1.00004;
        const y = sinc(d.ph) * d.e; d.e *= d.d;
        l += y * (1 - d.p) * 0.7; rr += y * (1 + d.p) * 0.7;
        if (d.e < 1e-5) this.drops.splice(i, 1);
      }
      const wind = this.snow * 0.9 + this.fog * 0.45;
      if (wind > 1e-4) {
        if ((s & 63) === 0) {
          this.wph += this.winc * 64; if (this.wph > 1) this.wph -= 1; this.wph2 += this.winc2 * 64; if (this.wph2 > 1) this.wph2 -= 1;
          const c = 380 + 260 * sinc(this.wph) + 120 * sinc(this.wph2);
          this.wL.set(c, 0.9); this.wR.set(c * 1.08, 0.9);
        }
        const gust = 0.6 + 0.4 * sinc(this.wph2 * 3 + 0.2);
        l += this.wL.run(this.nL()) * 0.05 * wind * gust; rr += this.wR.run(this.nR()) * 0.05 * wind * gust;
      }
      L[s] += l; R[s] += rr;
    }
  }
}

// Vinyl crackle and hiss; level follows how much lofi is playing.
class Crackle {
  constructor(sr, r) {
    this.sr = sr; this.r = r; this.n = noiseGen(r() * 4294967296);
    this.hp = new OnePole(sr, 1400); this.lp = new OnePole(sr, 7000); this.hissLp = new OnePole(sr, 5000);
    this.pop = 0; this.popD = Math.exp(-1 / (sr * 0.0007)); this.rumble = new OnePole(sr, 40);
  }
  process(L, R, n, vinyl, hiss) {
    const r = this.r, sr = this.sr;
    for (let s = 0; s < n; s++) {
      if (vinyl > 0.001 && r() < 7 / sr) { const a = r(); this.pop = (r.chance(0.5) ? 1 : -1) * a * a * a * 0.22; }
      const c = this.lp.lp(this.hp.hp(this.pop)) * vinyl; this.pop *= this.popD;
      const h = this.hissLp.lp(this.n()) * (0.0035 * vinyl + 0.0022 * hiss);
      L[s] += c + h; R[s] += c * 0.8 + h;
    }
  }
}

// Tape wow and flutter: a short delay line with a wandering read position.
class Wobble {
  constructor(sr, r) {
    this.sr = sr; this.r = r; this.N = 8192; this.bL = new Float32Array(this.N); this.bR = new Float32Array(this.N); this.w = 0;
    this.wow = r(); this.flut = r(); this.drift = 0; this.driftT = 0;
    this.base = 0.008 * sr; this.wowD = 0.0011 * sr; this.flD = 0.00007 * sr;
  }
  process(L, R, n, amt) {
    const sr = this.sr, N = this.N, r = this.r;
    for (let s = 0; s < n; s++) {
      this.bL[this.w] = L[s]; this.bR[this.w] = R[s];
      this.wow += 0.31 / sr; this.flut += 5.7 / sr;
      if ((s & 255) === 0) { this.driftT += (r() - 0.5) * 0.02; this.driftT *= 0.995; }
      this.drift += (this.driftT - this.drift) * 0.0005;
      const d = this.base + amt * (this.wowD * (sinc(this.wow) + this.drift) + this.flD * sinc(this.flut));
      let p = this.w - d; if (p < 0) p += N;
      const i = p | 0, f = p - i, j = (i + 1) % N;
      L[s] = this.bL[i] + (this.bL[j] - this.bL[i]) * f; R[s] = this.bR[i] + (this.bR[j] - this.bR[i]) * f;
      if (++this.w >= N) this.w = 0;
    }
  }
}

// ── The engine
export class Engine {
  constructor({ sampleRate = 48000, seed = 1, mode = 'lofi' } = {}) {
    this.sr = sampleRate; this.seed = seed >>> 0; this.r = rng(this.seed); this.t = 0;
    this.weather = new WeatherSound(sampleRate, this.r.fork());
    this.crackle = new Crackle(sampleRate, this.r.fork());
    this.wobble = new Wobble(sampleRate, this.r.fork());
    this.genRng = this.r.fork();
    this.gens = []; this.onInfo = null; this.lastInfo = null;
    this.mL = new Float32Array(0); this.mR = new Float32Array(0);
    this.agcEnv = 0.02; this.agcGain = 1; this.agcA = 1 - Math.exp(-1 / (sampleRate * 2.5)); this.agcG = 1 - Math.exp(-1 / (sampleRate * 4));
    this.lim = 1; this.limRel = 1 - Math.exp(-1 / (sampleRate * 0.25));
    this.la = 48; this.dL = new Float32Array(this.la); this.dR = new Float32Array(this.la); this.di = 0;
    this.setMode(mode, true);
  }
  get mode() { const g = this.gens[this.gens.length - 1]; return g ? g.gen.mode : null; }
  setMode(mode, instant = false) {
    if (this.mode === mode) return;
    const prev = this.gens.length ? this.gens[this.gens.length - 1].gen : null;
    const prevKey = prev ? (prev.section || (prev.key && { tonic: prev.key.tonic, minor: prev.key.mode === 'aeolian' || prev.key.mode === 'dorian', bpm: prev.key.bpm })) : null;
    const r = this.genRng.fork();
    const lp = prevKey && { tonic: prevKey.tonic, minor: !!prevKey.minor, bpm: clamp(prevKey.bpm || 80, 70, 90) };
    const gen = mode === 'ambient' ? new AmbientGen(this.sr, r, prevKey) : mode === 'jazz' ? new JazzGen(this.sr, r, lp) : new LofiGen(this.sr, r, lp);
    if (mode === 'ambient' && prevKey && prevKey.tonic !== undefined) { gen.key.tonic = prevKey.tonic; gen.droneRoot = 31 + ((gen.key.tonic - 31 % 12 + 24) % 12); }
    if (gen.barPos !== undefined) gen.barPos = this.t + (instant ? 0 : Math.round(1.5 * this.sr));
    if (gen.next !== undefined) gen.next = this.t;
    for (const g of this.gens) g.target = 0;
    // rapid switching: drop generators that are already (nearly) silent, and never run more than three at once
    this.gens = this.gens.filter((g) => g.gain > 0.02);
    while (this.gens.length > 2) { let qi = 0; for (let i = 1; i < this.gens.length; i++) if (this.gens[i].gain < this.gens[qi].gain) qi = i; this.gens.splice(qi, 1); }
    this.gens.push({ gen, gain: instant ? 1 : 0, target: 1 });
  }
  setWeather(w) { this.weather.set(w); }
  set onFlash(f) { this.weather.onFlash = f; }
  _info(i) { this.lastInfo = i; if (this.onInfo) this.onInfo(i); }
  process(L, R, n) {
    if (this.mL.length < n) { this.mL = new Float32Array(n); this.mR = new Float32Array(n); }
    const sr = this.sr;
    L.fill(0, 0, n); R.fill(0, 0, n);
    let lofiW = 0;
    const step = 1 / (sr * 7); // 7 s crossfade between modes
    for (let gi = this.gens.length - 1; gi >= 0; gi--) {
      const g = this.gens[gi];
      const mL = this.mL.fill(0, 0, n), mR = this.mR.fill(0, 0, n);
      const top = gi === this.gens.length - 1;
      g.gen.process(this.t, n, mL, mR, top ? (i) => this._info(i) : null);
      for (let s = 0; s < n; s++) {
        if (g.gain < g.target) g.gain = Math.min(g.target, g.gain + step); else if (g.gain > g.target) g.gain = Math.max(g.target, g.gain - step);
        const e = g.gain * g.gain * (3 - 2 * g.gain); // smoothstep: equal-ish power crossfade
        L[s] += mL[s] * e; R[s] += mR[s] * e;
      }
      if (g.gen.mode === 'lofi') lofiW += g.gain; else if (g.gen.mode === 'jazz') lofiW += g.gain * 0.6;
      if (g.gain === 0 && g.target === 0) this.gens.splice(gi, 1);
    }
    // slow leveller keeps sections and modes at a similar loudness (±6 dB)
    for (let s = 0; s < n; s++) {
      const p = L[s] * L[s] + R[s] * R[s];
      this.agcEnv += this.agcA * (p - this.agcEnv);
      const target = clamp(0.165 / Math.sqrt(this.agcEnv + 1e-9), 0.5, 2.5);
      this.agcGain += this.agcG * (target - this.agcGain);
      L[s] *= this.agcGain; R[s] *= this.agcGain;
    }
    this.wobble.process(L, R, n, 0.4 + 0.6 * lofiW);
    this.weather.process(L, R, n);
    this.crackle.process(L, R, n, lofiW, 1 - lofiW);
    // look-ahead peak limiter at -1 dBFS, then a soft safety clip
    const ceil = 0.89;
    for (let s = 0; s < n; s++) {
      const pk = Math.max(Math.abs(L[s]), Math.abs(R[s]));
      const want = pk > ceil ? ceil / pk : 1;
      if (want < this.lim) this.lim = want; else this.lim += this.limRel * (want - this.lim);
      const dl = this.dL[this.di], dr = this.dR[this.di];
      this.dL[this.di] = L[s]; this.dR[this.di] = R[s]; if (++this.di >= this.la) this.di = 0;
      // gain is the minimum over the look-ahead window via the instant attack above
      L[s] = Math.tanh(dl * this.lim / 0.98) * 0.98; R[s] = Math.tanh(dr * this.lim / 0.98) * 0.98;
    }
    this.t += n;
  }
}
