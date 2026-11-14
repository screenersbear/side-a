// The Deck look: a grey home deck. Mode switches stacked on the left over L/R level meters, the cassette (wide
// orange band) in a recessed bay with five piano keys under it, readout, tuner and presets on the right.
// Styles: styles/look-deck.css. Its moving part is the level meters.
import { el } from '../../components/el.js';
import { createMeters } from '../../components/meters.js';

export const DECK_PARTS = { keys: { order: ['stop', 'rec', 'rew', 'play', 'ff'], cls: 'pk', recIcon: 'recBar' }, shelfText: 'Shelf' };

const KEY_NAMES = { stop: 'Stop', rec: 'Rec', rew: 'Rew', play: 'Play', ff: 'FF' };

export function createDeckLook(p) {
  const meters = createMeters();
  const recFrom = el('div', { class: 'rec-from' }, el('span', { class: 'lab', 'aria-hidden': 'true' }, 'Rec from'), p.source.node);

  const side = el(
    'div',
    { class: 'side' },
    el('span', { class: 'lab', 'aria-hidden': 'true' }, 'Mode'),
    p.mode.node,
    recFrom,
    meters,
  );

  const keyNames = el(
    'div',
    { class: 'key-names', 'aria-hidden': 'true' },
    DECK_PARTS.keys.order.map((type) => el('span', { class: 'lab' }, KEY_NAMES[type])),
  );
  const frame = el('div', { class: 'frame' }, el('div', { class: 'bay' }, p.cassette.node));
  const middle = el('div', { class: 'middle' }, frame, keyNames, p.transport.node);

  const panel = el(
    'div',
    { class: 'panel' },
    el('div', { class: 'readout' }, p.status, el('div', { class: 'big-row' }, p.big, p.unit), p.line),
    p.tuner.node,
    p.wheel.node,
    p.presets.node,
    el('div', { class: 'links' }, p.shelfLink, p.settingsLink),
  );

  const node = el(
    'section',
    { class: 'screen deck look-deck', 'aria-label': 'Deck' },
    p.grain,
    p.heading,
    el('div', { class: 'deck-row' }, side, middle, panel),
    p.edge,
  );

  return { node, live: meters, update: (v) => { recFrom.hidden = !v.isTape; } };
}
