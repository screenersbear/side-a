// The Pocket look's moving part: 24 level bars that rise and fall while sound plays. The last six are red.
// The motion itself is CSS (styles/pocket.css): calm loops, out of step, still on Stop and with reduce motion.
import { el } from './el.js';

export function createLevelBars(count = 24) {
  return el('div', { class: 'levels', 'aria-hidden': 'true' }, Array.from({ length: count }, () => el('span', { class: 'lv' })));
}
