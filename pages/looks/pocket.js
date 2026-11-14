// The Pocket look: paper body, the cassette seen through an oval window, a red pinstripe, controls on the right.
// Styles: styles/look-pocket.css. Its moving part is the level bars over the window.
import { el } from '../../components/el.js';
import { createLevelBars } from '../../components/level-bars.js';

export const POCKET_PARTS = { shelfText: 'Shelf ›' };

export function createPocketLook(p) {
  const bay = el(
    'div',
    { class: 'bay' },
    p.cassette.node,
    el('div', { class: 'cover', 'aria-hidden': 'true' }),
    el('div', { class: 'rim', 'aria-hidden': 'true' }),
    createLevelBars(24),
    el('div', { class: 'scale', 'aria-hidden': 'true' }, el('span', {}, '0'), el('span', {}, '50'), el('span', {}, '100')),
  );

  const panel = el(
    'div',
    { class: 'panel' },
    p.transport.node,
    el('div', { class: 'brand-row' }, el('span', { class: 'brand' }, 'SIDE A ', el('i', {}, 'pocket')), p.shelfLink),
    el('div', { class: 'readout' }, p.status, el('div', { class: 'big-row' }, p.big, p.unit), p.line),
    el('div', { class: 'middle' }, p.source.node, p.tuner.node),
    p.presets.node,
    el('div', { class: 'mode-row' }, p.mode.node, p.settingsLink),
  );

  const node = el(
    'section',
    { class: 'screen deck look-pocket', 'aria-label': 'Deck' },
    p.grain,
    el('div', { class: 'stripe-off', 'aria-hidden': 'true' }),
    el('div', { class: 'stripe', 'aria-hidden': 'true' }),
    p.heading,
    el('div', { class: 'deck-row' }, bay, panel),
    p.edge,
  );

  // In this look the tuner and the record-from switch share one spot: the switch shows on Tape.
  return { node, live: bay, update: (v) => { p.tuner.node.hidden = v.isTape; } };
}
