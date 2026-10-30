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
