// The Boombox look's moving part: a round speaker printed as a 10 x 10 grid of cobalt dots, biggest in the
// middle. It breathes while sound plays (CSS, styles/look-boombox.css); still on Stop and with reduce motion.
import { el } from './el.js';

// Each dot's size as a share of its cell (the mockup's 14 px cells, dots up to 12 px).
function dotSize(x, y) {
  const dist = Math.hypot(x - 4.5, y - 4.5);
  if (dist > 5) return 0;
  return Math.max(2, Math.round(12 * (1 - dist / 6))) / 14;
}

export function createSpeaker() {
  const cells = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const size = `${(dotSize(x, y) * 100).toFixed(1)}%`;
      cells.push(el('span', { class: 'spk-cell' }, el('i', { style: { width: size, height: size } })));
    }
  }
  return el('div', { class: 'speaker', 'aria-hidden': 'true' }, el('div', { class: 'spk' }, cells));
}
