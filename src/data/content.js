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
];

// Life 4 — featured. `blurb` is placeholder copy: rewrite freely.
export const BIG_GAMES = [
  {
    id: 'purrpendicular', title: 'Purrpendicular!', href: '/games/purrpendicular/', art: 'purrpendicular',
    kicker: 'Featured · 01', blurb: 'Right angles, sharp reflexes and one very determined cat. Everything here meets at ninety degrees — except the cat.',
    cta: 'Play Purrpendicular!',
  },
  {
    id: 'reactor', title: 'Reactor Purr', href: '/games/ReactorRun/', art: 'reactor',
    kicker: 'Featured · 02', blurb: 'Keep the core humming. Keep the cat calm. A warm, glowing, slightly-too-loud purr at the heart of the machine.',
    cta: 'Play Reactor Purr',
  },
  {
    id: 'catridge', title: 'Catridge', href: 'https://feelie75.itch.io/catridge-32', art: 'catridge', external: true,
    kicker: 'Collection · itch.io', blurb: 'My game collection, packed into one cartridge. Blow on the contacts, slot it in, and lose an afternoon.',
    cta: 'Get Catridge on itch.io',
  },
];

// Life 5 — the Lab. glyph picks the floating specimen drawing; hue tints the jar.
export const LAB = [
  { href: '/ai/agent1.html', title: 'Trippy Demo Scene I', glyph: 'spiral', hue: 300 },
  { href: '/ai/agent2.html', title: 'Trippy Demo Scene II', glyph: 'tunnel', hue: 190 },
  { href: '/ai/pixigame.html', title: 'Candy Crush (PixiJS)', glyph: 'candy', hue: 340 },
  { href: '/ai/snake-enhanced.html', title: 'Neon Snake', glyph: 'snake', hue: 120 },
  { href: '/ball/', title: 'Gravity & Bouncing Balls', glyph: 'balls', hue: 40 },
  { href: '/periodic.html', title: 'Dynamic Periodic Table', glyph: 'element', hue: 210 },
  { href: '/torus.html', title: 'Torus', glyph: 'torus', hue: 165 },
  { href: '/spinny.html', title: 'Spinny', glyph: 'spinny', hue: 270 },
  { href: '/mana.html', title: 'Mana Collector', glyph: 'mana', hue: 230 },
];

// Life 7 — 54 Bench Challenge, in trail order.
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
