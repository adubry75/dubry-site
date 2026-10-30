# Lofi Cat Radio: decisions log

Overnight build of `/lofi/`. Each entry is a call I made without asking, and why.

## Where things live
- **The page is a self-contained folder, `lofi/`, at the repo root** (not under `src/` or `dist/`).
  `npm run build` wipes and regenerates `dist/` for the Nine Lives home page. Keeping Lofi Cat Radio out of that
  pipeline means it needs no build step, can't break the home page build, and deploys as one folder:
  upload `lofi/` to `public_html/lofi/`.
- Plain ES modules, no bundler, no dependencies, so the files on the server are the files in the repo.
- `tools/render-audio.mjs` (offline renderer) and `tools/check-audio.mjs` (level checker) sit next to the
  site's other tools.

## Music engine
- **One pure-JS DSP engine (`lofi/js/engine.js`) runs in both the browser and Node.** The browser runs it inside an
  AudioWorklet, which is still WebAudio, just on the audio thread. A WebAudio node graph can't be
  rendered deterministically in Node without a native dependency, and two separate implementations would drift
  apart. With one engine, the 1-hour MP3 sounds like the page, and a seed renders the same file every time.
- All randomness comes from seeded PRNGs (mulberry32 / xorshift), never `Math.random`.
- Synthesis, all original: FM electric piano (Rhodes-style) with jazz voicings (maj9, m9, m11, 13, 7♭9, 6/9,
  9sus4 …) voice-led by a small search that minimises movement; sine bass with approach notes; synthesized
  kick, snare, ghost notes, hats and shaker on a "dusty" half-sample-rate drum bus; sparse pentatonic melodies;
  vinyl crackle and hiss; tape wow and flutter (a modulated delay line); an 8-line FDN reverb.
- **Ambient mode has no bells and nothing percussive or plucked**: every envelope in it has a slow raised-cosine
  attack (pads 3.5–8 s, swells 9–16 s, the slow lead ≥ 1.6 s). Ingredients: detuned PolyBLEP-saw pads through
  breathing low-pass filters, a root/fifth drone that crossfades on key changes, filtered-noise "air" swells,
  a slow vibrato lead now and then, and a long (7.5 s) reverb.
- Lofi sections run 24–48 bars (about 1–3 minutes) and move to a *related* key (a fourth, a tone, relative
  minor/major) with a tempo nudge of 3–7 BPM inside 70–90. Transitions: the last bar drops the snare and
  half the hats, holds a long chord and closes the filter a little; the next section opens with Rhodes, bass and
  soft hats while the filter opens. There is never silence, and the tempo change lands where there is no groove
  to break.
- Mode changes crossfade over 7 s, and the new generator starts in the old one's key.
- Master: a slow leveller (±6 dB, 2.5 s window) keeps sections and modes at a similar loudness, then a
  look-ahead limiter at −1 dBFS and a soft clip. Target loudness is about −18 LUFS integrated: comfortable
  for background listening, with headroom.

## Links from the home page
- The brief allows one link from the home page and one from the games/demos area. The games area *is* the
  home page's Arcade, so: **one new arcade cabinet** ("Lofi Cat Radio", `/lofi/`, last in the aisle, with a real
  frame of the scene as its screen at `src/static/cabs/lofi-radio.webp`) and **one footer link** next to
  "54 Bench Challenge" and "Art portfolio". The only source edits are one line in `src/data/content.js` and one
  line in `src/index.html`. `dist/` was rebuilt: `dist/index.html` changed and one image was added; every hashed
  JS file is byte-identical. The arcade heading counts the cabinets itself, so it now says 35.
- If the server has a separate games index page (outside this repo), it needs a link added by hand:
  `<a href="/lofi/">Lofi Cat Radio</a>`.

## Scene
- **Everything is drawn in code on one canvas**, with a 1920×1080 logical design. Wider screens see more wall; phones
  (portrait) zoom to the window and get the ceiling, a floor, a rug, a cat bed and a ball of yarn above and below.
- **Lighting follows the sun's real altitude** for Medford (SunCalc-style formulas in `lofi/js/sky.js`) through four
  palettes (night, blue hour, golden hour, day). The town and the room are pre-rendered once per palette and
  crossfaded, which keeps frames cheap (mostly a few `drawImage` calls) and makes transitions perfectly smooth.
- The window faces south, so the sun arcs across it and the moon (real position and phase) shows up when it's
  in that part of the sky.
- The town is generic and drawn freehand: rows of houses, a steeple, power lines with birds on them, street
  lamps, a distant snowy volcano (the Rogue Valley has one on the horizon; this one is not a portrait of any real
  mountain). Trees follow the real season: autumn colours now, bare in winter, blossom in spring.
- Lights in town windows each have their own darkness threshold and bedtime, so they come on one by one at dusk
  and go off one by one late at night; a few come on before sunrise. About 30% of windows never light (empty rooms).
- Night touches: the lamp turns itself on at dusk (warm pool of light, reflected in the glass), fairy lights
  twinkle, passing cars throw headlight sweeps across the ceiling, and a rare shooting star crosses clear skies.
- **The cat** is procedural bezier art with a small behaviour model: sleeps (slow breathing, head on paws), wakes
  with a yawn, loafs with slow blinks, looks around, watches birds fly past, stretches, twitches ears and flicks
  its tail. Pupils are slits in daylight and round at night. Skins: Daisy (black, white socks), Nero (beige),
  Jammies (orange tabby), Callie/Soybean (Siamese points, blue eyes), solid black.
- **The second cat's cameo** is a "photobomb": every 8–23 minutes another of the five cats peeks up from the bottom
  of the frame, looks around and sinks back. The main cat wakes up and looks at it.

## Performance
- Measured in headless Chromium with **software** rasterization (no GPU here), forcing a canvas readback every frame:
  first version 20–50 ms per frame at 1920×1080. Profiled per section and fixed the hotspots: film grain and the
  glass sheen are baked into the cached room (were full-screen blends every frame), the lamp's light is one
  pre-merged additive sprite and is baked into the night room, clouds are tinted once per colour change and
  drawn into a third-resolution layer. Now 12–35 ms in pure software and about 1.5 ms of JavaScript per frame.
  A normal GPU-accelerated browser composites this far under 16 ms.
- Safety net for slow machines: if the page can't hold ~45 fps for 4 s, it renders at a lower canvas resolution
  (down to 50%). Everything is soft shapes, so it still looks right. `?quality=1` pins full resolution.
- Memory: caches are 4 room images + 4 town images (+4 snow images if it snows), built lazily per palette and
  rebuilt only on resize or season change. Particles are capped. The 10-minute soak stays flat (see below).

## Polish pass 1 (cat close-ups, poses, soak)
- Looked at every skin awake, asleep and at night, plus the yawn, the stretch and the visitor. Fixed: the window
  rim light outlined the whole cat, so it now only catches the top edges, like real backlight; the Siamese mask
  was a dark blob (a hole at night), so it is now a smaller, softer mask on the muzzle; the lighter chest on Nero
  and Jammies was a visible disc, so it is now a wide, faint wash.
- 10-minute soak (fast day cycle, auto weather, music playing): JS heap 1.4 → 2.0 MB and flat after the first
  minute, DOM nodes constant at 224, no console errors or warnings. JS work per frame 1.3–3.4 ms on average.

## Polish pass 2 (music)
- **The browser and the renderer produce identical audio.** Checked by rendering 8 s of each mode in Chromium with an
  `OfflineAudioContext` + the real AudioWorklet and comparing with the Node engine for the same seed: max
  difference 0.0 (bit-identical). The renderer now runs the engine in the same 128-frame quanta as the browser,
  because a few ambient events are timed at block boundaries.
- Lofi grooves now swing their off-beat 8ths (they were straight; only 16ths swung). About a third of sections
  play a soft **felt piano** (additive, slightly stretched partials, higher ones decaying faster) instead of the
  Rhodes: the brief said "Rhodes/piano". The last bar of a section has a quiet filtered-noise riser that leads
  into the next one.
- Tempo now drifts 3–7 BPM per section and bounces off the 70/90 limits. Before, clamping made some seeds sit
  at 90 forever.
- Listen-check of the samples in `lofi/samples/` (decoded from the MP3s):

  | file | peak | clipped | silence gaps | short-term loudness | worst 1 s change | integrated |
  |---|---|---|---|---|---|---|
  | lofi-3min-seed10.mp3 (D minor piano → F major Rhodes → D minor) | −3.4 dBFS | 0 | none | −23.0 to −14.5 LUFS | 3.1 LU | −18.1 LUFS |
  | ambient-3min-seed21.mp3 (D dorian → A ionian) | −4.7 dBFS | 0 | none | −19.9 to −13.8 LUFS | 1.2 LU | −17.1 LUFS |
  | lofi-rain-3min-seed13.mp3 | −3.3 dBFS | 0 | none | −21.0 to −14.2 LUFS | 2.7 LU | −17.2 LUFS |

- "No bells, no plucks" in Ambient, measured: with the signal high-passed at 200 Hz, ambient has **no** level rise above
  6 dB within 60 ms (largest 5.1 dB, which is pad beating), while lofi has 77 (drums and keys).

## New weather: Storm and Live
- **Storm** is kept cozy: lightning is a soft, bluish brightening behind the clouds (a quick double flicker), and the
  room catches only a faint wash of it. The rumble is distant: filtered brown noise with a slow 0.5–1 s attack,
  arriving 1.5–5 s after the flash. Thunder is generated by the music engine, which tells the page when to flash,
  so sight and sound line up (and `--weather storm` works in the renderer). With the sound off, the page makes its
  own flashes. Auto weather picks storms rarely.
- **Live (Medford)** fetches the current conditions from Open-Meteo (free, keyless, allows browser requests) every
  15 minutes and maps the WMO weather code to our weather (drizzle → light rain, showers → rain, thunderstorm →
  storm, fog codes → fog, cloud cover → how cloudy). On failure it says "live weather unavailable" in the info line
  and retries a couple of minutes later. Tested: it picked up tonight's real overcast (code 3, 98% cloud).

## Seasonal touches (new mood detail)
- The sill gets a small seasonal object by the real date: a friendly jack-o'-lantern Oct 1–Nov 7 (round eyes and a
  smile, glows and flickers after dark; it's Halloween week), a tiny potted pine with baubles plus multicoloured
  fairy lights Dec 1–Jan 6, tulips in spring, a sunflower in summer. The town's trees already follow the season,
  and autumn leaves drift past the window now and then.

## New music style: Jazz
- A third mode beside Lofi and Ambient: a late-night trio. Brushes (band-passed noise sweeps) plus soft cross-stick
  on 2 and 4 and a feathered kick, a ride cymbal playing "ding, ding-a" on triplet-swung 8ths, a **walking upright
  bass** (root, chord tones or scale steps, then a chromatic approach to the next chord on beat 4, with the
  occasional skip note), and piano or Rhodes comping in Charleston-style rhythms over ii–V–I style progressions.
  Same seeded section system as lofi (new key and tempo every 1–3 minutes, 70–90 BPM). Less vinyl crackle, no
  half-rate "dusty" drum bus (it would alias the ride).
- Sample: `lofi/samples/jazz-3min-seed41.mp3`: peak −5.5 dBFS, no clipping, no gaps, short-term loudness −20.6 to
  −15.6 LUFS, worst 1 s change 2.4 LU, −18.0 LUFS integrated. Tonal balance is like lofi with ~4 dB more air (ride).
- Tested live in Chromium: Lofi → Jazz → Ambient → Lofi on desktop and phone. The info line follows each switch, the
  new style starts in the old one's key, play/pause works, no console errors. `M` cycles the three styles.

## Offline video renderer
- `tools/render-video.mjs` loads the page with `?manual=1` (a virtual clock: the page exposes `__lofi.step(dt)` and
  stops its own animation loop), steps it once per frame, grabs each frame from the canvas as a high-quality JPEG
  and pipes it to x264. Meanwhile the same music engine runs in Node in lockstep: each frame it takes the page's
  current weather (so rain and snow sounds fade with what you see), and each thunder it schedules is passed back
  to the page as a flash. Fades in and out at both ends, then audio and video are muxed into one MP4 (H.264 CRF
  18 + AAC 192k). Verified on a storm test: the sky flash lands at 11.37 s, the engine scheduled it at 11.2 s, and
  the rumble follows 1.5–5 s later, as intended. ffprobe shows exact 1920×1080, 30 fps, matching audio length.

---

# Summary (read this first)

**What I built:** Lofi Cat Radio at `/lofi/`. A cozy, endless, generative scene: a cat (Daisy, Nero, Jammies,
Callie/Soybean or solid black) napping on a windowsill above a small town. The sky, sun, moon and room lighting
follow real Medford time, and the weather drifts (clear, cloudy, rain, gentle storms, snow, fog, or the real
current Medford weather). Music is generated live with no loops: **Lofi** (Rhodes/piano jazz chords, dusty drums,
bass, vinyl, tape wobble), **Jazz** (brushes, ride, walking bass) and **Ambient** (pads, drone, swells, nothing
plucked). There's an offline renderer for long soundtracks.

**Deploy (WinSCP):** upload the `lofi/` folder to `public_html/lofi/`. That's the whole page (≈ 150 KB of code;
`lofi/samples/` is optional, about 11 MB of MP3s). For the links on the home page, re-upload `dist/index.html` to
`public_html/index.html` and `dist/nine-lives/cabs/lofi-radio.webp` to `public_html/nine-lives/cabs/`. Nothing
else changed.

**Record a 1-hour video:**
1. Open `https://dubry.com/lofi/?record=1` in Chrome, full screen (F11) on a 1920×1080 display. `record=1` hides
   every control and the cursor. Click once to start the sound.
   Handy URL options: `mode=lofi|jazz|ambient`, `weather=auto|live|clear|cloudy|rain|storm|snow|fog`,
   `cat=daisy|nero|jammies|callie|black`, `seed=42` (same seed = same music), `fast=3600` (one whole day passes in
   one hour; `fast=1` is a 6-minute day), `time=21:30` (start at a given Medford time).
   Example: `/lofi/?record=1&mode=lofi&weather=rain&cat=daisy&fast=3600&seed=7`.
2. In OBS: a Window or Display Capture of that Chrome window + Desktop Audio, output 1920×1080 at 30 or 60 fps,
   and record for 60 minutes.
3. **Easiest: no screen recording at all.** `tools/render-video.mjs` renders a finished MP4 (picture and music)
   offline, frame by frame. It can't drop frames, and storms' flashes and rumbles stay in sync:
   `node tools/render-video.mjs --minutes 60 --seed 7 --mode lofi --weather rain --cat daisy --out lofi-rain-1h.mp4`
   (add `--fast 3600 --time 05:30` for a whole day, dawn to night, in one hour). Here, without a GPU, it ran at
   ~17 frames/s, so an hour at 30 fps takes under two hours; `--fps 24` is quicker. It needs Node, ffmpeg and
   Playwright's Chromium (`npx playwright install chromium` once).
4. Or record the picture only and use a rendered soundtrack, e.g.
   `node tools/render-audio.mjs --minutes 60 --seed 7 --mode lofi --weather rain --out lofi-1h.mp3`, then
   `ffmpeg -i video.mp4 -i lofi-1h.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest final.mp4`.

## New moods: room themes
- A "Room" control (and `room=` URL option, `R` key, `--room` in the video renderer): **Cozy** (the original warm
  peach room with terracotta curtains), **Cabin** (log-plank walls, green plaid curtains, darker wood) and **Blue
  hour** (dusty blue walls, cream curtains, white-painted window). Same layout, so the cat, lighting and weather
  all carry over, and each theme gets its own pre-lit caches. Gives several distinct-looking videos from one page.
- Polish pass 3 check: rendered a full day in 60 s (960×540, 24 fps) with the video renderer and measured every
  frame. The largest frame-to-frame brightness change is 2.2/255 (sunrise and sunset are smooth crossfades, and
  the lamp and window lights fade rather than pop). The contact sheet shows the moon at night, the sun by day, the
  jack-o'-lantern lighting up at dusk, and no visual glitches.
- Full screenshot re-run (6 weathers × 7 times × desktop/phone = 84 shots + controls): no console errors. Fixed what
  it showed: night fog was drawn with untinted white sprites and looked like a glowing band, so fog banks are now
  tinted to the sky's colour (darker at night), and lit windows and street lamps glow through fog.
- Phones (portrait) showed a big empty band of wall above the window, so there's now a high floating shelf up there
  (framed photos, books, a little cat figurine, a jar, a trailing pothos). It sits above y=0 in the design, so a
  16:9 screen never shows it and the desktop composition is unchanged.
- Small life touches: fireflies blink over the town on clear summer nights, spring days have pink blossom petals
  drifting past (like the autumn leaves), and the info panel shows the session's **seed**. Same seed, same
  music: open `?seed=N` or render it offline with `--seed N`. Switching room themes now drops the other themes'
  cached room images, so cycling themes can't pile up memory.
- Lofi gained a third keys instrument: a soft **fingerpicked nylon guitar** (Karplus-Strong string synthesis with a
  small body resonance) for about one section in five, picking the jazz voicing as broken-chord 8ths and strumming
  the long chord at the section's end. The keys split is Rhodes 50%, felt piano 30%, guitar 20%. The info line names
  the instrument when it isn't the Rhodes.
- Radio flavour: every section gets a made-up track title, like "sleepy radiator", "tea & whiskers" or "faraway
  moon". It's derived from the section's key, tempo and the seed, so it's stable, and it's shown in quotes in the
  info line.
- 60-minute renders (seed 77, rain) of Lofi and Jazz: peak −3.0 dBFS, 0 clipped samples, no silence gaps, 1-second
  RMS stays between −26 and −12 dBFS for the whole hour. Rendering takes about 2–3 minutes per hour of audio.
