// The tape shelf: every recording as a small cassette, label colour by kind, plus a blank tape at the end.
// Tapping a tape puts it in the deck and plays it. The blank tape opens the deck ready to record.
import { el, setText } from '../components/el.js';
import { icon } from '../components/icons.js';
import { createCassette } from '../components/cassette.js';
import { createSwitch } from '../components/controls.js';
import { FILTERS, filterTapes, tapeCard, emptyText } from '../logic/shelf.js';

const SHELL = { shell: '#C9D0CC', band: '#29323A', win: '#29323A', pack: '#7C868C', hub: '#FAFAF7', ink: '#29323A' };

function tapeButton(tape, onPick) {
  const card = tapeCard(tape);
  const cassette = createCassette({ ...SHELL, label: card.label });
  cassette.update({ title: card.title, len: card.len });
  return el(
    'button',
    { class: 'tape', type: 'button', 'aria-label': card.aria, onclick: () => onPick(tape) },
    cassette.node,
    el('span', { class: 'tape-words' }, el('span', { class: 'tape-title' }, card.title), el('span', { class: 'tape-meta' }, card.meta)),
  );
}

function blankButton(onBlank) {
  const cassette = createCassette({ ...SHELL, label: '#FAFAF7', band: '#FAFAF7', pack: '#29323A' });
  cassette.update({ title: 'Blank', side: '+', len: ' ' });
  return el(
    'button',
    { class: 'tape', type: 'button', 'aria-label': 'Blank tape, start a new recording', onclick: onBlank },
    cassette.node,
    el('span', { class: 'tape-words' }, el('span', { class: 'tape-title plain' }, 'Blank tape'), el('span', { class: 'tape-meta' }, 'Start a new recording')),
  );
}

export function createShelfPage({ onPick, onBlank }) {
  let tapes = [];
  let filter = 'all';
  const grid = el('div', { class: 'shelf-grid' });
  const empty = el('p', { class: 'shelf-empty', hidden: true });
  const chips = createSwitch('Show', FILTERS.map((f) => ({ id: f.id, text: f.name })), (id) => {
    filter = id;
    draw();
  }, 'chip');

  function draw() {
    chips.update(filter);
    const shown = filterTapes(tapes, filter);
    empty.hidden = shown.length > 0;
    setText(empty, emptyText(filter));
    grid.replaceChildren(...shown.map((t) => tapeButton(t, onPick)), blankButton(onBlank));
  }

  const node = el(
    'section',
    { class: 'screen shelf', 'aria-label': 'Tape shelf' },
    el(
      'header',
      { class: 'shelf-top' },
      el('a', { class: 'back', href: '#/' }, icon('back'), 'Deck'),
      el('h1', {}, 'TAPE SHELF'),
      el('div', { class: 'grow' }),
      chips.node,
    ),
    empty,
    grid,
  );

  function show(list) {
    tapes = Array.isArray(list) ? list : [];
    draw();
  }

  draw();
  return { node, show };
}
