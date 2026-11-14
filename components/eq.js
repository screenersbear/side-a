// The Sport look's moving part: three graphic EQ sliders whose knobs ride up and down while sound plays, on a
// printed panel (HANDOFF "Depth pass"): GRAPHIC over EQUALIZER, +10 / 0 / -10 beside the sliders, 100 / 1K / 10K
// under them. The motion is CSS (styles/look-sport.css): out of step, still on Stop and with reduce motion.
import { el } from './el.js';

const words = (cls, list) => el('div', { class: cls }, list.map((w) => el('span', {}, w)));

export function createEq() {
  const sliders = Array.from({ length: 3 }, () => el('b', {}, el('i', {})));
  return el(
    'div',
    { class: 'eq-row', 'aria-hidden': 'true' },
    el('span', { class: 'eq-name' }, el('span', { class: 'eq-graphic' }, 'GRAPHIC'), el('span', { class: 'eq-equalizer' }, 'EQUALIZER')),
    el(
      'div',
      { class: 'eq-panel' },
      words('eq-marks', ['+10', '0', '-10']),
      el('div', { class: 'eq-col' }, el('div', { class: 'eq' }, sliders), words('eq-freqs', ['100', '1K', '10K'])),
    ),
  );
}
