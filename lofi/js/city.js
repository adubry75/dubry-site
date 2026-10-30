// Lofi Cat Radio: the City view. A skyline of taller buildings (window grids, water tanks, a radio mast),
// neon signs, an elevated railway and a street below. Static parts go into the per-palette caches; lit
// windows, neon, the mast light, the train and the reflections are drawn live.

const W = 980, STREET = 612, RAIL = 545;

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NEON = [['CAFÉ', '#ff7eb6'], ['NOODLES', '#7ef0ff'], ['OPEN', '#ff9e6e'], ['BOOKS', '#b8a2ff'], ['24H', '#9effa8'], ['RECORDS', '#ffd36e'], ['TEA', '#7ef0ff']];

export function buildCity() {
  const r = seeded(77), C = { far: [], near: [], windows: [], signs: [] };
  let x = -20;
  while (x < W + 20) { const w = 40 + r() * 60, h = 140 + r() * 190; C.far.push({ x, w, h, col: ['#8c94a8', '#9aa1b2', '#7f889c'][(r() * 3) | 0], tank: r() < 0.25 }); x += w - 4 + r() * 10; }
  x = -30;
  while (x < W + 30) {
    const w = 70 + r() * 90, h = 120 + r() * 170;
    const b = { x, w, h, col: ['#a77f6c', '#8f8a8f', '#b49a7c', '#7c8794', '#a88a8f', '#6f7a72'][(r() * 6) | 0], tank: r() < 0.35, mast: false };
    C.near.push(b);
    // window grid
    const cols = Math.floor(w / 16), rows = Math.floor((h - 18) / 20);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      if (r() < 0.08) continue;
      C.windows.push({ x: x + 6 + j * ((w - 12) / cols), y: STREET - 30 - h + 12 + i * 20, w: Math.max(5, (w - 12) / cols - 6), h: 10, lit: r() < 0.55, col: r() < 0.12 ? '#b8d0ff' : r() < 0.5 ? '#ffd58c' : '#ffc979', blink: r() < 0.04 ? 20 + r() * 80 : 0, ph: r() * 100 });
    }
    if (r() < 0.6 && C.signs.length < 6) { const [text, col] = NEON[C.signs.length % NEON.length]; C.signs.push({ x: x + w * (0.2 + r() * 0.4), y: STREET - 30 - h * (0.25 + r() * 0.35), text, col, vertical: r() < 0.4, ph: r() * 10, flick: r() < 0.3 }); }
    x += w + 2 + r() * 8;
  }
  const tall = C.near.reduce((a, b) => (b.h > a.h ? b : a));
  tall.mast = true;
  C.train = null; C.nextTrain = 20;
  return C;
}

export function renderCity(g, C, C_, SN) {
  const fill = (style, f) => { g.fillStyle = style; g.beginPath(); f(); g.fill(); };
  for (const b of C.far) {
    if (!SN) fill(C_(b.col, 0.55), () => g.rect(b.x, STREET - 40 - b.h, b.w, b.h + 40));
    else fill(SN(0.55), () => g.rect(b.x - 1, STREET - 40 - b.h - 2, b.w + 2, 3));
    if (b.tank) {
      if (!SN) { fill(C_('#6a5a50', 0.55), () => { g.rect(b.x + b.w * 0.3, STREET - 40 - b.h - 18, 16, 14); g.moveTo(b.x + b.w * 0.3 - 2, STREET - 40 - b.h - 18); g.lineTo(b.x + b.w * 0.3 + 8, STREET - 40 - b.h - 26); g.lineTo(b.x + b.w * 0.3 + 18, STREET - 40 - b.h - 18); }); }
      else fill(SN(0.55), () => { g.moveTo(b.x + b.w * 0.3 - 2, STREET - 40 - b.h - 18); g.lineTo(b.x + b.w * 0.3 + 8, STREET - 40 - b.h - 26); g.lineTo(b.x + b.w * 0.3 + 18, STREET - 40 - b.h - 18); });
    }
  }
  for (const b of C.near) {
    const top = STREET - 30 - b.h;
    if (!SN) {
      fill(C_(b.col, 0.15), () => g.rect(b.x, top, b.w, b.h + 30));
      fill(C_(b.col, 0.15, 0.8), () => g.rect(b.x + b.w * 0.85, top, b.w * 0.15, b.h + 30));
      fill(C_('#5a5560', 0.15), () => g.rect(b.x - 2, top - 4, b.w + 4, 5)); // cornice
      // dark windows (the lit ones are drawn live)
      g.fillStyle = C_('#2e3140', 0.12);
      for (const w of C.windows) if (w.x >= b.x && w.x < b.x + b.w) g.fillRect(w.x, w.y, w.w, w.h);
      // fire escapes on some
      if ((b.x | 0) % 3 === 0) { g.strokeStyle = C_('#3a3438', 0.1); g.lineWidth = 1.2; for (let y = top + 30; y < STREET - 40; y += 40) { g.beginPath(); g.moveTo(b.x + 8, y); g.lineTo(b.x + 34, y); g.moveTo(b.x + 10, y); g.lineTo(b.x + 30, y + 40); g.stroke(); } }
    } else fill(SN(0.15), () => g.rect(b.x - 2, top - 6, b.w + 4, 4));
    if (b.tank) {
      const tx = b.x + b.w * 0.6, ty = top - 4;
      if (!SN) {
        fill(C_('#4a3a32', 0.15), () => { g.rect(tx + 2, ty - 10, 2, 10); g.rect(tx + 18, ty - 10, 2, 10); });
        fill(C_('#7a5a44', 0.15), () => g.rect(tx, ty - 30, 22, 20));
        fill(C_('#5a4234', 0.15), () => { g.moveTo(tx - 2, ty - 30); g.lineTo(tx + 11, ty - 40); g.lineTo(tx + 24, ty - 30); g.closePath(); });
      } else fill(SN(0.15), () => { g.moveTo(tx - 2, ty - 30); g.lineTo(tx + 11, ty - 40); g.lineTo(tx + 24, ty - 30); g.closePath(); });
    }
    if (b.mast && !SN) { fill(C_('#3a3a44', 0.15), () => { g.rect(b.x + b.w / 2 - 1.5, top - 70, 3, 70); g.rect(b.x + b.w / 2 - 8, top - 50, 16, 2); g.rect(b.x + b.w / 2 - 5, top - 32, 10, 2); }); }
  }
  if (!SN) {
    // elevated railway: deck and pillars
    fill(C_('#4a4650', 0.05), () => { g.rect(0, RAIL, W, 9); for (let x = 30; x < W; x += 120) g.rect(x, RAIL + 9, 8, STREET - RAIL - 9); });
    fill(C_('#625c66', 0.05), () => g.rect(0, RAIL - 2, W, 3));
    // street
    fill(C_('#55525c', 0.03), () => g.rect(0, STREET, W, 60));
    fill(C_('#7a7680', 0.03), () => g.rect(0, STREET - 4, W, 6));
    g.strokeStyle = C_('#d8cfae', 0.04); g.lineWidth = 2; g.setLineDash([20, 24]); g.beginPath(); g.moveTo(0, 640); g.lineTo(W, 640); g.stroke(); g.setLineDash([]);
  } else {
    fill(SN(0.05), () => g.rect(0, RAIL - 4, W, 4));
    fill(SN(0.03), () => { g.rect(0, STREET - 4, W, 5); g.rect(0, 650, W, 12); });
  }
}

// live: lit windows, neon, mast light, the train, wet reflections. Glass coordinates.
export function cityLive(ctx, C, scene, state, glow) {
  const t = scene.time, dt = scene.dt || 1 / 60, dark = state.dark, W2 = scene.w;
  const on = Math.min(1, Math.max(0, (dark - 0.25) * 2.5));
  // windows: most lit after dusk, fewer deep in the night, a few flicker like a TV
  if (on > 0.01) {
    const late = state.hour >= 1 && state.hour < 6 ? 0.45 : 1;
    for (const w of C.windows) {
      if (!w.lit) continue;
      if (late < 1 && (w.ph * 7) % 1 > late) continue;
      let a = on * 0.95;
      if (w.blink) a *= 0.75 + 0.25 * Math.sin(t * 6 + w.ph) * Math.sin(t * 2.3 + w.ph);
      ctx.globalAlpha = a; ctx.fillStyle = w.col; ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.globalAlpha = 1;
  }
  // neon signs: on from dusk, a gentle hum of brightness, one or two that stutter now and then
  const neon = Math.min(1, Math.max(0, (dark - 0.15) * 2));
  const wet = Math.max(W2.rain, scene.wetRoad || 0);
  if (neon > 0.01) {
    ctx.font = '600 13px ui-rounded, "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of C.signs) {
      let a = neon * (0.85 + 0.15 * Math.sin(t * 1.3 + s.ph));
      if (s.flick && Math.sin(t * 0.37 + s.ph) > 0.97) a *= (Math.sin(t * 40) > 0 ? 0.25 : 1);
      ctx.save(); ctx.translate(s.x, s.y);
      if (s.vertical) ctx.rotate(Math.PI / 2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.5; ctx.drawImage(glow, -s.text.length * 6 - 12, -22, s.text.length * 12 + 24, 44);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a; ctx.fillStyle = s.col; ctx.shadowColor = s.col; ctx.shadowBlur = 8;
      ctx.fillText(s.text, 0, 0);
      ctx.restore();
      if (wet > 0.05 && !s.vertical) { // its smear on the wet street
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * wet * 0.35;
        ctx.fillStyle = s.col; ctx.fillRect(s.x - s.text.length * 4, STREET + 6, s.text.length * 8, 30);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // the mast's red light, slow blink
  const mast = C.near.find((b) => b.mast);
  if (mast && (t % 2.4) < 0.5) {
    const x = mast.x + mast.w / 2, y = STREET - 30 - mast.h - 72;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 + 0.4 * dark; ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5 * dark; ctx.drawImage(glow, x - 12, y - 12, 24, 24); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // the train
  C.nextTrain -= dt;
  if (!C.train && C.nextTrain <= 0) {
    const dir = scene.r() < 0.5 ? 1 : -1, v = 70 + scene.r() * 30, cars = 3 + ((scene.r() * 2) | 0);
    C.train = { x: dir > 0 ? -cars * 92 - 20 : W + 20, dir, v, cars };
    if (scene.onTrain) scene.onTrain((W + cars * 92 + 40) / v, dir); // tell the sound how long it takes to cross
  }
  if (C.train) {
    const tr = C.train; tr.x += tr.dir * tr.v * dt;
    const len = tr.cars * 92, x0 = tr.x;
    for (let k = 0; k < tr.cars; k++) {
      const cx = x0 + k * 92;
      ctx.fillStyle = `rgb(${Math.round(170 - 120 * dark)},${Math.round(176 - 124 * dark)},${Math.round(186 - 120 * dark)})`;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx, RAIL - 26, 88, 24, 5) : ctx.rect(cx, RAIL - 26, 88, 24); ctx.fill();
      for (let j = 0; j < 6; j++) { ctx.globalAlpha = 0.35 + 0.65 * on; ctx.fillStyle = on > 0.3 ? '#ffe3a6' : '#5a6070'; ctx.fillRect(cx + 6 + j * 14, RAIL - 21, 10, 8); }
      ctx.globalAlpha = 1;
    }
    if ((tr.dir > 0 && x0 > W + 20) || (tr.dir < 0 && x0 + len < -20)) { C.train = null; C.nextTrain = 35 + scene.r() * 70; }
  }
}
