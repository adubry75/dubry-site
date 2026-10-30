// Lofi Cat Radio: the Lake view. A forested lakeshore under the same distant volcano, as an alternative to
// the town. Static parts are drawn into the per-palette caches (like the town); the water's shimmer, the
// sun or moon path, rain ripples, the cabin's lit window and the deer are drawn live.

const W = 980, WATER_TOP = 485, SHORE = 600;

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildLake() {
  const r = seeded(91), L = { rows: [], reeds: [] };
  // three bands of pines on the far hills, back to front
  for (const [y0, n, s, depth] of [[432, 60, 0.55, 0.62], [458, 46, 0.8, 0.42], [480, 36, 1.05, 0.22]]) {
    const row = [];
    for (let i = 0; i < n; i++) row.push({ x: (i / n) * (W + 60) - 30 + r() * 14, y: y0 + Math.sin(i * 0.7 + y0) * 6 + r() * 6, s: s * (0.75 + r() * 0.5), hue: r(), depth });
    L.rows.push(row);
  }
  L.cabin = { x: 300, y: 480 };
  for (let i = 0; i < 40; i++) L.reeds.push({ x: r() * W, h: 10 + r() * 22, lean: (r() - 0.5) * 0.5 });
  return L;
}

// draw the static lake scene for one palette. C(hex, depth, mul) lights a colour, SN(depth) is snow, or null.
export function renderLake(g, L, C, SN, season, sky) {
  const fill = (style, f) => { g.fillStyle = style; g.beginPath(); f(); g.fill(); };
  // water: a vertical gradient taking the sky's colours (darker, a little greener)
  if (!SN) {
    const wg = g.createLinearGradient(0, WATER_TOP, 0, SHORE);
    wg.addColorStop(0, C('#8fa6bd', 0.3)); wg.addColorStop(1, C('#4a6070', 0.05));
    g.fillStyle = wg; g.fillRect(0, WATER_TOP - 2, W, SHORE - WATER_TOP + 4);
  }
  // pine bands (and their mirror images in the water)
  const pine = (t, mirror) => {
    const col = C(t.hue < 0.5 ? '#3f5e4a' : '#4a6a50', t.depth);
    g.fillStyle = SN ? SN(t.depth) : col;
    const s = t.s, x = t.x, y = t.y, dir = mirror ? -1 : 1, base = mirror ? WATER_TOP + (WATER_TOP - y) : y;
    for (let k = 0; k < 3; k++) {
      const w = (24 - k * 6.5) * s, ty = base - dir * (12 + k * 15) * s;
      g.beginPath();
      if (SN && !mirror) { g.moveTo(x - w * 0.6, ty + 5 * s); g.lineTo(x, ty - 13 * s); g.lineTo(x + w * 0.6, ty + 5 * s); g.quadraticCurveTo(x, ty + 1 * s, x - w * 0.6, ty + 5 * s); }
      else { g.moveTo(x - w, ty + dir * 16 * s); g.lineTo(x, ty - dir * 13 * s); g.lineTo(x + w, ty + dir * 16 * s); }
      g.closePath(); g.fill();
    }
  };
  if (!SN) { // reflections first, faint, then a haze over them
    g.save(); g.beginPath(); g.rect(0, WATER_TOP, W, SHORE - WATER_TOP); g.clip();
    g.globalAlpha = 0.35; for (const row of L.rows) for (const t of row) pine(t, true);
    g.globalAlpha = 1; g.restore();
  }
  // the far shore's ground under the trees
  if (!SN) fill(C('#4c5f48', 0.3), () => { g.moveTo(0, WATER_TOP + 2); for (let x = 0; x <= W; x += 40) g.lineTo(x, WATER_TOP - 6 + Math.sin(x * 0.02) * 3); g.lineTo(W, WATER_TOP + 2); g.closePath(); });
  else { g.globalAlpha = 0.85; fill(SN(0.3), () => { g.moveTo(0, WATER_TOP + 1); for (let x = 0; x <= W; x += 40) g.lineTo(x, WATER_TOP - 6 + Math.sin(x * 0.02) * 3); g.lineTo(W, WATER_TOP + 1); g.closePath(); }); g.globalAlpha = 1; }
  for (const row of L.rows) {
    for (const t of row) if (!(Math.abs(t.x - L.cabin.x) < 40 && t.depth < 0.3)) pine(t, false);
  }
  // the cabin on the far shore (its window is lit live)
  const c = L.cabin;
  if (!SN) {
    fill(C('#6e4a38', 0.18), () => g.rect(c.x - 22, c.y - 20, 44, 20));
    fill(C('#4a3a40', 0.18), () => { g.moveTo(c.x - 28, c.y - 18); g.lineTo(c.x, c.y - 36); g.lineTo(c.x + 28, c.y - 18); g.closePath(); });
    fill(C('#5a4a42', 0.18), () => g.rect(c.x + 10, c.y - 40, 6, 14));
    fill(C('#2a2833', 0.18), () => g.rect(c.x - 10, c.y - 14, 9, 8));
    fill(C('#3a2e2a', 0.18), () => g.rect(c.x + 4, c.y - 13, 7, 13));
  } else fill(SN(0.18), () => { g.moveTo(c.x - 28, c.y - 18); g.lineTo(c.x, c.y - 36); g.lineTo(c.x + 28, c.y - 18); g.lineTo(c.x + 24, c.y - 16); g.lineTo(c.x, c.y - 31); g.lineTo(c.x - 24, c.y - 16); g.closePath(); });
  // near shore: grass bank, reeds, a little dock and a canoe
  if (!SN) {
    fill(C(season === 'autumn' ? '#7d7a4a' : season === 'winter' ? '#6f7360' : '#5f7d4a', 0.02), () => { g.moveTo(0, SHORE + 8); for (let x = 0; x <= W; x += 30) g.lineTo(x, SHORE - 2 + Math.sin(x * 0.03) * 4); g.lineTo(W, 660); g.lineTo(0, 660); g.closePath(); });
    g.strokeStyle = C('#5d6e40', 0.02); g.lineWidth = 1.6;
    g.beginPath(); for (const rd of L.reeds) { const x = rd.x, y = SHORE + 2; g.moveTo(x, y); g.quadraticCurveTo(x + rd.lean * 6, y - rd.h * 0.6, x + rd.lean * 10, y - rd.h); } g.stroke();
    // dock
    fill(C('#7a5a40', 0.02), () => { g.moveTo(376, SHORE + 2); g.lineTo(436, SHORE + 2); g.lineTo(412, 548); g.lineTo(388, 548); g.closePath(); });
    g.strokeStyle = C('#5a3f2c', 0.02); g.lineWidth = 1; g.beginPath(); for (let y = 554; y < SHORE; y += 8) { const u = (y - 548) / (SHORE - 548); g.moveTo(388 - u * 12, y); g.lineTo(412 + u * 24, y); } g.stroke();
    fill(C('#4a3626', 0.02), () => { g.rect(387, 544, 3, 14); g.rect(410, 544, 3, 14); });
    // canoe tied to the dock
    fill(C('#b8583a', 0.02), () => { g.moveTo(436, 572); g.quadraticCurveTo(486, 584, 536, 572); g.quadraticCurveTo(486, 578, 436, 572); });
    fill(C('#8a3f2a', 0.02), () => { g.moveTo(440, 573); g.quadraticCurveTo(486, 580, 532, 573); g.lineTo(526, 571); g.quadraticCurveTo(486, 576, 446, 571); g.closePath(); });
  } else {
    g.globalAlpha = 0.9; fill(SN(0.02), () => { g.moveTo(0, SHORE + 8); for (let x = 0; x <= W; x += 30) g.lineTo(x, SHORE - 2 + Math.sin(x * 0.03) * 4); g.lineTo(W, 660); g.lineTo(0, 660); g.closePath(); }); g.globalAlpha = 1;
    fill(SN(0.02), () => { g.moveTo(388, 547); g.lineTo(412, 547); g.lineTo(413, 550); g.lineTo(387, 550); g.closePath(); });
  }
}

// live parts, in glass coordinates. glow: a soft warm sprite; state: the frame state.
export function lakeLive(ctx, L, scene, state, glow, sky) {
  const t = scene.time, W2 = scene.w, dt = scene.dt || 1 / 60;
  // shimmer: thin light lines drifting on the water
  ctx.strokeStyle = state.night > 0.6 ? 'rgba(170,180,230,0.10)' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 26; i++) {
    const y = WATER_TOP + 8 + (i * 37 % (SHORE - WATER_TOP - 10)), x = ((i * 173 + t * (6 + (i % 5))) % (W + 120)) - 60, len = 20 + (i * 13 % 40);
    ctx.moveTo(x, y); ctx.lineTo(x + len, y);
  }
  ctx.stroke();
  // the sun's or moon's path on the water
  const bodies = [];
  if (state.sunAlt > -1) bodies.push([scene.skyXY(state.sunAz, state.sunAltR)[0], state.night > 0.5 ? 0 : 1, 'rgba(255,214,150,']);
  if (state.moonAlt > 0 && state.sunAlt < 2) bodies.push([scene.skyXY(state.moonAz, state.moonAlt)[0], 0.55 * state.moonFraction, 'rgba(220,226,255,']);
  const clear = 1 - Math.min(1, W2.cloud * 0.8 + W2.fog * 0.7 + W2.rain * 0.5);
  for (const [bx, a0, rgb] of bodies) {
    const a = a0 * clear; if (a < 0.02 || bx < -40 || bx > W + 40) continue;
    for (let k = 0; k < 14; k++) {
      const y = WATER_TOP + 4 + k * 7.5, wob = Math.sin(t * 1.3 + k * 1.7) * 6, w = 6 + k * 2.2 + Math.sin(t * 2 + k) * 3;
      ctx.fillStyle = rgb + (a * (0.55 - k * 0.03)).toFixed(3) + ')'; ctx.fillRect(bx - w / 2 + wob, y, w, 2.2);
    }
  }
  // rain rings on the water
  if (W2.rain > 0.05) {
    if (!scene.rings) scene.rings = [];
    const rr = scene.r;
    if (rr() < W2.rain * 54 * dt) scene.rings.push({ x: rr() * W, y: WATER_TOP + 6 + rr() * (SHORE - WATER_TOP - 12), t: 0 });
    for (const g of scene.rings) {
      g.t += dt; const u = g.t / 1.2;
      ctx.lineWidth = 1; ctx.strokeStyle = (state.night > 0.5 ? 'rgba(180,190,230,' : 'rgba(255,255,255,') + (0.35 * (1 - u)).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(g.x, g.y, 2 + u * 12, 0.6 + u * 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    scene.rings = scene.rings.filter((g) => g.t < 1.2);
  } else if (scene.rings) scene.rings.length = 0;
  // the cabin's window, lit after dusk (and its glow on the water)
  const c = L.cabin, lit = Math.max(0, Math.min(1, (state.dark - 0.35) * 4));
  if (lit > 0.01 && !(state.hour >= 1.5 && state.hour < 5.5)) {
    ctx.fillStyle = `rgba(255,205,130,${lit})`; ctx.fillRect(c.x - 10, c.y - 14, 9, 8);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = lit * 0.45; ctx.drawImage(glow, c.x - 26, c.y - 30, 40, 40);
    ctx.globalAlpha = lit * 0.25; ctx.drawImage(glow, c.x - 16, WATER_TOP + 4, 20, 36);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // smoke from the cabin's chimney
  ctx.fillStyle = state.night > 0.5 ? 'rgba(80,84,104,1)' : 'rgba(230,230,236,1)';
  for (let k = 0; k < 6; k++) {
    const u = (t * 0.1 + k / 6) % 1;
    ctx.globalAlpha = 0.45 * (1 - u) * Math.min(1, u * 6);
    ctx.beginPath(); ctx.arc(c.x + 13 + u * 18, c.y - 42 - u * 50, 2.5 + u * 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // a deer wanders along the far shore at dawn or dusk, now and then
  const twilight = state.dark > 0.15 && state.dark < 0.75;
  if (!scene.deer && twilight && scene.r() < dt / 240) { const dir = scene.r() < 0.5 ? 1 : -1; scene.deer = { x: dir > 0 ? -20 : W + 20, dir, ph: 0, stop: 0.3 + scene.r() * 0.4, grazed: 0 }; }
  const d = scene.deer;
  if (d) {
    const along = d.dir > 0 ? d.x / W : 1 - d.x / W;
    if (along > d.stop && d.grazed < 8) d.grazed += dt; else { d.x += d.dir * 21 * dt; d.ph += 5.4 * dt; }
    if (d.x < -30 || d.x > W + 30) scene.deer = null;
    const grazing = along > d.stop && d.grazed < 8, y = WATER_TOP - 5;
    ctx.save(); ctx.translate(d.x, y); ctx.scale(d.dir * 0.9, 0.9);
    const k = Math.min(1, state.dark * 1.2); // fades into the dusk
    ctx.fillStyle = `rgb(${Math.round(122 - 80 * k)},${Math.round(90 - 52 * k)},${Math.round(68 - 22 * k)})`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    const a = grazing ? 0 : Math.sin(d.ph) * 2, b = -a;
    ctx.beginPath(); ctx.moveTo(5, -8); ctx.lineTo(5 + a, 0); ctx.moveTo(3, -8); ctx.lineTo(3 + b, 0); ctx.moveTo(-5, -8); ctx.lineTo(-5 + b, 0); ctx.moveTo(-7, -8); ctx.lineTo(-7 + a, 0); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-1, -10, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    if (grazing) { ctx.beginPath(); ctx.moveTo(5, -11); ctx.lineTo(10, -3); ctx.lineWidth = 2.4; ctx.stroke(); ctx.beginPath(); ctx.ellipse(11, -2.5, 2.4, 1.6, 0.5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(5, -11); ctx.lineTo(8, -17); ctx.lineWidth = 2.4; ctx.stroke(); ctx.beginPath(); ctx.ellipse(10, -18, 3, 1.8, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, -20); ctx.lineTo(6.5, -23); ctx.moveTo(9, -20); ctx.lineTo(10, -23.5); ctx.stroke(); }
    ctx.restore();
  }
}
