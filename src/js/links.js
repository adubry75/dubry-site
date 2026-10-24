// Every link that leaves the page opens in a new tab (and says so to screen readers).
export function newTab(a) {
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-describedby', 'newtab');
  return a;
}
export const NEW_TAB = 'target="_blank" rel="noopener" aria-describedby="newtab"';
