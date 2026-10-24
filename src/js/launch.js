// "Insert coin": opening a game or toy morphs its screen/jar into a full-screen
// launch card with a same-document View Transition, then navigates.
export function initLaunch({ reduced }) {
  const overlay = document.querySelector('.launch');
  if (!overlay) return;
  const screen = overlay.querySelector('.launch__screen');
  const title = overlay.querySelector('.launch__title');
  const msg = overlay.querySelector('.launch__msg');

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-launch]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (reduced || !document.startViewTransition) return; // plain navigation
    e.preventDefault();

    const scope = a.closest('.poster, .cab, .jar') || a;
    const art = scope.querySelector('[data-launch-art]');
    const name = (scope.querySelector('.poster__title, .cab__title, .jar__name') || a).textContent.trim();
    const color = getComputedStyle(scope).getPropertyValue('--a').trim() || getComputedStyle(scope).getPropertyValue('--c').trim()
      || getComputedStyle(scope.querySelector('.poster__card') || scope).getPropertyValue('--pa').trim();
    const href = a.href;

    if (art) art.style.viewTransitionName = 'launch';
    const vt = document.startViewTransition(() => {
      if (art) art.style.viewTransitionName = '';
      const clone = art ? art.cloneNode(true) : document.createElement('div');
      clone.removeAttribute('data-launch-art');
      screen.replaceChildren(clone);
      title.textContent = name;
      msg.firstChild.textContent = `Loading ${name}`;
      if (color) overlay.style.setProperty('--la', color);
      overlay.hidden = false;
    });
    vt.finished.finally(() => setTimeout(() => location.assign(href), 240));
  });

  // coming back with the back button (bfcache): put the page back the way it was
  addEventListener('pageshow', (e) => { if (e.persisted) overlay.hidden = true; });
}
