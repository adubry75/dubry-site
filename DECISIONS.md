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
- Master: a slow leveller (−6 to +8 dB, 2.5 s window) keeps sections and modes at a similar loudness, then a
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
- One of the near houses has a cat sitting in its lit window in the evenings (a neighbour's cat).
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
- Memory: caches are 4 room images + 4 view images + 4 snow layers, built in idle time after load and rebuilt only on
  resize, season, room or view change (dropped canvases are freed at once). Particles are capped. The 10-minute soak stays flat (see below).

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
- New cat behaviour: **grooming**. An awake cat now sometimes lifts a front paw to its chin and washes it for ~7 s
  (eyes closed, small head bobs) before setting it back down. It joins yawns, stretches, looking around, slow blinks,
  ear twitches, tail flicks, sleeping and waking.
- Ambient 60-minute render (seed 77, rain): peak −3.0 dBFS, 0 clipped, no gaps, 1-second RMS −23 to −13 dBFS, largest
  second-to-second change 3.2 dB over the whole hour. **Auto** music schedule added (fourth button,
  `mode=auto`, also in the `M` cycle): Lofi 6 AM–5 PM, Jazz 5–11 PM, Ambient 11 PM–6 AM by Medford time, switching
  with the usual 7 s crossfade and at most every 2 minutes, so a fast day never makes the music lurch. Checked live:
  10:00 → Lofi, 20:00 → Jazz, 02:00 → Ambient. The video renderer takes a fixed style (`--mode`), not Auto.
- `tools/render-video.mjs --still thumb.png --size 1280x720 …` saves one clean frame (for YouTube thumbnails).
  The page now has a share card (`og:image` = `lofi/og.jpg`, 1200×630, the cozy room at dusk with Daisy and the
  jack-o'-lantern) plus canonical and Twitter-card tags, like the home page.
- Chimney smoke: from mid-October to mid-April (wood-stove season in the Rogue Valley), or whenever it snows, soft
  puffs rise from a third of the town's chimneys and lean with the breeze (more in the rain).
- `?caption=1` (works with `record=1`): a small "♪ dusty moon · lofi · A♭ major · 76 bpm" caption fades in at the
  bottom-left for 8 s whenever a new section (track) starts, like lofi channels do. It's HTML, so it shows in screen
  recordings but not in `render-video.mjs` output, which captures only the canvas.
- When snow has settled on the town, a small snowman (top hat, carrot nose, red scarf) stands on the far sidewalk,
  fading in with the snow cover.

## Polish pass 4: independent code review
I had a separate reviewer agent read all the code cold and stress-test the engine (hour-long renders with mode and
weather changes, rapid switching, NaN injection, timing). Its real findings, all fixed:
- **One exception could freeze the scene forever**: the animation loop now re-arms itself before drawing and survives
  a bad frame. Odd URL values like `?cat=constructor` got past `SKINS[x]` checks, so they're validated with own-property
  checks now, plus weather. A 0×0 window (hidden or embedded frame) no longer produces Infinity transforms; the
  scene waits for a real size.
- **The moon jumped around at moonrise/moonset**: the refraction formula divided by zero just below the horizon. It's
  clamped now, as in SunCalc: 0 jumps over 30 simulated days, minute by minute.
- `?vol=abc` made `play()` throw (NaN gain ramp), so it's validated now.
- Audio robustness: the AudioContext is resumed inside the tap before any `await` (Safari), resumed again after an
  interruption (phone call, lock screen, tab back to visible), a failed start can be retried, and quick
  pause/play/pause no longer lets an old suspend timer cut the sound. Holding Space doesn't machine-gun play/pause,
  and Cmd/Ctrl shortcuts are left to the browser.
- **Jazz filter swept every bar** (a subtle "whoosh" on the ride): fixed, it now opens once per section like lofi.
- Denormals: the weather smoothers and the crackle state crept into subnormal numbers after ~37 min of silence,
  costing CPU on the audio thread. They now snap to zero.
- Weather values are clamped and NaN-proofed. If a NaN ever reached the output, the engine now zeros it and
  rebuilds the generator, so the radio can't go permanently silent.
- Ambient started with a burst if chosen mid-session (its timers counted from 0). Fixed.
- The ScriptProcessor fallback now runs the engine in 128-frame quanta, and the tape wobble no longer depends on block
  boundaries, so every path plays the same music for a seed. Re-verified browser vs Node: bit-identical for Lofi,
  Jazz and Ambient.
- Dropped canvas caches release their memory immediately (iOS caps total canvas memory). Lightning shows while the
  music is paused, the screen wake lock is released on pause.
- Tools: the local servers bind to 127.0.0.1 only and refuse paths outside the repo or folders; WAV headers no longer
  overflow on renders over ~6 h; very short renders fade correctly.
- Ambient now has two pad timbres, chosen per key section: the warm detuned saws, or a rounder triangle-like
  "soft" pad, so a long ambient session changes colour. Levels are matched (soft sections −16.4 LUFS in a 6-minute
  test).
- Lofi's last intro bar now has a soft kick on 1 and 3, so the full groove leans in rather than dropping in. The
  worst 1-second loudness change across three 6-minute renders fell to 2.2–4.1 LU.
- **Final listen-check of the samples** (rendered from the final engine; decoded MP3s, `tools/check-audio.mjs`):

  | file | peak | clipped | gaps | short-term loudness | worst 1 s change | integrated |
  |---|---|---|---|---|---|---|
  | lofi-3min-seed10.mp3 (D minor → F major → B♭ major) | −3.5 dBFS | 0 | none | −24.5 to −15.3 LUFS | 2.0 LU | −18.1 LUFS |
  | lofi-rain-3min-seed13.mp3 (F major → D minor, rain) | −3.3 dBFS | 0 | none | −22.4 to −14.3 LUFS | 2.2 LU | −17.5 LUFS |
  | jazz-3min-seed41.mp3 (A♭ major → B major) | −5.4 dBFS | 0 | none | −21.2 to −15.6 LUFS | 2.2 LU | −18.0 LUFS |
  | ambient-3min-seed21.mp3 (D dorian → A dorian) | −5.6 dBFS | 0 | none | −18.9 to −14.0 LUFS | 1.1 LU | −17.0 LUFS |

## Pet the cat
- Click or tap the cat (the cursor turns into a hand over it): it flicks an ear, wakes if asleep, turns to you and slow
  blinks. With the music on it also **purrs**, a synthesized rumble (band-passed noise pulsing ~26 times a second,
  breathing in and out) mixed after the leveller at about 7 dB under the music. It's measured by rendering the same
  seed with and without a purr and subtracting, which works because the engine is deterministic. Nothing changes
  for recordings: `record=1` has no cursor, and the purr only happens on a tap. The cursor stays hidden when idle,
  even over the cat.
- The golden-hour sunbeam is now the window's own shape (transom lights and the two big panes, with mullion
  shadows) thrown onto the wall, slanted with the low sun and soft-edged (drawn tiny and scaled up). It was a
  hard-edged slab, and it was on the wrong side: the window faces south, so evening sun from the west lands on the
  left (east) wall and morning sun on the right.
- Night atmosphere: on a wet road (during rain and for a while after) the street lamps, headlights and tail lights
  leave soft shimmering reflections; clear dark nights show a faint Milky Way band (dimmer when the moon is
  bright); and now and then a distant plane's blinking lights crawl across the night sky.
- Layout QA beyond the two required sizes: landscape phone (844×390), tablet portrait (1024×1366), ultrawide
  (2560×1080, more room shows), tiny (320×480), 1366×768, 1080×1920, and live resizing through a hidden 0×0 state
  and back. All compose sensibly with no console errors.
- After ~25 s asleep the cat **tucks its tail in**: over about ten seconds the tail is drawn up from hanging over the
  sill's edge to lying along the sill in front of the body, tip curled. It unfurls again on waking. The two tail
  shapes are blended point by point, with the tip slightly ahead. Blending the bend angles was tried first, and it
  swept the tail through mid-air under the sill.

## New music style: Bossa
- A fourth style for sunny afternoons. Nylon guitar (the Karplus-Strong voice) plays the syncopated bossa comp
  (fingers on 1, the "a" of 1, the "and" of 2, 3-and, 4) with a thumb bass on 1 and 3, sometimes pushing the next
  chord in early. Underneath: a cross-stick clave (3-2 or 2-3, chosen per section), soft shaker 16ths, a
  surdo-like root/fifth bass with a pickup, a feathered kick, a quiet Rhodes pad and the occasional melody. Same key
  and tempo system (70–90 BPM, which gives a relaxed bossa).
- Auto now runs Lofi 6 AM–1 PM, Bossa 1–5 PM, Jazz 5–11 PM, Ambient 11 PM–6 AM.
- Sample `lofi/samples/bossa-3min-seed51.mp3`: peak −4.2 dBFS, 0 clipped, no gaps, short-term −23.8 to −14.8 LUFS,
  worst 1 s change 2.8 LU, −17.8 LUFS integrated. Tested live: Lofi → Jazz → Bossa → Ambient → Lofi with no errors,
  and the browser/Node bit-exactness check still passes.
- `render-video.mjs --mode auto` follows the page's clock with the same 2-minute rule. Tested on a fast day
  starting at noon: Bossa at 1 PM (15 s in), Jazz at 135 s, crossfades within 2.8 LU, no clipping or gaps.
- Bossa 60-minute render (seed 88, storm with thunder): peak −3.0 dBFS, 0 clipped, no gaps, short-term −20.9 to
  −12.8 LUFS, worst 1 s change 3.2 LU, −16.5 LUFS integrated.
- Desktop control bar: it wrapped onto two rows even on wide screens (an absolutely positioned box at `left: 50%`
  shrink-wraps to half the viewport). It now sizes to its content and only wraps when the screen is narrow.
- A second kind of cameo: every 6–18 minutes (not in heavy rain) a little **rooftop cat** strolls along one of the
  town's flat roofs (only roofs not hidden by the sill's things or the main cat), sometimes sits halfway to look
  around, and fades in and out at the roof's ends. Its eyes glint at night, and the window cat watches it. (I first
  put it on the sidewalk, but the mug, plant and pumpkin hide most of the sidewalk.)
- The info panel has a live status line naming what the cat is up to: "Daisy is napping", "… is curled up asleep",
  "… is washing a paw", "… is watching the birds", "… is watching a cat on the roof", "… has a visitor: Nero", and so
  on. The solid-black skin is called "Kitty" there, and Callie/Soybean "Callie".
- **Next track** (⏭ button, `N` key): moves the current track to its closing bar (or, in Ambient, to the end of the
  current chord), so the normal smooth transition plays into a new key and tempo. Checked in all four styles.
- **Second 10-minute soak** on the near-final code (music playing, auto weather, a 2-minute day so every palette,
  the lamp and weather changes cycle several times): JS heap 1.6 → 2.3 MB and flat, DOM nodes constant at 301,
  headless fps 55–60 (the adaptive resolution stepped in for the software renderer), JS work ~1–2 ms a frame, no
  console errors or warnings. Its last frame caught one artifact, the Milky Way sprite's clipped edge showing as a
  faint rectangle in the night sky. The sprite now fades out at every edge.
- A plain Chromium (no autoplay flag) loads the page, record mode, and record + captions + auto + storm with a
  completely clean console.
- Sound to match the fireflies: on summer nights (June–August, after dark, fading out with rain, fog or snow) three
  synthesized crickets chirp quietly at different places in the stereo field, about 27 dB under the music.
  Silent the rest of the year, and off in the renderer unless asked for, so seeds still render identically
  (browser vs Node re-verified).


## New scene: the Lake view
- A second view out of the same window (**View: Town / Lake**, `view=lake`, `V` key, `--view lake` in the video
  renderer). It shows a forested lakeshore under the same distant volcano: three bands of pines with their mirror
  images in the water, the far shore's ground, a small cabin among the trees, and on the near bank grass, reeds, a
  wooden dock and a red canoe. It pairs naturally with the Cabin room for "cabin in the woods" videos.
- Live parts: drifting shimmer lines on the water; the sun's or moon's path on the water (a wobbling column of light
  under wherever the sun or moon is); rain rings on the lake when it rains; the cabin's window lights up at dusk
  (off in the small hours), glows on the water, and its chimney smokes; and now and then a **deer** wanders along
  the far shore at dawn or dusk and stops to graze (the cat watches it, and the status line says so). Fog, snow
  (on the pines, the far shore, the cabin roof, the bank and the dock), stars, clouds, birds, fireflies and storms
  all work the same as in the town. Cars, street lamps, wires, the rooftop cat and the town's chimneys are
  town-only.
- Checked with the full screenshot sweep (6 weathers × 7 times, desktop + phone, Cabin room): no console errors.
  It caught the town's window lights "glowing through the fog" over the lake, now town-only.
- Sound for the lake: soft water lapping at the dock (slow low swashes every 1–2.6 s, scattered across the stereo
  field), ~19 dB under the music, only in the Lake view (and in Lake-view renders). Seeds without it are unchanged.
- Built the same way as the town: drawn into per-palette caches (lit by the same four palettes, snow as a
  separate layer), with only the moving parts drawn each frame, so it costs about the same.

## Polish pass 6: second independent review (of everything added after the first)
A second reviewer read the new code cold and stress-tested it. It found no crashes, NaNs or runaway voices; it found
these behaviour glitches, all fixed and re-measured:
- **Next in Ambient took up to ~55 s** (it waited for one more old-key chord). It now switches key right away, and
  the first new-key chord arrives 1.5 s after the press, with the old pads releasing underneath.
- **A second Next within a bar made a one-bar "track"**, and so did pressing Next during a style crossfade. Next is
  now ignored while a new track is already lined up. Tested: two presses 2.5 s apart give one clean transition.
- **Petting spam made the music pump** (two stacked purrs drove the limiter down to −3 dB). Now there's only ever one
  purr (petting again extends it), its envelope is smoothed, and it's mixed about 13 dB under the music. With purr
  spam, limiter activity is the same as with no purr.
- A possible doubled (flammed) kick when Next landed on the last intro bar. Fixed.
- **Rendered videos never had crickets**: the page now reports them to the video renderer too, from the same helper.
- `?stray=1` (testing) was used up by the instant warm-up. Now it's applied after it.
- **The tail jumped in front of the hind paw** in one frame mid-tuck; it now crossfades between the two layers.
- The rooftop cat only ever had one short roof. The filter was stricter than needed (the sill's things sit lower
  than every roof), so four roofs qualify now.
- **10-minute 1080p video test** (`--mode auto --fast 600 --weather auto`): exactly 600 s at 30 fps, and the music
  followed the rendered day (Lofi → Bossa → Jazz → Ambient → Lofi at dawn). Peak −3.0 dBFS, no clipping or gaps,
  −17.0 LUFS. Rendered in 21 min here (software rendering, other tests running alongside). Memory for Chromium +
  Node + ffmpeg together stayed flat at ~710–790 MB. Output is ~175 MB per 10 minutes at the default `--crf 18`;
  use `--crf 22` for files about half the size.

## Sleep timer
- For falling asleep to it: `T` cycles the sleep timer through 30, 60, 90 minutes and off (or `?sleep=60`). A small
  toast confirms, the info panel counts down, and the radio fades out over the last two minutes, then pauses. The
  scene keeps running. Tested with a 3-second timer: it paused on schedule, and the cycle and toasts work.

## Polish pass 7: small screens and a real bug
- **Bug: the play button never turned into a pause button.** The icons are SVG elements, and `svg.hidden = …` is a
  no-op (`hidden` is an HTML property, not an SVG one). It now toggles the attribute. Found by looking closely at a
  landscape-phone screenshot.
- Landscape phones (height ≤ 480 px) get a compact control bar and info panel, so the cat stays visible while the
  controls are up. Touch devices don't show the keyboard-shortcut hint on the start screen.
- Video renderer speed: profiled per frame (about 22 ms to render in software + 24 ms to JPEG-encode + transfer).
  Batching frames and async `toBlob` pipelining gave no gain here (Chromium encodes on the same thread and this
  machine is CPU-bound), so I left it simple. On a machine with a GPU, rendering is the cheaper half.
- Accessibility: with the OS "reduce motion" setting, lightning is a slow 2-second glow at half the brightness
  instead of a quick flicker (measured: peak 0.35 over 1 s, versus a 0.72 flicker). The thunder still rumbles.
- **Third 10-minute soak** (Lake view, Auto music, auto weather, 2-minute days): heap 1.6 → 2.4 MB and flat,
  DOM nodes constant (332), 55–60 fps, no console errors. It showed two rare long frames (55 and 82 ms), most likely
  a snow layer being built when snow first fell. Snow layers are now built in idle time too. Measured afterwards:
  every cache is ready within 8 s of opening the page, and the worst frame when snow begins is 4 ms.
- Refreshed the arcade cabinet image (`lofi-radio.webp`, in `src/static/cabs/` and `dist/nine-lives/cabs/`) and the
  share image (`lofi/og.jpg`, now `?v=2` so social sites refetch it) with the current look (dusk, chimney smoke,
  window-shaped sunbeam, birds on the wire). Both were rendered with `render-video.mjs --still`.
- **Tuning in**: pressing play now sounds like switching on a radio. A 1.6 s sweep of soft band-passed static with a
  faint whistle gliding down as it "locks on", while the music rises underneath (it peaks ~7 dB under the music, no
  spikes). Only on play, never in the renderers, so seeds still render identically.

## New scene: the City view
- A third view (`view=city`, `V` cycles Town → Lake → City): the classic lofi night city. A hazy far skyline,
  then nearer mid-rise buildings with window grids, cornices, fire escapes, rooftop water tanks and a radio mast
  with a slowly blinking red light; an elevated railway on pillars; a street below. All original and generic.
- Live parts: hundreds of windows light up after dusk (fewer in the small hours, a few flickering like TVs); seven
  neon signs with generic words (CAFÉ, NOODLES, OPEN, BOOKS, 24H, RECORDS, TEA) switch on at dusk, hum gently in
  brightness, and one or two stutter now and then; their colours smear on the wet street in the rain; and every 1–2
  minutes an elevated train of 3–4 lit carriages glides across (the status line says "… is watching the train go
  by"). Weather, snow layers, sky, moon and palettes work as in the other views.
  Two of the lit windows have a tiny cat silhouette sitting in them, flicking its tail now and then: a wink to the
  window cat.
- Checked: screenshot sweep (4 weathers × 7 times, desktop + phone, no console errors) and performance in software
  rendering (8–31 ms a frame, the same as the town).
- The train is heard too: a soft, distant rumble with paired rail clacks every ~0.4 s, swelling and fading over exactly
  the time the train takes to cross, panned in its direction, about 13 dB under the music. Like thunder, it's sent
  from the scene to the engine, so videos rendered with `render-video.mjs --view city` include it (checked: two trains
  in a 2-minute render, each passing its 15.6 s crossing time to the rumble; peak −2.9 dBFS, no clipping).
- **Fourth 10-minute soak** (City view, Auto music, auto weather, 2-minute days, trains and neon cycling): heap
  2.3–2.5 MB and flat, DOM nodes constant, 56–59 fps, worst frame 20 ms, no console errors or warnings.

## Polish pass 8: third independent review (Lake, City, sleep timer, new sounds)
A third reviewer checked everything since the second review (it confirmed: no NaNs, no runaway voices, determinism
intact, drawing state never leaks out of the new views). Fixed:
- **The sleep timer didn't work with the screen locked** (it ran from animation frames, which stop when a page is
  hidden), which is exactly when it matters. The fade is now scheduled on the audio clock and the pause on a timer;
  both keep running in the background. Tested with the animation loop stopped: it still paused on time.
- A timer that ran out while paused made the next Play pause again. Now it's simply over.
- During the final 2-minute fade, Play or the volume slider swelled back to full volume. Every volume change now
  respects the fade (all volume changes are explicit ramps, which also fixed a WebAudio ordering subtlety I found
  while testing: a ramp queued after `setTargetAtTime` starts from the wrong anchor). Measured: a timer's gain glides
  down smoothly to 0 and pauses.
- **City: lit windows were painted over the elevated railway.** The window grid and the signs now stop above it.
- Small ones: the "watching a deer" status could follow you into other views; the tune-in could blip on the old
  ScriptProcessor fallback (tune-in is now AudioWorklet-only); toasts no longer cover the control bar when it's up
  (they show mid-screen then); no fireflies over the City.

## Final QA (4 AM)
- Full screenshot sweep again on the final code (6 weathers × 7 times, desktop + phone, plus the controls): no
  console errors, nothing off in the contact sheets.
- Fifth 10-minute soak on the default experience (Town, Lofi): heap 2.2–2.5 MB and flat, DOM nodes constant, 58–60
  fps, no console errors or warnings.
- The five committed MP3 samples are bit-identical (decoded PCM hashes) to what the final engine renders for the
  same seeds, so they truly represent the shipped music.
- `npm run build` reproduces the committed `dist/` exactly (zero diff).
- Re-checked the visitor cameo in the City, the Lake on a landscape phone and the Town on a portrait phone: it sat
  too low (only ears and eyes showed). It now rises a bit higher, so its whole face and both front paws rest on the
  bottom edge of the frame.
- The fallback for browsers without AudioWorklet, tested by forcing the worklet to fail: the page switches to the
  same engine on a ScriptProcessor, music plays (signal measured), style switching works, and the console shows only
  the expected "using ScriptProcessor" notice. Laptop sizes (1366×768, 1024×768) checked with the controls up.

## Last music pass (4:15 AM): more harmony
- Six more chord progressions for variety: I–ii–iii–IV, IV–V–iii–vi, and the "backdoor" I–♭VII–IV–iv for major
  keys; i–♭VII–♭VI–Vsus and iv–i–♭VI–♭VII for minor keys; I–♭III9–ii–V for jazz. All samples were re-rendered
  from this final engine and re-checked:

  | file | peak | clipped | gaps | short-term loudness | worst 1 s change | integrated |
  |---|---|---|---|---|---|---|
  | lofi-3min-seed10.mp3 | −3.4 dBFS | 0 | none | −24.1 to −14.2 LUFS | 2.3 LU | −18.2 LUFS |
  | lofi-rain-3min-seed13.mp3 | −3.5 dBFS | 0 | none | −21.9 to −14.4 LUFS | 2.2 LU | −17.3 LUFS |
  | jazz-3min-seed41.mp3 | −5.2 dBFS | 0 | none | −21.5 to −14.2 LUFS | 4.6 LU (a section change) | −17.9 LUFS |
  | bossa-3min-seed51.mp3 | −4.2 dBFS | 0 | none | −23.8 to −14.8 LUFS | 2.8 LU | −17.8 LUFS |
  | ambient-3min-seed21.mp3 | −5.6 dBFS | 0 | none | −18.9 to −14.0 LUFS | 1.1 LU | −17.0 LUFS |

  Browser and Node still match bit for bit; 6 seeds × 4 minutes of lofi, jazz and bossa: no NaN, peaks under the
  limiter ceiling. (The earlier sample tables above describe the samples as they were then.)

---

# Summary

**What I built:** Lofi Cat Radio, a new page at `/lofi/`. A cozy, endless, generative scene: a cat (Daisy, Nero,
Jammies, Callie/Soybean or solid black) napping, yawning, grooming and stretching on a windowsill above a small town
(you can pet the cat, and it purrs). Sky, sun, moon and room lighting follow real Medford time. Weather drifts
through clear, cloudy, rain, gentle storms, snow and fog, or follows Medford's live weather. Lights come on in the
town at dusk, and cars, birds, a rooftop cat, chimney smoke, seasonal décor and a visiting second cat keep it gently
alive. Three views out of the window (the town; a forested lake with a cabin and the occasional deer; a
neon-lit city with an elevated train) and
three room moods (Cozy, Cabin, Blue hour).

The music is generated live in the browser and never loops: **Lofi** (Rhodes/piano/guitar jazz voicings, dusty
drums, bass, vinyl, tape wobble), **Jazz** (brushes, ride, walking bass), **Bossa** (nylon guitar, clave, shaker),
**Ambient** (pads, drone, swells, nothing plucked or bell-like), or **Auto**, which follows the clock. Rain, snow,
fog, thunder and summer crickets are mixed in to match the weather. Everything is original and drawn or synthesized
in code.

**Deploy (WinSCP):**
1. Upload the `lofi/` folder to `public_html/lofi/`. That's the whole page: about 250 KB of code + a 100 KB share
   image. `lofi/samples/` (5 MP3s, about 14 MB) is optional.
2. For the two links on the home page, upload `dist/index.html` → `public_html/index.html` and
   `dist/nine-lives/cabs/lofi-radio.webp` → `public_html/nine-lives/cabs/lofi-radio.webp`. Nothing else on the
   server changes (all the hashed JS files are byte-identical).
3. If the server has its own games index page outside this repo, add `<a href="/lofi/">Lofi Cat Radio</a>` there.

**Record a 1-hour video:**
- **Easiest, no screen recording:** `node tools/render-video.mjs --minutes 60 --seed 7 --mode lofi --weather rain
  --cat daisy --out lofi-rain-1h.mp4` renders a finished 1080p MP4 (picture and music in sync) offline. Add
  `--fast 3600 --time 2026-11-01T05:30:00-07:00 --mode auto` for a whole day in an hour, with the music following
  it. `--still thumb.png --size 1280x720` makes a thumbnail. It needs Node, ffmpeg and Playwright (once:
  `npm i -D playwright && npx playwright install chromium`). It ran at ~17 frames/s here without a GPU, so an hour at 30 fps takes
  about two hours (≈1 GB at the default quality; `--crf 22` roughly halves it).
- **Or screen-record:** open `https://dubry.com/lofi/?record=1` in Chrome full screen (F11) at 1920×1080, click once
  to start the sound (`record=1` hides every control and the cursor; `&autoplay=1` starts it by itself in a Chrome
  launched with `--autoplay-policy=no-user-gesture-required`), and record the window + desktop audio in
  OBS for 60 minutes. URL options: `mode=lofi|jazz|bossa|ambient|auto`,
  `weather=auto|live|clear|cloudy|rain|storm|snow|fog`, `cat=daisy|nero|jammies|callie|black`,
  `room=cozy|cabin|blue`, `view=town|lake|city`, `seed=7` (same seed = same music), `fast=3600` (a whole day per hour), `time=21:30`,
  `caption=1` (now-playing captions).
- **Ready-made recipes** (all checked by screenshot; append to `https://dubry.com/lofi/?record=1&`, or pass the same
  values to `render-video.mjs` as `--mode … --weather … --cat … --room … --view … --time …`):
  | Video | Settings |
  |---|---|
  | Rainy night lofi | `mode=lofi&weather=rain&time=21:30&cat=daisy&room=cozy&view=town` |
  | Snowy cabin ambient | `mode=ambient&weather=snow&time=19:00&cat=nero&room=cabin&view=lake` |
  | Sunny bossa afternoon | `mode=bossa&weather=clear&time=15:00&cat=jammies&room=blue&view=town` |
  | Stormy jazz night | `mode=jazz&weather=storm&time=23:30&cat=black&room=cabin&view=town` |
  | Misty lake morning | `mode=ambient&weather=fog&time=07:45&cat=callie&room=blue&view=lake` |
  | Golden hour by the lake | `mode=lofi&weather=clear&time=17:45&cat=callie&room=cozy&view=lake` |
  | Neon city in the rain | `mode=lofi&weather=rain&time=21:30&cat=black&room=blue&view=city` |
  | A whole day in an hour | `mode=auto&weather=auto&fast=3600&time=05:30&view=lake&room=cabin` |
- **Keys on the page:** Space play/pause · N next track · M music style · W weather · C cat · R room · V view ·
  T sleep timer · D fast day · F full screen · H hide controls. Click the cat to pet it.
- **Soundtrack only:** `node tools/render-audio.mjs --minutes 60 --seed 7 --mode lofi --weather rain --out
  lofi-1h.mp3` (deterministic per seed, ~2–3 minutes per hour of audio).

**What I could and couldn't verify:** everything was tested in headless Chromium: screenshots of every weather ×
time on desktop and phone (town, lake and city), five 10-minute soaks (town, lake, city) with flat memory, console clean, live mode switching, the browser
audio matching the Node renderer bit for bit, and level analysis of every sample plus 60-minute renders of each
style. I couldn't test real Safari/iPhone or Firefox (only Chromium is installed here), or frame rate on a real GPU.
In software rendering it already runs at 55–60 fps with adaptive resolution, and the Safari-specific risks I know
of are handled in code. Worth a quick look on your phone.
