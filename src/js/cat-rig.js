// Procedural neon line-art cat. One rig, many poses: every frame is solved from a
// small parameter object (body height/pitch, foot targets, head/tail angles) with
// two-bone IK for the legs, so walking, sprinting, leaping, stretching and sitting
// all blend smoothly. Pure geometry — used at runtime and at build time for the
// static (reduced-motion / no-JS) illustrations.

const D = Math.PI / 180;

// Body-space anchors (cat faces +x, ground is y = 0). The hip is the pitch pivot.
const HIP = [-26, -40];
const ANCH = {
  fn: [21, -40], // front near shoulder
  ff: [15, -40], // front far shoulder
  hn: [-26, -40], // hind near hip
  hf: [-20, -40], // hind far hip
  neck: [31, -55],
  tail: [-40, -51],
};
const FRONT = [18, 18]; // shoulder→elbow, elbow→wrist
const HIND = [16, 17]; // hip→knee, knee→hock
const META = 12.5; // hock→paw

// Torso, head and face drawn in body space (absolute coords around the hip pivot).
export const TORSO =
  'M35,-67C30,-61 17,-62 0,-62C-18,-62 -27,-60 -34,-54C-45,-46 -44,-31 -31,-29C-13,-27 9,-29 23,-33C33,-36 40,-45 43,-55';
export const HEAD =
  'M33,-69L35,-85L43,-77Q47,-78.5 51,-77L57,-85L57.5,-71Q62,-67 61.5,-63Q60,-57.5 53,-57Q45,-54.5 38,-57.5Q32,-61 33,-69Z';
const WHISKERS = 'M58,-61L71,-64M58,-59.5L71,-57.5M57,-58L68,-53';
const NOSE = 'M59.2,-64.6L62,-64L60.4,-62Z';
const EYE_OPEN = 'M50.4,-69.4a2.2,2.4 0 1,0 0.01,0';
const EYE_SHUT = 'M47.5,-68.5Q50.5,-66 53.5,-68.5';
const HAUNCH = 'M-9,-8C-12,3 -7,12 0,15';

const rot = ([x, y], a, [cx, cy] = [0, 0]) => {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => f1(p[0]) + ',' + f1(p[1]);

// Two-bone IK. bend = +1 puts the joint on the +x side of the root→target line.
function ik(a, b, l1, l2, bend) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.01;
  const dc = Math.min(max, Math.max(min, d));
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
  const off = Math.acos(Math.max(-1, Math.min(1, cosA)));
  // pick the side so the joint falls where `bend` asks
  const j1 = [a[0] + l1 * Math.cos(base + off), a[1] + l1 * Math.sin(base + off)];
  const j2 = [a[0] + l1 * Math.cos(base - off), a[1] + l1 * Math.sin(base - off)];
  const side = (j) => (b[0] - a[0]) * (j[1] - a[1]) - (b[1] - a[1]) * (j[0] - a[0]);
  // for a downward-pointing limb, side() < 0 means the joint sits toward +x
  const j = (bend > 0 ? side(j1) < side(j2) : side(j1) > side(j2)) ? j1 : j2;
  const reach = Math.min(d, max) / d;
  const end = [a[0] + dx * reach, a[1] + dy * reach];
  // re-derive the end from the joint so the second bone keeps its length
  const ang2 = Math.atan2(end[1] - j[1], end[0] - j[0]);
  return [j, [j[0] + l2 * Math.cos(ang2), j[1] + l2 * Math.sin(ang2)]];
}

// Solve a pose into drawable path strings.
// pose: { bx, hy, pitch, head, eye, tail:[a,b,c], feet:{fn,ff,hn,hf}, meta:{hn,hf} }
export function solve(pose) {
  const p = pose.pitch * D;
  const toWorld = (q) => add(rot(q, p, HIP), [pose.bx, pose.hy - HIP[1]]);
  const out = {};
  out.body = `translate(${f1(pose.bx)} ${f1(pose.hy - HIP[1])}) rotate(${f1(pose.pitch)} ${HIP[0]} ${HIP[1]})`;
  out.head = `rotate(${f1(pose.head)} ${ANCH.neck[0]} ${ANCH.neck[1]})`;
  out.eye = pose.eye > 0.5 ? EYE_OPEN : EYE_SHUT;

  for (const k of ['fn', 'ff']) {
    const s = toWorld(ANCH[k]);
    const foot = pose.feet[k];
    const wrist = [foot[0] - 2.5, foot[1] - 3];
    const [elbow, w] = ik(s, wrist, FRONT[0], FRONT[1], -1);
    const start = lerp2(s, elbow, 0.32);
    const toe = [w[0] + 5, w[1] + 2.6];
    out[k] = `M${pt(start)}L${pt(elbow)}L${pt(w)}L${pt(toe)}`;
  }
  for (const k of ['hn', 'hf']) {
    const h = toWorld(ANCH[k]);
    const foot = pose.feet[k];
    const tilt = (pose.meta?.[k] ?? 12) * D;
    const hock = [foot[0] - Math.sin(tilt) * META, foot[1] - Math.cos(tilt) * META];
    const [knee, hk] = ik(h, hock, HIND[0], HIND[1], 1);
    const start = lerp2(h, knee, 0.45);
    const paw = [hk[0] + Math.sin(tilt) * META, hk[1] + Math.cos(tilt) * META];
    const toe = [paw[0] + 4.5, paw[1]];
    out[k] = `M${pt(start)}L${pt(knee)}L${pt(hk)}L${pt(paw)}L${pt(toe)}`;
    if (k === 'hn') {
      const a = Math.atan2(knee[1] - h[1], knee[0] - h[0]) - Math.PI / 2;
      out.haunch = `translate(${pt(h)}) rotate(${f1(a / D)})`;
    }
  }
  // tail: forward kinematics, three segments, drawn as a smooth curve
  let tp = toWorld(ANCH.tail);
  let ang = Math.PI + p; // pointing backwards along the body
  const pts = [tp];
  for (let i = 0; i < 4; i++) {
    ang += (pose.tail[Math.min(i, 2)] * D) * (i === 3 ? 0.6 : 1);
    tp = [tp[0] + Math.cos(ang) * 11, tp[1] + Math.sin(ang) * 11];
    pts.push(tp);
  }
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = lerp2(pts[i], pts[i + 1], 0.5);
    d += `Q${pt(pts[i])} ${pt(m)}`;
  }
  d += `L${pt(pts[pts.length - 1])}`;
  out.tail = d;
  return out;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// ---------- Poses ----------
const FEET_STAND = { fn: [24, 0], ff: [17, 0], hn: [-22, 0], hf: [-16, 0] };
export const POSES = {
  stand: { bx: 0, hy: -40, pitch: 0, head: 0, eye: 1, tail: [52, 26, -30], feet: FEET_STAND },
  sit: {
    bx: -4, hy: -10, pitch: -50, head: 46, eye: 1, tail: [34, -44, -52],
    feet: { fn: [9, 0], ff: [3, 0], hn: [-8, 0], hf: [-2, 0] }, meta: { hn: 76, hf: 76 },
  },
  stretch: {
    bx: 0, hy: -48, pitch: 20, head: 2, eye: 0, tail: [34, 32, -8],
    feet: { fn: [58, 0], ff: [52, 0], hn: [-22, 0], hf: [-16, 0] },
  },
  leapUp: {
    bx: 0, hy: -40, pitch: -12, head: 6, eye: 1, tail: [12, 6, -4],
    feet: { fn: [52, -30], ff: [46, -24], hn: [-58, -10], hf: [-52, -4] }, meta: { hn: -40, hf: -36 },
  },
  leapDown: {
    bx: 0, hy: -40, pitch: 10, head: -14, eye: 1, tail: [34, -8, -10],
    feet: { fn: [44, 4], ff: [38, 6], hn: [-48, -14], hf: [-44, -10] }, meta: { hn: -30, hf: -30 },
  },
};

export function blend(a, b, t) {
  const o = {
    bx: lerp(a.bx, b.bx, t), hy: lerp(a.hy, b.hy, t), pitch: lerp(a.pitch, b.pitch, t),
    head: lerp(a.head, b.head, t), eye: lerp(a.eye, b.eye, t),
    tail: a.tail.map((v, i) => lerp(v, b.tail[i], t)), feet: {}, meta: {},
  };
  for (const k of ['fn', 'ff', 'hn', 'hf']) o.feet[k] = lerp2(a.feet[k], b.feet[k], t);
  for (const k of ['hn', 'hf']) o.meta[k] = lerp(a.meta?.[k] ?? 12, b.meta?.[k] ?? 12, t);
  return o;
}

// Gaits: phase offsets per leg, duty factor (stance fraction), stride, lift, bob.
export const GAITS = {
  walk: { off: { hn: 0, fn: 0.25, hf: 0.5, ff: 0.75 }, duty: 0.62, stride: 22, lift: 6, bob: 1.2, pitch: 1.5 },
  trot: { off: { fn: 0, hf: 0, ff: 0.5, hn: 0.5 }, duty: 0.5, stride: 30, lift: 9, bob: 2.2, pitch: 2 },
  sprint: { off: { fn: 0, ff: 0.12, hn: 0.55, hf: 0.65 }, duty: 0.38, stride: 44, lift: 13, bob: 4, pitch: 7 },
};

// Build a pose for gait `g` at cycle phase `ph` (0..1).
export function gaitPose(g, ph) {
  const G = GAITS[g];
  const base = POSES.stand;
  const feet = {}, meta = {};
  for (const k of ['fn', 'ff', 'hn', 'hf']) {
    const t = (ph + G.off[k]) % 1;
    const home = base.feet[k];
    let x, y, tilt = 12;
    if (t < G.duty) {
      const u = t / G.duty;
      x = home[0] + G.stride * (0.5 - u);
      y = 0;
      tilt = 12 + (u - 0.5) * 30;
    } else {
      const u = (t - G.duty) / (1 - G.duty);
      const e = u * u * (3 - 2 * u);
      x = home[0] + G.stride * (-0.5 + e);
      y = -G.lift * Math.sin(Math.PI * u);
      tilt = 40 - 50 * e;
    }
    feet[k] = [x, y];
    if (k[0] === 'h') meta[k] = tilt;
  }
  const s = Math.sin(ph * Math.PI * 4);
  const s2 = Math.sin(ph * Math.PI * 2);
  return {
    bx: 0, hy: base.hy - G.bob * Math.abs(s) + (g === 'sprint' ? 3 : 0),
    pitch: (g === 'sprint' ? G.pitch * s2 : G.pitch * s * 0.4),
    head: (g === 'sprint' ? 8 : 2) - s * 2, eye: 1,
    tail: g === 'sprint' ? [14 + s2 * 6, 8, -6] : [46 + s2 * 10, 22 - s2 * 8, -26 + s2 * 12],
    feet, meta,
  };
}

// ---------- Static drawings ----------
// Curled-up sleeping cat (not reachable by the rig, so it is hand drawn).
export const CURL = {
  body: 'M-44,-2C-50,-22 -36,-42 -8,-44C20,-46 42,-34 44,-14C45,-5 40,0 30,0L-38,0C-42,0 -44,-1 -44,-2Z',
  tail: 'M38,-4C30,6 -10,8 -30,4C-38,2 -40,-6 -34,-9',
  head: 'M-34,-12L-40,-30L-30,-24Q-24,-27 -18,-24L-10,-31L-12,-14Q-14,-6 -24,-5Q-32,-5 -34,-12Z',
  eye: 'M-29,-15Q-26.5,-13 -24,-15',
  ear: 'M-20,-18Q-17,-16 -14,-18',
  paw: 'M-12,-6Q-4,-10 4,-6',
};

export function staticSVG(kind, { cls = '', label = '' } = {}) {
  const lab = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"';
  if (kind === 'curl') {
    return `<svg class="catsvg ${cls}" viewBox="-60 -60 120 70"${lab}><g class="cat-lines">` +
      `<path d="${CURL.body}"/><path d="${CURL.tail}"/><path d="${CURL.head}"/>` +
      `<path class="thin" d="${CURL.eye}"/><path class="thin" d="${CURL.paw}"/></g></svg>`;
  }
  const s = solve(kind === 'walk' ? gaitPose('walk', 0.1) : POSES[kind]);
  return `<svg class="catsvg ${cls}" viewBox="-78 -96 156 104"${lab}>${rigMarkup(s)}</svg>`;
}

// Markup for a solved rig (also used to seed the live cat).
export function rigMarkup(s) {
  return `<g class="cat-lines">` +
    `<path class="far" data-p="hf" d="${s.hf}"/><path class="far" data-p="ff" d="${s.ff}"/>` +
    `<path data-p="tail" d="${s.tail}"/>` +
    `<g data-p="body" transform="${s.body}"><path d="${TORSO}"/>` +
    `<g data-p="head" transform="${s.head}"><path d="${HEAD}"/><path class="thin" d="${WHISKERS}"/>` +
    `<path class="fill" d="${NOSE}"/><path class="eye" data-p="eye" d="${s.eye}"/></g></g>` +
    `<path class="haunch" data-p="haunchp" transform="${s.haunch}" d="${HAUNCH}"/>` +
    `<path data-p="hn" d="${s.hn}"/><path data-p="fn" d="${s.fn}"/></g>`;
}

// Live renderer: caches element handles and writes attributes each frame.
export class Rig {
  constructor(root) {
    this.el = {};
    root.querySelectorAll('[data-p]').forEach((n) => (this.el[n.dataset.p] = n));
  }
  draw(pose) {
    const s = solve(pose), e = this.el;
    for (const k of ['fn', 'ff', 'hn', 'hf', 'tail']) e[k].setAttribute('d', s[k]);
    e.body.setAttribute('transform', s.body);
    e.head.setAttribute('transform', s.head);
    e.haunchp.setAttribute('transform', s.haunch);
    if (e.eye.getAttribute('d') !== s.eye) e.eye.setAttribute('d', s.eye);
  }
}
