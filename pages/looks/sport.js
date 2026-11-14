// The Sport look: a yellow sport player. Keys and switches across the top, the cassette in a dark housing with
// a black cap and a green stripe, then EQ, readout and a cyan tuning panel on the right.
// Styles: styles/look-sport.css. Its moving part is the EQ sliders.
import { el } from '../../components/el.js';
import { createEq } from '../../components/eq.js';

// 'Shelf', not 'Tape shelf': the long name pushed Settings off a small phone (Starky, 2026-11-14).
export const SPORT_PARTS = { shelfText: 'Shelf' };

export function createSportLook(p) {
  const eq = createEq();

  const top = el('div', { class: 'top-row' }, p.transport.node, p.mode.node, p.source.node);

  const bay = el(
    'div',
    { class: 'bay' },
    p.cassette.node,
    el('div', { class: 'cap', 'aria-hidden': 'true' }, el('span', {}, 'SIDE A')),
    el('div', { class: 'stripe-off', 'aria-hidden': 'true' }),
    el('div', { class: 'stripe', 'aria-hidden': 'true' }),
    el('div', { class: 'recess', 'aria-hidden': 'true' }),
  );

  const panel = el(
    'div',
    { class: 'panel' },
    eq,
    // The BAND key sits beside the big frequency (and the status under it, so it adds no height).
    el(
      'div',
      { class: 'readout' },
      el('div', { class: 'big-line' }, el('div', { class: 'big-stack' }, el('div', { class: 'big-row' }, p.big, p.unit), p.status), p.band),
      p.line,
    ),
    el('div', { class: 'tune-box' }, p.tuner.node, p.wheel.node, p.presets.node),
    el('div', { class: 'links' }, p.shelfLink, p.settingsLink),
  );

  const node = el(
    'section',
    { class: 'screen deck look-sport', 'aria-label': 'Deck' },
    p.grain,
    p.heading,
    el('div', { class: 'deck-col' }, top, el('div', { class: 'deck-row' }, el('div', { class: 'housing' }, bay), panel)),
    p.edge,
  );

  return { node, live: eq, update: () => {} };
}
