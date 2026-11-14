// The Boombox look: a pink boombox. A dark bar across the top (SIDE A, tuning dial, readout), the cassette
// behind a rounded door on the left, the dot speaker, presets, the song playing, keys and switches on the right.
// Styles: styles/look-boombox.css. Its moving part is the speaker.
import { el } from '../../components/el.js';
import { createSpeaker } from '../../components/speaker.js';
import { icon } from '../../components/icons.js';

export const BOOMBOX_PARTS = { wheel: 'knob' };

export function createBoomboxLook(p) {
  const speaker = createSpeaker();

  const bar = el(
    'div',
    { class: 'bar' },
    el('span', { class: 'brand', 'aria-hidden': 'true' }, 'SIDE A'),
    p.tuner.node,
    el('div', { class: 'readout' }, el('div', { class: 'big-row' }, p.big, p.unit), p.status),
    p.wheel.node,
  );

  const bay = el(
    'div',
    { class: 'bay' },
    p.cassette.node,
    el('div', { class: 'door', 'aria-hidden': 'true' }),
    el('span', { class: 'cap-small', 'aria-hidden': 'true' }, 'Auto stop, radio to tape'),
    el('span', { class: 'cap-big', 'aria-hidden': 'true' }, 'FM·TAPE'),
  );

  const panel = el(
    'div',
    { class: 'panel' },
    el('div', { class: 'top' }, speaker, p.presets.node),
    // The song playing, under the speaker (the station and preset are in the readout up top).
    el('div', { class: 'now' }, icon('note'), p.line),
    p.transport.node,
    // Radio / Tape, then the BAND key on the radio (the record-from switch on tape).
    el('div', { class: 'mode-row' }, p.mode.node, p.band, p.source.node),
    el('div', { class: 'links' }, p.shelfLink, p.settingsLink),
  );

  const node = el(
    'section',
    { class: 'screen deck look-boombox', 'aria-label': 'Deck' },
    p.grain,
    p.heading,
    el('div', { class: 'deck-col' }, bar, el('div', { class: 'deck-row' }, el('div', { class: 'housing' }, bay), panel)),
    p.edge,
  );

  return { node, live: speaker, update: (v) => { p.band.hidden = v.isTape; } };
}
