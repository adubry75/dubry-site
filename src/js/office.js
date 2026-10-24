// Life 8: pull the Power BI screenshots from /portfolio/powerbi.html at runtime.
import { SOURCES } from '../data/content.js';
import { NEW_TAB, newTab } from './links.js';

export async function init(section, api) {
  const list = section.querySelector('[data-monitors]');
  let shots = [];
  try {
    const base = new URL(SOURCES.powerbi, location.href);
    const res = await fetch(base);
    if (!res.ok) throw new Error(res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    shots = [...doc.querySelectorAll('img[src]')].map((img) => {
      const u = new URL(img.getAttribute('src'), base);
      return { src: u.origin === location.origin ? u.pathname + u.search : null, alt: (img.getAttribute('alt') || '').trim() };
    }).filter((s) => s.src).slice(0, 6);
    if (!shots.length) throw new Error('empty');
  } catch {
    list.outerHTML = `<p class="life__lede"><a href="${SOURCES.powerbi.replace(/"/g, '')}" ${NEW_TAB}>See the Power BI reports →</a></p>`;
    return;
  }
  list.replaceChildren(...shots.map((s, i) => {
    const li = document.createElement('li');
    li.className = 'monitor';
    const a = newTab(document.createElement('a'));
    a.className = 'monitor__btn';
    a.href = s.src;
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = s.alt ? `Power BI report: ${s.alt}` : `Power BI report screenshot ${i + 1} of ${shots.length}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    a.append(img);
    li.append(a);
    return li;
  }));
  list.removeAttribute('aria-busy');
  const { bind } = await api.lightbox();
  bind([...list.querySelectorAll('.monitor__btn')], (a) => ({ alt: a.querySelector('img').alt, cap: a.querySelector('img').alt }));
}
