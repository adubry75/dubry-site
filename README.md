# dubry.com — Nine Lives

The dubry.com home page: one long scroll-driven page where a neon line-art cat walks
down through eight "lives", each its own world (it's keeping the ninth in reserve).

| # | Life | What's there |
|---|------|--------------|
| 1 | **Wake up** | Hero. The cat naps on the `dubry.com` wordmark until you arrive (first scroll / mouse move / touch / key), then stretches awake; WebGL aurora sky. |
| 2 | **The Arcade** | 34 neon cabinets, each screen showing the real game (title-screen captures). The section pins and your scroll drives the aisle sideways. Click = View Transition into the game. |
| 3 | **High Score Hall** | One combined leaderboard from `/games/scores.php` (Top Cats + per-game champions + unclaimed crowns). |
| 4 | **Big Games** | Purrpendicular! (itch.io), Meowntain (itch.io), Purr Bricks (Steam), Reactor Purr (a Catridge-32 cart), Catridge (itch.io): full-screen posters with each game's key art, stacking as you scroll. |
| 5 | **The Gallery** | The art portfolio hung salon-style on a wall in perspective, scrubbed by scroll; lightbox on click. |
| 6 | **The Trail** | 54 Bench Challenge: a winding trail draws itself as the cat hikes it; benches light up as you pass. |
| 7 | **The Office** | Blazor / .NET blurb, a little Razor component, Power BI screenshots on "monitors". |
| 8 | **Nap time** | Footer. The cat walks onto a cushion and curls up asleep. Store buttons for every game on itch.io and Steam. |

Hidden easter-egg cats link to `/grumpycat/` and `/ratsrus/` (arcade, gallery, trail, footer).

The cat reacts to scroll speed: **walk → trot → sprint**, **leaps** between lives, **turns around** when you
scroll back up, **sits** when you stop, and **sleeps** at the bottom.

---

## Deploying (WinSCP)

`npm run build` writes everything to `dist/`, and `dist/` is committed so you can upload it directly.

```
dist/
├── index.html          → upload to  public_html/index.html      (replaces the Neon Chomp copy)
└── nine-lives/         → upload to  public_html/nine-lives/     (whole folder)
    ├── js/             ES modules (content-hashed names)
    ├── fonts/          Unbounded, Space Grotesk, Silkscreen (OFL, self-hosted)
    ├── posters/        Big Games key art (WebP)
    ├── cabs/           arcade cabinet screens, 360×270 WebP
    ├── favicon.svg, apple-touch-icon.png, og.jpg
```

1. **Back up** the current `public_html/index.html` first (it's a copy of Neon Chomp; the game itself
   is still at `/games/neon-chomp.html` and has its own cabinet).
2. In WinSCP, open `public_html/` on the server and `dist/` locally.
3. Upload `dist/index.html` over `public_html/index.html`.
4. Upload the `dist/nine-lives/` folder as `public_html/nine-lives/`.

That's everything. **Nothing else on the server is touched or copied:** games, art, bench photos, scores
and toys are all linked or fetched from their existing URLs.

**Re-deploying:** JS file names carry a content hash (`main-XXXX.js`), so browsers never run stale code.
Old hashed files in `nine-lives/js/` are harmless. To tidy up, delete `public_html/nine-lives/js/` before
uploading the new one.

Optional: if your host doesn't already compress and cache static files, this `.htaccess` snippet
(in `public_html/nine-lives/`) helps. The page scores 100 without it locally, so it's a nice-to-have:

```apache
<IfModule mod_deflate.c>AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript image/svg+xml</IfModule>
<IfModule mod_expires.c>ExpiresActive On
  ExpiresByType text/javascript "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"</IfModule>
```

### What the page reads from the live site at runtime

| Source | Used by | Notes |
|---|---|---|
| `GET /games/scores.php?game=<id>` | High Score Hall | One request per arcade game (31, in parallel), only when you scroll near the hall. Cached in `sessionStorage` for 5 min. `<id>` = the game's file name (`pounce`, `gridstorm`, …). Entries are assumed to be **ordered best-first by the server**. |
| `GET /art-portfolio/` | Gallery | Parses every `<img src>` that lives under `/art-portfolio/` (e.g. `./name.jpg`), on idle after page load. Images are lazy-loaded as the wall scrolls. |
| `GET /portfolio/powerbi.html` | Office | Uses its `<img>` sources (first 6) and their `alt` text. |
| `/images/benches/t/<file>` + `/images/benches/<file>` | Trail | Thumbnails inline, full size in the lightbox (links work without JS too). |

Every failure path has a designed fallback: an empty hall invites people to claim the first crown; a dead
API shows "the scoreboard is napping" + retry; a missing gallery or Power BI page links to the original.

---

## Previewing locally

Requirements: **Node 18+**, and **Python 3 + Pillow** (only for generating preview fixtures; on Windows run
`py tools/make_fixtures.py` if `python3` isn't on your PATH).

```bash
npm install                 # esbuild + self-hosted fonts + axe-core
pip install pillow          # once, for fixtures
npm run fixtures            # fake art portfolio, Power BI page, bench photos -> fixtures/_gen/
npm run dev                 # build + serve at http://localhost:8054/
```

The preview server (`tools/serve.mjs`) serves `dist/` at `/` and stands in for the rest of dubry.com:

* `/games/scores.php` returns seeded fake boards. Many games are empty and one board always returns 500,
  so the error paths get exercised. Add a query to the **page** URL to switch modes:
  `/?scores=empty`, `/?scores=fail`, `/?scores=slow`.
* `/art-portfolio/`, `/portfolio/powerbi.html` and `/images/benches/…` come from `fixtures/_gen/`.
* Any other `.html` or folder URL (games, lab toys, `/grumpycat/`, …) returns a small stub page, so every
  link can be clicked.

### Tests & screenshots (Playwright)

The test scripts use Playwright with Chromium. If you don't have it: `npm i -D playwright && npx playwright install chromium`.

```bash
npm run check     # behaviour + accessibility checks (see below), exits non-zero on failure
npm run shoot     # screenshots of every life at 1440×900 and 390×844 -> shots/
RM=1 npm run shoot          # same, with prefers-reduced-motion
bash tools/lighthouse.sh    # Lighthouse mobile + desktop (uses npx lighthouse) -> .lighthouse/
```

`npm run check` covers:

* an axe-core WCAG scan (after every life has loaded)
* landmarks, headings and labels: one `h1` plus eight life `h2`s, named links, `alt` on every image, the decorative cat `aria-hidden`
* keyboard: the skip link, the cabinets, and focus scrolling the pinned aisle so the focused cabinet is visible
* reduced motion: no live cat, static cat illustrations, unpinned sections with native scrolling, the trail fully drawn
* the lightbox: open, arrow keys, Esc, focus handling
* launching a game, plus the back button (bfcache)
* every scoreboard state, and the session cache
* the cat: walks, trots or sprints with scroll speed, turns around, leaps between lives, sits, naps
* deep links and long nav jumps land on the right life

Last local run: **Lighthouse 100 / 100 / 100 / 100** (performance, accessibility, best practices, SEO) on
both mobile and desktop presets, against the preview server.

---

## How it's built

```
src/
├── index.html            page template (build fills the <!--@…--> slots)
├── data/content.js       ← all content: games, big games, store links, benches, runtime URLs
├── css/*.css             one file per life + base/cat/overlays/motion (inlined & minified at build)
├── js/
│   ├── main.js           entry: nav, wake-up, pinned scrubs, lazy loading per life
│   ├── cat-rig.js        the cat: procedural rig (IK legs, poses, gaits) — also renders static SVGs
│   ├── cat.js            cat controller: scroll speed → gait, per-life tracks, leaps, naps
│   ├── art.js            generated neon cabinet art — fallback for a cabinet with no screenshot (baked in at build)
│   ├── launch.js         View Transition "insert coin" launch into games
│   ├── lightbox.js       <dialog> viewer with View Transitions
│   ├── scores.js · gallery.js · trail.js · office.js · hero-gl.js   (lazy chunks)
├── build/markup.js       build-time HTML (cabinets, posters, store buttons, benches, code snippet)
└── static/               favicon, touch icon, og image, posters/ + cabs/ art (copied to dist/nine-lives/)
tools/                    build, preview server, fixtures, screenshots, checks, lighthouse
```

* **Engine:** CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`, named view
  timelines + `timeline-scope`) drive the pinned arcade aisle, the gallery wall, the poster stack, jar
  parallax, reveals, monitors powering on and the code "typing". JavaScript is used only where CSS can't
  react: the cat (velocity), the trail (path through real bench positions) and data fetching.
* **No-support fallback:** browsers without scroll-driven animations get the same page with native
  horizontal scrollers instead of pinned scrubs.
* **`prefers-reduced-motion`:** no live cat, no pinning, no parallax. Static cat illustrations (same
  drawing) sit on the wordmark and the cushion. The trail is fully drawn and every bench is shown.
* **Performance:** CSS inlined (no render-blocking requests), one preloaded font, a ~10 KB entry module,
  every life's code lazy-loaded near its section, images lazy, decorative loops paused off-screen, the
  cat's animation loop stops when idle, and the WebGL sky starts only once a visitor interacts.
* **Content:** edit `src/data/content.js`, then `npm run build`. The Big Games blurbs come from each
  game's store page; a poster's art is `src/static/posters/<name>.webp` (set `img` with its pixel size),
  or a drawn SVG in `markup.js` when a game has no key art (Reactor Purr). To add an arcade game, add a line to `ARCADE`
  and drop a 360×270 `src/static/cabs/<id>.webp` frame of it (without one, the cabinet gets generated art from
  the motif you pick in `src/js/art.js`). `npm run og` re-renders the share image `src/static/og.jpg` from the
  current art (needs `npm run serve` running); bump the `?v=` on the `og:image` URL so social sites refetch it.
