// The cat: drawn in code (bezier shapes + gradients), with a small behaviour model.
// Local units: origin at the front edge of the sill under the cat's chest, y up is negative. Faces left.

export const SKINS = {
  daisy: { name: 'Daisy', base: '#25222a', shade: '#121016', light: '#4a4552', socks: '#f1ece4', socksShade: '#c9c2b8', eye: '#c9d65e', inner: '#8a5a63', nose: '#3b3036', whisker: 'rgba(240,235,230,0.55)' },
  nero: { name: 'Nero', base: '#d8c09c', shade: '#b39874', light: '#f0e2c8', muzzle: '#f2e8d6', eye: '#d9a441', inner: '#e8a8a0', nose: '#d98c84', whisker: 'rgba(255,255,255,0.75)' },
  jammies: { name: 'Jammies', base: '#e08a3e', shade: '#b8642a', light: '#f5b673', stripe: '#b25a22', muzzle: '#f6d9b0', eye: '#a8c255', inner: '#e8a090', nose: '#d97a6e', whisker: 'rgba(255,250,240,0.8)' },
  callie: { name: 'Callie / Soybean', base: '#efe3cd', shade: '#cdbb9e', light: '#fbf4e6', point: '#4a382f', pointSoft: 'rgba(74,56,47,0)', eye: '#6aa7e0', inner: '#7a5e54', nose: '#5b4640', whisker: 'rgba(255,255,255,0.8)' },
  black: { name: 'Solid black', base: '#1d1b21', shade: '#0e0d11', light: '#3d3a46', eye: '#d7c25a', inner: '#5e4650', nose: '#2c2529', whisker: 'rgba(220,220,230,0.45)' },
};
export const SKIN_IDS = Object.keys(SKINS);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ease = (t) => t * t * (3 - 2 * t);

// Multiply a hex/rgba colour by a light [r,g,b] (0..1.3) for the room's lighting.
const cache = new Map();
function parse(c) {
  if (cache.has(c)) return cache.get(c);
  let v;
  if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
  else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], m[3] ?? 1]; }
  cache.set(c, v); return v;
}
export function lit(c, L, alpha) {
  const [r, g, b, a] = parse(c);
  return `rgba(${Math.min(255, r * L[0]) | 0},${Math.min(255, g * L[1]) | 0},${Math.min(255, b * L[2]) | 0},${alpha ?? a})`;
}

// ── Behaviour
export class CatBrain {
  constructor(rand) {
    this.r = rand;
    this.state = 'sleep'; this.stateLeft = 40 + rand() * 60;
    // smoothed pose parameters
    this.p = { head: 0, eyes: 0, paws: 0.35, yawn: 0, stretch: 0, earL: 0, earR: 0, lookX: 0, lookY: 0, tail: 0, curl: 0 };
    this.t = { head: 0, eyes: 0, paws: 0.35, yawn: 0, stretch: 0, lookX: 0, lookY: 0 };
    this.action = null; this.actionT = 0; this.nextAction = 8 + rand() * 10;
    this.blinkT = 3; this.blink = 0;
    this.ear = [0, 0]; this.earT = [0, 0]; this.nextEar = 4 + rand() * 8;
    this.flick = 0; this.nextFlick = 3 + rand() * 6;
    this.breath = 0;
    this.attention = null; // {x,y} in cat-local coords to look at
  }
  wake() { if (this.state === 'sleep') { this.state = 'awake'; this.stateLeft = 50 + this.r() * 90; this.start('yawn'); } }
  start(a) { this.action = a; this.actionT = 0; }
  update(dt, look) {
    const r = this.r, t = this.t, p = this.p;
    this.breath += dt * (this.state === 'sleep' ? 0.23 : 0.3) * Math.PI * 2;
    this.stateLeft -= dt;
    if (this.stateLeft <= 0 && !this.action) {
      if (this.state === 'sleep') this.wake();
      else { this.state = 'sleep'; this.stateLeft = 90 + r() * 200; if (r() < 0.4) this.start('stretch'); }
    }
    const awake = this.state === 'awake';
    t.head = awake ? 1 : 0; t.eyes = awake ? 0.85 : 0; t.paws = awake ? 0.7 : 0.35;
    t.yawn = 0; t.stretch = 0;
    // occasional actions
    this.nextAction -= dt;
    if (!this.action && this.nextAction <= 0) {
      this.nextAction = 25 + r() * 60;
      const roll = r();
      if (awake) this.start(roll < 0.35 ? 'yawn' : roll < 0.55 ? 'stretch' : roll < 0.8 ? 'look' : 'slowblink');
      else if (roll < 0.25) this.start('stirr'); else if (roll < 0.4) this.start('dreamtwitch');
    }
    if (this.action) {
      const a = this.action; this.actionT += dt; const k = this.actionT;
      const bell = (dur) => Math.sin(Math.PI * clamp(k / dur, 0, 1));
      if (a === 'yawn') { const d = 3.2; t.yawn = ease(clamp(bell(d) * 1.4, 0, 1)); t.head = 1; t.eyes = 0; if (k > d) this.action = null; }
      else if (a === 'stretch') { const d = 4.5; t.stretch = ease(clamp(bell(d) * 1.3, 0, 1)); t.eyes = 0.1; if (k > d) this.action = null; }
      else if (a === 'look') { const d = 6; const s = Math.sin(k * 0.9); t.lookX = s * 0.8; t.lookY = -0.2; if (k > d) { this.action = null; } }
      else if (a === 'slowblink') { const d = 2.6; t.eyes = 0.85 * (1 - ease(bell(d))); if (k > d) this.action = null; }
      else if (a === 'stirr') { const d = 5; t.head = 0.25 * bell(d); t.eyes = 0.25 * clamp(bell(d) * 2 - 1, 0, 1); if (k > d) this.action = null; }
      else if (a === 'dreamtwitch') { this.ear[0] = Math.sin(k * 40) * 0.12 * (1 - k); this.flick = Math.max(this.flick, 0.5); if (k > 1) this.action = null; }
    }
    if (look && awake && !this.action) { t.lookX = clamp(look.x, -1, 1); t.lookY = clamp(look.y, -1, 1); }
    else if (!this.action || this.action !== 'look') { t.lookX *= 0.98; t.lookY *= 0.98; }
    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.18; this.blinkT = 2.5 + r() * 6; }
    this.blink = Math.max(0, this.blink - dt);
    // ear twitches
    this.nextEar -= dt;
    if (this.nextEar <= 0) { const i = r() < 0.5 ? 0 : 1; this.earT[i] = 0.35; this.nextEar = (awake ? 4 : 7) + r() * 14; }
    for (let i = 0; i < 2; i++) { this.earT[i] = Math.max(0, this.earT[i] - dt); this.ear[i] = this.earT[i] > 0 ? Math.sin((0.35 - this.earT[i]) / 0.35 * Math.PI * 3) * 0.22 : this.ear[i] * 0.85; }
    // tail flicks
    this.nextFlick -= dt;
    if (this.nextFlick <= 0) { this.flick = 1; this.nextFlick = (awake ? 3 : 6) + r() * 10; }
    this.flick = Math.max(0, this.flick - dt * 0.9);
    // smooth everything (critically damped-ish)
    const k = 1 - Math.exp(-dt * 2.2), kf = 1 - Math.exp(-dt * 5);
    for (const key of ['head', 'paws', 'stretch', 'lookX', 'lookY']) p[key] += (t[key] - p[key]) * k;
    p.eyes += (t.eyes - p.eyes) * kf; p.yawn += (t.yawn - p.yawn) * kf;
    p.earL = this.ear[0]; p.earR = this.ear[1];
  }
}

// ── Drawing
// light: [r,g,b] multiplier for the room light at the cat; rim: {color, alpha} backlight from the window;
// warm: 0..1 lamp glow from the right side.
export function drawCat(ctx, x, y, s, skinId, brain, time, light, rim, eyeGlow = 0) {
  const S = SKINS[skinId] || SKINS.daisy;
  const p = brain.p, L = light;
  const br = Math.sin(brain.breath) * (brain.state === 'sleep' ? 1 : 0.6);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const st = p.stretch;
  const C = (c) => lit(c, L);

  // ground shadow
  ctx.fillStyle = `rgba(20,10,20,${0.28})`;
  ctx.beginPath(); ctx.ellipse(20, 2, 200, 10, 0, 0, Math.PI * 2); ctx.fill();

  // tail (behind the body: drapes over the sill's front edge)
  drawTail(ctx, S, p, brain, time, C);

  // body
  const backY = -104 - br * 2.4 + st * 18, chestX = -92 - st * 6, rumpY = -116 - br * 1.6 - st * 26;
  const body = new Path2D();
  body.moveTo(chestX + 4, 0);
  body.bezierCurveTo(chestX - 20, -14, chestX - 24, -72, chestX + 10, backY + 6);
  body.bezierCurveTo(-30, backY - 12, 40, backY - 8, 92, rumpY);
  body.bezierCurveTo(140, rumpY + 2, 162, -66, 150, -18);
  body.bezierCurveTo(144, -4, 132, 0, 122, 0);
  body.closePath();
  ctx.fillStyle = C(S.base); ctx.fill(body);
  ctx.save(); ctx.clip(body);
  let g = ctx.createLinearGradient(0, rumpY, 0, 0);
  g.addColorStop(0, C(S.light)); g.addColorStop(0.35, C(S.base)); g.addColorStop(1, C(S.shade));
  ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.fillRect(-160, -170, 360, 175); ctx.globalAlpha = 1;
  if (S.stripe) { // tabby stripes across the back
    ctx.strokeStyle = C(S.stripe); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55;
    for (let i = 0; i < 7; i++) { const sx = -40 + i * 28; ctx.beginPath(); ctx.moveTo(sx, backY - 6); ctx.quadraticCurveTo(sx + 12, backY + 30, sx + 4, backY + 56 - i * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (S.point) { // siamese: darker towards the rump and haunch
    g = ctx.createRadialGradient(170, -30, 10, 170, -30, 120);
    g.addColorStop(0, lit(S.point, L, 0.55)); g.addColorStop(1, lit(S.point, L, 0));
    ctx.fillStyle = g; ctx.fillRect(40, -170, 160, 175);
  }
  if (S.muzzle) { // lighter chest
    g = ctx.createRadialGradient(chestX - 4, -30, 6, chestX - 4, -30, 75);
    g.addColorStop(0, lit(S.muzzle, L, 0.55)); g.addColorStop(1, lit(S.muzzle, L, 0));
    ctx.fillStyle = g; ctx.fillRect(chestX - 60, -110, 130, 115);
  }
  // haunch line
  ctx.strokeStyle = C(S.shade); ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(62, -4); ctx.bezierCurveTo(68, -72, 134, -86, 144, -30); ctx.stroke();
  ctx.globalAlpha = 1;
  // rim light from the window behind
  if (rim && rim.alpha > 0.01) { // backlight from the window: only the top edges catch it
    const rg = ctx.createLinearGradient(0, rumpY - 6, 0, -50);
    rg.addColorStop(0, rim.color); rg.addColorStop(1, rim.color.replace(/[\d.]+\)$/, '0)'));
    ctx.strokeStyle = rg; ctx.globalAlpha = rim.alpha; ctx.lineWidth = 8; ctx.stroke(body); ctx.globalAlpha = 1;
  }
  ctx.restore();

  // hind paw
  paw(ctx, 112, -4, 26, 13, S, C, 0);
  // front paws (tucked → sphinx → stretched)
  const reach = lerp(0, 54, clamp(p.paws, 0, 1)) + st * 60;
  for (const [dx, dy] of [[0, 0], [26, 3]]) {
    const px = chestX - reach + dx + 10, py = -7 + dy;
    ctx.fillStyle = C(S.point || S.base);
    ctx.beginPath(); ctx.moveTo(chestX + 20 + dx, -36); ctx.quadraticCurveTo(px + 20, -22, px + 8, py - 12); ctx.lineTo(px + 30, py + 6); ctx.quadraticCurveTo(chestX + 40 + dx, -6, chestX + 36 + dx, -40); ctx.fill();
    paw(ctx, px + 10, py, 22, 12, S, C, st);
  }

  // head
  const hx = lerp(-112, -122, 1 - p.head) - st * 34 + p.lookX * 4;
  const hy = lerp(-58, -128, p.head) - br * 1.6 + st * 36 + p.yawn * -6;
  const tilt = lerp(-0.22, 0, p.head) + p.yawn * 0.16 + p.lookX * 0.05 - st * 0.1;
  drawHead(ctx, hx, hy, tilt, S, p, brain, C, rim, eyeGlow);
  ctx.restore();
}

function paw(ctx, x, y, rx, ry, S, C, st) {
  const col = S.socks || S.point || S.base;
  ctx.fillStyle = C(col);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C(S.socksShade || S.shade); ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6;
  const spread = 1 + st * 0.6;
  for (const k of [-0.33, 0, 0.33]) { ctx.beginPath(); ctx.moveTo(x - rx * 0.92, y + k * ry * 1.4 * spread); ctx.lineTo(x - rx * 0.55, y + k * ry * spread); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function drawTail(ctx, S, p, brain, time, C) {
  // spine: from the rump, over the edge, hanging down with a curl at the tip
  const pts = [];
  const sway = Math.sin(time * 0.7) * 0.12 + brain.flick * Math.sin(time * 9) * 0.35;
  const N = 18;
  let x = 134, y = -26, ang = 0.35;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    pts.push([x, y]);
    const curl = u > 0.6 ? (u - 0.6) * 2.4 * (0.8 + 0.4 * Math.sin(time * 0.5)) : 0;
    ang += (u < 0.15 ? 0.13 : 0.02) + curl * 0.32 * (1 + sway) - sway * 0.05 * u;
    const segLen = 11;
    x += Math.cos(ang) * segLen; y += Math.sin(ang) * segLen;
  }
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const w = lerp(15, 9, i / (pts.length - 1));
    left.push([pts[i][0] - dy / len * w, pts[i][1] + dx / len * w]);
    right.push([pts[i][0] + dy / len * w, pts[i][1] - dx / len * w]);
  }
  const path = new Path2D();
  path.moveTo(left[0][0], left[0][1]);
  for (const q of left) path.lineTo(q[0], q[1]);
  const tip = pts[pts.length - 1];
  path.arc(tip[0], tip[1], 9, Math.atan2(left[left.length - 1][1] - tip[1], left[left.length - 1][0] - tip[0]), Math.atan2(right[right.length - 1][1] - tip[1], right[right.length - 1][0] - tip[0]), true);
  for (let i = right.length - 1; i >= 0; i--) path.lineTo(right[i][0], right[i][1]);
  path.closePath();
  ctx.fillStyle = C(S.point || S.base); ctx.fill(path);
  ctx.save(); ctx.clip(path);
  if (S.stripe) { ctx.strokeStyle = C(S.stripe); ctx.lineWidth = 8; ctx.globalAlpha = 0.6; for (let i = 3; i < pts.length - 1; i += 3) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 16, 0, Math.PI * 2); ctx.stroke(); } ctx.globalAlpha = 1; }
  ctx.strokeStyle = C(S.shade); ctx.globalAlpha = 0.5; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(right[0][0], right[0][1]); for (const q of right) ctx.lineTo(q[0], q[1]); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawHead(ctx, hx, hy, tilt, S, p, brain, C, rim, eyeGlow) {
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt); ctx.scale(1.12, 1.12);
  const yawn = p.yawn;
  // ears (behind the head)
  const earBack = yawn * 0.3;
  ear(ctx, -1, p.earL - earBack, S, C);
  ear(ctx, 1, -p.earR + earBack, S, C);
  // head shape with cheek fluff
  const head = new Path2D();
  head.moveTo(0, -56);
  head.bezierCurveTo(40, -57, 62, -36, 64, -6);
  head.bezierCurveTo(70, 8, 64, 22, 56, 26);
  head.bezierCurveTo(44, 44, 20, 50, 0, 50);
  head.bezierCurveTo(-20, 50, -44, 44, -56, 26);
  head.bezierCurveTo(-64, 22, -70, 8, -64, -6);
  head.bezierCurveTo(-62, -36, -40, -57, 0, -56);
  ctx.fillStyle = C(S.base); ctx.fill(head);
  ctx.save(); ctx.clip(head);
  let g = ctx.createLinearGradient(0, -56, 0, 50);
  g.addColorStop(0, C(S.light)); g.addColorStop(0.5, C(S.base)); g.addColorStop(1, C(S.shade));
  ctx.globalAlpha = 0.45; ctx.fillStyle = g; ctx.fillRect(-70, -60, 140, 112); ctx.globalAlpha = 1;
  if (S.point) { // siamese mask
    g = ctx.createRadialGradient(0, 20, 3, 0, 18, 40);
    g.addColorStop(0, C(S.point).replace(/[\d.]+\)$/, '0.92)')); g.addColorStop(0.5, C(S.point).replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, C(S.point).replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g; ctx.fillRect(-70, -40, 140, 100);
  }
  if (S.muzzle) {
    ctx.fillStyle = C(S.muzzle); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(-13, 26, 18, 14, 0, 0, Math.PI * 2); ctx.ellipse(13, 26, 18, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (S.stripe) { // tabby "M" on the forehead
    ctx.strokeStyle = C(S.stripe); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.65;
    for (const dx of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(dx, -52); ctx.lineTo(dx * 0.8, -30); ctx.stroke(); }
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 62, 0); ctx.lineTo(sx * 44, 4); ctx.moveTo(sx * 63, 12); ctx.lineTo(sx * 46, 14); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (rim && rim.alpha > 0.01) {
    const rg = ctx.createLinearGradient(0, -58, 0, 10);
    rg.addColorStop(0, rim.color); rg.addColorStop(1, rim.color.replace(/[\d.]+\)$/, '0)'));
    ctx.strokeStyle = rg; ctx.globalAlpha = rim.alpha; ctx.lineWidth = 7; ctx.stroke(head); ctx.globalAlpha = 1;
  }
  ctx.restore();

  // eyes
  const open = clamp(p.eyes * (brain.blink > 0 ? 0.05 : 1), 0, 1);
  for (const sx of [-1, 1]) {
    const ex = sx * 26, ey = -2;
    if (open < 0.08) {
      ctx.strokeStyle = C(S.shade === '#121016' || S.shade === '#0e0d11' ? '#07060a' : '#3a2a26'); ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath();
      if (yawn > 0.3) { ctx.moveTo(ex - 11, ey - 3); ctx.lineTo(ex, ey + 3); ctx.lineTo(ex + 11, ey - 3); }
      else { ctx.moveTo(ex - 12, ey); ctx.quadraticCurveTo(ex, ey + 8, ex + 12, ey); }
      ctx.stroke();
      continue;
    }
    const h = 11 * open;
    const eye = new Path2D();
    eye.moveTo(ex - 14, ey); eye.quadraticCurveTo(ex, ey - h * 1.5, ex + 14, ey); eye.quadraticCurveTo(ex, ey + h * 1.3, ex - 14, ey);
    ctx.fillStyle = C(S.eye); ctx.fill(eye);
    if (eyeGlow > 0) { ctx.fillStyle = S.eye; ctx.globalAlpha = eyeGlow * 0.6; ctx.fill(eye); ctx.globalAlpha = 1; }
    ctx.save(); ctx.clip(eye);
    const pupilW = lerp(2.4, 7.5, brain.pupil ?? 0.5);
    ctx.fillStyle = '#0b0a0d';
    ctx.beginPath(); ctx.ellipse(ex + p.lookX * 6, ey + p.lookY * 3, pupilW, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(ex + 4 + p.lookX * 5, ey - 4, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,8,10,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(eye);
  }
  // nose and mouth
  ctx.fillStyle = C(S.nose);
  ctx.beginPath(); ctx.moveTo(-6, 15); ctx.quadraticCurveTo(0, 13, 6, 15); ctx.quadraticCurveTo(2, 21, 0, 22); ctx.quadraticCurveTo(-2, 21, -6, 15); ctx.fill();
  if (yawn > 0.05) {
    ctx.fillStyle = C('#7a3340');
    ctx.beginPath(); ctx.ellipse(0, 33 + yawn * 4, 9 + yawn * 4, 3 + yawn * 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(235,140,150,0.9)'; ctx.beginPath(); ctx.ellipse(0, 38 + yawn * 9, 6 + yawn * 2, 2 + yawn * 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4efe8';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 7, 24); ctx.lineTo(sx * 5, 24 + 4 * yawn); ctx.lineTo(sx * 9, 24); ctx.fill(); }
  } else {
    ctx.strokeStyle = C(S.shade === '#121016' || S.shade === '#0e0d11' ? '#07060a' : '#5a4038'); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, 26); ctx.quadraticCurveTo(-4, 31, -9, 28); ctx.moveTo(0, 26); ctx.quadraticCurveTo(4, 31, 9, 28); ctx.stroke();
  }
  // whiskers
  ctx.strokeStyle = S.whisker; ctx.lineWidth = 1.1;
  for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 18, 24 + k * 3); ctx.quadraticCurveTo(sx * 50, 18 + k * 8, sx * 82, 16 + k * 14); ctx.stroke();
  }
  ctx.restore();
}

function ear(ctx, side, rot, S, C) {
  ctx.save(); ctx.translate(side * 36, -36); ctx.rotate(side * 0.18 + rot * side);
  ctx.fillStyle = C(S.point || S.base);
  ctx.beginPath(); ctx.moveTo(-side * 26, 14); ctx.quadraticCurveTo(-side * 8, -38, side * 4, -46); ctx.quadraticCurveTo(side * 22, -10, side * 26, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C(S.inner); ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(-side * 15, 8); ctx.quadraticCurveTo(-side * 4, -26, side * 3, -33); ctx.quadraticCurveTo(side * 14, -8, side * 15, 8); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.restore();
}

// The rare visitor: a second cat peeks up from the bottom of the frame, looks around, sinks back.
export function drawPeek(ctx, x, y, s, skinId, k, time, light) {
  const S = SKINS[skinId] || SKINS.nero;
  const C = (c) => lit(c, light);
  const rise = ease(clamp(Math.min(k / 0.18, (1 - k) / 0.18), 0, 1));
  const brain = { blink: Math.sin(time * 1.3) > 0.97 ? 1 : 0, pupil: 0.8 };
  const p = { eyes: 0.9, yawn: 0, lookX: Math.sin(k * Math.PI * 3) * 0.9, lookY: -0.3, earL: Math.sin(time * 5) * 0.05 * rise, earR: 0 };
  ctx.save(); ctx.translate(x, y + (1 - rise) * 170 * s); ctx.scale(s, s);
  // paws on the bottom edge
  for (const dx of [-46, 46]) paw(ctx, dx, 60, 26, 15, S, C, 0);
  drawHead(ctx, 0, -6, Math.sin(k * Math.PI * 2) * 0.12, S, p, brain, C, null, 0);
  ctx.restore();
}
