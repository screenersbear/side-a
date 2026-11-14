// The shelf as a popup, for choosing the tape a clip comes from (Add clip on the mix screen). Every tape can be
// heard first (Listen: its reels turn while it plays); tapping a tape uses it. A native <dialog>, like the tape menu.
import { el, setText, setPressed } from './el.js';
import { icon } from './icons.js';
import { createCassette } from './cassette.js';
import { createSwitch } from './controls.js';
import { FILTERS, filterTapes, tapeCard, emptyText } from '../logic/shelf.js';
import { mmss } from '../logic/tape-names.js';

const SHELL = { shell: '#C9D0CC', band: '#29323A', win: '#29323A', pack: '#7C868C', hub: '#FAFAF7', ink: '#29323A' };

// onPick(tape): a tape was chosen. onClose(picked): the popup closed (picked: false when closed without choosing).
// player: { listen(tape, onTime(seconds), onEnd()), hush() } plays one tape at a time.
export function createTapePicker({ onPick, onClose, player }) {
  let tapes = [];
  let filter = 'all';
  let picked = false;
  let listening = null; // the item being heard

  const grid = el('div', { class: 'pk-grid' });
  const empty = el('p', { class: 'pk-empty', hidden: true });
  const chips = createSwitch('Show', FILTERS.map((f) => ({ id: f.id, text: f.name })), (id) => {
    filter = id;
    draw();
  }, 'chip');
  const close = el('button', { class: 'pk-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  const node = el(
    'dialog',
    { class: 'tape-picker', 'aria-labelledby': 'pk-title' },
    el(
      'div',
      { class: 'pk-card' },
      el('div', { class: 'pk-top' }, el('h2', { class: 'pk-title', id: 'pk-title' }, 'Choose a tape'), chips.node),
      el('p', { class: 'pk-hint' }, 'Listen first if you like, then tap a tape to use it.'),
      empty,
      grid,
      close,
    ),
  );

  close.addEventListener('click', () => node.close());
  node.addEventListener('click', (e) => {
    if (e.target === node) node.close();
  });
  node.addEventListener('close', () => {
    hush();
    onClose(picked);
  });

  // Back to quiet: the key says Listen again and the reels stop.
  function hush() {
    if (!listening) return;
    const was = listening;
    listening = null;
    player.hush();
    setPressed(was.listen, false);
    was.listen.replaceChildren(icon('play'), 'Listen');
    was.cassette.update({ title: was.card.title, len: was.card.len });
    setText(was.meta, was.card.meta);
  }

  function hear(it) {
    const again = listening === it;
    hush();
    if (again) return;
    listening = it;
    setPressed(it.listen, true);
    it.listen.replaceChildren(icon('stop'), 'Stop');
    it.cassette.update({ title: it.card.title, len: it.card.len, reelOn: true });
    setText(it.meta, `${mmss(0)} of ${it.card.len}`);
    player.listen(
      it.tape,
      (seconds) => listening === it && setText(it.meta, `${mmss(seconds)} of ${it.card.len}`),
      () => listening === it && hush(),
    );
  }

  function choose(tape) {
    picked = true;
    node.close();
    onPick(tape);
  }

  function item(tape) {
    const card = tapeCard(tape);
    const cassette = createCassette({ ...SHELL, label: card.label });
    cassette.update({ title: card.title, len: card.len });
    const meta = el('span', { class: 'tape-meta' }, card.meta);
    const it = { tape, card, cassette, meta };
    it.listen = el(
      'button',
      { class: 'pk-listen control', type: 'button', 'aria-pressed': 'false', 'aria-label': `Listen to ${card.title}`, onclick: () => hear(it) },
      icon('play'),
      'Listen',
    );
    const use = el(
      'button',
      { class: 'pk-use', type: 'button', 'aria-label': `Use ${card.aria}`, onclick: () => choose(tape) },
      cassette.node,
      el('span', { class: 'tape-words' }, el('span', { class: 'tape-title' }, card.title), meta),
    );
    return el('div', { class: 'pk-tape' }, use, it.listen);
  }

  function draw() {
    hush();
    chips.update(filter);
    const shown = filterTapes(tapes, filter);
    grid.replaceChildren(...shown.map(item));
    empty.hidden = shown.length > 0;
    setText(empty, tapes.length ? emptyText(filter) : 'The shelf is empty. Record a voice note or tape the radio first.');
  }

  return {
    node,
    // Opens on every tape on the shelf (the filter picked last time stays).
    open(list) {
      tapes = Array.isArray(list) ? list : [];
      picked = false;
      draw();
      if (!node.open) node.showModal();
    },
    close() {
      if (node.open) node.close();
    },
  };
}
