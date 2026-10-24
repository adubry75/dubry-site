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

  const measure = () => {
    W = innerWidth; H = innerHeight; cw = el.offsetWidth; ch = el.offsetHeight;
    const sy = scrollY;
    geo = lives.map((s) => { const r = s.getBoundingClientRect(); return { top: r.top + sy, h: r.height, track: s.dataset.track || 'ground', n: +s.dataset.life }; });
  };
  measure();
  new ResizeObserver(() => measure()).observe(document.body);
  addEventListener('resize', measure, { passive: true });

  const st = {
    x: W * 0.5, y: H * 0.5, vx: 0, vy: 0, s: 1, face: 1, phase: 0, gait: 'walk', prevGait: 'walk', gaitT: 1,
    pose: structuredClone(POSES.stand), vel: 0, lastSy: scrollY, lastMove: performance.now(), life: -1,
    mode: scrollY < 40 ? 'wake' : 'move', modeT: performance.now(), leap: null, sleeping: false, frame: 0,
  };
  let last = performance.now();

  function lifeAt(focus) {
    let i = 0;
    for (let k = 0; k < geo.length; k++) if (focus >= geo[k].top) i = k;
    return i;
  }

  function perchPoint() {
    const r = perch.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.923, s: clamp(r.width / cw, 1, 2.6) };
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
      const pp = perchPoint();
      const t = clamp(sy / (g.h * 0.55), 0, 1);
      if (t <= 0) return { ...pp, i, perched: true };
      const e = ease(t);
      return { x: lerp(pp.x, pad, e), y: lerp(pp.y, groundY, e) - Math.sin(Math.PI * e) * H * 0.12, s: lerp(pp.s, 1, e), i, airborne: t < 0.98 };
    }
    if (g.track === 'trail' && tracks.trail) {
      const t = tracks.trail(sy, W, H);
      if (t) return { ...t, i };
    }
    if (g.track === 'nap' && cushion) {
      const r = cushion.getBoundingClientRect();
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

    // wake-up routine on first load
    if (st.mode === 'wake') {
      const t = now - st.modeT;
      if (Math.abs(sy) > 40 || t > 4200) st.mode = 'move';
      el.dataset.pose = t < 1300 ? 'curl' : 'rig';
      el.toggleAttribute('data-sleep', t < 1300);
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
    } else if (moving) {
      const g = speed > 2.2 ? 'sprint' : speed > 0.75 ? 'trot' : 'walk';
      if (g !== st.gait) { st.prevGait = st.gait; st.gait = g; st.gaitT = 0; }
      st.gaitT = Math.min(1, st.gaitT + dt * 5);
      const hz = g === 'sprint' ? 2.6 + speed * 0.15 : g === 'trot' ? 1.7 + speed * 0.4 : 0.9 + speed * 1.1;
      st.phase = (st.phase + dt * Math.min(hz, 3.6)) % 1;
      want = st.gaitT < 1 ? blend(gaitPose(st.prevGait, st.phase), gaitPose(g, st.phase), st.gaitT) : gaitPose(g, st.phase);
    } else if (still > 450) {
      want = POSES.sit;
    } else {
      want = POSES.stand;
    }

    // nap on the cushion
    const napping = T.bed && !moving && still > 900 && Math.hypot(T.x - st.x, T.y - st.y) < 6;
    el.dataset.pose = napping ? 'curl' : 'rig';
    el.toggleAttribute('data-sleep', napping);

    st.pose = blend(st.pose, want, 1 - Math.exp(-dt * (moving ? 22 : 7)));
    if (!moving && !st.leap) st.pose.tail = st.pose.tail.map((a, k) => a + Math.sin(now / 520 + k * 0.8) * (k + 1) * 2.2);
    draw(yOff);
  }

  function draw(yOff = 0) {
    el.dataset.face = String(st.face);
    el.style.transform = `translate3d(${(st.x - cw / 2).toFixed(1)}px,${(st.y + yOff - ch * 0.923).toFixed(1)}px,0) scale(${st.s.toFixed(3)})`;
    if (el.dataset.pose === 'rig') rig.draw(st.pose);
  }

  function loop(now) {
    // when nothing is happening, redraw at ~20fps (tail flicks) instead of 60
    const idle = now - st.lastMove > 2500 && st.mode !== 'wake' && Math.abs(st.vx) < 1;
    if (!idle || ++st.frame % 3 === 0) frame(now);
    else last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    setTrack(name, fn) { tracks[name] = fn; },
    remeasure: measure,
  };
}
