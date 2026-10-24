// "Insert coin": opening a game morphs its screen or poster art into a full-screen
// launch card with a same-document View Transition, then opens it in a new tab
// and puts this page back the way it was.
export function initLaunch({ reduced }) {
  const overlay = document.querySelector('.launch');
  if (!overlay) return;
  const screen = overlay.querySelector('.launch__screen');
  const title = overlay.querySelector('.launch__title');
  const msg = overlay.querySelector('.launch__msg');
  const go = overlay.querySelector('.launch__go');
  let from = null;

  function close() {
    if (overlay.hidden) return;
    const done = () => { overlay.hidden = true; go.hidden = true; if (from) from.style.viewTransitionName = 'launch'; };
    const vt = !reduced && document.startViewTransition ? document.startViewTransition(done) : null;
    if (!vt) done();
    (vt ? vt.finished : Promise.resolve()).finally(() => { if (from) from.style.viewTransitionName = ''; });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-launch]');
    // modifier / middle clicks, reduced motion, no View Transitions: the link's own target="_blank" handles it
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (reduced || !document.startViewTransition) return;
    e.preventDefault();

    const scope = a.closest('.poster, .cab') || a;
    const art = scope.querySelector('[data-launch-art]');
    const name = (scope.querySelector('.poster__title, .cab__title') || a).textContent.trim();
    const color = getComputedStyle(scope).getPropertyValue('--a').trim() || getComputedStyle(scope).getPropertyValue('--c').trim()
      || getComputedStyle(scope.querySelector('.poster__card') || scope).getPropertyValue('--pa').trim();
    const href = a.href;
    from = art;

    if (art) art.style.viewTransitionName = 'launch';
    const vt = document.startViewTransition(() => {
      if (art) art.style.viewTransitionName = '';
      const clone = art ? art.cloneNode(true) : document.createElement('div');
      clone.removeAttribute('data-launch-art');
      screen.replaceChildren(clone);
      title.textContent = name;
      msg.firstChild.textContent = `Opening ${name} in a new tab`;
      go.href = href;
      go.target = '_blank';
      go.rel = 'noopener';
      go.hidden = true;
      if (color) overlay.style.setProperty('--la', color);
      overlay.hidden = false;
    });
    // open while the click still counts as a user gesture (well inside the browsers' activation window)
    vt.finished.finally(() => {
      const w = window.open(href, '_blank');
      if (w) { w.opener = null; setTimeout(close, 350); }
      else { msg.firstChild.textContent = 'Pop-up blocked — '; go.hidden = false; go.focus(); } // let the visitor click through
    });
  });

  go.addEventListener('click', () => setTimeout(close, 200));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // coming back with the back button (bfcache) or to this tab: page as it was
  addEventListener('pageshow', (e) => { if (e.persisted) overlay.hidden = true; });
}
