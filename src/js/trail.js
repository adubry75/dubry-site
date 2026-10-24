// Life 7: the 54 Bench Challenge trail. Builds a winding SVG path through every
// bench, draws it as you scroll, and hands the cat a track so it hikes the trail.
const NS = 'http://www.w3.org/2000/svg';

export async function init(section, api) {
  const map = section.querySelector('[data-trail]');
  const svg = map.querySelector('.trail__svg');
  const path = svg.querySelector('.trail__path');
  const ghost = svg.querySelector('.trail__ghost');
  const trees = svg.querySelector('.trail__trees');
  const benches = [...map.querySelectorAll('.bench')];
  const live = api.motion;
  let samples = [], total = 1, wayY = [], reached = -1, mapX = 0, mapY = 0;

  benches[26]?.setAttribute('data-milestone', 'Halfway there');
  benches[53]?.setAttribute('data-milestone', 'Bench 54 · summit');

  function build() {
    const mr = map.getBoundingClientRect();
    const W = mr.width;
    mapX = mr.left + scrollX; mapY = mr.top + scrollY;
    svg.setAttribute('viewBox', `0 0 ${W} ${mr.height}`);
    const sign = map.querySelector('.trail__sign').getBoundingClientRect();
    const pts = [[W / 2, sign.bottom - mr.top]];
    wayY = [];
    benches.forEach((b, i) => {
      const r = b.querySelector('.bench__pic').getBoundingClientRect();
      const right = b.classList.contains('bench--r');
      const edge = right ? r.left - mr.left : r.right - mr.left;
      const gap = Math.min(46, Math.abs(W / 2 - edge) * 0.55);
      const y = r.top - mr.top + r.height * 0.5;
      pts.push([edge + (right ? -gap : gap) + Math.sin(i * 1.7) * 6, y]);
      wayY.push(y);
    });
    const summit = map.querySelector('.trail__summit svg').getBoundingClientRect();
    pts.push([W / 2, summit.top - mr.top + 8]);

    // Catmull-Rom through the waypoints -> cubic Béziers; sample for the cat lookup.
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    samples = [{ x: pts[0][0], y: pts[0][1], l: 0 }];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
      let prev = samples[samples.length - 1];
      for (let k = 1; k <= 16; k++) {
        const t = k / 16, u = 1 - t;
        const x = u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0];
        const y = u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1];
        len += Math.hypot(x - prev.x, y - prev.y);
        prev = { x, y, l: len };
        samples.push(prev);
      }
    }
    path.setAttribute('d', d);
    ghost.setAttribute('d', d);
    total = path.getTotalLength() || len;
    const k = total / len;
    samples.forEach((s) => (s.l *= k));
    path.style.strokeDasharray = `${total} ${total}`;

    // a sparse forest along the edges
    trees.replaceChildren();
    const rows = Math.floor(mr.height / 150);
    for (let i = 0; i < rows; i++) {
      const left = i % 2 === 0;
      const x = left ? 8 + ((i * 37) % 40) : W - 8 - ((i * 53) % 40);
      const y = 120 + i * 150 + ((i * 29) % 50);
      const s = 0.8 + ((i * 17) % 10) / 14;
      const t = document.createElementNS(NS, 'path');
      t.setAttribute('d', `M${x},${y}l${-9 * s},${18 * s}h${6 * s}l${-8 * s},${16 * s}h${22 * s}l${-8 * s},${-16 * s}h${6 * s}zM${x},${y + 34 * s}v${8 * s}`);
      trees.append(t);
    }
    update();
  }

  // where along the trail is the viewport's "focus line"?
  function at(localY) {
    let lo = 0, hi = samples.length - 1;
    if (localY <= samples[0].y) return null;
    if (localY >= samples[hi].y) return { ...samples[hi], end: true };
    while (lo < hi) { const m = (lo + hi) >> 1; if (samples[m].y < localY) lo = m + 1; else hi = m; }
    const b = samples[lo], a = samples[Math.max(0, lo - 1)];
    const t = b.y === a.y ? 0 : (localY - a.y) / (b.y - a.y);
    return { x: a.x + (b.x - a.x) * t, y: localY, l: a.l + (b.l - a.l) * t };
  }

  function update() {
    if (!live) { path.style.strokeDashoffset = '0'; setReached(benches.length - 1); return; }
    const ly = innerHeight * 0.6 - (mapY - scrollY);
    const p = at(ly);
    path.style.strokeDashoffset = String(p ? total - p.l : total);
    let n = -1;
    for (let i = 0; i < wayY.length; i++) if (wayY[i] <= ly + 20) n = i;
    setReached(n);
  }
  function setReached(n) {
    if (n === reached) return;
    benches.forEach((b, i) => b.classList.toggle('is-reached', i <= n));
    reached = n;
  }

  build();
  new ResizeObserver(() => build()).observe(map);
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });

  // the cat hikes: stand on the trail where it crosses the focus line
  api.cat?.setTrack('trail', (sy, W, H) => {
    const top = mapY - sy;
    const p = at(H * 0.6 - top);
    if (!p || p.end) return null;
    return { x: mapX - scrollX + p.x, y: top + p.y + 4, s: W < 600 ? 0.62 : 0.78 };
  });
  api.cat?.remeasure();

  const { bind } = await api.lightbox();
  bind(benches.map((b) => b.querySelector('.bench__pic')), (a) => ({ alt: a.querySelector('img').alt, cap: a.dataset.cap }));
}
