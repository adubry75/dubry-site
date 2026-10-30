// Lofi Cat Radio: the scene. Everything is drawn in code on one canvas.
// Logical design space is 1920×1080; wider/taller screens see more wall, ceiling and floor.
// Lighting follows the sun's altitude through four palettes (night, blue hour, golden hour, day). The
// town and the room are pre-rendered once per palette and crossfaded, so a frame is mostly a handful of
// drawImage calls plus the moving things (sky, clouds, weather, lights, cars, birds, the cat).
import { sunPosition, moonPosition, moonIllumination, localParts } from './sky.js';
import { drawCat, drawPeek, CatBrain, SKIN_IDS, lit } from './cat.js';

export const GLASS = { x: 470, y: 120, w: 980, h: 650 };
const G = GLASS;
const SILL_Y = 778, SILL_FRONT = 806, CAT_X = 1150;
const TRANSOM_Y = 268; // bar between the transom lights and the big panes (logical y)
const MULLION_X = 960;

// ── colour helpers
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── palettes, keyed by the sun's altitude in degrees
const KEYS = [
  { alt: -13, name: 'night', sky: ['#0a102c', '#18214b', '#2c3262'], town: [0.2, 0.22, 0.36], haze: '#262c55', room: [0.36, 0.31, 0.44], spill: 0 },
  { alt: -5, name: 'blue', sky: ['#1c285a', '#4a5390', '#a37ea2'], town: [0.42, 0.42, 0.62], haze: '#68679a', room: [0.54, 0.47, 0.6], spill: 0.1 },
  { alt: 2, name: 'golden', sky: ['#56689f', '#d39a9e', '#ffcb92'], town: [1.0, 0.78, 0.62], haze: '#e9b49c', room: [0.98, 0.8, 0.66], spill: 0.6 },
  { alt: 13, name: 'day', sky: ['#6ea4da', '#a3c8e8', '#e6ecef'], town: [1, 1, 1], haze: '#c9dbeb', room: [1, 0.97, 0.93], spill: 0.45 },
];
function keyBlend(alt) {
  if (alt <= KEYS[0].alt) return [0, 0, 0];
  for (let i = 0; i < KEYS.length - 1; i++) if (alt <= KEYS[i + 1].alt) return [i, i + 1, smooth(KEYS[i].alt, KEYS[i + 1].alt, alt)];
  return [3, 3, 0];
}
// room themes: same room, different moods
export const THEMES = {
  cozy: { name: 'Cozy', wall: ['#b98f86', '#d4ab92', '#c09a84'], speck: '#a87f74', ceil: '#cdb4a6', curtain: ['#a95f52', '#c4766a'], tie: '#e2c38c',
    frame: ['#7f5639', '#9b6d4b', '#5e3e2a'], sill: ['#a97a55', '#c4936a', '#8a5d3e', '#a5734f'], rug: '#9e5b53' },
  cabin: { name: 'Cabin', wall: ['#7a5236', '#946746', '#7d553a'], speck: '#5e3d27', ceil: '#6e4a32', curtain: ['#3f5e48', '#557a5c'], tie: '#c9a45a',
    frame: ['#5a3a26', '#74503a', '#3f281a'], sill: ['#8a6242', '#a2774f', '#6a472e', '#8a6242'], rug: '#7d3b34', planks: true, plaid: '#c9a45a' },
  blue: { name: 'Blue hour', wall: ['#7c8ea4', '#9aabbd', '#8798ad'], speck: '#6a7c92', ceil: '#a9b6c4', curtain: ['#d9cdb8', '#ece2d0'], tie: '#9aa7b8',
    frame: ['#e6e0d6', '#f4efe6', '#c4bdb1'], sill: ['#e3ddd2', '#f1ece3', '#c9c1b4', '#e9e3d8'], rug: '#5f6f8a' },
};

// a little seasonal something on the sill, by date
function decorFor(month, day) {
  const d = month * 100 + day;
  if (d >= 1001 && d <= 1107) return 'pumpkin';
  if (d >= 1201 || d <= 106) return 'holiday';
  if (d >= 320 && d <= 531) return 'tulips';
  if (d >= 601 && d <= 831) return 'sunflower';
  return 'none';
}
function season(month, day) { // Rogue Valley-ish
  const d = month * 31 + day;
  if (d < 2 * 31 + 25 || d >= 12 * 31 + 5) return 'winter';
  if (d < 5 * 31 + 25) return 'spring';
  if (d < 9 * 31 + 25) return 'summer';
  return 'autumn';
}

// ── the town's layout (fixed seed: it's the same town every visit)
function buildTown() {
  const r = seeded(54);
  const T = { mountains: [], hills: [], rows: [], trees: [], lamps: [], poles: [], windows: [] };
  // far ridge and a snowy volcano (generic, drawn freehand)
  T.peak = { x: 760, y: 252, w: 300 };
  let x = -20;
  while (x < G.w + 40) { T.mountains.push([x, 372 + Math.sin(x * 0.011) * 18 + r() * 14]); x += 34 + r() * 30; }
  x = -20;
  while (x < G.w + 40) { T.hills.push([x, 410 + Math.sin(x * 0.007 + 1) * 14 + r() * 6]); x += 26 + r() * 20; }
  const palettes = ['#c9b79a', '#a9b59a', '#9fb2bf', '#c79a82', '#d6c08c', '#b9a8b8', '#d9cdb8', '#8fa39a', '#c4a27c'];
  const roofs = ['#5d5562', '#6e4a42', '#4f5b66', '#7a5a46', '#58504a'];
  // three rows of buildings, back to front
  const rows = [{ y: 470, h: [26, 52], w: [36, 70], depth: 0.62 }, { y: 520, h: [36, 74], w: [52, 96], depth: 0.35 }, { y: 588, h: [56, 112], w: [80, 150], depth: 0.08 }];
  rows.forEach((row, ri) => {
    const items = [];
    let bx = -30 + r() * 30;
    while (bx < G.w + 20) {
      const w = row.w[0] + r() * (row.w[1] - row.w[0]);
      const h = row.h[0] + r() * (row.h[1] - row.h[0]);
      const kind = r() < 0.55 ? 'gable' : r() < 0.6 ? 'flat' : 'hip';
      const b = { x: bx, y: row.y, w, h, kind, col: palettes[(r() * palettes.length) | 0], roof: roofs[(r() * roofs.length) | 0], chimney: r() < 0.45, depth: row.depth, row: ri, steeple: false };
      if (ri === 1 && Math.abs(bx - 300) < 50 && !T.church) { b.steeple = true; b.w = 64; b.h = 70; b.kind = 'gable'; b.col = '#e8e0d2'; T.church = b; }
      items.push(b);
      // windows
      const cols = Math.max(1, Math.floor(w / (ri === 2 ? 26 : 20))), floors = Math.max(1, Math.floor(h / (ri === 2 ? 30 : 24)));
      const ww = ri === 2 ? 10 : ri === 1 ? 7 : 5, wh = ri === 2 ? 13 : ri === 1 ? 9 : 6;
      for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
        if (r() < 0.12) continue;
        const wx = bx + (c + 0.5) * (w / cols) - ww / 2, wy = row.y - h + 10 + f * (h - 14) / floors;
        if (wy + wh > row.y - 3) continue;
        const warm = ['#ffd58c', '#ffc979', '#ffe3a6', '#ffcf9a', '#f7b56d'][(r() * 5) | 0];
        T.windows.push({ x: wx, y: wy, w: ww, h: wh, row: ri, col: r() < 0.07 ? '#a8c4ff' : warm, tv: r() < 0.07, thr: r() < 0.3 ? 2 : 0.3 + r() * 0.55, off: r() < 0.12 ? 27 + r() * 3.5 : 20.5 + r() * 5.5, morning: r() < 0.25 ? 5.4 + r() * 1.4 : 99, a: 0 });
      }
      bx += w + (r() < 0.3 ? 8 + r() * 30 : 0);
    }
    T.rows.push(items);
  });
  // trees between rows
  for (let i = 0; i < 46; i++) {
    const ri = i % 3, y = [480, 532, 602][ri] + r() * 10;
    T.trees.push({ x: r() * G.w, y, s: [0.5, 0.75, 1.1][ri] * (0.8 + r() * 0.5), pine: r() < 0.35, row: ri, hue: r() });
  }
  T.trees.sort((a, b) => a.y - b.y);
  for (let i = 0; i < 5; i++) T.lamps.push({ x: 90 + i * 200 + r() * 30, y: 612 });
  T.poles = [{ x: 140, top: 300 }, { x: 860, top: 312 }];
  return T;
}

export class Scene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.r = seeded(opts.seed ?? 1);
    this.town = buildTown();
    this.cat = new CatBrain(this.r);
    this.skin = 'daisy'; this.theme = 'cozy';
    this.w = { rain: 0, snow: 0, fog: 0, cloud: 0.25, storm: 0 };
    this.flash = 0; this.flashT = -1; this.localThunder = 30; this.audioThunder = false;
    this.wt = { ...this.w };
    this.snowCover = 0;
    this.caches = new Map(); this.season = null;
    this.clouds = []; this.streaks = []; this.flakes = []; this.drops = []; this.cars = []; this.birds = []; this.wireBirds = []; this.leaves = [];
    this.nextCar = 4; this.nextFlock = 6; this.nextPeek = 600 + this.r() * 600; this.peek = null; this.shooting = null; this.nextShooting = 30;
    this.headlight = 0;
    this.time = 0;
    this.playing = false;
    for (let i = 0; i < 9; i++) this.clouds.push(this.newCloud(true));
    for (let i = 0; i < 4; i++) this.wireBirds.push({ u: 0.12 + i * 0.07 + this.r() * 0.05, state: 'sit', t: 0, hop: 0 });
    this.makeSprites();
    this.resize();
  }

  // ── sizing and the camera
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.quality || 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!vw || !vh) { this.zero = true; return; } // hidden / 0×0 frame: wait for a real size
    this.zero = false;
    const cw = Math.max(1, Math.round(vw * dpr)), ch = Math.max(1, Math.round(vh * dpr));
    this.canvas.width = cw; this.canvas.height = ch;
    // landscape: fit the height (wider screens see more room); portrait: fit the window's width
    const s = vw < vh ? Math.min(vh / 1080, vw / 940) : Math.min(vh / 1080, vw / 1060);
    this.k = s * dpr;
    const cx = vw / vh < 1 ? 975 : 960, cy = vw / vh < 1 ? 640 : 540;
    this.ox = cw / 2 - cx * this.k; this.oy = ch / 2 - cy * this.k;
    this.view = { x0: -this.ox / this.k, y0: -this.oy / this.k, x1: (cw - this.ox) / this.k, y1: (ch - this.oy) / this.k };
    this.dropCaches();
    this.cloudLayer = null;
  }
  get portrait() { return this.canvas.width < this.canvas.height; }

  // ── sprites made once
  makeSprites() {
    const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
    this.glow = mk(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    this.warmGlow = mk(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,196,120,0.9)'); gr.addColorStop(0.35, 'rgba(255,170,90,0.35)'); gr.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    // the lamp's light: three soft pools merged once, drawn additively
    this.lampGlow = mk(450, 350, (g) => {
      const pool = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,170,90,${a})`); gr.addColorStop(0.35, `rgba(255,150,80,${a * 0.4})`); gr.addColorStop(1, 'rgba(255,140,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, 450, 350); };
      g.globalCompositeOperation = 'lighter';
      pool(225, 175, 225, 0.32); pool(225, 160, 105, 0.42); pool(225, 150, 35, 0.4);
    });
    this.cloudSprites = [];
    const r = seeded(9);
    for (let i = 0; i < 6; i++) {
      this.cloudSprites.push(mk(360, 160, (g, w, h) => {
        const n = 9 + ((r() * 6) | 0);
        for (let j = 0; j < n; j++) {
          const x = 50 + r() * (w - 100), y = h * 0.6 - Math.sin((x / w) * Math.PI) * (20 + r() * 35), rad = 24 + r() * 34;
          const gr = g.createRadialGradient(x, y - rad * 0.3, rad * 0.1, x, y, rad);
          gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(240,242,248,0.75)'); gr.addColorStop(1, 'rgba(225,230,240,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }
        g.globalCompositeOperation = 'source-atop';
        const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(80,90,120,0.35)');
        g.fillStyle = sh; g.fillRect(0, 0, w, h);
      }));
    }
    this.fogSprite = mk(256, 256, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    this.dropSprite = mk(64, 64, (g, w) => {
      const c = w / 2;
      let gr = g.createRadialGradient(c, c + 4, 4, c, c, c - 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.92, 'rgba(20,25,40,0.35)'); gr.addColorStop(1, 'rgba(20,25,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
      gr = g.createRadialGradient(c - 8, c - 9, 0, c - 8, c - 9, 9); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      gr = g.createRadialGradient(c + 6, c + 12, 0, c + 6, c + 12, 12); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    this.flakeSprite = mk(32, 32, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    this.grain = mk(256, 256, (g, w) => {
      const d = g.createImageData(w, w), rr = seeded(3);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (rr() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
    });
    this.grainPattern = null;
  }

  newCloud(anywhere) {
    const r = this.r;
    return { x: anywhere ? r() * (G.w + 400) - 200 : -380, y: 20 + r() * 260, s: 0.6 + r() * 0.9, v: 4 + r() * 6, i: (r() * 6) | 0, a: 0.6 + r() * 0.4, dark: r(), fa: 1 };
  }

  setWeather(t) { Object.assign(this.wt, t); }
  // is this client point (CSS px) on the cat?
  hitCat(cx, cy) {
    const dpr = this.canvas.width / window.innerWidth;
    const x = (cx * dpr - this.ox) / this.k, y = (cy * dpr - this.oy) / this.k;
    return x > CAT_X - 220 && x < CAT_X + 190 && y > SILL_Y - 210 && y < SILL_Y + 140;
  }
  lightning() { this.flashT = 0; this.flashX = 150 + this.r() * (G.w - 300); }

  // ── per-palette caches
  cache(key, idx, build) {
    const id = key + idx + this.season + (key === 'room' ? this.decor + this.theme : '');
    let c = this.caches.get(id);
    if (!c) { c = build(); this.caches.set(id, c); }
    return c;
  }
  // release cached canvases' memory right away (Safari caps total canvas memory)
  dropCaches() { for (const c of this.caches.values()) { c.width = 0; c.height = 0; } this.caches.clear(); }

  // build one missing palette cache (called from idle time so a palette change never stutters)
  prewarm() {
    if (!this.season) return false;
    for (let i = 0; i < KEYS.length; i++) {
      if (!this.caches.has('room' + i + this.season + this.decor + this.theme)) { this.cache('room', i, () => this.renderRoom(i)); return true; }
      if (!this.caches.has('town' + i + this.season)) { this.cache('town', i, () => this.renderTown(i)); return true; }
      if (this.w.snow > 0.05 && !this.caches.has('snow' + i + this.season)) { this.cache('snow', i, () => this.renderTown(i, true)); return true; }
    }
    return false;
  }
  glassCanvas() {
    const c = document.createElement('canvas');
    c.width = Math.ceil(G.w * this.k); c.height = Math.ceil(G.h * this.k);
    const g = c.getContext('2d'); g.setTransform(this.k, 0, 0, this.k, 0, 0);
    return [c, g];
  }

  renderTown(i, snowOnly = false) {
    const P = KEYS[i], [c, g] = this.glassCanvas(), T = this.town;
    const haze = hex(P.haze);
    const C = (h, depth = 0, extra = 1) => { const b = hex(h); const l = [b[0] * P.town[0] * extra, b[1] * P.town[1] * extra, b[2] * P.town[2] * extra]; return css(mix(l, haze, depth)); };
    const SN = (depth) => C('#f4f6fa', depth, 1.05);
    const snow = snowOnly;
    const fill = (style, f) => { g.fillStyle = style; g.beginPath(); f(); g.fill(); };
    // distant volcano + ridge
    const pk = T.peak;
    if (!snow) {
      fill(C('#8a96b0', 0.72), () => { g.moveTo(pk.x - pk.w, 400); g.quadraticCurveTo(pk.x - 60, pk.y + 30, pk.x - 18, pk.y + 2); g.lineTo(pk.x + 14, pk.y); g.quadraticCurveTo(pk.x + 70, pk.y + 40, pk.x + pk.w, 400); g.closePath(); });
    }
    // the peak always has its snowcap
    fill(snow ? SN(0.6) : C('#eef2f8', 0.55), () => { g.moveTo(pk.x - 64, pk.y + 44); g.quadraticCurveTo(pk.x - 34, pk.y + 12, pk.x - 18, pk.y + 2); g.lineTo(pk.x + 14, pk.y); g.quadraticCurveTo(pk.x + 40, pk.y + 22, pk.x + 70, pk.y + 48); g.lineTo(pk.x + 46, pk.y + 40); g.lineTo(pk.x + 30, pk.y + 52); g.lineTo(pk.x + 8, pk.y + 40); g.lineTo(pk.x - 14, pk.y + 56); g.lineTo(pk.x - 34, pk.y + 44); g.closePath(); });
    if (!snow) {
      fill(C('#7d8aa4', 0.62), () => { g.moveTo(-20, 460); for (const [x, y] of T.mountains) g.lineTo(x, y); g.lineTo(G.w + 40, 460); g.closePath(); });
      fill(C(this.season === 'winter' ? '#76806e' : this.season === 'summer' ? '#6f8a5f' : this.season === 'autumn' ? '#8a845c' : '#6f9060', 0.45), () => { g.moveTo(-20, 480); for (const [x, y] of T.hills) g.lineTo(x, y); g.lineTo(G.w + 40, 480); g.closePath(); });
    } else {
      g.globalAlpha = 0.55; fill(SN(0.62), () => { g.moveTo(-20, 460); for (const [x, y] of T.mountains) g.lineTo(x, y + 1); g.lineTo(G.w + 40, 460); g.closePath(); });
      g.globalAlpha = 0.8; fill(SN(0.45), () => { g.moveTo(-20, 480); for (const [x, y] of T.hills) g.lineTo(x, y + 1); g.lineTo(G.w + 40, 480); g.closePath(); });
      g.globalAlpha = 1;
    }
    const drawTrees = (row) => {
      for (const t of T.trees) if (t.row === row) this.tree(g, t, C, row === 0 ? 0.5 : row === 1 ? 0.3 : 0.08, snow ? SN : null);
    };
    T.rows.forEach((row, ri) => {
      drawTrees(ri);
      for (const b of row) this.building(g, b, C, snow ? SN : null);
    });
    if (!snow) {
      // street and sidewalk
      fill(C('#6b6870', 0.04), () => g.rect(0, 600, G.w, 60));
      fill(C('#8e8a88', 0.04), () => g.rect(0, 596, G.w, 8));
      g.strokeStyle = C('#d8cfae', 0.05); g.lineWidth = 2; g.setLineDash([22, 22]); g.beginPath(); g.moveTo(0, 632); g.lineTo(G.w, 632); g.stroke(); g.setLineDash([]);
      // lamp posts
      for (const l of T.lamps) { fill(C('#3b3a42', 0.02), () => { g.rect(l.x - 2, l.y - 70, 4, 72); g.rect(l.x - 2, l.y - 72, 16, 3); }); fill(C('#4a4952', 0.02), () => g.rect(l.x + 9, l.y - 72, 8, 7)); }
      // power poles and wires
      g.strokeStyle = C('#2f2c33', 0.05); g.lineWidth = 1.4;
      for (const p of T.poles) { fill(C('#4a3f3a', 0.05), () => { g.rect(p.x - 3, p.top, 6, 600 - p.top); g.rect(p.x - 22, p.top + 8, 44, 4); }); }
      for (const off of [0, 12]) { g.beginPath(); g.moveTo(-10, 330 + off); g.quadraticCurveTo(70, 352 + off, 140 - 18 + off * 2, 310 + off); g.quadraticCurveTo(500, 382 + off, 860 - 18 + off * 2, 322 + off); g.quadraticCurveTo(940, 350 + off, G.w + 10, 334 + off); g.stroke(); }
    } else {
      fill(SN(0.03), () => { g.rect(0, 598, G.w, 6); g.rect(0, 640, G.w, 20); });
      // a neighbour's snowman on the far sidewalk
      const sx = 448, sy = 600;
      g.fillStyle = SN(0.02);
      g.beginPath(); g.arc(sx, sy - 9, 10, 0, Math.PI * 2); g.arc(sx, sy - 24, 7.5, 0, Math.PI * 2); g.arc(sx, sy - 35, 5.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = C('#2c2a30', 0.02); g.fillRect(sx - 5, sy - 44, 10, 3); g.fillRect(sx - 3.5, sy - 50, 7, 6);
      g.fillStyle = C('#e07a3a', 0.02); g.beginPath(); g.moveTo(sx + 1, sy - 35); g.lineTo(sx + 8, sy - 34); g.lineTo(sx + 1, sy - 33); g.fill();
      g.fillStyle = C('#b8433a', 0.02); g.fillRect(sx - 6, sy - 30, 12, 3);
      g.strokeStyle = C('#5a4636', 0.02); g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx - 7, sy - 25); g.lineTo(sx - 16, sy - 31); g.moveTo(sx + 7, sy - 25); g.lineTo(sx + 15, sy - 32); g.stroke();
    }
    return c;
  }

  building(g, b, C, SN) {
    const top = b.y - b.h, d = b.depth;
    const wall = C(b.col, d), shade = C(b.col, d, 0.78), roof = C(b.roof, d);
    if (!SN) {
      g.fillStyle = wall; g.fillRect(b.x, top, b.w, b.h);
      g.fillStyle = shade; g.fillRect(b.x + b.w * 0.82, top, b.w * 0.18, b.h);
    }
    g.fillStyle = SN ? SN(d) : roof;
    g.beginPath();
    if (b.kind === 'gable') { const rh = Math.min(b.w * 0.42, 42); if (SN) { g.moveTo(b.x - 4, top + 2); g.lineTo(b.x + b.w / 2, top - rh); g.lineTo(b.x + b.w + 4, top + 2); g.lineTo(b.x + b.w + 1, top + 6); g.lineTo(b.x + b.w / 2, top - rh + 6); g.lineTo(b.x - 1, top + 6); } else { g.moveTo(b.x - 4, top + 2); g.lineTo(b.x + b.w / 2, top - rh); g.lineTo(b.x + b.w + 4, top + 2); } }
    else if (b.kind === 'hip') { const rh = Math.min(b.w * 0.25, 22); g.moveTo(b.x - 3, top + 2); g.lineTo(b.x + b.w * 0.25, top - rh); g.lineTo(b.x + b.w * 0.75, top - rh); g.lineTo(b.x + b.w + 3, top + 2); if (SN) { g.lineTo(b.x + b.w * 0.75, top - rh + 6); g.lineTo(b.x + b.w * 0.25, top - rh + 6); } }
    else { g.rect(b.x - 2, top - 4, b.w + 4, SN ? 4 : 5); }
    g.closePath(); g.fill();
    if (b.chimney && !SN) { g.fillStyle = C('#8a5a4a', d); g.fillRect(b.x + b.w * 0.7, top - 26, 9, 22); }
    if (b.steeple) {
      if (!SN) { g.fillStyle = wall; g.fillRect(b.x + b.w / 2 - 10, top - 62, 20, 30); }
      g.fillStyle = SN ? SN(d) : roof; g.beginPath(); g.moveTo(b.x + b.w / 2 - 13, top - 60); g.lineTo(b.x + b.w / 2, top - (SN ? 96 : 104)); g.lineTo(b.x + b.w / 2 + 13, top - 60); g.closePath(); g.fill();
    }
    if (!SN) {
      g.fillStyle = C('#323446', d);
      for (const w of this.town.windows) if (w.x >= b.x && w.x < b.x + b.w && w.row === b.row && w.y > top - 2) g.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  tree(g, t, C, d, SN) {
    const s = t.s, x = t.x, y = t.y;
    const se = this.season;
    if (t.pine) {
      const col = C(t.hue < 0.5 ? '#3f5e4a' : '#4a6a50', d);
      g.fillStyle = SN ? SN(d) : col;
      for (let k = 0; k < 3; k++) {
        const w = (26 - k * 7) * s, ty = y - (14 + k * 16) * s;
        g.beginPath();
        if (SN) { g.moveTo(x - w * 0.62, ty + 6 * s); g.lineTo(x, ty - 14 * s); g.lineTo(x + w * 0.62, ty + 6 * s); g.quadraticCurveTo(x, ty + 1 * s, x - w * 0.62, ty + 6 * s); }
        else { g.moveTo(x - w, ty + 18 * s); g.lineTo(x, ty - 14 * s); g.lineTo(x + w, ty + 18 * s); }
        g.closePath(); g.fill();
      }
      if (!SN) { g.fillStyle = C('#4e3b30', d); g.fillRect(x - 2 * s, y - 4 * s, 4 * s, 6 * s); }
      return;
    }
    if (!SN) { g.fillStyle = C('#5a4636', d); g.fillRect(x - 2.5 * s, y - 24 * s, 5 * s, 26 * s); }
    if (se === 'winter' && !SN) { // bare branches
      g.strokeStyle = C('#5a4a42', d); g.lineWidth = 1.6 * s;
      g.beginPath(); for (const a of [-0.9, -0.4, 0.1, 0.6, 1.0]) { g.moveTo(x, y - 20 * s); g.lineTo(x + Math.sin(a) * 22 * s, y - 20 * s - Math.cos(a) * 26 * s); } g.stroke();
      return;
    }
    const cols = {
      autumn: ['#d08a3a', '#c96a32', '#e0b04a', '#b8503a', '#8f9a4a'], summer: ['#5f8a4a', '#6a9450', '#557f45'],
      spring: ['#86b05e', '#9cc06a', '#e8b8c8', '#7aa858'], winter: ['#6a7a5a'],
    }[se];
    const col = cols[Math.floor(t.hue * cols.length) % cols.length];
    g.fillStyle = SN ? SN(d) : C(col, d);
    g.beginPath();
    if (SN) { g.ellipse(x, y - 40 * s, 17 * s, 7 * s, 0, Math.PI, Math.PI * 2); }
    else for (const [dx, dy, rr] of [[0, -38, 18], [-11, -30, 13], [11, -30, 13], [0, -26, 14]]) { g.moveTo(x + dx * s + rr * s, y + dy * s); g.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2); }
    g.fill();
    if (!SN) { g.fillStyle = C('#ffffff', d, 0.12); g.beginPath(); g.arc(x - 6 * s, y - 44 * s, 8 * s, 0, Math.PI * 2); g.fill(); }
  }

  // The room, pre-lit for palette i. The glass is cut out so the outside shows through.
  renderRoom(i) {
    const P = KEYS[i], k = this.k;
    const c = document.createElement('canvas'); c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, this.ox, this.oy);
    const L = P.room, C = (h) => lit(h, L);
    const v = this.view;
    const lg = (x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) gr.addColorStop(o, C(col)); return gr; };
    // wall with a soft vertical gradient and faint plaster texture
    const TH = THEMES[this.theme] || THEMES.cozy;
    g.fillStyle = lg(0, v.y0, 0, v.y1, [[0, TH.wall[0]], [0.45, TH.wall[1]], [1, TH.wall[2]]]);
    g.fillRect(v.x0 - 10, v.y0 - 10, v.x1 - v.x0 + 20, v.y1 - v.y0 + 20);
    const rr = seeded(11);
    g.fillStyle = C(TH.speck); g.globalAlpha = TH.planks ? 0.12 : 0.05;
    for (let j = 0; j < 900; j++) { const x = v.x0 + rr() * (v.x1 - v.x0), y = v.y0 + rr() * (v.y1 - v.y0); g.fillRect(x, y, 2 + rr() * 5, 1 + rr() * 3); }
    g.globalAlpha = 1;
    if (TH.planks) { // log-cabin planks
      for (let y = Math.floor(v.y0 / 56) * 56; y < v.y1; y += 56) {
        g.fillStyle = C('#4a2f1e'); g.globalAlpha = 0.55; g.fillRect(v.x0 - 10, y, v.x1 - v.x0 + 20, 3);
        g.fillStyle = C('#b08058'); g.globalAlpha = 0.18; g.fillRect(v.x0 - 10, y + 3, v.x1 - v.x0 + 20, 6);
        g.globalAlpha = 1;
      }
    }
    // ceiling and crown molding (portrait screens see it)
    if (v.y0 < -40) { g.fillStyle = C(TH.ceil); g.fillRect(v.x0 - 10, v.y0 - 10, v.x1 - v.x0 + 20, -40 - v.y0 + 10); g.fillStyle = C('#e2cdbd'); g.fillRect(v.x0 - 10, -46, v.x1 - v.x0 + 20, 12); g.fillStyle = C('#a7887a'); g.fillRect(v.x0 - 10, -34, v.x1 - v.x0 + 20, 4); }
    // a high shelf above the window (only tall/portrait screens see this part of the wall)
    if (v.y0 < -120) this.highShelf(g, C);
    // floor (portrait/tall screens) with a rug
    if (v.y1 > 1090) {
      g.fillStyle = C('#8d6a55'); g.fillRect(v.x0 - 10, 1090, v.x1 - v.x0 + 20, v.y1 - 1090 + 10);
      g.fillStyle = C('#e9d9c6'); g.fillRect(v.x0 - 10, 1078, v.x1 - v.x0 + 20, 14);
      g.strokeStyle = C('#7a5a47'); g.lineWidth = 2; for (let y = 1130; y < v.y1; y += 48) { g.beginPath(); g.moveTo(v.x0 - 10, y); g.lineTo(v.x1 + 10, y); g.stroke(); }
      g.fillStyle = C(TH.rug); g.beginPath(); g.ellipse(960, 1260, 420, 90, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = C('#e7c79a'); g.lineWidth = 6; g.beginPath(); g.ellipse(960, 1260, 380, 74, 0, 0, Math.PI * 2); g.stroke();
      // a cat bed on the rug, and a ball of yarn
      g.fillStyle = C('#6f7f95'); g.beginPath(); g.ellipse(760, 1240, 120, 40, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = C('#e8dccb'); g.beginPath(); g.ellipse(760, 1232, 90, 24, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = C('#c2577a'); g.beginPath(); g.arc(1150, 1262, 26, 0, Math.PI * 2); g.fill();
      g.strokeStyle = C('#e88aa6'); g.lineWidth = 2.5; g.beginPath(); g.arc(1150, 1262, 18, 0.3, 2.6); g.moveTo(1130, 1250); g.quadraticCurveTo(1160, 1262, 1170, 1250); g.stroke();
      g.beginPath(); g.moveTo(1124, 1272); g.bezierCurveTo(1080, 1300, 1040, 1270, 1000, 1296); g.stroke();
    }
    // radiator under the window
    g.fillStyle = C('#e6ddd2'); this.round(g, 640, 892, 640, 176, 10); g.fill();
    g.fillStyle = C('#cfc3b6'); for (let x = 664; x < 1268; x += 30) g.fillRect(x, 906, 14, 150);
    g.fillStyle = C('#b5a89a'); g.fillRect(640, 1050, 640, 8);
    // left wall: shelf with books, a little radio and a trailing plant; a framed print
    this.leftWall(g, C);
    this.rightWall(g, C);
    // window frame
    const [fr, frL, frD] = TH.frame;
    g.fillStyle = C(fr); g.fillRect(G.x - 34, G.y - 34, G.w + 68, G.h + 52);
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(G.x, G.y, G.w, G.h);
    g.globalCompositeOperation = 'source-over';
    // frame bevels
    g.fillStyle = C(frL); g.fillRect(G.x - 34, G.y - 34, G.w + 68, 8); g.fillRect(G.x - 34, G.y - 34, 8, G.h + 52);
    g.fillStyle = C(frD); g.fillRect(G.x - 6, G.y - 6, G.w + 12, 6); g.fillRect(G.x - 6, G.y, 6, G.h); g.fillRect(G.x + G.w, G.y, 6, G.h);
    // muntins: transom bar, centre mullion, transom dividers
    g.fillStyle = C(fr);
    g.fillRect(G.x, TRANSOM_Y - 10, G.w, 20); g.fillRect(MULLION_X - 12, G.y, 24, G.h);
    g.fillRect(G.x + G.w / 4 - 6, G.y, 12, TRANSOM_Y - G.y); g.fillRect(G.x + 3 * G.w / 4 - 6, G.y, 12, TRANSOM_Y - G.y);
    g.fillStyle = C(frL); g.fillRect(G.x, TRANSOM_Y - 10, G.w, 3); g.fillRect(MULLION_X - 12, G.y, 3, G.h);
    g.fillStyle = C(frD); g.fillRect(G.x, TRANSOM_Y + 8, G.w, 3); g.fillRect(MULLION_X + 9, G.y, 3, G.h);
    // sash lock
    g.fillStyle = C('#c9a45a'); this.round(g, MULLION_X - 14, 520, 28, 12, 4); g.fill();
    // curtains and rod (in front of the frame)
    this.curtain(g, C, 352, 486, -1);
    this.curtain(g, C, 1434, 1568, 1);
    // sill: top surface, front lip and a shadow underneath
    g.fillStyle = lg(0, SILL_Y - 8, 0, SILL_FRONT, [[0, TH.sill[0]], [1, TH.sill[1]]]);
    g.beginPath(); g.moveTo(G.x - 40, SILL_Y - 8); g.lineTo(G.x + G.w + 40, SILL_Y - 8); g.lineTo(G.x + G.w + 74, SILL_FRONT); g.lineTo(G.x - 74, SILL_FRONT); g.closePath(); g.fill();
    g.fillStyle = C(TH.sill[2]); this.round(g, G.x - 78, SILL_FRONT, G.w + 156, 30, 5); g.fill();
    g.fillStyle = C(TH.sill[3]); g.fillRect(G.x - 74, SILL_FRONT, G.w + 148, 4);
    g.fillStyle = 'rgba(40,20,30,0.25)'; g.fillRect(G.x - 70, SILL_FRONT + 30, G.w + 140, 10);
    // things on the sill: a succulent, a mug, a little stack of books
    this.sillThings(g, C);
    // daylight spill on the sill and the wall under the window
    if (P.spill > 0) {
      const sp = g.createLinearGradient(0, SILL_Y - 10, 0, SILL_FRONT + 120);
      sp.addColorStop(0, `rgba(255,235,200,${0.22 * P.spill})`); sp.addColorStop(1, 'rgba(255,235,200,0)');
      g.fillStyle = sp; g.fillRect(G.x - 70, SILL_Y - 10, G.w + 140, 160);
    }
    // the lamp's light, baked into the night room (it's always on at night)
    if (i === 0) { g.globalCompositeOperation = 'lighter'; g.drawImage(this.lampGlow, 1754 - 900, 0, 1800, 1400); g.globalCompositeOperation = 'source-over'; }
    // a faint reflection sheen on the glass (baked in: the glass area is otherwise transparent)
    const night = 1 - P.room[0];
    const sh = g.createLinearGradient(G.x, G.y, G.x + G.w, G.y + G.h);
    sh.addColorStop(0.15, 'rgba(255,255,255,0)'); sh.addColorStop(0.32, `rgba(255,255,255,${0.035 + night * 0.03})`); sh.addColorStop(0.42, 'rgba(255,255,255,0)');
    sh.addColorStop(0.62, 'rgba(255,255,255,0)'); sh.addColorStop(0.7, `rgba(255,255,255,${0.025 + night * 0.02})`); sh.addColorStop(0.78, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = sh; g.fillRect(G.x, G.y, G.w, G.h); g.globalCompositeOperation = 'source-over';
    // film grain over the room (static, so it costs nothing per frame)
    g.save(); g.beginPath(); g.rect(v.x0 - 10, v.y0 - 10, v.x1 - v.x0 + 20, v.y1 - v.y0 + 20); g.rect(G.x, G.y, G.w, G.h); g.clip('evenodd');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.05;
    g.fillStyle = g.createPattern(this.grain, 'repeat'); g.fillRect(0, 0, c.width, c.height);
    g.restore();
    // vignette, only over the room (glass stays clear)
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const cx = c.width / 2, cy = c.height / 2, R = Math.hypot(cx, cy);
    const vg = g.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
    vg.addColorStop(0, 'rgba(20,10,25,0)'); vg.addColorStop(1, `rgba(20,10,25,${0.42 + (1 - P.room[0]) * 0.25})`);
    g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  leftWall(g, C) {
    // framed print: a hill and a moon (original, simple)
    g.fillStyle = C('#5c4334'); g.fillRect(100, 150, 180, 140);
    g.fillStyle = C('#efe2cf'); g.fillRect(112, 162, 156, 116);
    g.fillStyle = C('#2f3d63'); g.fillRect(124, 174, 132, 92);
    g.fillStyle = C('#f2d79a'); g.beginPath(); g.arc(214, 204, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = C('#4f6b5f'); g.beginPath(); g.moveTo(124, 266); g.quadraticCurveTo(170, 214, 256, 246); g.lineTo(256, 266); g.closePath(); g.fill();
    // shelf
    g.fillStyle = C('#7a5238'); g.fillRect(40, 428, 290, 16);
    g.fillStyle = C('#5f3f2b'); g.fillRect(40, 444, 290, 5);
    g.fillStyle = C('#4b3324'); g.fillRect(70, 449, 8, 18); g.fillRect(290, 449, 8, 18);
    // books
    const books = [['#7d4b5e', 20, 74], ['#c9a35c', 16, 66], ['#5b7488', 22, 80], ['#9c5c42', 14, 60], ['#6e7f5a', 18, 70]];
    let bx = 150;
    for (const [col, w, h] of books) { g.fillStyle = C(col); g.fillRect(bx, 428 - h, w, h); g.fillStyle = C('#f0e2c6'); g.globalAlpha = 0.5; g.fillRect(bx + 3, 428 - h + 10, w - 6, 3); g.globalAlpha = 1; bx += w + 1; }
    g.save(); g.translate(bx + 8, 428); g.rotate(0.22); g.fillStyle = C('#b86d5a'); g.fillRect(-10, -64, 18, 64); g.restore();
    // the radio (its dial glows when music is on: drawn live)
    g.fillStyle = C('#8a5a3c'); this.round(g, 236, 352, 84, 76, 10); g.fill();
    g.fillStyle = C('#d9c6a5'); this.round(g, 244, 360, 68, 30, 4); g.fill();
    g.fillStyle = C('#5a3a28'); for (let y = 398; y < 422; y += 5) g.fillRect(246, y, 40, 2);
    g.fillStyle = C('#3c2a20'); g.beginPath(); g.arc(300, 410, 7, 0, Math.PI * 2); g.fill();
    // trailing plant
    g.fillStyle = C('#c56f4d'); g.beginPath(); g.moveTo(54, 380); g.lineTo(124, 380); g.lineTo(116, 428); g.lineTo(62, 428); g.closePath(); g.fill();
    g.fillStyle = C('#a8583c'); g.fillRect(52, 378, 74, 8);
    const rr = seeded(5);
    const leaf = (x, y, s, a, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = C(col); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(9 * s, -7 * s, 0, -18 * s); g.quadraticCurveTo(-9 * s, -7 * s, 0, 0); g.fill(); g.restore(); };
    for (let j = 0; j < 9; j++) leaf(60 + rr() * 60, 380, 1 + rr() * 0.4, -0.9 + rr() * 1.8, rr() < 0.5 ? '#4f7a4a' : '#6a9a52');
    g.strokeStyle = C('#4a6a3e'); g.lineWidth = 2;
    for (const [sx, len] of [[64, 260], [92, 340], [118, 200]]) {
      g.beginPath(); g.moveTo(sx, 384);
      let x = sx, y = 384;
      for (let j = 0; j < len; j += 20) { x += Math.sin(j * 0.04 + sx) * 4; y += 20; g.lineTo(x, y); }
      g.stroke();
      x = sx; y = 384;
      for (let j = 0; j < len; j += 20) { x += Math.sin(j * 0.04 + sx) * 4; y += 20; leaf(x, y, 0.8 + rr() * 0.3, (j / 20) % 2 ? 2.2 : -2.2, rr() < 0.5 ? '#4f7a4a' : '#5f8c4c'); }
    }
  }

  highShelf(g, C) {
    const y = -150;
    g.fillStyle = C('#7a5238'); g.fillRect(600, y, 720, 14); g.fillStyle = C('#5f3f2b'); g.fillRect(600, y + 14, 720, 5);
    g.fillStyle = C('#4b3324'); g.fillRect(640, y + 19, 8, 16); g.fillRect(1272, y + 19, 8, 16);
    // framed photos
    for (const [x, w, h, col] of [[640, 70, 88, '#e8b38a'], [722, 56, 70, '#9cc0d8']]) {
      g.fillStyle = C('#3e2b20'); g.fillRect(x, y - h, w, h); g.fillStyle = C('#efe4d2'); g.fillRect(x + 6, y - h + 6, w - 12, h - 12);
      g.fillStyle = C(col); g.fillRect(x + 11, y - h + 11, w - 22, h - 22);
      g.fillStyle = C('#3a2f36'); g.beginPath(); g.ellipse(x + w / 2, y - 20, w * 0.18, 9, 0, Math.PI, 0); g.fill(); // a little cat silhouette
      g.beginPath(); g.moveTo(x + w / 2 - 8, y - 26); g.lineTo(x + w / 2 - 5, y - 34); g.lineTo(x + w / 2 - 1, y - 27); g.lineTo(x + w / 2 + 3, y - 34); g.lineTo(x + w / 2 + 6, y - 26); g.fill();
    }
    // books
    let bx = 820;
    for (const [col, w, h] of [['#6e7f5a', 18, 66], ['#c9a35c', 14, 58], ['#7d4b5e', 20, 72], ['#5b7488', 16, 62]]) { g.fillStyle = C(col); g.fillRect(bx, y - h, w, h); bx += w + 1; }
    // a sleepy cat figurine (lucky-cat-ish shape, just a simple loaf)
    g.fillStyle = C('#f0e6d8'); g.beginPath(); g.ellipse(960, y - 18, 30, 18, 0, Math.PI, 0); g.fill(); g.fillRect(930, y - 18, 60, 18);
    g.beginPath(); g.arc(940, y - 30, 14, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(930, y - 38); g.lineTo(933, y - 50); g.lineTo(940, y - 42); g.lineTo(947, y - 50); g.lineTo(950, y - 38); g.fill();
    g.strokeStyle = C('#3a2f36'); g.lineWidth = 1.5; g.beginPath(); g.moveTo(933, y - 30); g.quadraticCurveTo(936, y - 27, 939, y - 30); g.moveTo(942, y - 30); g.quadraticCurveTo(945, y - 27, 948, y - 30); g.stroke();
    // a jar and a trailing plant
    g.fillStyle = C('#cfe0e4'); g.globalAlpha = 0.75; this.round(g, 1050, y - 54, 40, 54, 8); g.fill(); g.globalAlpha = 1;
    g.fillStyle = C('#c56f4d'); g.beginPath(); g.moveTo(1150, y - 46); g.lineTo(1214, y - 46); g.lineTo(1206, y); g.lineTo(1158, y); g.closePath(); g.fill();
    const rr = seeded(13);
    g.strokeStyle = C('#4a6a3e'); g.lineWidth = 2;
    for (const [sx, len] of [[1160, 180], [1182, 260], [1204, 140]]) {
      let x = sx, yy = y - 40; g.beginPath(); g.moveTo(x, yy);
      const pts = [];
      for (let j = 0; j < len; j += 18) { x += Math.sin(j * 0.05 + sx) * 5; yy += 18; g.lineTo(x, yy); pts.push([x, yy]); }
      g.stroke();
      for (const [px, py] of pts) { g.save(); g.translate(px, py); g.rotate(rr() * 2 - 1 + (rr() < 0.5 ? 2.2 : -2.2)); g.fillStyle = C(rr() < 0.5 ? '#4f7a4a' : '#6a9a52'); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(8, -6, 0, -16); g.quadraticCurveTo(-8, -6, 0, 0); g.fill(); g.restore(); }
    }
    for (let j = 0; j < 8; j++) { g.save(); g.translate(1162 + rr() * 40, y - 46); g.rotate(-1 + rr() * 2); g.fillStyle = C(rr() < 0.5 ? '#4f7a4a' : '#6a9a52'); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(9, -7, 0, -18); g.quadraticCurveTo(-9, -7, 0, 0); g.fill(); g.restore(); }
  }

  rightWall(g, C) {
    // side table + lamp (its glow is drawn live)
    g.fillStyle = C('#6e4a34'); g.fillRect(1640, 860, 230, 18);
    g.fillStyle = C('#5a3b29'); g.fillRect(1656, 878, 12, 220); g.fillRect(1842, 878, 12, 220);
    g.fillStyle = C('#4c3a2e'); g.fillRect(1750, 640, 8, 222);
    g.fillStyle = C('#3a2c24'); g.beginPath(); g.ellipse(1754, 860, 40, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C('#e8cfa2'); g.beginPath(); g.moveTo(1690, 646); g.lineTo(1818, 646); g.lineTo(1790, 560); g.lineTo(1718, 560); g.closePath(); g.fill();
    g.fillStyle = C('#d2b386'); g.fillRect(1690, 640, 128, 8);
    // records leaning on the table
    g.fillStyle = C('#2c2a33'); g.fillRect(1668, 806, 60, 54);
    g.fillStyle = C('#d07a52'); g.fillRect(1676, 814, 44, 40);
    g.fillStyle = C('#f2d9a0'); g.beginPath(); g.arc(1698, 834, 9, 0, Math.PI * 2); g.fill();
    // hanging planter from the ceiling
    g.strokeStyle = C('#e6d6bd'); g.lineWidth = 2;
    g.beginPath(); g.moveTo(1730, -60); g.lineTo(1700, 270); g.moveTo(1730, -60); g.lineTo(1760, 270); g.stroke();
    g.fillStyle = C('#e9e1d4'); g.beginPath(); g.moveTo(1690, 268); g.lineTo(1770, 268); g.quadraticCurveTo(1766, 318, 1730, 320); g.quadraticCurveTo(1694, 318, 1690, 268); g.fill();
    const rr = seeded(8);
    for (let j = 0; j < 14; j++) { g.save(); g.translate(1700 + rr() * 60, 270); g.rotate(-1.4 + rr() * 2.8); g.fillStyle = C(rr() < 0.5 ? '#5f8c4c' : '#77a35a'); g.beginPath(); g.ellipse(0, -22, 7, 22, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }

  curtain(g, C, x0, x1, side) {
    const top = 60, bottom = 880;
    // rod
    g.fillStyle = C('#5a3b29'); g.fillRect(320, 58, 1280, 8);
    g.beginPath(); g.arc(316, 62, 10, 0, Math.PI * 2); g.arc(1604, 62, 10, 0, Math.PI * 2); g.fill();
    const w = x1 - x0;
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    const TH = THEMES[this.theme] || THEMES.cozy;
    for (let j = 0; j <= 6; j++) gr.addColorStop(j / 6, C(j % 2 ? TH.curtain[0] : TH.curtain[1]));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0, top);
    g.lineTo(x1, top);
    const tie = 560, inX = side < 0 ? x0 + w * 0.55 : x1 - w * 0.55;
    if (side < 0) { g.quadraticCurveTo(x1 - 10, tie - 120, inX, tie); g.quadraticCurveTo(x1 + 16, tie + 140, x1 + 6, bottom); g.lineTo(x0, bottom); }
    else { g.lineTo(x1, bottom); g.lineTo(x0 - 6, bottom); g.quadraticCurveTo(x0 - 16, tie + 140, inX, tie); g.quadraticCurveTo(x0 + 10, tie - 120, x0, top); }
    g.closePath(); g.fill();
    if (TH.plaid) { // a soft plaid check on the cabin curtains
      g.save(); g.clip(); g.globalAlpha = 0.18; g.fillStyle = C(TH.plaid);
      for (let x = x0; x < x1; x += 26) g.fillRect(x, top, 5, bottom - top);
      for (let y = top; y < bottom; y += 26) g.fillRect(x0 - 20, y, w + 40, 5);
      g.restore(); g.globalAlpha = 1;
    }
    g.fillStyle = C(TH.tie); g.fillRect(inX - 12, tie - 6, 24, 12);
    for (let x = x0 + 8; x < x1; x += 16) { g.fillStyle = C('#5a3b29'); g.beginPath(); g.arc(x, top + 2, 4, 0, Math.PI * 2); g.fill(); }
  }

  decorThings(g, C) {
    const d = this.decor, y = SILL_Y - 4;
    if (d === 'pumpkin') {
      for (const [dx, w] of [[-26, 30], [26, 30], [0, 34]]) { g.fillStyle = C(dx ? '#d9772e' : '#e8893a'); g.beginPath(); g.ellipse(830 + dx * 0.9, y - 34, w, 36, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = C('#b85f22'); g.lineWidth = 2; g.beginPath(); g.moveTo(816, y - 66); g.quadraticCurveTo(806, y - 34, 816, y - 2); g.moveTo(844, y - 66); g.quadraticCurveTo(854, y - 34, 844, y - 2); g.stroke();
      g.fillStyle = C('#5d6b3a'); g.beginPath(); g.moveTo(826, y - 68); g.quadraticCurveTo(828, y - 84, 838, y - 88); g.lineTo(840, y - 84); g.quadraticCurveTo(834, y - 80, 834, y - 68); g.fill();
      // the carved face, dark until the candle-glow is drawn over it at night
      g.fillStyle = C('#5a2e14');
      g.beginPath(); g.arc(812, y - 44, 6, 0, Math.PI * 2); g.arc(848, y - 44, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(806, y - 30); g.quadraticCurveTo(830, y - 12, 854, y - 30); g.quadraticCurveTo(830, y - 22, 806, y - 30); g.fill();
    } else if (d === 'holiday') { // a tiny potted pine with baubles and a star
      g.fillStyle = C('#b5583e'); g.beginPath(); g.moveTo(812, y - 30); g.lineTo(848, y - 30); g.lineTo(843, y); g.lineTo(817, y); g.closePath(); g.fill();
      g.fillStyle = C('#9a4a33'); g.fillRect(809, y - 34, 42, 7);
      for (const [w, ty] of [[40, y - 34], [32, y - 60], [23, y - 84]]) { g.fillStyle = C('#3f6e4c'); g.beginPath(); g.moveTo(830 - w, ty); g.lineTo(830, ty - 38); g.lineTo(830 + w, ty); g.closePath(); g.fill(); g.fillStyle = C('#4f8058'); g.beginPath(); g.moveTo(830, ty - 38); g.lineTo(830 + w, ty); g.lineTo(830 + w * 0.3, ty); g.closePath(); g.fill(); }
      for (const [x, yy, col] of [[812, y - 42, '#d8504a'], [846, y - 46, '#e8b84a'], [824, y - 66, '#6a9ad8'], [842, y - 72, '#d8504a'], [830, y - 94, '#e8b84a'], [816, y - 76, '#e88ab0']]) { g.fillStyle = C(col); g.beginPath(); g.arc(x, yy, 4.5, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = C('#f2cf5a'); g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 4 : 10; g.lineTo(830 + Math.cos(a) * rr, y - 124 + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    } else if (d === 'tulips' || d === 'sunflower') {
      g.fillStyle = C('#9fb8c8'); this.round(g, 812, y - 46, 36, 46, 10); g.fill();
      g.strokeStyle = C('#5f8c4c'); g.lineWidth = 3;
      const heads = d === 'tulips' ? [[808, y - 110, '#e86a7a'], [832, y - 124, '#f2b04a'], [856, y - 106, '#e88aa6']] : [[834, y - 138, '#f2c14a']];
      for (const [x, yy] of heads) { g.beginPath(); g.moveTo(830, y - 40); g.quadraticCurveTo(x, (yy + y) / 2, x, yy); g.stroke(); }
      for (const [x, yy, col] of heads) {
        if (d === 'tulips') { g.fillStyle = C(col); g.beginPath(); g.moveTo(x - 11, yy - 4); g.lineTo(x - 7, yy - 18); g.lineTo(x, yy - 8); g.lineTo(x + 7, yy - 18); g.lineTo(x + 11, yy - 4); g.quadraticCurveTo(x, yy + 12, x - 11, yy - 4); g.fill(); }
        else { g.fillStyle = C(col); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 16, yy + Math.sin(a) * 16, 9, 4, a, 0, Math.PI * 2); g.fill(); } g.fillStyle = C('#6a4a2a'); g.beginPath(); g.arc(x, yy, 11, 0, Math.PI * 2); g.fill(); }
      }
    }
  }

  sillThings(g, C) {
    this.decorThings(g, C);
    // succulent in a pot
    g.fillStyle = C('#d9cbb8'); g.beginPath(); g.moveTo(520, 732); g.lineTo(584, 732); g.lineTo(576, SILL_Y - 4); g.lineTo(528, SILL_Y - 4); g.closePath(); g.fill();
    g.fillStyle = C('#b9a994'); g.fillRect(518, 728, 68, 7);
    for (let j = 0; j < 7; j++) { g.save(); g.translate(552, 730); g.rotate(-1.3 + j * 0.43); g.fillStyle = C(j % 2 ? '#7fa37a' : '#93b78a'); g.beginPath(); g.ellipse(0, -16, 7, 17, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    // books
    g.fillStyle = C('#5b6f8a'); g.fillRect(612, SILL_Y - 22, 96, 18);
    g.fillStyle = C('#b9785a'); g.fillRect(618, SILL_Y - 38, 86, 16);
    g.fillStyle = C('#e8dcc7'); g.fillRect(612, SILL_Y - 20, 3, 14); g.fillRect(618, SILL_Y - 36, 3, 12);
    // mug on the books
    g.fillStyle = C('#e9e3d8'); this.round(g, 640, SILL_Y - 86, 46, 48, 6); g.fill();
    g.strokeStyle = C('#e9e3d8'); g.lineWidth = 6; g.beginPath(); g.arc(690, SILL_Y - 62, 11, -1.2, 1.2); g.stroke();
    g.fillStyle = C('#6a8fb0'); g.fillRect(640, SILL_Y - 70, 46, 8);
    g.fillStyle = C('#5a3a2a'); g.beginPath(); g.ellipse(663, SILL_Y - 84, 20, 4, 0, 0, Math.PI * 2); g.fill();
  }

  // ── simulation
  update(dt, state) {
    const r = this.r;
    this.time += dt;
    // weather eases toward its target over ~20 s
    const kw = 1 - Math.exp(-dt / 7);
    for (const key of ['rain', 'snow', 'fog', 'cloud', 'storm']) this.w[key] += ((this.wt[key] || 0) - this.w[key]) * kw;
    // lightning: soft double flicker (the music engine sends flashes when it's playing, so the rumble follows)
    if (!this.audioThunder && this.w.storm > 0.3) { this.localThunder -= dt; if (this.localThunder <= 0) { this.lightning(); this.localThunder = 22 + this.r() * 53; } }
    if (this.flashT >= 0) {
      this.flashT += dt; const t = this.flashT;
      this.flash = Math.exp(-t / 0.09) * (t < 0.3 ? 1 : 0) + 0.7 * (t > 0.18 ? Math.exp(-(t - 0.18) / 0.35) : 0);
      if (t > 2) { this.flashT = -1; this.flash = 0; }
    }
    const W = this.w;
    this.wetRoad = clamp((this.wetRoad || 0) + (W.rain > 0.3 ? dt / 20 : -dt / 600), 0, 1);
    this.snowCover = clamp(this.snowCover + (W.snow > 0.3 ? dt / 120 : -dt / 300) * (state.fast ? 6 : 1), 0, 1);
    // clouds
    const want = 5 + Math.round(W.cloud * 12);
    for (const c of this.clouds) c.x += c.v * dt * (1 + W.cloud);
    this.clouds = this.clouds.filter((c) => c.x < G.w + 200);
    while (this.clouds.length < want) { const c = this.newCloud(this.r() < 0.7); c.fa = 0; this.clouds.push(c); }
    for (const c of this.clouds) if (c.fa < 1) c.fa = Math.min(1, c.fa + dt / 10);
    if (this.clouds.length > want + 3) { const c = this.clouds.find((x) => !x.out); if (c) c.out = true; }
    for (const c of this.clouds) if (c.out) c.fa -= dt / 10;
    this.clouds = this.clouds.filter((c) => !(c.out && c.fa <= 0));
    // precipitation particles (in glass coordinates)
    const nStreak = Math.round(W.rain * 240);
    while (this.streaks.length < nStreak) this.streaks.push({ x: r() * (G.w + 200) - 100, y: r() * G.h, v: 900 + r() * 500, l: 14 + r() * 22, z: r() });
    if (this.streaks.length > nStreak) this.streaks.length = nStreak;
    for (const s of this.streaks) { s.y += s.v * dt; s.x -= s.v * dt * 0.12; if (s.y > G.h) { s.y -= G.h + 40; s.x = r() * (G.w + 200) - 100; } }
    const nFlake = Math.round(W.snow * 320);
    while (this.flakes.length < nFlake) this.flakes.push({ x: r() * G.w, y: r() * G.h - G.h * (this.flakes.length > 20 ? 0 : 0), v: 18 + r() * 40, s: 1 + r() * 3.2, ph: r() * 6, z: r() });
    if (this.flakes.length > nFlake) this.flakes.length = nFlake;
    for (const f of this.flakes) { f.y += f.v * dt * (0.6 + f.z * 0.8); f.x += Math.sin(this.time * 0.6 + f.ph) * 14 * dt + 6 * dt; if (f.y > G.h) { f.y = -6; f.x = r() * G.w; } if (f.x > G.w) f.x -= G.w; }
    // drops on the glass
    if (W.rain > 0.05 && r() < W.rain * dt * 10 && this.drops.length < 140) this.drops.push({ x: r() * G.w, y: r() * G.h * 0.95, r: 2 + r() * r() * 7, v: 0, life: 40 + r() * 80, trail: [] });
    for (const d of this.drops) {
      d.life -= dt * (W.rain > 0.05 ? 1 : 4);
      if (d.r > 5.5 && r() < dt * 0.3) d.v = 40 + r() * 60;
      if (d.v > 0) { d.y += d.v * dt; d.x += Math.sin(d.y * 0.05) * 0.2; d.v *= 0.995; if (d.trail.length === 0 || d.y - d.trail[d.trail.length - 1][1] > 6) d.trail.push([d.x, d.y]); if (d.trail.length > 24) d.trail.shift(); d.r = Math.max(2, d.r - dt * 0.5); }
    }
    this.drops = this.drops.filter((d) => d.life > 0 && d.y < G.h + 10);
    // autumn leaves (and spring blossom) drift past now and then
    const drift = this.season === 'autumn' ? ['#d08a3a', '#c96a32', '#e0b04a'] : this.season === 'spring' && state.night < 0.5 ? ['#f2c4d0', '#f7d8e0', '#ebb0c2'] : null;
    if (drift && W.rain < 0.5 && W.snow < 0.3 && r() < dt * (this.season === 'spring' ? 0.12 : 0.05) && this.leaves.length < 6) this.leaves.push({ x: -20, y: 80 + r() * 300, vx: 50 + r() * 50, ph: r() * 6, rot: 0, col: drift[(r() * drift.length) | 0], petal: this.season === 'spring' });
    // fireflies on warm summer nights
    const flies = this.season === 'summer' && W.rain < 0.3 && W.fog < 0.5 ? Math.round(smooth(0.5, 0.9, state.night) * 14) : 0;
    if (!this.fireflies) this.fireflies = [];
    while (this.fireflies.length < flies) this.fireflies.push({ x: r() * G.w, y: 430 + r() * 200, ph: r() * 6, sp: 0.5 + r(), vx: (r() - 0.5) * 12, vy: (r() - 0.5) * 6 });
    if (this.fireflies.length > flies) this.fireflies.length = flies;
    for (const f of this.fireflies) { f.x += (f.vx + Math.sin(this.time * 0.7 + f.ph) * 8) * dt; f.y += (f.vy + Math.cos(this.time * 0.5 + f.ph) * 5) * dt; if (f.x < 0) f.x += G.w; if (f.x > G.w) f.x -= G.w; if (f.y < 400 || f.y > 650) f.vy = -f.vy; }
    for (const l of this.leaves) { l.x += l.vx * dt; l.y += (20 + Math.sin(this.time * 2 + l.ph) * 30) * dt; l.rot += dt * 2; }
    this.leaves = this.leaves.filter((l) => l.x < G.w + 30 && l.y < G.h);
    // cars
    this.nextCar -= dt * (state.fast ? 3 : 1);
    if (this.nextCar <= 0) {
      const dir = r() < 0.5 ? 1 : -1;
      this.cars.push({ x: dir > 0 ? -90 : G.w + 90, dir, v: 110 + r() * 60, col: ['#b54a3c', '#3f5f8a', '#d9cfb8', '#4d6b52', '#e0b84a', '#6d6a78'][(r() * 6) | 0], lane: dir > 0 ? 646 : 626 });
      this.nextCar = 14 + r() * 40 * (state.night > 0.5 ? 1.6 : 1);
    }
    for (const c of this.cars) c.x += c.dir * c.v * dt;
    this.cars = this.cars.filter((c) => c.x > -120 && c.x < G.w + 120);
    // birds (daytime, not in heavy weather)
    this.nextFlock -= dt;
    if (this.nextFlock <= 0) {
      if (state.night < 0.4 && W.rain < 0.6 && W.snow < 0.6) {
        const n = 1 + ((r() * 5) | 0), y = 60 + r() * 220, dir = r() < 0.5 ? 1 : -1, v = 60 + r() * 50;
        for (let j = 0; j < n; j++) this.birds.push({ x: (dir > 0 ? -30 : G.w + 30) - dir * j * (18 + r() * 16), y: y + (j % 2) * 12 + r() * 8, dir, v, ph: r() * 6, s: 0.8 + r() * 0.4 });
      }
      this.nextFlock = 20 + r() * 50;
    }
    for (const b of this.birds) { b.x += b.dir * b.v * dt; b.y += Math.sin(this.time * 0.8 + b.ph) * 6 * dt; }
    this.birds = this.birds.filter((b) => b.x > -60 && b.x < G.w + 60);
    for (const wb of this.wireBirds) {
      wb.t -= dt;
      if (wb.state === 'sit' && (state.night > 0.6 || W.rain > 0.6)) { wb.state = 'gone'; }
      if (wb.state === 'sit' && wb.t <= 0) { wb.hop = r() < 0.5 ? 0.25 : 0; wb.t = 4 + r() * 10; if (r() < 0.08) { wb.state = 'gone'; wb.t = 20 + r() * 60; } }
      if (wb.state === 'gone' && wb.t <= 0 && state.night < 0.5 && W.rain < 0.5) { wb.state = 'sit'; wb.u = 0.1 + r() * 0.3; wb.t = 6; }
      wb.hop = Math.max(0, wb.hop - dt);
    }
    if (!this.plane && state.night > 0.6 && W.cloud < 0.6 && r() < dt / 420) this.plane = { x: -10, y: 60 + r() * 160, v: 9 + r() * 6, dy: (r() - 0.5) * 1.5 };
    if (this.plane) { this.plane.x += this.plane.v * dt; this.plane.y += this.plane.dy * dt; if (this.plane.x > G.w + 10) this.plane = null; }
    // a shooting star on clear nights, rarely
    this.nextShooting -= dt;
    if (this.nextShooting <= 0) { if (state.night > 0.8 && W.cloud < 0.5) this.shooting = { x: 200 + r() * 600, y: 40 + r() * 120, t: 0 }; this.nextShooting = 90 + r() * 240; }
    if (this.shooting) { this.shooting.t += dt; if (this.shooting.t > 1.2) this.shooting = null; }
    // a stray trots along the far sidewalk now and then
    if (this.nextStray === undefined) this.nextStray = 240 + r() * 400;
    this.nextStray -= dt;
    if (!this.roofs) // flat roofs in the nearer rows that nothing on the sill (or the cat) hides
      this.roofs = this.town.rows.flat().filter((b) => b.kind === 'flat' && b.row > 0 && b.w > 60 && (b.x + b.w < 470 || b.x > 880) && b.x > 20 && b.x + b.w < G.w - 20);
    if (this.nextStray <= 0 && !this.stray && W.rain < 0.6 && this.roofs.length) {
      const b = this.roofs[(r() * this.roofs.length) | 0], dir = r() < 0.5 ? 1 : -1;
      this.stray = { x0: b.x + 6, x1: b.x + b.w - 6, x: dir > 0 ? b.x + 6 : b.x + b.w - 6, y: b.y - b.h - 4, s: b.row === 2 ? 0.85 : 0.65, dir, v: 16 + r() * 8, ph: 0,
        col: ['#2a2629', '#d08a4a', '#8a8580', '#e9e2d6'][(r() * 4) | 0], sit: r() < 0.6 ? 0.35 + r() * 0.3 : -1, sat: 0 };
      this.nextStray = 360 + r() * 700;
    }
    if (this.stray) {
      const st = this.stray, u = (st.x - st.x0) / (st.x1 - st.x0), along = st.dir > 0 ? u : 1 - u;
      if (st.sit > 0 && along > st.sit && st.sat < 7) { st.sat += dt; } // pauses to sit and look around
      else { st.x += st.dir * st.v * dt; st.ph += dt * st.v / 7; }
      st.a = Math.min(1, along * 8, (1 - along) * 8); // fades in and out at the ends of the roof
      if (along >= 1) this.stray = null;
    }
    // the visitor
    this.nextPeek -= dt;
    if (this.nextPeek <= 0 && !this.peek) {
      const others = SKIN_IDS.filter((s) => s !== this.skin);
      this.peek = { t: 0, dur: 9 + r() * 5, skin: others[(r() * others.length) | 0], x: this.portrait ? 760 : 760 + r() * 140 };
      this.nextPeek = 480 + r() * 900;
    }
    if (this.peek) { this.peek.t += dt; if (this.peek.t > this.peek.dur) this.peek = null; }
    // the cat looks at flying birds or the visitor
    let look = null;
    const catHead = { x: G.x + (CAT_X - G.x) - 112, y: SILL_Y - 128 };
    if (this.peek && this.peek.t > 1.5) look = { x: (this.peek.x - CAT_X) / 400, y: 0.8 };
    else if (this.stray) look = { x: (G.x + this.stray.x - catHead.x) / 500, y: (G.y + this.stray.y - catHead.y) / 400 };
    else if (this.birds.length) { const b = this.birds[0]; look = { x: (G.x + b.x - catHead.x) / 500, y: (G.y + b.y - catHead.y) / 400 }; }
    if (this.peek && this.peek.t > 1 && this.cat.state === 'sleep' && this.peek.t < 1.1) this.cat.wake();
    this.cat.pupil = clamp(0.25 + state.night * 0.7, 0, 1);
    this.cat.update(dt, look);
    // lights in the town
    const hour = state.hour;
    for (const w of this.town.windows) {
      const evening = state.dark > w.thr && (hour >= 12 ? hour < w.off : hour + 24 < w.off);
      const morning = hour >= w.morning && state.dark > 0.2 && hour < 12;
      const target = evening || morning ? 1 : 0;
      w.a += (target - w.a) * Math.min(1, dt * 2.5);
    }
  }

  // ── frame
  draw(state) {
    if (this.zero) { this.resize(); if (this.zero) return; }
    const ctx = this.ctx, k = this.k, W = this.w;
    if (this.prof) this.profT = performance.now();
    const sea = season(state.month, state.day);
    const dec = decorFor(state.month, state.day);
    if (sea !== this.season || dec !== this.decor) { this.season = sea; this.decor = dec; this.dropCaches(); }
    if (this.theme !== this.cachedTheme) { // drop the other themes' room images
      for (const k of [...this.caches.keys()]) if (k.startsWith('room') && !k.endsWith(this.theme)) { const c = this.caches.get(k); c.width = c.height = 0; this.caches.delete(k); }
      this.cachedTheme = this.theme;
    }
    const [ia, ib, bt] = keyBlend(state.sunAlt);
    const PA = KEYS[ia], PB = KEYS[ib];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // ── outside (clipped to the glass)
    ctx.save();
    ctx.setTransform(k, 0, 0, k, this.ox, this.oy);
    ctx.beginPath(); ctx.rect(G.x, G.y, G.w, G.h); ctx.clip();
    ctx.translate(G.x, G.y);
    // sky
    const grey = mix([138, 146, 160], [40, 44, 60], state.night);
    const sky = [0, 1, 2].map((j) => mix(mix(hex(PA.sky[j]), hex(PB.sky[j]), bt), grey, Math.min(0.85, W.cloud * 0.72 + W.fog * 0.3)));
    const sg = ctx.createLinearGradient(0, 0, 0, 470);
    sg.addColorStop(0, css(sky[0])); sg.addColorStop(0.6, css(sky[1])); sg.addColorStop(1, css(sky[2]));
    ctx.fillStyle = sg; ctx.fillRect(0, 0, G.w, G.h);
    // stars
    const starA = state.night * (1 - W.cloud * 0.9) * (1 - W.fog);
    if (starA > 0.02) {
      if (!this.milky) { // a faint diagonal band of sky-glow, made once
        const c = document.createElement('canvas'); c.width = 240; c.height = 160; const g = c.getContext('2d'), rr = seeded(31);
        g.translate(120, 80); g.rotate(-0.45);
        for (let i = 0; i < 70; i++) { const x = (rr() - 0.5) * 300, y = (rr() - 0.5) * 26 * (1 + rr()), r0 = 8 + rr() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, r0); gr.addColorStop(0, 'rgba(190,200,255,0.10)'); gr.addColorStop(1, 'rgba(190,200,255,0)'); g.fillStyle = gr; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2); }
        // fade every edge to nothing, so the band can never show the sprite's border
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
        let m = g.createLinearGradient(0, 0, 240, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.25, 'rgba(0,0,0,1)'); m.addColorStop(0.75, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, 240, 160);
        m = g.createLinearGradient(0, 0, 0, 160); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.25, 'rgba(0,0,0,1)'); m.addColorStop(0.75, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, 240, 160);
        this.milky = c;
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, starA * 1.3 * (1 - state.moonFraction * 0.5));
      ctx.drawImage(this.milky, 120, -40, G.w * 0.85, 420); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      this.stars(ctx, starA);
    }
    // a plane's lights crossing far away, now and then at night
    if (this.plane) {
      const pl = this.plane, blink = (this.time * 1.1) % 1 < 0.12;
      ctx.fillStyle = `rgba(255,255,255,${0.75 * state.night})`; ctx.fillRect(pl.x, pl.y, 2, 2);
      if (blink) { ctx.fillStyle = `rgba(255,90,80,${state.night})`; ctx.fillRect(pl.x + 3, pl.y, 2.4, 2.4); }
    }
    // sun glow and moon
    this.sunMoon(ctx, state, sky);
    // shooting star
    if (this.shooting) {
      const s = this.shooting, u = s.t / 1.2, x = s.x + u * 220, y = s.y + u * 90;
      const gr = ctx.createLinearGradient(x - 60, y - 25, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${0.8 * Math.sin(u * Math.PI)})`);
      ctx.strokeStyle = gr; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 60, y - 25); ctx.lineTo(x, y); ctx.stroke();
    }
    this.mark('sky');
    // clouds
    this.drawClouds(ctx, state, sky);
    this.mark('clouds');
    if (this.flash > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      const fg = ctx.createRadialGradient(this.flashX, 120, 0, this.flashX, 120, 700);
      fg.addColorStop(0, `rgba(200,210,255,${0.45 * this.flash})`); fg.addColorStop(1, `rgba(160,170,230,${0.12 * this.flash})`);
      ctx.fillStyle = fg; ctx.fillRect(0, 0, G.w, 480);
      ctx.globalCompositeOperation = 'source-over';
    }
    // town (two palettes crossfaded) + snow cover
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gx = Math.round(this.ox + G.x * k), gy = Math.round(this.oy + G.y * k);
    const ta = this.cache('town', ia, () => this.renderTown(ia));
    ctx.drawImage(ta, gx, gy);
    if (bt > 0.01 && ib !== ia) { ctx.globalAlpha = bt; ctx.drawImage(this.cache('town', ib, () => this.renderTown(ib)), gx, gy); ctx.globalAlpha = 1; }
    if (this.snowCover > 0.01) {
      ctx.globalAlpha = this.snowCover * (1 - bt); ctx.drawImage(this.cache('snow', ia, () => this.renderTown(ia, true)), gx, gy);
      if (bt > 0.01 && ib !== ia) { ctx.globalAlpha = this.snowCover * bt; ctx.drawImage(this.cache('snow', ib, () => this.renderTown(ib, true)), gx, gy); }
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(k, 0, 0, k, this.ox + G.x * k, this.oy + G.y * k);
    // overcast dims the town a little
    if (W.cloud > 0.05) {
      const oc = mix([120, 128, 145], [20, 22, 35], state.night), og = ctx.createLinearGradient(0, 240, 0, 420);
      og.addColorStop(0, css(oc, 0)); og.addColorStop(1, css(oc, W.cloud * 0.22));
      ctx.fillStyle = og; ctx.fillRect(0, 240, G.w, G.h - 240);
    }
    this.mark('town');
    // lit windows, street lamps, cars, birds
    this.townLights(ctx, state);
    // a wet road mirrors the lamps and headlights
    const wet = Math.max(W.rain, this.wetRoad || 0);
    if (wet > 0.05 && state.dark > 0.3) this.reflections(ctx, state, wet);
    this.drawCars(ctx, state);
    if (this.stray) this.drawStray(ctx, state);
    this.drawBirds(ctx, state);
    this.mark('lights');
    // fog
    if (W.fog > 0.02) this.drawFog(ctx, state, sky);
    // chimney smoke in wood-stove season (mid-October to mid-April)
    const md = state.month * 100 + state.day;
    if (md >= 1015 || md <= 415 || W.snow > 0.2) this.smoke(ctx, state);
    // lights glow through the fog
    if (W.fog > 0.05 && state.dark > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      for (const w of this.town.windows) if (w.a > 0.2 && w.row > 0) { ctx.globalAlpha = w.a * W.fog * 0.35; ctx.drawImage(this.warmGlow, w.x - 10, w.y - 10, w.w + 20, w.h + 20); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // rain / snow outside
    this.precip(ctx, state);
    for (const l of this.leaves) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot); ctx.fillStyle = css(mix(hex(l.col), [30, 30, 50], state.night * 0.7)); ctx.beginPath(); ctx.ellipse(0, 0, l.petal ? 4 : 6, l.petal ? 2.5 : 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (this.fireflies && this.fireflies.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.fireflies) { const a = Math.max(0, Math.sin(this.time * f.sp + f.ph)); if (a < 0.05) continue; ctx.globalAlpha = a; ctx.drawImage(this.warmGlow, f.x - 13, f.y - 13, 26, 26); ctx.fillStyle = '#fff7b0'; ctx.fillRect(f.x - 1.2, f.y - 1.2, 2.4, 2.4); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    this.mark('fogprecip');
    // glass: drops, frost, reflections
    this.glass(ctx, state);
    ctx.restore();

    this.mark('glass');
    // ── room (two palettes crossfaded)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.cache('room', ia, () => this.renderRoom(ia)), 0, 0);
    if (bt > 0.01 && ib !== ia) { ctx.globalAlpha = bt; ctx.drawImage(this.cache('room', ib, () => this.renderRoom(ib)), 0, 0); ctx.globalAlpha = 1; }
    ctx.setTransform(k, 0, 0, k, this.ox, this.oy);
    // weather darkens the room a touch (not the glass)
    const dim = W.cloud * 0.16 + W.fog * 0.06;
    if (dim > 0.01) {
      ctx.fillStyle = `rgba(30,32,50,${dim})`;
      const v = this.view; ctx.beginPath(); ctx.rect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); ctx.rect(G.x, G.y, G.w, G.h); ctx.fill('evenodd');
    }
    this.mark('room');
    this.roomLights(ctx, state);
    this.mark('roomlights');
    // the cat
    const roomL = mix(mix(KEYS[ia].room, KEYS[ib].room, bt), [0, 0, 0], 0).map((v) => v * (1 - dim * 0.8));
    const lampOn = state.lamp;
    const catL = [roomL[0] + lampOn * 0.35, roomL[1] + lampOn * 0.24, roomL[2] + lampOn * 0.1];
    const rimCol = state.night > 0.6 ? 'rgba(150,170,230,1)' : css(mix(hex('#fff2dc'), hex('#ffc68a'), smooth(10, 0, state.sunAlt)));
    const rim = { color: rimCol, alpha: (1 - state.night * 0.75) * 0.35 * (1 - W.cloud * 0.5) + 0.08 };
    drawCat(ctx, CAT_X, SILL_Y + 2, 1, this.skin, this.cat, this.time, catL, rim, state.night * 0.3);
    this.mark('cat');
    // the visitor peeks up from the bottom of the frame
    if (this.peek) drawPeek(ctx, this.peek.x, this.view.y1 - 40, 1.25, this.peek.skin, this.peek.t / this.peek.dur, this.time, catL);
    // lamp glow over everything nearby (also catches the cat)
    // (the night room has the lamp's light baked in; draw only what the palette blend doesn't cover)
    const baked = ia === 0 ? (ib === 0 ? 1 : 1 - bt) : 0;
    const extra = lampOn - baked;
    if (extra > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = extra; ctx.drawImage(this.lampGlow, 1754 - 900, 0, 1800, 1400);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (this.flash > 0.01) { // the room catches a little of the lightning
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(150,160,210,${0.07 * this.flash})`;
      const v = this.view; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); ctx.globalCompositeOperation = 'source-over';
    }
    // headlights sweeping across the ceiling at night
    if (this.headlight > 0.01) {
      const h = this.headlight, x = this.headX;
      ctx.globalCompositeOperation = 'screen';
      const gr = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
      gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(0.5, `rgba(255,240,210,${0.16 * h})`); gr.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 200, this.view.y0); ctx.lineTo(x + 260, this.view.y0); ctx.lineTo(x + 120, G.y - 40); ctx.lineTo(x - 300, G.y - 40); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    this.mark('lampglow');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.mark('end');
  }

  mark(name) {
    if (!this.prof) return;
    this.ctx.getImageData(0, 0, 1, 1);
    const t = performance.now(); this.prof[name] = (this.prof[name] || 0) + t - this.profT; this.profT = t;
  }
    stars(ctx, a) {
    if (!this.starField) {
      const r = seeded(77); this.starField = [];
      for (let i = 0; i < 160; i++) this.starField.push([r() * G.w, r() * 420, r() * 1.3 + 0.3, r() * 6, r()]);
    }
    ctx.fillStyle = '#fff';
    for (const [x, y, s, ph, b] of this.starField) {
      ctx.globalAlpha = a * (0.35 + 0.65 * b) * (0.75 + 0.25 * Math.sin(this.time * (0.5 + b) + ph)) * clamp(1 - y / 460, 0, 1);
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // map azimuth (0 south, + west) / altitude to the view: the window faces south-west
  skyXY(az, alt) {
    const deg = az * 180 / Math.PI, a = alt * 180 / Math.PI;
    return [G.w / 2 + deg * (G.w / 230), 430 - a * 5.6];
  }

  sunMoon(ctx, state, sky) {
    const W = this.w, clear = 1 - Math.min(1, W.cloud * 0.8 + W.fog * 0.7 + W.rain * 0.4 + W.snow * 0.4);
    const [sx, sy] = this.skyXY(state.sunAz, state.sunAltR);
    if (state.sunAlt > -4 && clear > 0.02) {
      const warm = smooth(18, 0, state.sunAlt);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clear * 0.55; ctx.drawImage(this.warmGlow, sx - 260, sy - 260, 520, 520);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = css(mix([255, 248, 232], [255, 196, 130], warm), clear);
      ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();
    }
    const [mx, my] = this.skyXY(state.moonAz, state.moonAlt);
    if (state.moonAlt > -0.05 && state.sunAlt < 4) {
      const vis = clear * (0.35 + 0.65 * state.night);
      const ph = state.moonPhase, R = 17;
      ctx.save(); ctx.translate(mx, my);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = vis * 0.35 * state.moonFraction; ctx.drawImage(this.glow, -90, -90, 180, 180); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = vis * 0.2; ctx.fillStyle = css(sky[0]); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      // lit part: half disc + a terminator ellipse
      ctx.globalAlpha = vis; ctx.fillStyle = '#f3ecd8';
      const waxing = ph < 0.5, f = Math.cos(ph * Math.PI * 2); // 1 new, -1 full
      ctx.beginPath();
      ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(0, 0, Math.abs(f) * R, R, 0, Math.PI / 2, -Math.PI / 2, (f > 0) === waxing ? true : false);
      ctx.fill();
      ctx.globalAlpha = vis * 0.12; ctx.fillStyle = '#9a947f';
      ctx.beginPath(); ctx.arc(-5, -4, 4, 0, Math.PI * 2); ctx.arc(6, 5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  drawClouds(ctx, state, sky) {
    const W = this.w;
    // tint: lit tops by day, warm at golden hour, dark blue-grey at night; storms are greyer
    const day = mix(hex('#ffffff'), hex('#ffd2b0'), smooth(14, 1, state.sunAlt));
    const base = mix(day, mix(sky[1], [30, 34, 58], 0.5), state.night * 0.9);
    const col = mix(base, [120, 126, 140], W.rain * 0.5 + W.snow * 0.2);
    // tinted copies of the cloud sprites, rebuilt only when the tint changes noticeably
    const key = col.map((v) => Math.round(v / 6)).join(',');
    if (key !== this.cloudKey) {
      this.cloudKey = key;
      this.tinted = this.cloudSprites.map((sp, i) => {
        const c = (this.tinted && this.tinted[i]) || document.createElement('canvas');
        c.width = sp.width; c.height = sp.height;
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; g.drawImage(sp, 0, 0);
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(col, 0.85); g.fillRect(0, 0, c.width, c.height);
        return c;
      });
    }
    // drawn at a third of the resolution into a layer, then scaled up once (they're soft anyway)
    const lw = Math.ceil(G.w / 3), lh = Math.ceil(G.h / 3);
    if (!this.cloudLayer) { this.cloudLayer = document.createElement('canvas'); this.cloudLayer.width = lw; this.cloudLayer.height = lh; this.cloudCtx = this.cloudLayer.getContext('2d'); }
    const g = this.cloudCtx;
    g.clearRect(0, 0, lw, lh);
    for (const c of this.clouds) {
      g.globalAlpha = c.a * (0.55 + W.cloud * 0.45) * (c.fa ?? 1);
      const s = c.s * (1 + W.cloud * 0.6);
      g.drawImage(this.tinted[c.i], c.x / 3, c.y / 3, 120 * s, 53.3 * s);
    }
    g.globalAlpha = 1;
    ctx.drawImage(this.cloudLayer, 0, 0, lw * 3, lh * 3);
    // overcast veil
    if (W.cloud > 0.4) {
      const vg = ctx.createLinearGradient(0, 0, 0, 500);
      vg.addColorStop(0, css(col, (W.cloud - 0.4) * 0.9)); vg.addColorStop(0.75, css(col, (W.cloud - 0.4) * 0.6)); vg.addColorStop(1, css(col, 0));
      ctx.fillStyle = vg; ctx.fillRect(0, 0, G.w, 500);
    }
  }

  townLights(ctx, state) {
    const W = this.w;
    // lit windows
    for (const w of this.town.windows) {
      if (w.a < 0.02) continue;
      let a = w.a * (w.row === 2 ? 1 : w.row === 1 ? 0.85 : 0.65);
      if (w.tv) a *= 0.7 + 0.3 * Math.sin(this.time * 7 + w.x) * Math.sin(this.time * 3.1 + w.y);
      ctx.globalAlpha = a; ctx.fillStyle = w.col; ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.globalAlpha = 1;
    // window glows (cheap: only the near rows)
    ctx.globalCompositeOperation = 'screen';
    for (const w of this.town.windows) if (w.row === 2 && w.a > 0.2) { ctx.globalAlpha = w.a * 0.18; ctx.drawImage(this.warmGlow, w.x - 14, w.y - 14, w.w + 28, w.h + 28); }
    // street lamps
    const on = smooth(0.3, 0.5, state.dark);
    if (on > 0.01) for (const l of this.town.lamps) {
      ctx.globalAlpha = on * (0.7 + W.fog * 0.3); ctx.drawImage(this.warmGlow, l.x + 13 - 40 - W.fog * 30, l.y - 69 - 40 - W.fog * 30, 80 + W.fog * 60, 80 + W.fog * 60);
      ctx.globalAlpha = on * 0.35; ctx.drawImage(this.warmGlow, l.x + 13 - 60, l.y - 30, 120, 50);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (on > 0.01) { ctx.fillStyle = `rgba(255,224,160,${on})`; for (const l of this.town.lamps) ctx.fillRect(l.x + 9, l.y - 66, 8, 3); }
  }

  drawCars(ctx, state) {
    const dark = state.dark;
    let head = 0, headX = 0;
    for (const c of this.cars) {
      const y = c.lane, x = c.x;
      const body = css(mix(hex(c.col), [20, 22, 38], dark * 0.8));
      ctx.fillStyle = body;
      this.round(ctx, x - 34, y - 16, 68, 14, 5); ctx.fill();
      this.round(ctx, x - 20, y - 27, 38, 13, 6); ctx.fill();
      ctx.fillStyle = css(mix([170, 200, 220], [40, 50, 70], dark)); ctx.fillRect(x - 16, y - 24, 14, 8); ctx.fillRect(x + 1, y - 24, 14, 8);
      ctx.fillStyle = '#1e1c22'; ctx.beginPath(); ctx.arc(x - 20, y - 2, 6, 0, Math.PI * 2); ctx.arc(x + 20, y - 2, 6, 0, Math.PI * 2); ctx.fill();
      if (dark > 0.25) {
        const a = smooth(0.25, 0.5, dark), fx = x + c.dir * 34, bx = x - c.dir * 34;
        ctx.globalCompositeOperation = 'screen';
        // beam on the road ahead
        const gr = ctx.createLinearGradient(fx, 0, fx + c.dir * 160, 0); gr.addColorStop(0, `rgba(255,236,190,${0.45 * a})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(fx, y - 12); ctx.lineTo(fx + c.dir * 170, y - 22); ctx.lineTo(fx + c.dir * 170, y + 8); ctx.lineTo(fx, y - 4); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a; ctx.drawImage(this.glow, fx - 14, y - 22, 28, 28);
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#ff5a4a'; ctx.globalCompositeOperation = 'source-over'; ctx.fillRect(bx - 2, y - 13, 4, 4);
        ctx.globalAlpha = 1;
        // how much light this car throws into the room (as it passes in front)
        const u = 1 - Math.abs((x - G.w / 2) / (G.w / 2 + 90));
        if (u * a > head) { head = u * a; headX = G.x + G.w / 2 - (x - G.w / 2) * 0.9; }
      }
    }
    this.headlight = head; this.headX = headX;
  }

  reflections(ctx, state, wet) {
    const on = smooth(0.3, 0.5, state.dark) * wet;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.town.lamps) {
      const x = l.x + 13, sh = 0.75 + 0.25 * Math.sin(this.time * 3 + l.x);
      const gr = ctx.createLinearGradient(0, 606, 0, 662);
      gr.addColorStop(0, `rgba(255,200,120,${0.32 * on * sh})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 4, 606, 8, 56);
    }
    for (const c of this.cars) { // headlight and tail-light streaks
      const fx = c.x + c.dir * 34, bx = c.x - c.dir * 34;
      let gr = ctx.createLinearGradient(0, c.lane, 0, c.lane + 26); gr.addColorStop(0, `rgba(255,236,190,${0.35 * on})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = gr; ctx.fillRect(fx - 3, c.lane, 6, 26);
      gr = ctx.createLinearGradient(0, c.lane, 0, c.lane + 18); gr.addColorStop(0, `rgba(255,80,70,${0.3 * on})`); gr.addColorStop(1, 'rgba(255,80,70,0)');
      ctx.fillStyle = gr; ctx.fillRect(bx - 2, c.lane, 4, 18);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawStray(ctx, state) {
    const st = this.stray, sitting = st.sit > 0 && st.sat > 0 && st.sat < 7, y = st.y;
    const col = css(mix(hex(st.col), [18, 18, 30], state.night * 0.75));
    ctx.save(); ctx.globalAlpha = Math.max(0, st.a ?? 1); ctx.translate(st.x, y); ctx.scale(st.dir * st.s, st.s); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round';
    if (sitting) { // a little sitting silhouette
      ctx.beginPath(); ctx.ellipse(0, -7, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2, -15, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0.5, -21.5); ctx.lineTo(2.5, -18.5); ctx.lineTo(4, -21.5); ctx.lineTo(5, -17); ctx.fill();
      ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4, -1); ctx.quadraticCurveTo(-10, 0, -9, -6 + Math.sin(this.time * 2) * 1.5); ctx.stroke();
    } else { // trotting: legs swing, tail up
      const a = Math.sin(st.ph), b = Math.sin(st.ph + Math.PI);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(5 + a * 2.5, 0); ctx.moveTo(-5, -6); ctx.lineTo(-5 + b * 2.5, 0); ctx.moveTo(3.5, -6); ctx.lineTo(3.5 + b * 2.5, 0); ctx.moveTo(-6.5, -6); ctx.lineTo(-6.5 + a * 2.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -8, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(8.5, -11, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7, -13); ctx.lineTo(7.5, -16.5); ctx.lineTo(9.3, -13.8); ctx.lineTo(10.6, -16.5); ctx.lineTo(11.3, -12.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7.5, -9); ctx.quadraticCurveTo(-12, -12, -11 + Math.sin(st.ph * 0.5) * 1.5, -17); ctx.stroke();
    }
    if (state.night > 0.5) { ctx.fillStyle = 'rgba(220,240,140,0.9)'; ctx.fillRect(sitting ? 3.4 : 9.8, sitting ? -15.6 : -11.6, 1.3, 1.1); }
    ctx.restore();
  }

  smoke(ctx, state) {
    if (!this.chimneys) this.chimneys = this.town.rows.flat().filter((b) => b.chimney && b.row > 0).map((b, i) => ({ x: b.x + b.w * 0.7 + 4.5, y: b.y - b.h - 26, s: b.row === 2 ? 1 : 0.7, ph: i * 1.7, on: i % 3 !== 1 }));
    const col = mix([228, 228, 234], [70, 74, 96], state.night * 0.85);
    ctx.fillStyle = css(col);
    const wind = 6 + this.w.rain * 10;
    for (const c of this.chimneys) {
      if (!c.on) continue;
      for (let k = 0; k < 6; k++) {
        const u = ((this.time * 0.12 + c.ph + k / 6) % 1); // each puff rises over ~8 s
        const x = c.x + u * wind * 4 * c.s + Math.sin(this.time * 0.8 + k + c.ph) * 2 * u, y = c.y - u * 60 * c.s;
        ctx.globalAlpha = 0.5 * (1 - u) * Math.min(1, u * 6);
        ctx.beginPath(); ctx.arc(x, y, (3 + u * 11) * c.s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBirds(ctx, state) {
    const col = css(mix([60, 60, 74], [20, 20, 30], state.night));
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const b of this.birds) {
      const f = Math.sin(this.time * 9 + b.ph) * 5 * b.s;
      ctx.moveTo(b.x - 8 * b.s, b.y - f); ctx.quadraticCurveTo(b.x - 3 * b.s, b.y - 2, b.x, b.y); ctx.quadraticCurveTo(b.x + 3 * b.s, b.y - 2, b.x + 8 * b.s, b.y - f);
    }
    ctx.stroke();
    // birds on the wire between the poles (wire 1 from x=122 to x=842)
    ctx.fillStyle = col;
    for (const wb of this.wireBirds) {
      if (wb.state !== 'sit') continue;
      const u = wb.u, x = 122 + u * 720;
      const t = u, y = (1 - t) * (1 - t) * 310 + 2 * (1 - t) * t * 382 + t * t * 322 - 6 - (wb.hop > 0 ? Math.sin(wb.hop / 0.25 * Math.PI) * 4 : 0);
      ctx.beginPath(); ctx.ellipse(x, y, 5, 4, 0, 0, Math.PI * 2); ctx.arc(x - 4, y - 3, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 9, y + 3); ctx.lineTo(x + 3, y + 2); ctx.fill();
    }
  }

  drawFog(ctx, state, sky) {
    const W = this.w, f = W.fog;
    const col = mix(mix(sky[2], [200, 205, 215], 0.4 * (1 - state.night)), [40, 42, 66], state.night * 0.45);
    const gr = ctx.createLinearGradient(0, 200, 0, G.h);
    gr.addColorStop(0, css(col, 0)); gr.addColorStop(0.4, css(col, f * 0.55)); gr.addColorStop(1, css(col, f * 0.7));
    ctx.fillStyle = gr; ctx.fillRect(0, 200, G.w, G.h);
    // fog banks: the soft sprite tinted to tonight's fog colour (rebuilt only when that colour changes)
    const key = col.map((v) => Math.round(v / 6)).join(',');
    if (key !== this.fogKey) {
      this.fogKey = key;
      const c = this.fogTinted || document.createElement('canvas'); c.width = this.fogSprite.width; c.height = this.fogSprite.height;
      const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; g.drawImage(this.fogSprite, 0, 0);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = css(col); g.fillRect(0, 0, c.width, c.height);
      this.fogTinted = c;
    }
    ctx.globalAlpha = f * (0.55 - state.night * 0.15);
    for (let j = 0; j < 5; j++) {
      const x = ((this.time * (6 + j * 2) + j * 400) % (G.w + 900)) - 450, y = 380 + j * 50;
      ctx.drawImage(this.fogTinted, x, y - 60, 900, 160);
    }
    ctx.globalAlpha = 1;
  }

  precip(ctx, state) {
    const W = this.w;
    if (this.streaks.length) {
      const c = css(mix([236, 240, 250], [130, 140, 170], state.night));
      ctx.strokeStyle = c; ctx.lineWidth = 1.3; ctx.globalAlpha = (0.3 + W.rain * 0.25) * (state.night > 0.5 ? 0.8 : 1);
      ctx.beginPath();
      for (const s of this.streaks) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.l * 0.12, s.y - s.l); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (this.flakes.length) {
      const night = state.night;
      for (const f of this.flakes) { ctx.globalAlpha = (0.55 + f.z * 0.45) * (1 - night * 0.35); const s = f.s * 2.4; ctx.drawImage(this.flakeSprite, f.x - s / 2, f.y - s / 2, s, s); }
      ctx.globalAlpha = 1;
    }
  }

  glass(ctx, state) {
    const W = this.w;
    // the lamp reflected in the right pane at night
    if (state.lamp > 0.01) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = state.lamp * 0.22; ctx.drawImage(this.warmGlow, G.w - 260, 330, 300, 300); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // frost/condensation in the corners when it snows or fogs
    const frost = Math.max(W.snow, W.fog * 0.5) * 0.8;
    if (frost > 0.02) {
      for (const [x, y] of [[0, G.h], [G.w, G.h], [G.w / 2 - 12, G.h], [G.w / 2 + 12, G.h]]) {
        const fg = ctx.createRadialGradient(x, y, 0, x, y, 220);
        fg.addColorStop(0, `rgba(235,240,250,${0.5 * frost})`); fg.addColorStop(1, 'rgba(235,240,250,0)');
        ctx.fillStyle = fg; ctx.fillRect(x - 220, y - 220, 440, 220);
      }
    }
    // rain drops and their trails
    if (this.drops.length) {
      ctx.strokeStyle = 'rgba(210,220,240,0.10)'; ctx.lineWidth = 2;
      for (const d of this.drops) if (d.trail.length > 1) { ctx.beginPath(); ctx.moveTo(d.trail[0][0], d.trail[0][1]); for (const p of d.trail) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
      for (const d of this.drops) { const s = d.r * 2.4, a = Math.min(1, d.life / 8); ctx.globalAlpha = a * (0.7 + 0.3 * (1 - state.night)); ctx.drawImage(this.dropSprite, d.x - s / 2, d.y - s / 2, s, s); }
      ctx.globalAlpha = 1;
    }
  }

  roomLights(ctx, state) {
    const t = this.time, lamp = state.lamp;
    // fairy lights along the curtain rod, draped between hooks
    const hooks = [330, 610, 960, 1310, 1590];
    const on = 0.25 + 0.75 * smooth(0.2, 0.6, state.dark);
    const cols = this.decor === 'holiday' ? ['#ff8a7a', '#ffd27a', '#8fd6a0', '#9cc4ff', '#ffb0d8'] : ['#ffd27a', '#ffb070', '#fff0b0', '#ffc2a0'];
    let n = 0;
    ctx.strokeStyle = 'rgba(40,30,30,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let h = 0; h < hooks.length - 1; h++) { const a = hooks[h], b = hooks[h + 1]; ctx.moveTo(a, 70); ctx.quadraticCurveTo((a + b) / 2, 150, b, 70); }
    ctx.stroke();
    for (let h = 0; h < hooks.length - 1; h++) {
      const a = hooks[h], b = hooks[h + 1];
      for (let j = 1; j < 9; j++) {
        const u = j / 9, x = (1 - u) * (1 - u) * a + 2 * (1 - u) * u * ((a + b) / 2) + u * u * b, y = (1 - u) * (1 - u) * 70 + 2 * (1 - u) * u * 150 + u * u * 70;
        const tw = 0.75 + 0.25 * Math.sin(t * (0.6 + (n % 5) * 0.13) + n * 1.7);
        const c = cols[n % cols.length];
        ctx.fillStyle = c; ctx.globalAlpha = 0.35 + 0.65 * on * tw;
        ctx.beginPath(); ctx.arc(x, y + 5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = on * tw * 0.55;
        ctx.drawImage(this.warmGlow, x - 26, y - 21, 52, 52);
        ctx.globalCompositeOperation = 'source-over';
        n++;
      }
    }
    ctx.globalAlpha = 1;
    // lamp shade glows when it's on
    if (lamp > 0.01) {
      ctx.fillStyle = `rgba(255,214,150,${lamp * 0.85})`;
      ctx.beginPath(); ctx.moveTo(1692, 646); ctx.lineTo(1816, 646); ctx.lineTo(1789, 562); ctx.lineTo(1719, 562); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,236,190,${lamp})`; ctx.fillRect(1700, 644, 108, 4);
    }
    // radio dial glows while the music plays
    const dial = this.playing ? 0.85 + 0.1 * Math.sin(t * 2) : 0.15;
    ctx.fillStyle = `rgba(255,190,110,${dial * 0.9})`; this.round(ctx, 244, 360, 68, 30, 4); ctx.fill();
    ctx.fillStyle = `rgba(120,50,30,${0.6})`; ctx.fillRect(250 + ((t * 2) % 1) * 0 + 34, 364, 2, 22);
    if (this.playing) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.45; ctx.drawImage(this.warmGlow, 278 - 60, 375 - 60, 120, 120); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    // the jack-o'-lantern glows after dark
    if (this.decor === 'pumpkin') {
      const glow = smooth(0.3, 0.6, state.dark) * (0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1));
      if (glow > 0.01) {
        ctx.fillStyle = `rgba(255,190,80,${glow})`;
        ctx.beginPath(); // a friendly face: round eyes, a smile
        ctx.arc(812, SILL_Y - 48, 6, 0, Math.PI * 2); ctx.arc(848, SILL_Y - 48, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(806, SILL_Y - 34); ctx.quadraticCurveTo(830, SILL_Y - 16, 854, SILL_Y - 34); ctx.quadraticCurveTo(830, SILL_Y - 26, 806, SILL_Y - 34); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow * 0.5; ctx.drawImage(this.warmGlow, 830 - 90, SILL_Y - 40 - 90, 180, 180); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    // steam from the mug
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + state.night * 0.06})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let j = 0; j < 3; j++) {
      const ph = t * 0.5 + j * 2.1, x0 = 656 + j * 14;
      ctx.beginPath(); ctx.moveTo(x0, SILL_Y - 92);
      for (let y = 0; y < 70; y += 7) ctx.lineTo(x0 + Math.sin(ph + y * 0.08) * (3 + y * 0.12), SILL_Y - 92 - y);
      ctx.globalAlpha = 0.9; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // a sunbeam at golden hour: the window's shape, mullions and all, thrown onto the wall away from the sun.
    // The window faces south, so an evening (western) sun lands on the left wall and a morning sun on the right.
    const beam = smooth(-1, 3, state.sunAlt) * smooth(22, 8, state.sunAlt) * (1 - this.w.cloud * 0.9) * (1 - this.w.fog);
    if (beam > 0.01) {
      if (!this.beamSprite) { // drawn tiny, then scaled up: the smoothing gives it soft edges for free
        const c = document.createElement('canvas'); c.width = 60; c.height = 100;
        const g = c.getContext('2d');
        g.fillStyle = 'rgb(255,196,130)';
        for (const [x, y, w, h] of [[6, 6, 11, 14], [19, 6, 11, 14], [32, 6, 11, 14], [45, 6, 9, 14], [6, 24, 23, 70], [33, 24, 21, 70]]) g.fillRect(x, y, w, h);
        this.beamSprite = c;
      }
      const west = state.sunAz > 0, k = this.k;
      ctx.save();
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.34 * beam; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const X0 = west ? 40 : 1590, slant = west ? -1.1 : 1.1, sx = 290 / 60, sy = 5.6;
      ctx.setTransform(k * sx, k * slant, 0, k * sy, this.ox + k * X0, this.oy + k * (west ? 250 : 190));
      ctx.drawImage(this.beamSprite, 0, 0);
      ctx.restore();
    }
  }
}
