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
function setupScrub(section) {
  const stage = section.querySelector('.scrub__stage');
  const tracks = [...section.querySelectorAll('.scrub__track')];
  let over = 0;
  const size = () => {
    const cw = stage.clientWidth - parseFloat(getComputedStyle(stage).paddingLeft) - parseFloat(getComputedStyle(stage).paddingRight);
    over = Math.max(0, ...tracks.map((t) => t.scrollWidth - cw));
    section.style.setProperty('--scrub', Math.round(over * 1.05 + innerHeight * 0.35) + 'px');
    cat?.remeasure();
  };
  new ResizeObserver(size).observe(stage);
  tracks.forEach((t) => new ResizeObserver(size).observe(t));
  // keyboard: bring a focused item into view by scrolling the page to its spot
  section.addEventListener('focusin', (e) => {
    const track = e.target.closest('.scrub__track');
    const item = e.target.closest('.scrub__track > *');
    if (!track || !item || over <= 0) return;
    const cw = stage.clientWidth;
    const trackOver = Math.max(1, track.scrollWidth - (cw - parseFloat(getComputedStyle(stage).paddingLeft) * 2));
    const t = Math.min(0, Math.max(-trackOver, -(item.offsetLeft + item.offsetWidth / 2 - cw / 2)));
    let p = -t / trackOver;
    if (track.dataset.dir === '-1') p = 1 - p;
    const top = section.getBoundingClientRect().top + scrollY;
    const L = section.offsetHeight - innerHeight;
    scrollTo({ top: top + L * (0.04 + 0.92 * p), behavior: 'instant' });
  });
}
if (scrubbing) document.querySelectorAll('.scrub').forEach(setupScrub);

// ── lazy lives: load each module when its section is ~1.5 screens away ──
const api = { reduced, sda, motion, cat, lightbox: () => import('./lightbox.js') };
const modules = {
  arcade: () => import('./arcade.js'),
  scores: () => import('./scores.js'),
  gallery: () => import('./gallery.js'),
  trail: () => import('./trail.js'),
  office: () => import('./office.js'),
};
const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    modules[e.target.id]?.().then((m) => m.init(e.target, api)).catch((err) => console.error(e.target.id, err));
  }
}, { rootMargin: '150% 0px' });
for (const id of Object.keys(modules)) { const s = document.getElementById(id); if (s) lazy.observe(s); }

// ── hero sky: WebGL, started once the page is idle ──
if (motion) {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
  addEventListener('load', () => idle(() => import('./hero-gl.js').then((m) => m.init(document.querySelector('.wake__gl')))), { once: true });
}

// ── footer: wake the cat (back to the top) ──
document.querySelector('[data-wake]')?.addEventListener('click', () => {
  scrollTo({ top: 0, behavior: motion ? 'smooth' : 'instant' });
  document.querySelector('.brand')?.focus({ preventScroll: true });
});
const yr = document.querySelector('[data-year]');
if (yr) yr.textContent = String(new Date().getFullYear());
