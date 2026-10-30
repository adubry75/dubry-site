// Lofi Cat Radio: wiring. Time and sky, weather, the controls, the audio.
import { Scene, THEMES } from './scene.js';
import { SKINS, SKIN_IDS } from './cat.js';
import { sunPosition, moonPosition, moonIllumination, localParts, clockText, sunTimes } from './sky.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const RECORD = q.get('record') === '1';
const store = {
  get(k, d) { try { const v = localStorage.getItem('lofi-cat-radio:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lofi-cat-radio:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ── settings (URL beats saved beats default)
const settings = {
  mode: q.get('mode') || store.get('mode', 'lofi'),
  weather: q.get('weather') || store.get('weather', 'auto'),
  cat: q.get('cat') || store.get('cat', 'daisy'),
  room: q.get('room') || store.get('room', 'cozy'),
  view: q.get('view') || store.get('view', 'town'),
  volume: (() => { const v = q.has('vol') ? parseFloat(q.get('vol')) : Number(store.get('volume', 0.8)); return Number.isFinite(v) ? clamp(v, 0, 1) : 0.8; })(),
  fast: q.has('fast') ? q.get('fast') !== '0' : false,
};
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
if (!own(SKINS, settings.cat)) settings.cat = 'daisy';
if (!own(THEMES, settings.room)) settings.room = 'cozy';
if (!['town', 'lake'].includes(settings.view)) settings.view = 'town';
if (!['auto', 'live', 'clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'].includes(settings.weather)) settings.weather = 'auto';
if (!['lofi', 'jazz', 'bossa', 'ambient', 'auto'].includes(settings.mode)) settings.mode = 'lofi';
// Auto: the music follows the clock: lofi in the morning, bossa in the afternoon, jazz in the evening, ambient late at night
const scheduleFor = (hour) => (hour >= 6 && hour < 13 ? 'lofi' : hour >= 13 && hour < 17 ? 'bossa' : hour >= 17 && hour < 23 ? 'jazz' : 'ambient');
let playingMode = null, lastSwitch = -1e9; // what the engine is actually playing
const startMode = () => (settings.mode === 'auto' ? scheduleFor(localParts(virtual).hour) : settings.mode);
const DAY_SECONDS = q.has('fast') && parseFloat(q.get('fast')) > 1 ? parseFloat(q.get('fast')) : 360; // a fast day lasts 6 minutes
const seed = q.has('seed') ? parseInt(q.get('seed'), 10) >>> 0 : (Date.now() ^ (performance.now() * 1000)) >>> 0;

// ── time: real Medford time, or a fixed/fast clock
let offset = 0; // virtual - real
if (q.has('time')) { // ?time=21:30 (Medford local, today) or a full ISO date
  const t = q.get('time');
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) {
    const now = Date.now(), p = localParts(now);
    const cur = p.hour * 60 + p.minute, want = +m[1] * 60 + +m[2];
    offset = (want - cur) * 60e3 - p.second * 1000;
  } else if (!isNaN(Date.parse(t))) offset = Date.parse(t) - Date.now();
}
const freeze = q.get('freeze') === '1'; // hold the clock still (for screenshots)
const MANUAL = q.get('manual') === '1'; // tools/render-video.mjs drives frames itself, on a virtual clock
let virtual = Date.now() + offset, catchUp = false;
function advanceClock(dt) {
  const real = Date.now() + offset;
  if (freeze) return;
  if (MANUAL) { virtual += dt * 1000 * (settings.fast ? 86400 / DAY_SECONDS : 1); return; }
  if (settings.fast) { virtual += dt * 1000 * (86400 / DAY_SECONDS); catchUp = false; return; }
  if (catchUp) { // after a fast run, roll forward to the real time of day instead of jumping
    const target = real + Math.ceil((virtual - real) / 864e5) * 864e5;
    virtual += dt * 1000 * (86400 / DAY_SECONDS);
    if (virtual >= target) { virtual = real; catchUp = false; }
    return;
  }
  virtual = real;
}

// ── scene
const canvas = $('#scene');
const scene = new Scene(canvas, { seed });
if (q.has('quality')) { scene.quality = clamp(parseFloat(q.get('quality')) || 1, 0.3, 1); scene.resize(); }
// adaptive resolution: if a slow machine can't hold ~45 fps, render fewer pixels (it's all soft shapes)
const adapt = { t: 0, n: 0, on: !q.has('quality') && q.get('freeze') !== '1' && q.get('manual') !== '1' };
function adaptQuality(dt) {
  if (!adapt.on || document.hidden) return;
  adapt.t += dt; adapt.n++;
  if (adapt.t < 4) return;
  const fps = adapt.n / adapt.t; adapt.t = 0; adapt.n = 0;
  const q0 = scene.quality || 1;
  if (fps < 45 && q0 > 0.55) { scene.quality = Math.max(0.5, q0 - 0.15); scene.resize(); }
}
scene.skin = settings.cat; scene.theme = settings.room; scene.scenery = settings.view;
if (q.has('peek')) scene.nextPeek = parseFloat(q.get('peek')) || 1;
if (q.get('awake') === '1') { scene.cat.wake(); scene.cat.action = null; }
addEventListener('resize', () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 120); });
function resize() { scene.resize(); }

// ── weather
const WEATHER = {
  clear: { rain: 0, snow: 0, fog: 0, cloud: 0.12, storm: 0 },
  cloudy: { rain: 0, snow: 0, fog: 0, cloud: 0.75, storm: 0 },
  rain: { rain: 1, snow: 0, fog: 0, cloud: 0.9, storm: 0 },
  storm: { rain: 1, snow: 0, fog: 0, cloud: 1, storm: 1 },
  snow: { rain: 0, snow: 1, fog: 0, cloud: 0.8, storm: 0 },
  fog: { rain: 0, snow: 0, fog: 1, cloud: 0.45, storm: 0 },
};
// Live: the real current weather in Medford from Open-Meteo (free, no key), every 15 minutes
const live = { at: 0, label: '', failed: false, pending: false };
function wmo(code, cloud) { // WMO weather code → our presets (+ how heavy)
  if (code >= 95) return ['storm', 1];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['snow', code === 71 || code === 85 ? 0.6 : 1];
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return ['rain', [51, 56, 61, 80].includes(code) ? 0.55 : code === 53 ? 0.7 : 1];
  if (code === 45 || code === 48) return ['fog', 1];
  if (code === 3 || cloud > 70) return ['cloudy', 1];
  return ['clear', 1];
}
async function fetchLive() {
  if (live.pending) return; live.pending = true;
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=42.33&longitude=-122.87&current=weather_code,cloud_cover&timezone=America%2FLos_Angeles', { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined });
    const j = await r.json();
    const [name, amt] = wmo(j.current.weather_code, j.current.cloud_cover);
    const w = { ...WEATHER[name] };
    if (w.rain) w.rain *= amt; if (w.snow) w.snow *= amt;
    if (name === 'clear' || name === 'cloudy') w.cloud = Math.max(0.08, Math.min(0.85, j.current.cloud_cover / 100));
    if (settings.weather === 'live') scene.setWeather(w);
    live.label = name; live.failed = false; live.at = Date.now();
  } catch { live.failed = true; live.at = Date.now() - 13 * 60e3; /* retry in ~2 min */ }
  live.pending = false;
}
const auto = { current: 'clear', left: 0 };
const wr = (() => { let a = seed ^ 0x5bd1e995; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
function autoPick(month) {
  const winter = month === 12 || month <= 2, shoulder = month === 3 || month === 11 || month === 10 || month === 4;
  const w = winter ? { clear: 2, cloudy: 2, rain: 3, storm: 0.4, snow: 3, fog: 3 } : shoulder ? { clear: 3, cloudy: 2, rain: 4, storm: 0.7, snow: month === 11 || month === 3 ? 1 : 0, fog: 2 } : { clear: 6, cloudy: 2, rain: 1.5, storm: 0.8, snow: 0, fog: 0.5 };
  let x = wr() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(w)) { x -= v; if (x <= 0) return k; }
  return 'clear';
}
function applyWeather(name) { scene.setWeather(WEATHER[name] || WEATHER.clear); }
if (settings.weather !== 'auto' && WEATHER[settings.weather]) { applyWeather(settings.weather); Object.assign(scene.w, WEATHER[settings.weather]); }
if (q.get('instant') === '1') { Object.assign(scene.w, scene.wt); scene.snowCover = scene.w.snow; for (let i = 0; i < 20; i++) scene.update(0.5, { night: 0, dark: 0, hour: 12, fast: false }); scene.birds = []; scene.cars = []; scene.stray = null; }
if (q.has('stray')) scene.nextStray = parseFloat(q.get('stray')) || 1; // after the warm-up, which would use it up

// ── audio
let actx = null, node = null, gain = null, playing = false, starting = null, info = null;
async function startAudio() {
  if (starting) return starting;
  starting = (async () => {
    // iOS: play like a music app, even with the ring/silent switch on
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    actx.resume().catch(() => {}); // inside the tap, before any await (Safari is strict about this)
    actx.onstatechange = () => { if (playing && actx.state !== 'running' && actx.state !== 'closed') actx.resume().catch(() => {}); };
    gain = actx.createGain(); gain.gain.value = 0; gain.connect(actx.destination);
    const weather = { rain: scene.w.rain, snow: scene.w.snow, fog: scene.w.fog, storm: scene.w.storm };
    try {
      await actx.audioWorklet.addModule(new URL('./worklet.js', import.meta.url));
      node = new AudioWorkletNode(actx, 'lofi-radio', { numberOfInputs: 0, outputChannelCount: [2], processorOptions: { seed, mode: (playingMode = startMode()), weather } });
      node.port.onmessage = (e) => { if (e.data.type === 'info') showInfo(e.data.info); else if (e.data.type === 'flash') scene.lightning(); };
      node.connect(gain);
    } catch (err) { // older browsers: run the same engine on the main thread
      console.warn('AudioWorklet unavailable, using ScriptProcessor', err);
      const { Engine } = await import('./engine.js');
      const engine = new Engine({ sampleRate: actx.sampleRate, seed, mode: (playingMode = startMode()) });
      engine.setWeather(weather); engine.onInfo = showInfo; engine.onFlash = () => scene.lightning();
      const sp = actx.createScriptProcessor(4096, 0, 2);
      // 128-frame quanta, like the worklet, so the same seed plays the same music
      sp.onaudioprocess = (ev) => { const L = ev.outputBuffer.getChannelData(0), R = ev.outputBuffer.getChannelData(1); for (let i = 0; i < L.length; i += 128) engine.process(L.subarray(i, i + 128), R.subarray(i, i + 128), Math.min(128, L.length - i)); };
      node = { port: { postMessage: (m) => { if (m.type === 'mode') engine.setMode(m.mode); else if (m.type === 'weather') engine.setWeather(m.weather); else if (m.type === 'purr') engine.purr(); else if (m.type === 'next') engine.next(); } }, connect: (d) => sp.connect(d) };
      sp.connect(gain);
    }
  })();
  starting.catch(() => { starting = null; }); // let a later tap try again
  return starting;
}
let suspendT = 0;
async function play() {
  clearTimeout(suspendT);
  await startAudio();
  await actx.resume();
  const t = actx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(settings.volume, t + 1.5);
  playing = true; scene.playing = true; scene.audioThunder = true; updateUI();
  if (q.has('sleep') && !sleep.armed) { sleep.armed = true; const m = parseFloat(q.get('sleep')); if (m > 0) setSleep(m); }
  wakeLock();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
}
async function pause() {
  if (!actx) return;
  const t = actx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + 0.8);
  playing = false; scene.playing = false; scene.audioThunder = false; updateUI();
  clearTimeout(suspendT); suspendT = setTimeout(() => { if (!playing && actx.state === 'running') actx.suspend(); }, 900);
  if (lock) { lock.release().catch(() => {}); lock = null; }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
}
const toggle = () => (playing ? pause() : play());
let lock = null;
async function wakeLock() { try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch { /* not allowed */ } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && playing) { wakeLock(); if (actx && actx.state !== 'running') actx.resume().catch(() => {}); } });
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Lofi Cat Radio', artist: 'dubry.com', album: 'Lofi cats to relax to' });
  navigator.mediaSession.setActionHandler('play', play);
  navigator.mediaSession.setActionHandler('pause', pause);
}
// every section gets a little made-up track title, derived from its key and tempo
const ADJ = ['sleepy', 'warm', 'quiet', 'slow', 'soft', 'rainy', 'golden', 'late', 'little', 'velvet', 'paper', 'cozy', 'dusty', 'drowsy', 'gentle', 'faraway', 'amber', 'lazy', 'hazy', 'midnight'];
const NOUN = ['radiator', 'mug', 'paws', 'windowsill', 'blanket', 'tea', 'rain', 'lamp', 'pages', 'streetlight', 'cushion', 'yarn', 'nap', 'moon', 'kettle', 'sweater', 'purrs', 'clouds', 'whiskers', 'sunbeam', 'socks', 'fog', 'snowfall', 'radio'];
function trackTitle(i) {
  let h = 2166136261;
  for (const c of `${i.mode}|${i.key}|${i.bpm}|${seed}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const a = ADJ[h % ADJ.length], n = NOUN[(h >>> 8) % NOUN.length], n2 = NOUN[(h >>> 16) % NOUN.length];
  return (h >>> 24) % 4 === 0 && n2 !== n ? `${n} & ${n2}` : `${a} ${n}`;
}
const CAPTION = q.get('caption') === '1';
// a toast in the caption spot (for things like the sleep timer)
function toast(text, sub = '') { caption(text, sub); }
let lastTitle = '', capT = 0;
function caption(text, sub) {
  const el = $('#caption'); if (!el) return;
  el.querySelector('b').textContent = text; el.querySelector('span').textContent = sub;
  el.classList.add('on'); clearTimeout(capT); capT = setTimeout(() => el.classList.remove('on'), 8000);
}
function showInfo(i) {
  info = i;
  const title = trackTitle(i);
  if (CAPTION && title !== lastTitle) caption(`♪ ${title}`, i.mode === 'ambient' ? `ambient · ${i.key}` : `${i.mode} · ${i.key} · ${i.bpm} bpm`);
  lastTitle = title;
  const el = $('#now');
  if (el) el.textContent = `“${trackTitle(i)}” · ` + (i.mode === 'ambient' ? `Ambient · ${i.key}` : `${{ jazz: 'Jazz', bossa: 'Bossa' }[i.mode] || 'Lofi'} · ${i.key} · ${i.bpm} BPM${i.keys && i.keys !== 'rhodes' && i.mode !== 'bossa' ? ' · ' + i.keys : ''}`);
}

// ── controls
const ui = $('#ui');
function updateUI() {
  $('#play').setAttribute('aria-pressed', String(playing));
  $('#play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('#play .i-play').hidden = playing; $('#play .i-pause').hidden = !playing;
  for (const b of document.querySelectorAll('#mode button')) b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
  $('#weather').value = settings.weather; $('#cat').value = settings.cat; $('#room').value = settings.room; $('#view').value = settings.view; $('#fast').checked = settings.fast; $('#vol').value = settings.volume;
}
function setMode(m) {
  settings.mode = m; store.set('mode', m);
  const real = m === 'auto' ? scheduleFor(localParts(virtual).hour) : m;
  if (node && real !== playingMode) { node.port.postMessage({ type: 'mode', mode: real }); playingMode = real; lastSwitch = performance.now(); }
  const el = $('#now'); if (el && !node) el.textContent = { lofi: 'Lofi', jazz: 'Jazz', bossa: 'Bossa', ambient: 'Ambient', auto: 'Auto' }[m];
  updateUI();
}
$('#cat').innerHTML = SKIN_IDS.map((id) => `<option value="${id}">${SKINS[id].name}</option>`).join('');
$('#room').innerHTML = Object.entries(THEMES).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('');
$('#view').addEventListener('change', (e) => { settings.view = e.target.value; store.set('view', settings.view); scene.scenery = settings.view; });
$('#room').addEventListener('change', (e) => { settings.room = e.target.value; store.set('room', settings.room); scene.theme = settings.room; });
$('#play').addEventListener('click', toggle);
$('#next').addEventListener('click', () => { if (node && playing) node.port.postMessage({ type: 'next' }); });
for (const b of document.querySelectorAll('#mode button')) b.addEventListener('click', () => setMode(b.dataset.mode));
$('#vol').addEventListener('input', (e) => { settings.volume = parseFloat(e.target.value); store.set('volume', settings.volume); if (gain && playing) gain.gain.setTargetAtTime(settings.volume, actx.currentTime, 0.05); });
$('#weather').addEventListener('change', (e) => { settings.weather = e.target.value; store.set('weather', settings.weather); if (settings.weather === 'auto') auto.left = 0; else if (settings.weather === 'live') { live.at = 0; } else applyWeather(settings.weather); clockT = 0; });
$('#cat').addEventListener('change', (e) => { settings.cat = e.target.value; store.set('cat', settings.cat); scene.skin = settings.cat; });
$('#fast').addEventListener('change', (e) => { settings.fast = e.target.checked; if (!settings.fast) catchUp = true; });
if (!document.fullscreenEnabled) $('#full').hidden = true; // e.g. iPhone Safari has no element fullscreen
$('#full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); });
updateUI();

// keyboard: space play/pause, N next, M music, W weather, C cat, R room, F fullscreen, D fast day, H hide controls
const WEATHER_ORDER = ['auto', 'live', 'clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];
let hidden = RECORD;
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.target.closest && e.target.closest('select')) return; // selects use letters to pick options
  if (e.key === ' ' && e.target.closest && e.target.closest('button, input, select')) return; // let the control handle its own Space
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'k') { e.preventDefault(); hideStart(); toggle(); }
  else if (k === 'm') setMode({ lofi: 'jazz', jazz: 'bossa', bossa: 'ambient', ambient: 'auto', auto: 'lofi' }[settings.mode]);
  else if (k === 'w') { const i = (WEATHER_ORDER.indexOf(settings.weather) + 1) % WEATHER_ORDER.length; $('#weather').value = WEATHER_ORDER[i]; $('#weather').dispatchEvent(new Event('change')); }
  else if (k === 'c') { const i = (SKIN_IDS.indexOf(settings.cat) + 1) % SKIN_IDS.length; $('#cat').value = SKIN_IDS[i]; $('#cat').dispatchEvent(new Event('change')); }
  else if (k === 'f') $('#full').click();
  else if (k === 'n') $('#next').click();
  else if (k === 't') setSleep({ 0: 30, 30: 60, 60: 90, 90: 0 }[sleep.minutes] ?? 0);
  else if (k === 'v') { $('#view').value = settings.view === 'town' ? 'lake' : 'town'; $('#view').dispatchEvent(new Event('change')); }
  else if (k === 'r') { const ids = Object.keys(THEMES), i = (ids.indexOf(settings.room) + 1) % ids.length; $('#room').value = ids[i]; $('#room').dispatchEvent(new Event('change')); }
  else if (k === 'd') { $('#fast').checked = !settings.fast; $('#fast').dispatchEvent(new Event('change')); }
  else if (k === 'h') { hidden = !hidden; document.body.classList.toggle('hide-ui', hidden); }
  else return;
  poke();
});

// the controls fade away when the pointer rests (and the cursor hides), so recordings stay clean
let idleT = 0;
function poke() {
  if (RECORD) return;
  document.body.classList.add('awake');
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (!ui.matches(':hover') && !ui.contains(document.activeElement)) document.body.classList.remove('awake'); else poke(); }, 2600);
}
for (const ev of ['pointermove', 'pointerdown', 'touchstart', 'wheel']) addEventListener(ev, poke, { passive: true });
ui.addEventListener('focusin', poke);
if (RECORD) document.body.classList.add('record', 'hide-ui');

// start overlay: browsers need a click before sound can play
const start = $('#start');
function hideStart() { start.classList.add('gone'); setTimeout(() => (start.hidden = true), 700); }
if (RECORD || q.get('ui') === '0') { start.hidden = true; }
start.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); hideStart(); play(); poke(); });
start.addEventListener('click', () => { hideStart(); play(); poke(); });
if (RECORD) {
  addEventListener('pointerdown', () => { if (!playing) play(); }, { once: true });
  // ?autoplay=1: start right away where the browser allows it (e.g. Chrome started with
  // --autoplay-policy=no-user-gesture-required); opt-in, since elsewhere it only earns a console warning
  if (q.get('autoplay') === '1') startAudio().then(() => { if (actx.state === 'running') play(); }).catch(() => {});
}
if (!RECORD) poke();

// pet the cat: tap or click it
canvas.addEventListener('pointerdown', (e) => {
  if (!start.hidden && !start.classList.contains('gone')) return;
  if (!scene.hitCat(e.clientX, e.clientY)) return;
  scene.cat.pet();
  if (node && playing) node.port.postMessage({ type: 'purr' });
});
canvas.addEventListener('pointermove', (e) => { canvas.style.cursor = scene.hitCat(e.clientX, e.clientY) ? 'pointer' : ''; }, { passive: true });

// summer-night crickets, for the music engine (live and in rendered videos)
function crickets(month, night) { const W = scene.w; return month >= 6 && month <= 8 ? night * (1 - W.rain) * (1 - W.fog * 0.5) * (1 - W.snow) : 0; }
let lastNight = 0;

// sleep timer: fade the radio out over the last 2 minutes, then pause (T cycles off/30/60/90, or ?sleep=60)
const sleep = { minutes: 0, end: 0 };
function setSleep(min) {
  sleep.minutes = min; sleep.end = min ? performance.now() + min * 60e3 : 0;
  if (gain && playing) gain.gain.setTargetAtTime(settings.volume, actx.currentTime, 0.3);
  toast(min ? `☾ Sleep timer: ${min} min` : 'Sleep timer off', min ? 'the radio will fade out and pause' : '');
}
function sleepTick(now) {
  if (!sleep.end || !playing || !gain) return;
  const left = (sleep.end - now) / 1000;
  if (left <= 0) { sleep.end = 0; sleep.minutes = 0; pause(); return; }
  if (left < 120) gain.gain.setTargetAtTime(settings.volume * (left / 120) ** 2, actx.currentTime, 0.5);
}

// a little live status line: what the cat is up to
const CAT_NAME = { daisy: 'Daisy', nero: 'Nero', jammies: 'Jammies', callie: 'Callie', black: 'Kitty' };
function catStatus() {
  const c = scene.cat, name = CAT_NAME[scene.skin] || 'The cat';
  if (scene.peek) return `${name} has a visitor: ${CAT_NAME[scene.peek.skin] || 'a friend'}`;
  if (c.action === 'yawn') return `${name} is yawning`;
  if (c.action === 'stretch') return `${name} is stretching`;
  if (c.action === 'groom') return `${name} is washing a paw`;
  if (c.state === 'sleep') return c.p.wrap > 0.5 ? `${name} is curled up asleep` : `${name} is napping`;
  if (scene.stray) return `${name} is watching a cat on the roof`;
  if (scene.deer) return `${name} is watching a deer by the lake`;
  if (scene.birds.length) return `${name} is watching the birds`;
  if (scene.w.rain > 0.5) return `${name} is watching the rain`;
  if (scene.w.snow > 0.5) return `${name} is watching the snow`;
  return `${name} is looking out the window`;
}

// ── the loop
let last = performance.now(), sunCache = { at: -1e9 }, lamp = 0, lampOn = false, sendT = 0, clockT = 0;
const stats = { frames: 0, work: 0, worst: 0 };
window.__lofi = { scene, settings, stats, get virtual() { return virtual; }, setTime(ms) { offset = ms - Date.now(); virtual = ms; }, play, pause, setMode };

let failures = 0;
function frame(now) {
  requestAnimationFrame(frame); // first, so one bad frame can never stop the scene
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  adaptQuality(dt);
  sleepTick(now);
  try { tick(dt, now); failures = 0; } catch (err) { if (++failures < 3) console.error(err); if (failures === 30) { scene.resize(); } }
}
function tick(dt, now) {
  const t0 = performance.now();
  advanceClock(dt);
  const P = localParts(virtual);
  // weather auto-pilot: a new pattern every 8–20 minutes (sooner on a fast day)
  if (settings.weather === 'live' && Date.now() - live.at > 15 * 60e3) fetchLive();
  if (settings.mode === 'auto' && node && now - lastSwitch > 120e3) { // follow the schedule, at most every 2 minutes
    const want = scheduleFor(P.hour);
    if (want !== playingMode) { node.port.postMessage({ type: 'mode', mode: want }); playingMode = want; lastSwitch = now; }
  }
  if (settings.weather === 'auto') {
    auto.left -= dt * (settings.fast ? 8 : 1);
    if (auto.left <= 0) { auto.current = autoPick(P.month); applyWeather(auto.current); auto.left = 480 + wr() * 720; }
  }
  // sun and moon (recomputed a few times a second; every frame on a fast day)
  if (settings.fast || catchUp || now - sunCache.at > 250) {
    const s = sunPosition(virtual), m = moonPosition(virtual);
    if (!sunCache.ill || now - sunCache.illAt > 60000 || settings.fast) { sunCache.ill = moonIllumination(virtual); sunCache.illAt = now; }
    Object.assign(sunCache, { at: now, sAlt: s.altitude * 180 / Math.PI, sAltR: s.altitude, sAz: s.azimuth, mAlt: m.altitude, mAz: m.azimuth });
  }
  const W = scene.w;
  const sunAlt = sunCache.sAlt;
  const night = smooth(-1, -12, sunAlt); lastNight = night;
  const dark = clamp(smooth(7, -7, sunAlt) + W.cloud * 0.12 + W.rain * 0.1 + W.fog * 0.08, 0, 1);
  if (!lampOn && dark > 0.5) lampOn = true; else if (lampOn && dark < 0.38) lampOn = false;
  lamp += ((lampOn ? 1 : 0) - lamp) * Math.min(1, dt * 1.4);
  const state = {
    sunAlt, sunAltR: sunCache.sAltR, sunAz: sunCache.sAz, moonAlt: sunCache.mAlt, moonAz: sunCache.mAz,
    moonPhase: sunCache.ill.phase, moonFraction: sunCache.ill.fraction, night, dark, lamp,
    hour: P.hour + P.minute / 60, month: P.month, day: P.day, fast: settings.fast || catchUp,
  };
  scene.update(dt, state);
  scene.draw(state);
  window.__lofi.state = state;
  // keep the music's weather sounds in step with what we see
  sendT -= dt;
  if (node && sendT <= 0) {
    node.port.postMessage({ type: 'weather', weather: { rain: W.rain, snow: W.snow, fog: W.fog, storm: W.storm, crickets: crickets(P.month, night) } }); sendT = 1;
  }
  clockT -= dt;
  if (clockT <= 0 && !hidden) {
    const st = sunTimes(virtual);
    const wl = settings.weather === 'live' ? (live.failed ? ' · live weather unavailable' : live.label ? ` · ${live.label} (live)` : '') : '';
    $('#clock').textContent = `Medford, OR · ${clockText(virtual)}` + (st.sunrise ? ` · sunrise ${clockText(st.sunrise)} · sunset ${clockText(st.sunset)}` : '') + wl;
    $('#seed').textContent = `seed ${seed}` + (sleep.end ? ` · sleep in ${Math.ceil((sleep.end - performance.now()) / 60e3)} min` : '');
    $('#status').textContent = catStatus();
    clockT = settings.fast ? 0.2 : 1;
  }
  const work = performance.now() - t0;
  stats.frames++; stats.work += work; stats.worst = Math.max(stats.worst, work);
}
if (MANUAL) { // the video renderer calls step() for each frame; flashes come from its own audio engine
  let manualNow = 0;
  scene.audioThunder = true;
  window.__lofi.step = (dt, flashes = 0) => {
    for (let i = 0; i < flashes; i++) scene.lightning();
    manualNow += dt * 1000; tick(dt, manualNow);
    const w = scene.w, lp = localParts(virtual); return { rain: w.rain, snow: w.snow, fog: w.fog, storm: w.storm, crickets: crickets(lp.month, lastNight), hour: lp.hour };
  };
  window.__lofi.mode = settings.mode;
} else requestAnimationFrame(frame);
// fill the palette caches in idle time
const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 200));
(function warm() { idle(() => { scene.prewarm(); setTimeout(warm, 300); }); })();
