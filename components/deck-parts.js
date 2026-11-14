// The parts every look of the deck has: the cassette, transport keys, readout, tuner, presets, the two switches
// and the Shelf and Settings keys (raised keys with an icon, HANDOFF "Depth pass"). A look (pages/looks/) only arranges them; update(view) fills them in.
import { el, setText } from './el.js';
import { icon } from './icons.js';
import { createCassette } from './cassette.js';
import { createTransport, createSwitch, createPresets } from './controls.js';
import { createTuner } from './tuner.js';
import { createTicker } from './ticker.js';
import { PRESET_FREQS } from '../logic/stations.js';

// look: an entry of logic/looks.js. keys: options for the transport keys (order, class, Record symbol).
export function createDeckParts(dispatch, look, { keys = {}, shelfText = 'Tape shelf' } = {}) {
  const send = (type, extra) => dispatch({ type, ...extra });

  const parts = {
    cassette: createCassette(look.cassette, { printed: true, bandBig: look.bandBig }),
    transport: createTransport((type) => send(type, type === 'rec' ? { now: Date.now() } : {}), keys),
    status: el('span', { class: 'status', 'aria-live': 'polite' }),
    big: el('span', { class: 'big' }),
    unit: el('span', { class: 'unit' }),
    line: el('span', { class: 'line', 'aria-live': 'polite' }),
    source: createSwitch('Record from', [{ id: 'mic', text: 'MIC' }, { id: 'line', text: 'RADIO IN' }], (id) => send(id === 'mic' ? 'toMic' : 'toLine')),
    tuner: createTuner(),
    presets: createPresets(PRESET_FREQS.length, { onPick: (key) => send('preset', { key }), onHold: (key) => send('savePreset', { key }) }),
    mode: createSwitch('Mode', [{ id: 'radio', text: 'RADIO' }, { id: 'tape', text: 'TAPE' }], (id) => send(id === 'radio' ? 'toRadio' : 'toTape')),
    shelfLink: el('a', { class: 'tk', href: '#/shelf' }, icon('shelf'), shelfText),
    settingsLink: el('a', { class: 'tk', href: '#/settings' }, icon('sliders'), 'Settings'),
    heading: el('h1', { class: 'visually-hidden' }, 'SIDE A'),
    grain: el('div', { class: 'grain', 'aria-hidden': 'true' }),
    edge: el('div', { class: 'edge', 'aria-hidden': 'true' }),
  };

  const ticker = createTicker(parts.line);

  function update(v) {
    parts.cassette.update({ title: v.tapeTitle, len: v.tapeLength, counter: v.counter, rec: v.recording, reelOn: v.reelOn });
    parts.transport.update(v);
    setText(parts.status, v.status);
    parts.status.classList.toggle('blink', v.recording);
    setText(parts.big, v.big);
    setText(parts.unit, v.unit);
    ticker.set(v.line);
    parts.source.node.hidden = !v.isTape;
    parts.source.update(v.isMic ? 'mic' : 'line');
    parts.tuner.update(v);
    parts.presets.update(v.presets);
    parts.mode.update(v.isTape ? 'tape' : 'radio');
  }

  return { ...parts, update };
}

// The readout: status, the big number with its unit, and the line under it.
export function readout(parts, cls = 'readout') {
  return el('div', { class: cls }, parts.status, el('div', { class: 'big-row' }, parts.big, parts.unit), parts.line);
}
