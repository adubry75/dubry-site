// Life 6: read /art-portfolio/ at runtime, pull its <img> sources, hang them on the wall.
import { SOURCES } from '../data/content.js';
import { NEW_TAB, newTab } from './links.js';

const SHAPES = ['tall', '', 'wide', 'sq', '', 'tall', 'sq', 'wide', '', 'sq'];
const GRUMPY = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M6,30V10L4,2L13,8Q20,6 27,8L36,2L34,10V30Q20,34 6,30Z"/><path d="M11,16l6,2M29,16l-6,2"/><path d="M16,27q4,-4 8,0"/></svg>';

export async function listArt() {
  const base = new URL(SOURCES.art, location.href);
  const res = await fetch(base, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(res.status);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const seen = new Set();
  const out = [];
  for (const img of doc.querySelectorAll('img[src]')) {
    const u = new URL(img.getAttribute('src'), base);
    if (u.origin !== location.origin || !u.pathname.startsWith(base.pathname) || !/\.(jpe?g|png|webp|gif|avif)$/i.test(u.pathname) || seen.has(u.href)) continue;
    seen.add(u.href);
    out.push({ src: u.pathname + u.search, alt: (img.getAttribute('alt') || '').trim() });
  }
  return out;
}

export async function init(section, api) {
  const wall = section.querySelector('[data-wall]');
  const status = section.querySelector('[data-gallery-status]');
  let art;
  try {
    art = await listArt();
    if (!art.length) throw new Error('empty');
  } catch {
    wall.replaceChildren();
    wall.removeAttribute('aria-busy');
    status.innerHTML = `The gallery is closed for cleaning — <a href="/art-portfolio/" ${NEW_TAB}>visit the portfolio directly</a>.`;
    return;
  }
  const n = art.length;
  const nodes = art.map((a, i) => {
    const li = document.createElement('li');
    li.className = 'frame' + (SHAPES[i % SHAPES.length] ? ' frame--' + SHAPES[i % SHAPES.length] : '');
    const link = newTab(document.createElement('a'));
    link.className = 'frame__btn';
    link.href = a.src;
    const img = document.createElement('img');
    img.src = a.src;
    img.alt = a.alt || `Artwork ${i + 1} of ${n}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    link.append(img);
    const plaque = document.createElement('span');
    plaque.className = 'frame__plaque';
    plaque.setAttribute('aria-hidden', 'true');
    plaque.textContent = `No. ${String(i + 1).padStart(2, '0')}`;
    li.append(link, plaque);
    return li;
  });
  // a tiny self-portrait by a certain grumpy critic, hung among the real work
  const egg = document.createElement('li');
  egg.className = 'frame frame--egg';
  egg.innerHTML = `<a href="${SOURCES.grumpy}" ${NEW_TAB} aria-label="Secret cat: a grumpy self-portrait">${GRUMPY}</a>`;
  nodes.splice(Math.min(nodes.length, 17), 0, egg);
  wall.replaceChildren(...nodes);
  wall.removeAttribute('aria-busy');
  status.textContent = `${n} works on the wall`;

  const { bind } = await api.lightbox();
  bind([...wall.querySelectorAll('.frame:not(.frame--egg) .frame__btn')], (a) => {
    const img = a.querySelector('img');
    return { alt: img.alt, cap: img.alt };
  });
}
