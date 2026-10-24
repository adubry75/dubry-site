// Build-time markup generators. Everything here runs in Node during `npm run build`
// and is baked into dist/index.html, so the page works (and looks right) before JS.
import { ARCADE, EXTRA_CABINETS, BIG_GAMES, BENCHES, SOURCES, STORE_LINKS, ITCH_PROFILE } from '../data/content.js';
import fs from 'node:fs';
import { paletteFor, screenSVG } from '../js/art.js';
import { solve, POSES, rigMarkup, staticSVG } from '../js/cat-rig.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const LIVES = [
  ['wake', 'Wake up'], ['arcade', 'The Arcade'], ['scores', 'High Score Hall'], ['big', 'Big Games'],
  ['gallery', 'The Gallery'], ['trail', 'The Trail'], ['office', 'The Office'], ['nap', 'Nap time'],
];

export function livesNav() {
  return LIVES.map(([id, name], i) =>
    `<li><a href="#${id}" data-nav="${i + 1}"><span class="lives__pip" aria-hidden="true"></span><span class="lives__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="lives__label">${name}</span></a></li>`).join('\n    ');
}
export function footNav() {
  return LIVES.slice(0, -1).map(([id, name]) => `<li><a href="#${id}">${name}</a></li>`).join('');
}

// ── Arcade cabinets ───────────────────────────────────────────
export const CABINETS = [...ARCADE, ...EXTRA_CABINETS];
// Each screen shows a real frame of the game (src/static/cabs/<id>.webp, 360×270). A game with
// no screenshot yet gets the generated neon art from art.js instead, baked in at build time.
const hasShot = (id) => fs.existsSync(new URL(`../static/cabs/${id}.webp`, import.meta.url));
const screen = (g, i) => hasShot(g.id)
  ? `<img src="/nine-lives/cabs/${g.id}.webp" width="360" height="270" alt="" loading="lazy" decoding="async"><span class="hs" aria-hidden="true">PRESS START</span>`
  : screenSVG(g, i);
function cabinet(g, i) {
  const [a, b] = paletteFor(g.title, i);
  return `<li><a class="cab" href="${g.href}" data-launch data-i="${i}" data-motif="${g.motif}" style="--a:${a};--b:${b}">` +
    `<span class="cab__marquee"><span class="cab__title">${esc(g.title)}</span></span>` +
    `<span class="cab__screen" data-launch-art>${screen(g, i)}</span>` +
    `<span class="cab__deck" aria-hidden="true"><i class="cab__stick"></i><i class="cab__btn"></i><i class="cab__btn"></i></span>` +
    `<span class="cab__door" aria-hidden="true"><i></i><i></i></span><span class="sr"> — play</span></a></li>`;
}
export function cabRows() {
  const half = Math.ceil(CABINETS.length / 2);
  return [CABINETS.slice(0, half).map((g, i) => cabinet(g, i)).join(''),
    CABINETS.slice(half).map((g, i) => cabinet(g, i + half)).join('')];
}

// ── Big games posters ─────────────────────────────────────────
// Most posters show the game's own key art (src/static/posters/). Reactor Purr has none, so it is
// drawn here from the game's own sprites: the rocket-kitty ship, mouse fighters, the station.
const posterArt = {
  reactor() {
    const line = '#46f1ff', hot = '#ff3d8b', core = '#ffb627';
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars = Array.from({ length: 70 }, () => `<circle cx="${(rnd() * 600).toFixed(0)}" cy="${(rnd() * 600).toFixed(0)}" r="${(0.6 + rnd() * 1.4).toFixed(1)}" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`).join('');
    const ship = '<path d="M22,0L-14,-12L-8,0L-14,12Z"/><path d="M0,-7.3L3,-16L7,-5M-9,-10.3L-6.5,-18L-2,-8.7M-12,9Q-22,16 -24,8M17,1L27,-3M17,2L27,5"/><circle cx="9" cy="-1.5" r="1.8"/>';
    const mouse = '<path d="M-16,0L0,-9L10,0L0,9Z"/><circle cx="-3" cy="-10" r="5"/><circle cx="-3" cy="10" r="5"/><path d="M10,0Q18,-6 26,2"/><circle cx="-11" cy="-2" r="1"/>';
    const fighter = (x, y, s, r = 0) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" stroke-width="${(2 / s).toFixed(2)}">${mouse}</g>`;
    const hex = (r, rot) => { const pts = Array.from({ length: 6 }, (_, i) => { const t = rot + (i / 6) * Math.PI * 2; return `${(Math.cos(t) * r).toFixed(1)},${(Math.sin(t) * r).toFixed(1)}`; }); return `<polygon points="${pts.join(' ')}"/>`; };
    const yarn = '<circle r="20"/>' + [0, 0.8, 1.6, 2.4].map((a) => `<path d="M${(Math.cos(a) * 20).toFixed(1)},${(Math.sin(a) * 20).toFixed(1)}Q${(Math.cos(a + 1.6) * 6).toFixed(1)},${(Math.sin(a + 1.6) * 6).toFixed(1)} ${(Math.cos(a + 2.6) * 20).toFixed(1)},${(Math.sin(a + 2.6) * 20).toFixed(1)}"/>`).join('');
    return `<svg viewBox="0 0 600 600" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<g fill="#d9f6ff" stroke="none">${stars}</g>` +
      // the station, its docking bay, and the reactor core (a glowing ball of yarn) deep inside
      `<g stroke="${line}" style="filter:drop-shadow(0 0 7px ${line})"><path class="pa-draw" d="M590,70H470L400,130L362,168V255H450V345H362V432L400,470L470,530H590" stroke-width="4"/></g>` +
      `<g stroke="${line}" stroke-width="1.5" opacity=".35">${[0, 1, 2, 3].map((i) => `<path d="M${420 + i * 42},${150 + (i % 2) * 16}V228M${420 + i * 42},372V${450 - (i % 2) * 16}"/>`).join('')}<path d="M380,268V332M405,268V332M430,268V332"/></g>` +
      `<g transform="translate(522 300)" stroke="${core}" stroke-width="3" style="filter:drop-shadow(0 0 9px ${core})"><g class="pa-spin">${hex(34, 0.3)}</g><g class="pa-spin-rev">${hex(48, 0)}</g>${yarn}</g>` +
      `<path class="pa-shield" d="M344,150V450" stroke="${hot}" stroke-width="3" stroke-dasharray="14 10" style="filter:drop-shadow(0 0 6px ${hot})"/>` +
      // mouse fighters and their shots
      `<g stroke="${hot}" style="filter:drop-shadow(0 0 6px ${hot})"><g class="pa-purr">${fighter(262, 176, 2.4, -8)}${fighter(250, 432, 2.1, 10)}${fighter(186, 112, 1.5, -4)}</g>` +
      `<g stroke-width="2.5"><circle cx="218" cy="206" r="4"/><circle cx="200" cy="226" r="4"/><circle cx="212" cy="404" r="4"/></g></g>` +
      // a fighter going pop
      `<g stroke="${hot}" stroke-width="3" opacity=".9" class="pa-pulse-pop"><path transform="translate(2 0)" d="M300,330l-14,-10M306,322l2,-18M314,330l16,-8M312,342l14,10M300,344l-6,16M292,336l-18,4"/></g>` +
      // the rocket kitty, with its exhaust and lasers
      `<g stroke="${line}" stroke-width="3"><path d="M262,300H286" opacity=".9"/></g>` +
      `<g class="pa-float"><g stroke="${core}" stroke-width="3" opacity=".8"><path d="M54,316h12M28,324h10M80,310h10" stroke-dasharray="3 7"/></g>` +
      `<g transform="translate(140 300) scale(4)" stroke="${line}" stroke-width=".75" style="filter:drop-shadow(0 0 8px ${line})">${ship}</g></g>` +
      `<text x="28" y="44" fill="#6f8d9c" font-family="Silkscreen,monospace" font-size="15" letter-spacing="2">STATION 1 / 24</text>` +
      `<text x="28" y="572" fill="${hot}" font-family="Silkscreen,monospace" font-size="15" letter-spacing="2">FIGHTERS DOWN 4 / 5</text>` +
      `</svg>`;
  },
};

const posterImg = ({ src, w, h }) =>
  `<img src="/nine-lives/posters/${src}" width="${w}" height="${h}" alt="" loading="lazy" decoding="async">`;

export const N_BIG = BIG_GAMES.length;
export function posters() {
  return BIG_GAMES.map((g, i) => {
    const ext = g.store ? ' rel="noopener"' : '';
    const arrow = g.store ? ` <span aria-hidden="true">↗</span><span class="sr">(${esc(g.store)})</span>` : ' <span aria-hidden="true">→</span>';
    return `<article class="poster poster--${g.art}" style="--i:${i}" aria-labelledby="poster-${g.id}">
    <div class="poster__card">
      <a class="poster__art" href="${g.href}" data-launch tabindex="-1" aria-hidden="true"${ext}><span data-launch-art>${g.img ? posterImg(g.img) : posterArt[g.art]()}</span></a>
      <div class="poster__copy">
        <p class="poster__kicker">${esc(g.kicker)}</p>
        <h3 id="poster-${g.id}" class="poster__title" style="--tl:${Math.max(...g.title.split(' ').map((w) => w.length))}">${esc(g.title)}</h3>
        <p class="poster__blurb">${esc(g.blurb)}</p>
        <a class="btn poster__cta" href="${g.href}" data-launch${ext}>${esc(g.cta)}${arrow}</a>
      </div>
    </div>
  </article>`;
  }).join('\n  ');
}

// ── Footer store buttons ──────────────────────────────────────
export function storeButtons() {
  return STORE_LINKS.map((s) =>
    `<li><a class="btn btn--ghost nap__store" href="${s.href}" rel="noopener" style="--accent:${s.c}">` +
    `<span class="nap__store-name">${esc(s.title)}</span> <span class="nap__store-where">on ${esc(s.store)} <span aria-hidden="true">↗</span></span></a></li>`).join('') +
    `<li><a class="btn nap__store nap__store--all" href="${ITCH_PROFILE}" rel="noopener">` +
    `<span class="nap__store-name">All my games</span> <span class="nap__store-where">on itch.io <span aria-hidden="true">↗</span></span></a></li>`;
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
