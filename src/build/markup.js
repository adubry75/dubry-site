// Build-time markup generators. Everything here runs in Node during `npm run build`
// and is baked into dist/index.html, so the page works (and looks right) before JS.
import { ARCADE, EXTRA_CABINETS, BIG_GAMES, LAB, BENCHES, SOURCES } from '../data/content.js';
import { paletteFor, rigLines, catHead } from '../js/art.js';
import { solve, POSES, CURL, gaitPose, rigMarkup, staticSVG } from '../js/cat-rig.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const LIVES = [
  ['wake', 'Wake up'], ['arcade', 'The Arcade'], ['scores', 'High Score Hall'], ['big', 'Big Games'],
  ['lab', 'The Lab'], ['gallery', 'The Gallery'], ['trail', 'The Trail'], ['office', 'The Office'], ['nap', 'Nap time'],
];

export function livesNav() {
  return LIVES.map(([id, name], i) =>
    `<li><a href="#${id}" data-nav="${i + 1}"><span class="lives__pip" aria-hidden="true"></span><span class="lives__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="lives__label">${name}</span></a></li>`).join('\n    ');
}
export function footNav() {
  return LIVES.slice(0, 8).map(([id, name]) => `<li><a href="#${id}">${name}</a></li>`).join('');
}

// ── Arcade cabinets ───────────────────────────────────────────
export const CABINETS = [...ARCADE, ...EXTRA_CABINETS];
function cabinet(g, i) {
  const [a, b] = paletteFor(g.title, i);
  return `<li><a class="cab" href="${g.href}" data-launch data-i="${i}" data-motif="${g.motif}" style="--a:${a};--b:${b}">` +
    `<span class="cab__marquee"><span class="cab__title">${esc(g.title)}</span></span>` +
    `<span class="cab__screen" data-launch-art></span>` +
    `<span class="cab__deck" aria-hidden="true"><i class="cab__stick"></i><i class="cab__btn"></i><i class="cab__btn"></i></span>` +
    `<span class="cab__door" aria-hidden="true"><i></i><i></i></span><span class="sr"> — play</span></a></li>`;
}
export function cabRows() {
  const half = Math.ceil(CABINETS.length / 2);
  return [CABINETS.slice(0, half).map((g, i) => cabinet(g, i)).join(''),
    CABINETS.slice(half).map((g, i) => cabinet(g, i + half)).join('')];
}

// ── Big games posters ─────────────────────────────────────────
const posterArt = {
  purrpendicular() {
    const a = '#3df2ff', b = '#ffe45c';
    const grid = Array.from({ length: 11 }, (_, i) => `<path d="M${60 + i * 48},40V560M40,${60 + i * 48}H560" />`).join('');
    return `<svg viewBox="0 0 600 600" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<g class="pa-grid" stroke="${a}" stroke-width="1" opacity=".18">${grid}</g>` +
      `<path class="pa-draw" d="M70,470H530M470,530V70" stroke="${a}" stroke-width="6"/>` +
      `<path d="M440,470V440H470" stroke="${b}" stroke-width="4"/>` +
      `<text x="398" y="428" fill="${b}" font-family="Silkscreen,monospace" font-size="26">90°</text>` +
      `<g class="pa-cat" transform="translate(250 466) scale(2.1)" style="filter:drop-shadow(0 0 6px ${a})">${rigLines(solve(gaitPose('walk', 0.3)), a, 3)}</g>` +
      `<g class="pa-cat2" transform="translate(466 190) rotate(-90) scale(1.7)" style="filter:drop-shadow(0 0 6px ${b})">${rigLines(solve(gaitPose('walk', 0.8)), b, 3.2)}</g>` +
      `<circle cx="140" cy="140" r="36" stroke="${b}" stroke-width="3" stroke-dasharray="6 10" class="pa-spin"/>` +
      `</svg>`;
  },
  reactor() {
    const a = '#c6ff3d', b = '#ff8a3d';
    const curl = `<g transform="translate(300 318) scale(1.5)" stroke="${b}" stroke-width="3.2" fill="none"><path d="${CURL.body}"/><path d="${CURL.tail}"/><path d="${CURL.head}"/><path d="${CURL.eye}" stroke-width="2"/></g>`;
    const hazard = Array.from({ length: 24 }, (_, i) => { const t = (i / 24) * Math.PI * 2; const x1 = 300 + Math.cos(t) * 236, y1 = 300 + Math.sin(t) * 236, x2 = 300 + Math.cos(t + 0.12) * 262, y2 = 300 + Math.sin(t + 0.12) * 262; return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}"/>`; }).join('');
    return `<svg viewBox="0 0 600 600" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round">` +
      `<defs><radialGradient id="rcore"><stop offset="0" stop-color="${a}" stop-opacity=".55"/><stop offset=".55" stop-color="${a}" stop-opacity=".08"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient></defs>` +
      `<circle cx="300" cy="300" r="230" fill="url(#rcore)" class="pa-pulse"/>` +
      `<g stroke="${b}" stroke-width="6" opacity=".7" class="pa-spin-slow">${hazard}</g>` +
      `<circle cx="300" cy="300" r="200" stroke="${a}" stroke-width="2" opacity=".6"/>` +
      `<g class="pa-orbit" stroke="${a}" stroke-width="3"><ellipse cx="300" cy="300" rx="180" ry="62"/><ellipse cx="300" cy="300" rx="180" ry="62" transform="rotate(60 300 300)"/><ellipse cx="300" cy="300" rx="180" ry="62" transform="rotate(120 300 300)"/></g>` +
      `<g class="pa-spin" fill="${b}" stroke="none"><circle cx="480" cy="300" r="9"/><circle cx="210" cy="144" r="7"/><circle cx="210" cy="456" r="8"/></g>` +
      `<circle cx="300" cy="300" r="86" stroke="${a}" stroke-width="4"/>` +
      `<g class="pa-purr" stroke="${b}" stroke-width="3" opacity=".9"><path d="M392,250q14,10 0,20q14,10 0,20"/><path d="M208,250q-14,10 0,20q-14,10 0,20"/></g>` +
      `<g style="filter:drop-shadow(0 0 8px ${b})">${curl}</g></svg>`;
  },
  catridge() {
    const a = '#ff4fd8', b = '#a46bff', c = '#3df2ff';
    const ridges = Array.from({ length: 7 }, (_, i) => `<path d="M${196 + i * 34},470V520"/>`).join('');
    return `<svg viewBox="0 0 600 600" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<g class="pa-float">` +
      `<path class="pa-draw" d="M150,120L190,60L240,104H360L410,60L450,120V530Q450,548 432,548H168Q150,548 150,530Z" stroke="${a}" stroke-width="6"/>` +
      `<rect x="190" y="160" width="220" height="250" rx="14" stroke="${b}" stroke-width="4"/>` +
      `<g stroke="${a}" stroke-width="3" opacity=".7">${ridges}</g>` +
      `<g transform="translate(300 270) scale(4.2)">${catHead(0, 0, 1, c, 1.4)}</g>` +
      `<text x="300" y="388" text-anchor="middle" fill="${a}" font-family="Unbounded,sans-serif" font-weight="800" font-size="40" letter-spacing="2">32</text>` +
      `<text x="300" y="140" text-anchor="middle" fill="${b}" font-family="Silkscreen,monospace" font-size="16" letter-spacing="3">CATRIDGE</text>` +
      `</g><path d="M190,570H410" stroke="${b}" stroke-width="3" opacity=".5" class="pa-shadow"/></svg>`;
  },
};

export function posters() {
  return BIG_GAMES.map((g, i) => {
    const ext = g.external ? ' rel="noopener"' : '';
    return `<article class="poster poster--${g.art}" style="--i:${i}" aria-labelledby="poster-${g.id}">
    <div class="poster__card">
      <a class="poster__art" href="${g.href}" data-launch tabindex="-1" aria-hidden="true"${ext}><span data-launch-art>${posterArt[g.art]()}</span></a>
      <div class="poster__copy">
        <p class="poster__kicker">${esc(g.kicker)}</p>
        <h3 id="poster-${g.id}" class="poster__title" style="--tl:${Math.max(...g.title.split(' ').map((w) => w.length))}">${esc(g.title)}</h3>
        <p class="poster__blurb">${esc(g.blurb)}</p>
        <a class="btn poster__cta" href="${g.href}" data-launch${ext}>${esc(g.cta)}${g.external ? ' <span aria-hidden="true">↗</span><span class="sr">(itch.io)</span>' : ' <span aria-hidden="true">→</span>'}</a>
      </div>
    </div>
  </article>`;
  }).join('\n  ');
}

// ── Lab jars ──────────────────────────────────────────────────
const GLYPHS = {
  spiral: () => { let d = 'M80,128'; for (let t = 0; t < 26; t += 0.35) d += `L${(80 + Math.cos(t) * t * 1.35).toFixed(1)},${(128 + Math.sin(t) * t * 1.35).toFixed(1)}`; return `<path d="${d}"/>`; },
  tunnel: () => [8, 16, 24, 32].map((r, i) => `<rect x="${80 - r}" y="${128 - r * 0.8}" width="${r * 2}" height="${r * 1.6}" rx="3" opacity="${1 - i * 0.18}"/>`).join('') + '<path d="M48,102L72,121M112,102L88,121M48,154L72,135M112,154L88,135"/>',
  candy: () => '<path d="M62,128a18,14 0 1,0 36,0a18,14 0 1,0 -36,0ZM62,128l-16,-10v20zM98,128l16,-10v20z"/><path d="M70,120l8,16M82,118l8,16"/>',
  snake: () => '<path d="M46,160Q60,140 74,154T102,148T112,118Q112,104 98,104"/><circle cx="98" cy="104" r="1.6" fill="currentColor"/><path d="M84,104l-6,-3m6,3-6,3"/>',
  balls: () => '<circle cx="58" cy="150" r="11"/><circle cx="86" cy="112" r="14"/><circle cx="108" cy="146" r="8"/><path d="M58,128v-8M86,88v-8M108,128v-6" stroke-dasharray="2 4"/>',
  element: () => '<rect x="54" y="100" width="52" height="56" rx="4"/><text x="60" y="113" font-size="9" fill="currentColor" stroke="none" font-family="Silkscreen,monospace">9</text><text x="80" y="140" text-anchor="middle" font-size="24" fill="currentColor" stroke="none" font-family="Unbounded,sans-serif" font-weight="700">Ct</text><text x="80" y="151" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-family="Silkscreen,monospace">CATIUM</text>',
  torus: () => '<ellipse cx="80" cy="128" rx="34" ry="16"/><ellipse cx="80" cy="126" rx="14" ry="5"/>' + [0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${80 + Math.cos(i / 6 * Math.PI * 2) * 24}" cy="${128 + Math.sin(i / 6 * Math.PI * 2) * 10}" rx="${4 + Math.abs(Math.sin(i / 6 * Math.PI * 2)) * 5}" ry="9" opacity=".6"/>`).join(''),
  spinny: () => [0, 1, 2, 3].map((i) => `<path d="M80,128L${80 + Math.cos(i * Math.PI / 2) * 30},${128 + Math.sin(i * Math.PI / 2) * 30}Q${80 + Math.cos(i * Math.PI / 2 + 0.6) * 30},${128 + Math.sin(i * Math.PI / 2 + 0.6) * 30} ${80 + Math.cos(i * Math.PI / 2 + 0.9) * 14},${128 + Math.sin(i * Math.PI / 2 + 0.9) * 14}Z"/>`).join('') + '<circle cx="80" cy="128" r="3"/>',
  mana: () => '<path d="M80,96L104,124L80,164L56,124Z M56,124H104 M80,96L72,124L80,164L88,124Z"/><path d="M110,100l4,-8l4,8l-8,0zM46,150l3,-6l3,6z" opacity=".7"/>',
};

export function jars() {
  return LAB.map((t, i) => {
    const n = String(i + 1).padStart(3, '0');
    const glass = 'M46,30v12Q22,52 22,80V190Q22,206 38,206H122Q138,206 138,190V80Q138,52 114,42V30';
    const bubbles = [0, 1, 2, 3, 4].map((k) => `<circle class="bub" cx="${40 + ((k * 23 + i * 7) % 80)}" cy="196" r="${2 + (k % 3)}" style="--d:${(k * 0.9 + i * 0.37) % 4}s;--x:${(k % 2 ? 1 : -1) * 6}px"/>`).join('');
    return `<li class="jar" style="--hue:${t.hue};--k:${i}">
    <a class="jar__link" href="${t.href}" data-launch>
      <span class="jar__glass" data-launch-art><svg viewBox="0 0 160 220" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <defs><linearGradient id="liq${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${t.hue} 100% 60%)" stop-opacity=".42"/><stop offset="1" stop-color="hsl(${t.hue} 100% 40%)" stop-opacity=".14"/></linearGradient><clipPath id="jc${i}"><path d="${glass}Z"/></clipPath></defs>
        <g clip-path="url(#jc${i})"><path class="jar__liquid" d="M0,78Q40,70 80,78T160,78V220H0Z" fill="url(#liq${i})"/>${bubbles}</g>
        <g class="jar__specimen">${GLYPHS[t.glyph]()}</g>
        <path class="jar__outline" d="${glass}"/>
        <rect class="jar__lid" x="38" y="12" width="84" height="20" rx="4"/><path class="jar__lid" d="M50,12v20M64,12v20M78,12v20M92,12v20M106,12v20" opacity=".5"/>
        <path class="jar__shine" d="M34,92V176" />
      </svg></span>
      <span class="jar__tag"><span class="jar__no">Specimen ${n}</span><span class="jar__name">${esc(t.title)}</span></span>
    </a>
  </li>`;
  }).join('\n  ');
}

// ── Trail benches ─────────────────────────────────────────────
export function benches() {
  return BENCHES.map((b, i) => {
    const side = i % 2 ? 'r' : 'l';
    return `<li class="bench bench--${side}" data-n="${b.n}">` +
      `<a class="bench__pic" href="${SOURCES.benchFull(b.file)}" data-lb="bench" data-cap="Bench ${esc(b.label)}">` +
      `<img src="${SOURCES.benchThumb(b.file)}" alt="Bench ${esc(b.label)}" width="240" height="180" loading="lazy" decoding="async"></a>` +
      `<span class="bench__sign" aria-hidden="true">${b.n}</span><span class="bench__name">${esc(b.name)}</span></li>`;
  }).join('');
}

// ── Easter eggs ───────────────────────────────────────────────
export const EGGS = {
  grumpy: `<svg viewBox="0 0 40 34" aria-hidden="true" focusable="false"><path d="M6,30V10L4,2L13,8Q20,6 27,8L36,2L34,10V30Q20,34 6,30Z"/><path d="M11,16l6,2M29,16l-6,2"/><path d="M13,20h4M23,20h4"/><path d="M16,27q4,-4 8,0"/><path d="M2,22h7M2,25h7M31,22h7M31,25h7"/></svg>`,
  rat: `<svg viewBox="0 0 64 30" aria-hidden="true" focusable="false"><path d="M10,24Q8,10 24,8Q38,6 46,14L56,16Q58,19 54,20L46,22Q40,26 24,26Q14,26 10,24Z"/><circle cx="40" cy="10" r="4"/><circle cx="50" cy="16.5" r="1" class="dot"/><path d="M10,24Q2,22 4,14Q6,8 2,4"/><path d="M20,26l-2,3M34,26l1,3"/></svg>`,
  hole: `<svg viewBox="0 0 60 40" aria-hidden="true" focusable="false"><path d="M6,40V24Q6,6 30,6Q54,6 54,24V40"/><circle cx="24" cy="28" r="2.2" class="dot"/><circle cx="36" cy="28" r="2.2" class="dot"/></svg>`,
};

// ── Office code snippet (pre-highlighted) ─────────────────────
const CODE = `@page "/nap"
@inject ICatService Cats

<CatBed Size="CatBed.Large"
        @bind-Occupied="cat.IsAsleep" />

@code {
    private Cat cat = new() { Lives = 9 };

    protected override async Task OnInitializedAsync()
        => cat = await Cats.FindSunbeamAsync();
}`;
export function code() {
  const tok = /(@[\w-]+)|("[^"]*")|\b(private|new|protected|override|async|await)\b|\b(Task|Cat|CatBed|ICatService)\b|\b(\d+)\b|(&lt;\/?[A-Z]\w*|\/&gt;)/g;
  return esc(CODE).replace(/&quot;/g, '"').replace(tok, (m, d, s, k, t, n, tag) =>
    d ? `<b class="t-d">${d}</b>` : s ? `<b class="t-s">${s}</b>` : k ? `<b class="t-k">${k}</b>` : t ? `<b class="t-t">${t}</b>` : n ? `<b class="t-n">${n}</b>` : `<b class="t-g">${tag}</b>`)
    .split('\n').map((l) => `<span class="ln">${l || ' '}</span>`).join('');
}

// ── Cat ───────────────────────────────────────────────────────
export const catRig = () => rigMarkup(solve(POSES.stand));
export const catStatic = (k, opts) => staticSVG(k, opts);
