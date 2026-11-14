// The tuning dial: a line with a tick every 4 MHz and the red needle on the station.
import { el } from './el.js';
import { DIAL_TICKS, dialPercent } from '../logic/stations.js';

export function createTuner() {
  const needle = el('div', { class: 'needle' });
  const ticks = DIAL_TICKS.map((f) => {
    const left = `${dialPercent(f)}%`;
    return [el('div', { class: 'tick', style: { left } }), el('span', { class: 'tick-n', style: { left } }, String(f))];
  });
  const node = el('div', { class: 'tuner', role: 'img' }, el('div', { class: 'dial-line' }), ticks.flat(), needle);

  function update(v) {
    needle.style.left = `${v.needle}%`;
    node.setAttribute('aria-label', v.dialLabel);
  }
  return { node, update };
}
