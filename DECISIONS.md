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
