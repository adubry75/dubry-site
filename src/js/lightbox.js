// Shared image viewer: a native <dialog> (focus trap, Esc, inert page for free)
// with View Transitions morphing the thumbnail into the full image and back.
const dlg = document.querySelector('.lb');
const img = dlg.querySelector('.lb__img');
const cap = dlg.querySelector('.lb__cap');
let items = [], idx = 0, srcEl = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const vt = (fn) => (!reduced && document.startViewTransition ? document.startViewTransition(fn).finished : Promise.resolve(fn()));

function decoded(src) {
  const probe = new Image();
  probe.src = src;
  return Promise.race([probe.decode().catch(() => {}), new Promise((r) => setTimeout(r, 700))]);
}

function show(i) {
  idx = (i + items.length) % items.length;
  const it = items[idx];
  img.src = it.src;
  img.alt = it.alt || '';
  cap.textContent = it.cap || '';
  dlg.toggleAttribute('data-single', items.length < 2);
}

// items: [{ src, alt, cap, el }]; el = the thumbnail element to morph from.
export async function open(list, i) {
  items = list;
  srcEl = list[i].el;
  await decoded(list[i].src);
  if (srcEl) srcEl.style.viewTransitionName = 'lb-img';
  await vt(() => {
    if (srcEl) srcEl.style.viewTransitionName = '';
    show(i);
    dlg.showModal();
  });
}

function close() {
  const back = items[idx]?.el;
  vt(() => {
    dlg.close();
    if (back) back.style.viewTransitionName = 'lb-img';
  }).then(() => { if (back) back.style.viewTransitionName = ''; });
}

async function step(d) {
  const next = items[(idx + d + items.length) % items.length];
  await decoded(next.src);
  show(idx + d);
}

dlg.querySelector('.lb__close').addEventListener('click', close);
dlg.querySelector('.lb__prev').addEventListener('click', () => step(-1));
dlg.querySelector('.lb__next').addEventListener('click', () => step(1));
dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
dlg.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
});

// Wire a set of <a href="full.jpg"> thumbnails to the viewer (links still work without JS).
export function bind(links, meta = () => ({})) {
  const list = links.map((a) => ({ src: a.href, el: a.querySelector('img') || a, ...meta(a) }));
  links.forEach((a, i) => a.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(list, i);
  }));
  return list;
}
