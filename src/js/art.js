import { solve, POSES, TORSO, HEAD } from './cat-rig.js';

// Original neon cabinet art, generated from a game's title + motif. Every screen gets
// a procedural backdrop (seeded from the title) and a hand-built line motif — and
// somewhere in every screen there is a cat.

export const PALETTES = [
  ['#ff4fd8', '#3df2ff'], ['#c6ff3d', '#a46bff'], ['#ffb23d', '#3df2ff'], ['#ffe45c', '#ff4fd8'],
  ['#3df2ff', '#ff6b8b'], ['#ff5c5c', '#ffe45c'], ['#5cff9d', '#4f8bff'], ['#ff8a3d', '#c86bff'],
  ['#7af0ff', '#ffd23d'], ['#ff6bd5', '#c6ff3d'],
];

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let s = seed || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)), (s >>>= 0) / 4294967296);
}

const P = (d, c, w = 2.2, extra = '') => `<path d="${d}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
const C = (x, y, r, c, w = 2.2, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
const F = (d, c, extra = '') => `<path d="${d}" fill="${c}" stroke="none" ${extra}/>`;

// A tiny neon cat head (ears + face), the signature on every screen.
export function catHead(x, y, s, c, w = 2) {
  const k = (n) => +(n * s).toFixed(2);
  return `<g transform="translate(${x} ${y})">` +
    P(`M${k(-9)},${k(2)}L${k(-9)},${k(-12)}L${k(-3)},${k(-6)}Q0,${k(-7)} ${k(3)},${k(-6)}L${k(9)},${k(-12)}L${k(9)},${k(2)}Q${k(9)},${k(9)} 0,${k(9)}Q${k(-9)},${k(9)} ${k(-9)},${k(2)}Z`, c, w) +
    F(`M${k(-4.5)},${k(0)}a${k(1.4)},${k(1.6)} 0 1,0 0.01,0M${k(4.5)},${k(0)}a${k(1.4)},${k(1.6)} 0 1,0 0.01,0`, c) +
    `</g>`;
}
const ears = (x, y, s, c, w = 2) =>
  P(`M${x - 8 * s},${y}L${x - 7 * s},${y - 9 * s}L${x - 2 * s},${y - 4 * s}L${x + 2 * s},${y - 4 * s}L${x + 7 * s},${y - 9 * s}L${x + 8 * s},${y}`, c, w);
const paw = (x, y, s, c) =>
  F(`M${x},${y + 2 * s}c${-4 * s},0 ${-6 * s},${3 * s} ${-5 * s},${5 * s}c${1 * s},${2 * s} ${9 * s},${2 * s} ${10 * s},0c${1 * s},${-2 * s} ${-1 * s},${-5 * s} ${-5 * s},${-5 * s}Z`, c) +
  [[-6, -3], [-2, -6], [2, -6], [6, -3]].map(([dx, dy]) => `<ellipse cx="${x + dx * s}" cy="${y + dy * s}" rx="${1.6 * s}" ry="${2 * s}" fill="${c}"/>`).join('');

// Motifs draw in a 120 x 90 screen. a = primary, b = secondary colour.
const MOTIFS = {
  bird: (a, b) => [0, 1, 2].map((i) => P(`M${30 + i * 24},${22 + (i % 2) * 10}q6,-7 10,0q4,-7 10,0`, b)).join('') + catHead(60, 66, 1.4, a),
  box: (a, b) => P('M34,50L60,40L86,50L86,74L60,84L34,74Z M34,50L60,60L86,50 M60,60L60,84', b) + P('M34,50L24,40M86,50L96,40', b, 1.6) + ears(60, 52, 1.5, a, 2.4) + F('M53.5,47a1.6,1.8 0 1,0 .01,0M66.5,47a1.6,1.8 0 1,0 .01,0', a),
  tree: (a, b) => P('M60,84L60,30M40,84L80,84M44,62L76,62M50,40L72,40', b, 2.6) + C(60, 30, 7, b) + catHead(64, 24, 1, a),
  caterpillar: (a, b) => [0, 1, 2, 3, 4].map((i) => C(28 + i * 13, 52 + Math.sin(i) * 8, 7, i ? b : a)).join('') + P('M86,46l4,-10M92,50l6,-8', a) + paw(70, 76, 1, a),
  fish: (a, b) => P('M30,46q20,-18 42,0q-22,18 -42,0zM72,46l12,-9v18z', a, 2.4) + C(40, 44, 1.6, a, 2, `fill="${a}"`) + P('M14,68q8,-6 16,0t16,0t16,0t16,0t16,0t16,0M20,78q8,-6 16,0t16,0t16,0t16,0t16,0', b, 1.6),
  leaf: (a, b) => P('M60,18L84,28L82,56Q78,74 60,82Q42,74 38,56L36,28Z', b, 2.2) + P('M60,66Q46,52 60,30Q74,52 60,66ZM60,66L60,36', a, 2.2) + P('M52,48l8,6l8,-6', a, 1.4),
  curtain: (a, b) => P('M22,14H98', b, 3) + [0, 1, 2, 3, 4, 5].map((i) => P(`M${28 + i * 13},14q-5,20 0,38t0,36`, b, 1.6)).join('') + catHead(60, 42, 1.2, a) + P('M54,52l-2,8M60,53v8M66,52l2,8', a, 1.6),
  bowl: (a, b) => P('M36,30Q24,52 40,74H80Q96,52 84,30', b, 2.4) + P('M32,44H88', b, 1.4, 'stroke-dasharray="4 4"') + P('M50,58q8,-8 16,0q-8,8 -16,0zM66,58l6,-5v10z', a, 2) + paw(94, 22, 1.1, a),
  paws: (a, b) => paw(38, 30, 1.3, a) + paw(78, 26, 1.3, b) + paw(44, 66, 1.3, b) + paw(84, 62, 1.3, a),
  shards: (a, b) => P('M60,45L20,10M60,45L104,18M60,45L96,84M60,45L18,72M60,45L60,6', b, 1.4) + P('M60,45L76,36L70,58Z M60,45L44,30L40,52Z', a, 2.2) + catHead(60, 74, 0.9, a),
  storm: (a, b) => [0, 1, 2, 3, 4].map((i) => P(`M${10 + i * 25},10V80`, b, 0.8, 'opacity=".6"')).join('') + [0, 1, 2].map((i) => P(`M10,${20 + i * 25}H110`, b, 0.8, 'opacity=".6"')).join('') + P('M66,8L48,46H62L52,84L78,38H62Z', a, 2.6) + ears(60, 14, 1.1, a),
  maze: (a, b) => P('M20,12H100V78H20V22H90V68H30V32H80V58H40V42H70', b, 2.2) + catHead(56, 49, 0.7, a, 1.6),
  laser: (a, b) => P('M110,8L58,62', '#ff3b3b', 1.4, 'opacity=".8"') + C(58, 62, 3, '#ff3b3b', 2, 'fill="#ff3b3b"') + C(58, 62, 7, '#ff3b3b', 1, 'opacity=".5"') + P('M22,38q8,-8 16,0q-8,8 -16,0zM42,38q8,-8 16,0q-8,8 -16,0z', a, 2) + F('M30,34v8M50,34v8', a, `stroke="${a}" stroke-width="2.4"`) + ears(40, 28, 1.6, b),
  litter: (a, b) => P('M26,52H94L86,78H34Z', b, 2.4) + P('M34,52q6,-6 12,0t12,0t12,0t12,0t12,0', b, 1.4) + P('M70,22L84,48M78,44l10,-4l2,6l-10,4z', a, 2) + catHead(44, 34, 1, a),
  chain: (a, b) => [0, 1, 2, 3].map((i) => `<ellipse cx="${30 + i * 20}" cy="45" rx="11" ry="7" fill="none" stroke="${i % 2 ? b : a}" stroke-width="2.4"/>`).join('') + catHead(92, 45, 1, a),
  mole: (a, b) => [30, 60, 90].map((x, i) => P(`M${x - 14},76Q${x},${58} ${x + 14},76`, b, 2.2) + (i === 1 ? catHead(x, 60, 1, a) : `<ellipse cx="${x}" cy="68" rx="5" ry="4" fill="none" stroke="${b}" stroke-width="1.6"/>`)).join('') + P('M10,76H110', b, 1.6),
  moon: (a, b) => P('M78,14A24,24 0 1,0 98,50A18,18 0 1,1 78,14Z', b, 2.2) + [[24, 18], [40, 30], [18, 50], [100, 76]].map(([x, y]) => C(x, y, 1, b, 1.4)).join('') + P('M40,84C34,70 38,58 46,56L44,46L50,52L56,46L56,58C62,64 60,80 54,84Z', a, 2.2) + P('M40,84Q26,84 28,72', a, 2.2),
  invaders: (a, b) => [0, 1, 2].map((i) => `<g transform="translate(${20 + i * 30} ${20 + (i % 2) * 6})">` + P('M2,10V4h4v-4M18,10V4h-4v-4M4,4h12v8H4zM6,14l-2,4M14,14l2,4', i === 1 ? a : b, 2) + F('M7,7h2v2H7zM11,7h2v2h-2z', i === 1 ? a : b) + `</g>`).join('') + P('M54,82L60,72L66,82Z', a, 2) + P('M60,70V58', a, 1.4, 'stroke-dasharray="2 3"'),
  chomp: (a, b) => P('M58,45L84,30A30,30 0 1,0 84,60Z', a, 2.6) + P('M40,22L44,10L52,18M64,18L72,12L72,24', a, 2.4) + C(52, 32, 2, a, 2, `fill="${a}"`) + [94, 104, 114].map((x) => C(x, 45, 2, b, 2, `fill="${b}"`)).join(''),
  keys: (a, b) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${15 + i * 10}" y="34" width="9" height="44" rx="1" fill="none" stroke="${b}" stroke-width="1.4"/>`).join('') + [0, 1, 3, 4, 5, 7].map((i) => `<rect x="${21 + i * 10}" y="34" width="6" height="26" fill="${b}" opacity=".85"/>`).join('') + paw(60, 22, 1.2, a),
  lanes: (a, b) => P('M10,84L50,30M110,84L70,30M60,84V74M60,64V56M60,48V42M60,36V32', b, 2) + P('M10,30H110', b, 1, 'opacity=".5"') + catHead(60, 66, 1.1, a) + Array.from({ length: 9 }, (_, i) => C(14 + i * 4, 18, 1.4, a, 1.4, `fill="${a}"`)).join(''),
  paddles: (a, b) => P('M18,26V64M102,30V68', b, 4) + C(60, 45, 7, a, 2.2) + P('M54,41q6,4 12,0M54,49q6,-4 12,0', a, 1.2) + P('M30,40h8M82,52h8', b, 1, 'stroke-dasharray="2 3"'),
  pounce: (a, b) => P('M10,84Q46,-4 100,72', b, 1.4, 'stroke-dasharray="3 4"') + `<g transform="translate(56 50) scale(.42) rotate(-8)">${rigLines(solve(POSES.leapUp), a)}</g>` + P('M96,76q4,-6 10,-2q-4,6 -10,2zM106,74l6,-2', b, 2),
  roomba: (a, b) => `<ellipse cx="60" cy="70" rx="34" ry="10" fill="none" stroke="${b}" stroke-width="2.4"/>` + P('M26,70V74Q60,90 94,74V70', b, 1.6) + P('M46,62C42,50 46,38 56,36L54,24L61,31L67,24L68,36C76,40 76,56 72,62Z', a, 2.2) + P('M30,46q-6,-4 -12,0M90,46q6,-4 12,0', b, 1.2),
  scratch: (a, b) => [0, 1, 2].map((i) => P(`M${38 + i * 14},12Q${30 + i * 14},46 ${44 + i * 14},80`, i === 1 ? a : b, 3.2)).join('') + catHead(98, 74, 0.8, a),
  treats: (a, b) => [[30, 16], [62, 28], [88, 12], [46, 44]].map(([x, y], i) => P(`M${x - 7},${y}q7,-6 12,0q-5,6 -12,0zM${x + 5},${y}l4,-3v6z`, i % 2 ? a : b, 1.8)).join('') + P('M36,66H84Q80,84 60,84Q40,84 36,66Z', a, 2.4) + ears(60, 66, 1, a, 1.6),
  cans: (a, b) => [[42, 66], [78, 66], [60, 44], [60, 22]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y - 8}" rx="14" ry="4" fill="none" stroke="${i === 3 ? a : b}" stroke-width="2"/>` + P(`M${x - 14},${y - 8}V${y + 6}Q${x},${y + 12} ${x + 14},${y + 6}V${y - 8}`, i === 3 ? a : b, 2)).join('') + P('M54,0q6,6 12,0', a, 1.4),
  turf: (a, b) => Array.from({ length: 12 }, (_, i) => `<rect x="${16 + (i % 4) * 22}" y="${14 + Math.floor(i / 4) * 22}" width="20" height="20" fill="${[0, 1, 4, 5, 8].includes(i) ? a : b}" opacity="${[0, 1, 4, 5, 8].includes(i) ? 0.55 : 0.18}" stroke="${[0, 1, 4, 5, 8].includes(i) ? a : b}" stroke-width="1.2"/>`).join('') + catHead(38, 46, 0.7, '#fff', 1.6),
  glitch: (a, b) => catHead(56, 46, 2.2, a, 2.4) + `<g transform="translate(6 0)" opacity=".7">${catHead(56, 46, 2.2, b, 2)}</g>` + F('M20,30h30v4H20zM70,58h34v3H70zM30,70h20v2H30z', b) + F('M78,22h16v3H78z', a),
  bricks: (a, b) => Array.from({ length: 12 }, (_, i) => `<rect x="${14 + (i % 4) * 24}" y="${10 + Math.floor(i / 4) * 9}" width="21" height="6" fill="${i % 3 ? b : a}" opacity=".85"/>`).join('') + C(60, 56, 6, a, 2) + P('M55,53q5,3 10,0M55,59q5,-3 10,0', a, 1) + P('M42,80H78', b, 4),
  yarn: (a, b) => C(36, 40, 16, a, 2.4) + P('M24,30q12,8 24,-2M22,42q14,8 28,-4M26,52q10,4 20,-4M30,26q2,16 -4,28', a, 1.3) + P('M50,50C70,70 80,40 100,64S104,84 112,80', b, 2, 'stroke-dasharray="1 0"') + paw(98, 26, 0.9, b),
  rocket: (a, b) => P('M10,30H110', b, 1.2, 'stroke-dasharray="4 4"') + `<text x="12" y="25" font-size="6" fill="${b}" font-family="monospace">100 KM</text>` + P('M60,14Q72,30 70,56H50Q48,30 60,14ZM50,56L42,66V56ZM70,56L78,66V56Z', a, 2.2) + C(60, 38, 5, a, 1.8) + ears(60, 37, 0.6, a, 1.4) + P('M54,62q6,18 0,24M60,62q6,14 0,20M66,62q-6,18 0,24', '#ffb23d', 1.6),
  gavel: (a, b) => P('M52,30L72,10L84,22L64,42ZM60,36L32,64', a, 2.6) + P('M30,78H80V84H30Z', b, 2) + P('M96,16A12,12 0 1,0 106,32A9,9 0 1,1 96,16Z', b, 1.8) + catHead(50, 70, 0.6, b, 1.4),
  arkanoid: (a, b) => Array.from({ length: 16 }, (_, i) => `<rect x="${12 + (i % 8) * 12.4}" y="${12 + Math.floor(i / 8) * 8}" width="11" height="6" fill="${['#ff4fd8', '#3df2ff', '#ffe45c', '#c6ff3d'][i % 4]}" opacity=".85"/>`).join('') + C(66, 54, 3, '#fff', 1.6, 'fill="#fff"') + P('M44,78h32', a, 5) + ears(60, 76, 0.7, a, 1.4),
};

// The house cat, drawn from the shared rig (used on Pounce and the Big Games posters).
export function rigLines(r, c, w = 4.2) {
  const st = `stroke="${c}" stroke-width="${w}" fill="none"`;
  return `<g ${st}><path d="${r.hf}" opacity=".5"/><path d="${r.ff}" opacity=".5"/><path d="${r.tail}"/>` +
    `<g transform="${r.body}"><path d="${TORSO}"/><g transform="${r.head}"><path d="${HEAD}"/><path d="${r.eye}" fill="${c}" stroke-width="2"/></g></g>` +
    `<path d="${r.hn}"/><path d="${r.fn}"/></g>`;
}

const BACKDROPS = {
  grid: (a, b, r) => `<g opacity=".35" stroke="${b}" stroke-width=".6">` + Array.from({ length: 9 }, (_, i) => `<path d="M${60 + (i - 4) * 4},50L${60 + (i - 4) * 36},92"/>`).join('') + [56, 62, 70, 80, 92].map((y) => `<path d="M0,${y}H120"/>`).join('') + `</g>`,
  stars: (a, b, r) => Array.from({ length: 22 }, () => `<circle cx="${(r() * 120).toFixed(1)}" cy="${(r() * 90).toFixed(1)}" r="${(r() * 0.9 + 0.3).toFixed(2)}" fill="${r() > 0.7 ? a : '#fff'}" opacity="${(r() * 0.6 + 0.2).toFixed(2)}"/>`).join(''),
  rings: (a, b) => [14, 28, 42, 56].map((rr) => `<circle cx="60" cy="45" r="${rr}" fill="none" stroke="${b}" stroke-width=".7" opacity=".28"/>`).join(''),
  dots: (a, b) => `<g fill="${b}" opacity=".22">` + Array.from({ length: 60 }, (_, i) => `<circle cx="${6 + (i % 10) * 12}" cy="${6 + Math.floor(i / 10) * 15}" r="1"/>`).join('') + `</g>`,
  rays: (a, b) => `<g stroke="${b}" stroke-width=".7" opacity=".25">` + Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return `<path d="M60,45L${(60 + Math.cos(t) * 90).toFixed(1)},${(45 + Math.sin(t) * 90).toFixed(1)}"/>`; }).join('') + `</g>`,
};
const BD_KEYS = Object.keys(BACKDROPS);

// Full cabinet screen SVG. `i` spreads palettes across neighbours.
export function screenSVG({ title, motif }, i = 0, { label = true } = {}) {
  const h = hash(title);
  const r = rng(h);
  const [a, b] = PALETTES[(i + (h % 3)) % PALETTES.length];
  const bd = BACKDROPS[BD_KEYS[h % BD_KEYS.length]](a, b, r);
  const draw = MOTIFS[motif] || MOTIFS.paws;
  const id = 'g' + h.toString(36);
  return `<svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<defs><radialGradient id="${id}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${b}" stop-opacity=".28"/><stop offset="1" stop-color="#05030a" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="120" height="90" fill="#07050d"/><rect width="120" height="90" fill="url(#${id})"/>${bd}` +
    `<g class="motif" style="filter:drop-shadow(0 0 2px ${a})">${draw(a, b)}</g>` +
    (label ? `<text class="hs" x="60" y="87" text-anchor="middle" font-size="5.2" fill="${a}" font-family="Silkscreen,monospace" letter-spacing=".6">PRESS START</text>` : '') +
    `</svg>`;
}

export function paletteFor(title, i = 0) {
  const h = hash(title);
  return PALETTES[(i + (h % 3)) % PALETTES.length];
}
