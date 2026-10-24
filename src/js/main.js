// Nine Lives — entry module. Small on purpose: the cat, the nav, the launch
// transition and the pinned scrubs live here; each life's heavier code is
// imported only when you get close to it.
import { startCat } from './cat.js';
import { initLaunch } from './launch.js';

const root = document.documentElement;
root.classList.add('js');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sda = CSS.supports('animation-timeline: view()');
const motion = !reduced;

const lives = [...document.querySelectorAll('[data-life]')];
const navLinks = [...document.querySelectorAll('[data-nav]')];
const lifeN = document.querySelector('[data-life-n]');
const lifeName = document.querySelector('[data-life-name]');
const menu = document.getElementById('lifemenu');

function setLife(i) {
  navLinks.forEach((a, k) => {
    if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    a.classList.toggle('is-spent', k < i);
  });
  if (lifeN) lifeN.textContent = String(i + 1);
  if (lifeName) lifeName.textContent = navLinks[i]?.querySelector('.lives__label')?.textContent ?? '';
}
// close the phone menu after a jump
menu?.addEventListener('click', (e) => { if (e.target.closest('a') && menu.matches(':popover-open')) menu.hidePopover(); });

// ── the cat (or, with reduced motion, a plain observer for the nav) ──
let cat = null;
if (motion) {
  cat = startCat({ lives, onLife: setLife });
} else {
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) setLife(lives.indexOf(e.target));
  }, { rootMargin: '-55% 0px -44% 0px' });
  lives.forEach((s) => io.observe(s));
  setLife(0);
}

initLaunch({ reduced });

// ── pinned horizontal scrubs (Arcade, Gallery) ──
const scrubbing = motion && sda;
const pinnable = matchMedia('(min-height: 560px)');
function setupScrub(section) {
  const stage = section.querySelector('.scrub__stage');
  const tracks = [...section.querySelectorAll('.scrub__track')];
  let over = 0, queued = 0;
  const size = () => { if (!queued) queued = requestAnimationFrame(measure); };
  const measure = () => {
    queued = 0;
    const cw = stage.clientWidth - parseFloat(getComputedStyle(stage).paddingLeft) - parseFloat(getComputedStyle(stage).paddingRight);
    over = Math.max(0, ...tracks.map((t) => t.scrollWidth - cw));
    section.style.setProperty('--scrub', Math.round(over * 1.05 + innerHeight * 0.35) + 'px');
    cat?.remeasure();
  };
  measure();
  new ResizeObserver(size).observe(stage);
  tracks.forEach((t) => new ResizeObserver(size).observe(t));
  // keyboard: bring a focused item into view by scrolling the page to its spot
  section.addEventListener('focusin', (e) => {
    const track = e.target.closest('.scrub__track');
    const item = e.target.closest('.scrub__track > *');
    if (!track || !item || over <= 0 || !pinnable.matches) return;
    const cs = getComputedStyle(stage);
    const cw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const trackOver = Math.max(1, track.scrollWidth - cw);
    // offset of the item inside the (transformed) track, measured from the track itself
    const x = item.getBoundingClientRect().left - track.getBoundingClientRect().left;
    const t = Math.min(0, Math.max(-trackOver, -(x + item.offsetWidth / 2 - cw / 2)));
    let p = -t / trackOver;
    if (track.dataset.dir === '-1') p = 1 - p;
    const top = section.getBoundingClientRect().top + scrollY;
    const L = section.offsetHeight - innerHeight;
    const y = top + L * (0.04 + 0.92 * p);
    scrollTo({ top: y, behavior: 'instant' });
    // the browser's own focus scrolling can run after this handler: land again next frame
    requestAnimationFrame(() => scrollTo({ top: y, behavior: 'instant' }));
  });
}
if (scrubbing) document.querySelectorAll('.scrub').forEach(setupScrub);

// ── lazy lives: load each module when its section is ~1.5 screens away ──
const api = { reduced, sda, motion, cat, lightbox: () => import('./lightbox.js') };
const modules = {
  arcade: () => import('./arcade.js'),
  scores: () => import('./scores.js'),
  trail: () => import('./trail.js'),
  office: () => import('./office.js'),
};
// The gallery wall's length (and so its pinned scroll height) depends on how many
// artworks the portfolio lists, so hang it early — on idle after load — so nothing
// below it shifts later. Its images still load lazily as the wall scrolls past.
const whenIdle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 400));
addEventListener('load', () => whenIdle(() => {
  const g = document.getElementById('gallery');
  if (g) import('./gallery.js').then((m) => m.init(g, api)).catch((err) => console.error('gallery', err));
}), { once: true });

// Deep links (/#trail): if layout settles after the browser's first jump, land again.
let userMoved = false;
['wheel', 'touchstart', 'keydown', 'pointerdown', 'focusin'].forEach((t) => addEventListener(t, () => (userMoved = true), { once: true, passive: true }));
const hashTarget = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
if (hashTarget) {
  const until = performance.now() + 6000;
  const pageTop = () => hashTarget.getBoundingClientRect().top + scrollY;
  let lastTop = pageTop();
  const reland = () => {
    if (userMoved || performance.now() > until) return;
    const t = pageTop();
    if (Math.abs(t - lastTop) > 1) hashTarget.scrollIntoView({ behavior: 'instant' }); // something above it changed size
    lastTop = t;
  };
  new ResizeObserver(() => requestAnimationFrame(reland)).observe(document.querySelector('main'));
}
const load = (entries, obs) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    obs.unobserve(e.target);
    modules[e.target.id]?.().then((m) => m.init(e.target, api)).catch((err) => console.error(e.target.id, err));
  }
};
const lazy = new IntersectionObserver(load, { rootMargin: '150% 0px' });
const near = new IntersectionObserver(load, { rootMargin: '40% 0px' }); // the arcade sits right under the hero
for (const id of Object.keys(modules)) { const s = document.getElementById(id); if (s) (id === 'arcade' ? near : lazy).observe(s); }

// ── wake up: the cat naps on the wordmark until the visitor shows up (first
// scroll / pointer / touch / key). Then it stretches and the aurora fades in. ──
const WAKERS = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
function wakeUp() {
  WAKERS.forEach((t) => removeEventListener(t, wakeUp));
  root.classList.add('is-awake');
  cat?.wake();
  if (motion) import('./hero-gl.js').then((m) => m.init(document.querySelector('.wake__gl')));
}
WAKERS.forEach((t) => addEventListener(t, wakeUp, { passive: true }));

// ── pause decorative loops in lives that are off screen ──
const onScreen = new IntersectionObserver((es) => {
  for (const e of es) e.target.classList.toggle('is-off', !e.isIntersecting);
}, { rootMargin: '10% 0px' });
lives.forEach((s) => onScreen.observe(s));

// ── footer: wake the cat (back to the top) ──
document.querySelector('[data-wake]')?.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: motion ? 'smooth' : 'instant' });
  document.querySelector('.brand')?.focus({ preventScroll: true });
});
const yr = document.querySelector('[data-year]');
if (yr) yr.textContent = String(new Date().getFullYear());
