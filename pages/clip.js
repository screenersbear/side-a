// Adding a clip to the mix: 1, the tape (chosen in the shelf popup, components/tape-picker.js; Change tape opens it
// again); 2, drag the start and end handles (or step them with ‹ ›) around the part you want; Add to mix.
// From MixTrim.dc.html. It only shows and reports; pages/mixing.js decides.
import { el, setText } from '../components/el.js';
import { icon } from '../components/icons.js';
import { createWaveform } from '../components/waveform.js';
import { tapeCard } from '../logic/shelf.js';
import { canAdd, trimText } from '../logic/trim.js';

const step = (n, words) => el('p', { class: 'step' }, el('b', {}, n), words);

// on: { change() (opens the shelf popup), drag(edge, seconds), step(edge, steps), add() }
export function createClipPage(on) {
  const chosen = el('span', { class: 'clip-tape' });
  const change = el('button', { class: 'tool control', type: 'button', 'aria-haspopup': 'dialog', onclick: on.change }, 'Change tape');
  const waveform = createWaveform(on.drag);
  const range = el('span', { class: 'clip-range', 'aria-live': 'polite' });
  const length = el('span', { class: 'clip-length' });
  const note = el('span', { class: 'clip-note', 'aria-live': 'polite' });
  const add = el('button', { class: 'pri control', type: 'button', onclick: on.add }, 'Add to mix');
  const nudge = (edge, steps, label, mark) =>
    el('button', { class: 'tool nudge', type: 'button', 'aria-label': label, onclick: () => on.step(edge, steps) }, mark);

  const node = el(
    'section',
    { class: 'screen mix-screen clip-screen', 'aria-label': 'Add a clip', hidden: true },
    el('div', { class: 'mix-top' }, el('a', { class: 'back control', href: '#/mix' }, icon('back'), 'Mix'), el('h1', { class: 'screen-title' }, 'Add a clip')),
    el('div', { class: 'clip-which' }, step('1', 'Tape'), chosen, change),
    step('2', 'Select the part you want'),
    waveform.node,
    el(
      'div',
      { class: 'trim-row' },
      el('span', { class: 'edge-name control' }, 'Start'),
      nudge('start', -1, 'Move start earlier', '‹'),
      nudge('start', 1, 'Move start later', '›'),
      el('span', { class: 'edge-name control' }, 'End'),
      nudge('end', -1, 'Move end earlier', '‹'),
      nudge('end', 1, 'Move end later', '›'),
      range,
      length,
      note,
      el('div', { class: 'grow' }),
      el('a', { class: 'tool control', href: '#/mix' }, 'Cancel'),
      add,
    ),
  );

  // view: { tape, trim, levels, reading, failed }
  function show(view) {
    setText(chosen, view.tape ? tapeCard(view.tape).title : 'None yet');
    setText(change, view.tape ? 'Change tape' : 'Choose a tape');
    waveform.update(view.trim, view.levels);
    const words = trimText(view.trim);
    const ready = !view.reading && !view.failed && Boolean(view.tape);
    setText(range, ready ? words.range : '');
    setText(length, ready ? words.length : '');
    setText(note, view.reading ? 'Reading the tape…' : view.failed ? "This tape can't be cut here." : '');
    add.disabled = !ready || !canAdd(view.trim);
    node.querySelectorAll('.nudge').forEach((b) => { b.disabled = !ready; });
  }

  return { node, show };
}
