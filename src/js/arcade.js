// Life 2: paint every cabinet screen with its generated art, a few per idle slice
// so it never blocks the main thread for long.
import { screenSVG } from './art.js';

const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 300 }) : setTimeout(f, 16));

export function init(section) {
  const cabs = [...section.querySelectorAll('.cab')];
  const paint = (deadline) => {
    do {
      const cab = cabs.shift();
      if (!cab) return;
      const title = cab.querySelector('.cab__title').textContent;
      cab.querySelector('.cab__screen').innerHTML = screenSVG({ title, motif: cab.dataset.motif }, +cab.dataset.i);
    } while (!deadline || deadline.didTimeout || deadline.timeRemaining() > 4);
    idle(paint);
  };
  idle(paint);
}
