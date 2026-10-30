// Content manifest for the Nine Lives home page. Edit here, then `npm run build`.
// Every href is a same-origin absolute path on dubry.com (or an external URL).

// motif: which original cabinet-art motif to draw (see src/js/art.js).
export const ARCADE = [
  ['bird-brigade', 'Bird Brigade', 'bird'],
  ['box-hop', 'Box Hop', 'box'],
  ['cat-tree', 'Cat Tree', 'tree'],
  ['caterpillar', 'Caterpillar', 'caterpillar'],
  ['catfish-river', 'Catfish River', 'fish'],
  ['catnip-defense', 'Catnip Defense', 'leaf'],
  ['curtain-climb', 'Curtain Climb', 'curtain'],
  ['fish-bowl', 'Fish Bowl', 'bowl'],
  ['four-paws-down', 'Four Paws Down', 'paws'],
  ['fracture', 'Furacture', 'shards'],
  ['gridstorm', 'Purrstorm', 'storm'],
  ['hissy-halls', 'Hissy Halls', 'maze'],
  ['laser-pointer', 'Laser Pointer', 'laser'],
  ['litter-patrol', 'Litter Patrol', 'litter'],
  ['megachain', 'Meowgachain', 'chain'],
  ['mole-mouser', 'Mole Mouser', 'mole'],
  ['moon-mouser', 'Moon Mouser', 'moon'],
  ['mouse-invasion', 'Mouse Invasion', 'invaders'],
  ['neon-chomp', 'Neon Chomp', 'chomp'],
  ['nine-keys', 'Nine Keys', 'keys'],
  ['nine-lives-lane', 'Nine Lives Lane', 'lanes'],
  ['pawddle-war', 'Pawddle War', 'paddles'],
  ['pounce', 'Pounce', 'pounce'],
  ['roomba-rumble', 'Roomba Rumble', 'roomba'],
  ['scratch-through', 'Scratch Through', 'scratch'],
  ['treat-catcher', 'Treat Catcher', 'treats'],
  ['tuna-tower', 'Tuna Tower', 'cans'],
  ['turf-war', 'Turf War', 'turf'],
  ['unpatched', 'Unpawtched', 'glitch'],
  ['yarn-breaker', 'Yarn Breaker', 'bricks'],
  ['yarn-trail', 'Yarn Trail', 'yarn'],
].map(([id, title, motif]) => ({ id, title, motif, href: `/games/${id}.html`, scored: true }));

// Extra cabinets that are not on the shared scoreboard.
export const EXTRA_CABINETS = [
  { id: 'rocket-ascent', title: 'The Karman Line', motif: 'rocket', href: '/games/rocket-ascent/' },
  { id: 'midnight-auction', title: 'Midnight Auction', motif: 'gavel', href: '/games/midnight-auction/' },
  { id: 'arkanoid', title: 'Arkanoid', motif: 'arkanoid', href: '/arkanoid/arkanoid.html' },
  { id: 'lofi-radio', title: 'Lofi Cat Radio', motif: 'moon', href: '/lofi/' },
];

// Life 4 — featured. `art` picks the poster theme (big.css); `img` is the game's own key art in
// src/static/posters/ (w/h = its pixel size), otherwise `art` names a drawn SVG in markup.js.
// `store` marks an external link (itch.io, Steam).
export const BIG_GAMES = [
  {
    id: 'purrpendicular', title: 'Purrpendicular!', href: 'https://feelie75.itch.io/purrpendicular', art: 'purrpendicular', store: 'itch.io',
    img: { src: 'purrpendicular.webp', w: 630, h: 500 },
    kicker: 'Featured · 01 · itch.io', blurb: 'Gravity has gone to the cats. Pop groups of same-colour balls, tilt the whole chamber to build bigger ones, and survive the spinners, pegs and bumpers.',
    cta: 'Play Purrpendicular! on itch.io',
  },
  {
    id: 'meowntain', title: 'Meowntain', href: 'https://feelie75.itch.io/meowntain', art: 'meowntain', store: 'itch.io',
    img: { src: 'meowntain.webp', w: 1232, h: 706 },
    kicker: 'Featured · 02 · itch.io', blurb: 'Drop cat cards. Same cats squish into bigger cats. Climb the Meowntain through 36 levels, 13 cats and a café that fills with every cat you make.',
    cta: 'Play Meowntain on itch.io',
  },
  {
    id: 'purrbricks', title: 'Purr Bricks', href: 'https://store.steampowered.com/app/4459470/Purr_Bricks/', art: 'purrbricks', store: 'Steam',
    img: { src: 'purrbricks.webp', w: 616, h: 353 },
    kicker: 'Featured · 03 · Free on Steam', blurb: 'Smash through 100+ brick-packed levels. Grab wild powerups, dodge chaotic curses and build up FURY for board-clearing strikes.',
    cta: 'Get Purr Bricks on Steam',
  },
  {
    id: 'reactor', title: 'Reactor Purr', href: 'https://feelie75.itch.io/catridge-32', art: 'reactor', store: 'itch.io',
    kicker: 'Featured · 04 · Catridge-32 cart', blurb: 'Fly in. Blow the core. Get out alive. You’re a space cat, and 24 stations full of mouse fighters stand between you and home. One of the carts in Catridge-32.',
    cta: 'Play it in Catridge-32 on itch.io',
  },
  {
    id: 'catridge', title: 'Catridge', href: 'https://feelie75.itch.io/catridge-32', art: 'catridge', store: 'itch.io',
    img: { src: 'catridge.webp', w: 630, h: 500 },
    kicker: 'Collection · itch.io', blurb: 'A 1983 console that never existed, loaded with 32 cat arcade carts. Blow on the contacts, slot one in, and lose an afternoon.',
    cta: 'Get Catridge on itch.io',
  },
];

// Footer store buttons: everything on itch.io, plus Steam. `c` tints the button.
export const ITCH_PROFILE = 'https://feelie75.itch.io/';
export const STORE_LINKS = [
  { title: 'Purrpendicular!', href: 'https://feelie75.itch.io/purrpendicular', store: 'itch.io', c: '#ffb23d' },
  { title: 'Meowntain', href: 'https://feelie75.itch.io/meowntain', store: 'itch.io', c: '#ffab73' },
  { title: 'Catridge-32', href: 'https://feelie75.itch.io/catridge-32', store: 'itch.io', c: '#ff4fd8' },
  { title: 'Purr Bricks', href: 'https://store.steampowered.com/app/4459470/Purr_Bricks/', store: 'Steam', c: '#5aa9ff' },
];

// Life 6 — 54 Bench Challenge, in trail order.
export const BENCH_FILES = `01_Spillway.jpg,02_salamander.jpg,03_RedOsier.jpg,04_Trillium.jpg,05_FrogSong.jpg,
06_NorlingBridge.jpg,07_TheNarrows.jpg,08_SiskiyouRidge.jpg,09_SiskiyouView.jpg,10_KnobconePine.jpg,
11_Grandview.jpg,12_GraniteFalls.jpg,13_Pipsissewa.jpg,14_CantrellFalls.jpg,15_Ridgeview.jpg,16_DickAmes.jpg,
17_CanyonVista.jpg,18_Coyote.jpg,19_GraniteView.jpg,20_Dogwood.jpg,21_blackSnag.jpg,22_acorn.jpg,
23_theGrotto.jpg,24_mapleGrove.jpg,25_JacksonRidge.jpg,26_Serendipity.jpg,27_Sunrise.jpg,28_WrenSong.jpg,
29_UpperTwinPeak.jpg,30_LowerTwinPeak.jpg,31_CascadeCrestShelter-alt.jpg,32_Madrone.jpg,
33_MountainMahogany.jpg,34_manzanita.jpg,35_RedButtesSelfie.jpg,36_Ol'Rocky.jpg,37_UpperFalls.jpg,
38_HighLonesome.jpg,39_TranquilityBase.jpg,40_CanyonFalls.jpg,41_VulturesRoost.jpg,42_BlueSky.jpg,
43_Mahonia.jpg,44_FernGlen.jpg,45_Arbutus.jpg,46_RapaNui.jpg,47_MadronePoint.jpg,48_Dawn.jpg,
49_MockOrangeJoy.jpg,50_Weathertop.jpg,51_Eagle.jpg,52_BearclawFalls.jpg,53_VolkswagenFalls.jpg,54_AZHA.jpg`
  .split(',').map((s) => s.trim());

// "36_Ol'Rocky.jpg" -> { n: 36, name: "Ol' Rocky", label: "36 – Ol' Rocky" }
export function benchName(file) {
  const m = /^(\d+)_(.+)\.\w+$/.exec(file);
  const n = parseInt(m[1], 10);
  let name = m[2].replace(/-alt$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/'(?=[A-Z])/g, "' ")
    .replace(/[_-]+/g, ' ');
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { n, name, label: `${n} – ${name}`, file };
}
export const BENCHES = BENCH_FILES.map(benchName);
export const BENCH_DONE = '2022-05-08';

// Runtime sources on dubry.com
export const SOURCES = {
  scores: (id) => `/games/scores.php?game=${encodeURIComponent(id)}`,
  art: '/art-portfolio/',
  powerbi: '/portfolio/powerbi.html',
  benchThumb: (f) => `/images/benches/t/${encodeURIComponent(f)}`,
  benchFull: (f) => `/images/benches/${encodeURIComponent(f)}`,
  benchPage: '/54benchchallenge/',
  grumpy: '/grumpycat/',
  rats: '/ratsrus/',
};
