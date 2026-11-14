// The Sport look's moving part: three graphic EQ sliders whose knobs ride up and down while sound plays.
// The motion is CSS (styles/look-sport.css): out of step, still on Stop and with reduce motion.
import { el } from './el.js';

export function createEq() {
  const sliders = Array.from({ length: 3 }, () => el('b', {}, el('i', {})));
  return el('div', { class: 'eq-row', 'aria-hidden': 'true' }, el('div', { class: 'eq' }, sliders), el('span', { class: 'eq-name' }, 'Graphic EQ'));
}
