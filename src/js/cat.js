// The cat controller: turns scroll position + velocity into a walk down the page.
// Each life provides a "track" (where the cat should be on screen); the cat springs
// toward it, picks a gait from scroll speed, turns around when you scroll back up,
// leaps between lives, and naps at the bottom.
import { Rig, POSES, gaitPose, blend } from './cat-rig.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function startCat({ lives, onLife }) {
  const el = document.querySelector('.cat');
  const rig = new Rig(el.querySelector('.cat__rig'));
  document.documentElement.classList.add('has-cat');

  const perch = document.querySelector('[data-perch]');
  const cushion = document.querySelector('[data-cushion]');
  const tracks = {};
  let geo = []; // cached page geometry of each life
  let W = innerWidth, H = innerHeight, cw = 0, ch = 0;

  let perchBox = null, bedBox = null;
  const pageBox = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  const measure = () => {
    W = innerWidth; H = innerHeight; cw = el.offsetWidth; ch = el.offsetHeight;
    const sy = scrollY;
    geo = lives.map((s) => { const r = s.getBoundingClientRect(); return { top: r.top + sy, h: r.height, track: s.dataset.track || 'ground', n: +s.dataset.life }; });
    perchBox = pageBox(perch);
    if (cushion) bedBox = pageBox(cushion);
    kick();
  };
  let mq = 0;
  const remeasure = () => { if (!mq) mq = requestAnimationFrame(() => { mq = 0; measure(); }); };
  new ResizeObserver(remeasure).observe(document.body);
  addEventListener('resize', remeasure, { passive: true });

  const st = {
    x: W * 0.5, y: H * 0.5, vx: 0, vy: 0, s: 1, face: 1, phase: 0, gait: 'walk', prevGait: 'walk', gaitT: 1,
    pose: structuredClone(POSES.stand), vel: 0, lastSy: scrollY, lastMove: performance.now(), life: -1,
    mode: scrollY < 40 ? 'asleep' : 'move', modeT: performance.now(), leap: null,
  };
  let last = performance.now();
  const attrs = {};
  const setAttr = (k, v) => { if (attrs[k] !== v) { attrs[k] = v; if (v === null) el.removeAttribute(k); else el.setAttribute(k, v); } };

  function lifeAt(focus) {
    let i = 0;
    for (let k = 0; k < geo.length; k++) if (focus >= geo[k].top) i = k;
    return i;
  }

  function perchPoint(sy) {
    const r = perchBox;
    return { x: r.x - scrollX + r.w / 2, y: r.y - sy + r.h * 0.923, s: clamp(r.w / cw, 1, 2.6) };
  }

  function target(sy) {
    const focus = sy + H * 0.6;
    const i = lifeAt(focus);
    const g = geo[i];
    const p = clamp((focus - g.top) / g.h, 0, 1);
    const pad = Math.max(56, cw * 0.6);
    const groundY = H - Math.max(10, H * 0.018);
    const dir = g.n % 2 === 0 ? 1 : -1; // even lives walk left→right, odd right→left
    const ground = { x: dir > 0 ? lerp(pad, W - pad - (W >= 900 ? 64 : 0), p) : lerp(W - pad - (W >= 900 ? 64 : 0), pad, p), y: groundY, s: 1, i };

    if (g.track === 'hero') {
      const pp = perchPoint(sy);
      const t = clamp(sy / (g.h * 0.55), 0, 1);
      if (t <= 0) return { ...pp, i, perched: true };
      const e = ease(t);
      return { x: lerp(pp.x, pad, e), y: lerp(pp.y, groundY, e) - Math.sin(Math.PI * e) * H * 0.12, s: lerp(pp.s, 1, e), i, airborne: t < 0.98 };
    }
    if (g.track === 'trail' && tracks.trail) {
      const t = tracks.trail(sy, W, H);
      if (t) return { ...t, i };
    }
    if (g.track === 'nap' && bedBox) {
      const r = { left: bedBox.x - scrollX, top: bedBox.y - sy, width: bedBox.w, height: bedBox.h };
      if (r.top < H * 0.92) {
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.86;
        const k = clamp((H * 0.92 - r.top) / (H * 0.4), 0, 1);
        return { x: lerp(ground.x, cx, ease(k)), y: lerp(ground.y, cy, ease(k)), s: lerp(1, clamp(r.width / cw / 1.35, 1, 1.8), ease(k)), i, bed: k >= 1 };
      }
    }
    return ground;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
    last = now;
    const sy = scrollY;
    const dy = sy - st.lastSy;
    st.lastSy = sy;
    const inst = dy / (dt * 1000);
    st.vel = lerp(st.vel, inst, 1 - Math.exp(-dt * 9));
    if (Math.abs(dy) > 0.5) st.lastMove = now;
    const still = now - st.lastMove;

    const T = target(sy);
    if (T.i !== st.life) {
      if (st.life >= 0 && st.mode === 'move' && Math.abs(st.vel) > 0.05 && !T.airborne && geo[T.i].track !== 'hero') st.leap = { t0: now, dur: 520 };
      st.life = T.i;
      onLife?.(T.i);
    }

    // asleep on the wordmark until the visitor shows up
    if (st.mode === 'asleep') {
      st.x = T.x; st.y = T.y; st.s = T.s;
      setAttr('data-pose', 'curl'); setAttr('data-sleep', '');
      return draw();
    }
    // the wake-up routine: stretch, stand, sit
    if (st.mode === 'wake') {
      const t = now - st.modeT + 700;
      if (Math.abs(sy) > 40 || t > 4200) st.mode = 'move';
      setAttr('data-pose', t < 1300 ? 'curl' : 'rig');
      setAttr('data-sleep', t < 1300 ? '' : null);
      st.x = T.x; st.y = T.y; st.s = T.s; st.vx = st.vy = 0;
      const want = t < 2700 ? POSES.stretch : t < 3300 ? POSES.stand : POSES.sit;
      st.pose = t < 1300 ? structuredClone(POSES.stretch) : blend(st.pose, want, 1 - Math.exp(-dt * (t < 2700 ? 6 : 8)));
      st.pose.tail = st.pose.tail.map((a, k) => a + Math.sin(now / 380 + k) * (k + 1) * 3);
      return draw();
    }

    // spring toward the track target
    const w = T.perched ? 14 : 8;
    const ax = w * w * (T.x - st.x) - 2 * w * st.vx;
    const ay = w * w * (T.y - st.y) - 2 * w * st.vy;
    st.vx += ax * dt; st.vy += ay * dt;
    st.x += st.vx * dt; st.y += st.vy * dt;
    st.s = lerp(st.s, T.s, 1 - Math.exp(-dt * 8));

    if (Math.abs(st.vx) > 40) st.face = Math.sign(st.vx);
    else if (Math.abs(st.vel) > 0.15 && !T.perched) st.face = Math.sign(st.vel) * (geo[T.i].n % 2 === 0 ? 1 : -1);

    // gait from scroll speed (and how fast the cat is actually crossing the screen)
    const speed = Math.max(Math.abs(st.vel), Math.abs(st.vx) / 900);
    let want;
    let yOff = 0;
    const moving = speed > 0.03 || Math.abs(st.vx) > 25;
    if (st.leap || T.airborne) {
      let u;
      if (st.leap) {
        u = (now - st.leap.t0) / st.leap.dur;
        if (u >= 1) { st.leap = null; u = 1; }
        yOff = -Math.sin(Math.PI * Math.min(u, 1)) * 48 * st.s;
      } else u = clamp((T.y - st.y) / 80 + 0.5, 0, 1);
      want = u < 0.5 ? POSES.leapUp : POSES.leapDown;
      setAttr('data-gait', 'leap');
    } else if (moving) {
      const g = speed > 2.2 ? 'sprint' : speed > 0.75 ? 'trot' : 'walk';
      if (g !== st.gait) { st.prevGait = st.gait; st.gait = g; st.gaitT = 0; }
      st.gaitT = Math.min(1, st.gaitT + dt * 5);
      const hz = g === 'sprint' ? 2.6 + speed * 0.15 : g === 'trot' ? 1.7 + speed * 0.4 : 0.9 + speed * 1.1;
      st.phase = (st.phase + dt * Math.min(hz, 3.6)) % 1;
      want = st.gaitT < 1 ? blend(gaitPose(st.prevGait, st.phase), gaitPose(g, st.phase), st.gaitT) : gaitPose(g, st.phase);
      setAttr('data-gait', g);
    } else if (still > 450) {
      want = POSES.sit;
      setAttr('data-gait', 'sit');
    } else {
      want = POSES.stand;
      setAttr('data-gait', 'stand');
    }

    // nap on the cushion
    const napping = T.bed && !moving && still > 900 && Math.hypot(T.x - st.x, T.y - st.y) < 6;
    setAttr('data-pose', napping ? 'curl' : 'rig');
    setAttr('data-sleep', napping ? '' : null);
    st.settled = !moving && !st.leap && still > 1600 && Math.abs(st.vx) < 2 && Math.abs(st.vy) < 2;

    st.pose = blend(st.pose, want, 1 - Math.exp(-dt * (moving ? 22 : 7)));
    draw(yOff);
  }

  let lastT = '';
  function draw(yOff = 0) {
    setAttr('data-face', String(st.face));
    const tf = `translate3d(${(st.x - cw / 2).toFixed(1)}px,${(st.y + yOff - ch * 0.923).toFixed(1)}px,0) scale(${st.s.toFixed(3)})`;
    if (tf !== lastT) el.style.transform = lastT = tf;
    if (attrs['data-pose'] === 'rig') rig.draw(st.pose);
  }

  // The loop only runs while something is happening; scroll/resize kick it awake.
  let raf = 0;
  function loop(now) {
    raf = 0;
    frame(now);
    const done = st.mode === 'asleep' || (st.mode === 'move' && st.settled);
    if (!done) raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  addEventListener('scroll', () => { st.lastMove = performance.now(); kick(); }, { passive: true });
  measure();

  return {
    setTrack(name, fn) { tracks[name] = fn; kick(); },
    remeasure,
    wake() {
      if (st.mode !== 'asleep') return;
      st.mode = 'wake'; st.modeT = performance.now(); kick();
    },
  };
}
