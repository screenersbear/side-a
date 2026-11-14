// The deck screen, Pocket look: the cassette behind an oval window on the left, the controls on the right.
// Built once; update(view) changes only what the deck's state changed. view comes from logic/deck-view.js.
import { el, setText } from '../components/el.js';
import { createCassette } from '../components/cassette.js';
import { createTransport, createSwitch, createPresets } from '../components/controls.js';
import { createTuner } from '../components/tuner.js';
import { createLevelBars } from '../components/level-bars.js';
import { PRESET_FREQS } from '../logic/stations.js';

export function createDeckPage(dispatch) {
  const send = (type, extra) => dispatch({ type, ...extra });

  const cassette = createCassette({ shell: '#C9D0CC', label: '#FAFAF7', band: '#E8322B', win: '#29323A', pack: '#7C868C', hub: '#FAFAF7', ink: '#29323A' });
  const bay = el(
    'div',
    { class: 'bay' },
    cassette.node,
    el('div', { class: 'cover', 'aria-hidden': 'true' }),
    createLevelBars(24),
    el('div', { class: 'scale', 'aria-hidden': 'true' }, el('span', {}, '0'), el('span', {}, '50'), el('span', {}, '100')),
  );

  const transport = createTransport((type) => send(type, type === 'rec' ? { now: Date.now() } : {}));
  const status = el('span', { class: 'status', 'aria-live': 'polite' });
  const big = el('span', { class: 'big' });
  const unit = el('span', { class: 'unit' });
  const line = el('span', { class: 'line', 'aria-live': 'polite' });
  const source = createSwitch('Record from', [{ id: 'mic', text: 'MIC' }, { id: 'line', text: 'RADIO IN' }], (id) => send(id === 'mic' ? 'toMic' : 'toLine'));
  const tuner = createTuner();
  const presets = createPresets(PRESET_FREQS.length, (key) => send('preset', { key }));
  const mode = createSwitch('Mode', [{ id: 'radio', text: 'RADIO' }, { id: 'tape', text: 'TAPE' }], (id) => send(id === 'radio' ? 'toRadio' : 'toTape'));

  const panel = el(
    'div',
    { class: 'panel' },
    transport.node,
    el('div', { class: 'brand-row' }, el('span', { class: 'brand' }, 'SIDE A ', el('i', {}, 'pocket')), el('a', { class: 'tl', href: '#/shelf' }, 'Shelf ›')),
    el('div', { class: 'readout' }, status, el('div', { class: 'big-row' }, big, unit), line),
    el('div', { class: 'middle' }, source.node, tuner.node),
    presets.node,
    el('div', { class: 'mode-row' }, mode.node),
  );

  const node = el(
    'section',
    { class: 'screen deck pocket', 'aria-label': 'Deck' },
    el('div', { class: 'stripe', 'aria-hidden': 'true' }),
    el('h1', { class: 'visually-hidden' }, 'SIDE A'),
    el('div', { class: 'deck-row' }, bay, panel),
  );

  function update(v) {
    bay.classList.toggle('on', v.sounding);
    cassette.update({ title: v.tapeTitle, len: v.tapeLength, counter: v.counter, rec: v.recording, reelOn: v.reelOn });
    transport.update(v);
    setText(status, v.status);
    status.classList.toggle('blink', v.recording);
    setText(big, v.big);
    setText(unit, v.unit);
    setText(line, v.line);
    source.node.hidden = !v.isTape;
    source.update(v.isMic ? 'mic' : 'line');
    tuner.node.hidden = v.isTape;
    tuner.update(v);
    presets.update(v.presets);
    mode.update(v.isTape ? 'tape' : 'radio');
  }

  return { node, update };
}
