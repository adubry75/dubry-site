// Life 3: High Score Hall. Fetches every arcade board in parallel from the existing
// scores API, caches the lot in sessionStorage, and ranks players across games.
import { ARCADE, SOURCES } from '../data/content.js';
import { staticSVG } from './cat-rig.js';
import { newTab } from './links.js';

const KEY = 'nine-lives:scores:v1';
const TTL = 5 * 60 * 1000;
const POINTS = [10, 7, 5, 3, 2, 1, 1, 1, 1, 1];
const crown = '<svg class="crown" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 16 0 3l7 6 5-9 5 9 7-6-2 13Z"/></svg>';

const cacheGet = () => {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY));
    return c && Date.now() - c.at < TTL ? c : null;
  } catch { return null; }
};
const cacheSet = (c) => { try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode / quota */ } };

async function fetchBoard(g, signal) {
  const r = await fetch(SOURCES.scores(g.id), { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// Normalise one API response: { boards: { metric: [entries] } } -> [{ metric, entries:[{name,date,value}] }]
function boardsOf(json) {
  const out = [];
  const boards = json && typeof json.boards === 'object' && json.boards ? json.boards : {};
  for (const [metric, list] of Object.entries(boards)) {
    if (!Array.isArray(list)) continue;
    const entries = list.filter((e) => e && typeof e === 'object').map((e) => ({
      name: String(e.name ?? '').trim().slice(0, 20) || '???',
      date: e.date ? String(e.date) : '',
      value: e[metric] ?? e.value ?? e.score ?? '',
    }));
    if (entries.length) out.push({ metric, entries });
  }
  return out;
}

async function load(force) {
  const cached = !force && cacheGet();
  if (cached) return cached;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  const res = await Promise.allSettled(ARCADE.map((g) => fetchBoard(g, ctl.signal)));
  clearTimeout(timer);
  const games = ARCADE.map((g, i) => ({
    id: g.id, failed: res[i].status === 'rejected', boards: res[i].status === 'fulfilled' ? boardsOf(res[i].value) : [],
  }));
  const data = { at: Date.now(), games };
  if (games.some((g) => !g.failed)) cacheSet(data);
  return data;
}

function rank(games) {
  const players = new Map();
  for (const g of games) for (const b of g.boards) b.entries.slice(0, 10).forEach((e, k) => {
    const key = e.name.toUpperCase();
    const p = players.get(key) || { name: e.name, pts: 0, crowns: 0, games: new Set() };
    p.pts += POINTS[k] ?? 1;
    if (k === 0) p.crowns++;
    p.games.add(g.id);
    players.set(key, p);
  });
  return [...players.values()].sort((a, b) => b.pts - a.pts || b.crowns - a.crowns || b.games.size - a.games.size).slice(0, 10);
}

const fmtVal = (v) => (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v).toLocaleString('en-US') : String(v).slice(0, 14));
function fmtDate(d) {
  if (!d) return '';
  const t = new Date(String(d).replace(' ', 'T'));
  return isNaN(t) ? String(d).slice(0, 10) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function render(section, data, retry) {
  const status = section.querySelector('[data-hall-status]');
  const topEl = section.querySelector('[data-topcats]');
  const champEl = section.querySelector('[data-champs]');
  const vacant = section.querySelector('[data-vacant]');
  const titleOf = Object.fromEntries(ARCADE.map((g) => [g.id, g]));
  const ok = data.games.filter((g) => !g.failed);

  if (!ok.length) {
    status.textContent = 'The scoreboard is napping. ';
    const b = h('button', null, 'Try again');
    b.type = 'button';
    b.addEventListener('click', retry);
    status.append(b);
    topEl.replaceChildren(h('li', 'hall__empty', 'Scores are unavailable right now — the games still work.'));
    champEl.replaceChildren();
    vacant.hidden = true;
    return;
  }
  const failed = data.games.length - ok.length;
  const time = new Date(data.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  status.textContent = `Live from ${ok.length} boards · updated ${time}` + (failed ? ` · ${failed} didn't answer` : '');

  // Top cats
  const top = rank(data.games);
  if (!top.length) {
    const li = h('li', 'hall__empty');
    li.innerHTML = staticSVG('curl');
    li.append(h('b', null, 'No crowns yet.'), h('span', null, 'Every board in the hall is empty — the top spot is yours for the taking.'));
    topEl.replaceChildren(li);
  } else {
    topEl.replaceChildren(...top.map((p, i) => {
      const li = h('li');
      li.append(h('span', 'rk', String(i + 1).padStart(2, '0')));
      const nm = h('span', 'nm', p.name);
      if (i === 0 && p.crowns) nm.insertAdjacentHTML('beforeend', crown);
      li.append(nm);
      const pts = h('span', 'pts', `${p.pts} pts`);
      pts.append(h('small', null, `${p.crowns} crown${p.crowns === 1 ? '' : 's'} · ${p.games.size} game${p.games.size === 1 ? '' : 's'}`));
      li.append(pts);
      li.setAttribute('aria-label', `Rank ${i + 1}: ${p.name}, ${p.pts} points, ${p.crowns} crowns across ${p.games.size} games`);
      return li;
    }));
  }

  // Champions per board
  const rows = [];
  for (const g of data.games) for (const b of g.boards) rows.push({ g: titleOf[g.id], b, e: b.entries[0] });
  champEl.replaceChildren(...rows.map(({ g, b, e }) => {
    const li = h('li');
    const name = h('span', 'g');
    const a = newTab(h('a', null, g.title));
    a.href = g.href;
    name.append(a);
    const who = h('span', 'who', e.name);
    if (e.date) who.append(h('span', null, ` · ${fmtDate(e.date)}`));
    const val = h('span', 'val', fmtVal(e.value));
    val.append(h('small', null, b.metric));
    li.append(name, who, val);
    return li;
  }));
  if (!rows.length) champEl.replaceChildren(h('li', 'hall__empty', 'No champions crowned yet.'));

  // Unclaimed games
  const empty = data.games.filter((g) => !g.boards.length).map((g) => titleOf[g.id]);
  vacant.hidden = !empty.length;
  vacant.querySelector('ul').replaceChildren(...empty.map((g) => {
    const li = h('li');
    const a = newTab(h('a', null, g.title));
    a.href = g.href;
    li.append(a);
    return li;
  }));
}

export async function init(section) {
  const crt = section.querySelector('.hall__crt');
  const run = async (force) => {
    crt.setAttribute('aria-busy', 'true');
    try { render(section, await load(force), () => run(true)); } finally { crt.removeAttribute('aria-busy'); }
  };
  run(false);
}
