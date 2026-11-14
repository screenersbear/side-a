// The Deck look's moving part: L and R level meters, ten cells each (the last two red). A cover slides off the
// cells while sound plays; the motion is CSS (styles/look-deck.css) and stops on Stop and with reduce motion.
import { el } from './el.js';

function meter(side) {
  const cells = Array.from({ length: 10 }, () => el('i', {}));
  return el('div', { class: `meter meter-${side.toLowerCase()}` }, el('span', { class: 'lab' }, side), el('div', { class: 'lvl' }, cells, el('div', { class: 'lvl-cover' })));
}

export function createMeters() {
  return el('div', { class: 'meters', 'aria-hidden': 'true' }, el('span', { class: 'lab' }, 'Level'), meter('L'), meter('R'));
}
