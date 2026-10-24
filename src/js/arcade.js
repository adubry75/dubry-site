// Life 2: paint every cabinet screen with its generated art.
import { screenSVG } from './art.js';

export function init(section) {
  section.querySelectorAll('.cab').forEach((cab) => {
    const screen = cab.querySelector('.cab__screen');
    const title = cab.querySelector('.cab__title').textContent;
    screen.innerHTML = screenSVG({ title, motif: cab.dataset.motif }, +cab.dataset.i);
  });
}
