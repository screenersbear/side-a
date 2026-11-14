// The menu a tape on the shelf opens: Play, Share, Rename, Delete. Share asks MP3 or WAV, makes the file (showing
// how far along it is), then hands it to the phone's share sheet. Rename and Delete ask first.
// A native <dialog>: focus stays inside it, and Escape or a tap on the dark ground closes it.
import { el, setText } from './el.js';
import { icon } from './icons.js';
import { createCassette } from './cassette.js';
import { tapeCard } from '../logic/shelf.js';
import { FORMATS, progressText, sizeText } from '../logic/export.js';
import { cleanTitle, TITLE_MAX } from '../logic/tape-names.js';

const SHELL = { shell: '#C9D0CC', band: '#29323A', win: '#29323A', pack: '#7C868C', hub: '#FAFAF7', ink: '#29323A' };
// What to say after the share sheet: downloaded instead, or the phone wants a tap on Share first.
const AFTER = { saved: 'Downloaded.', again: 'Tap Share to send it.', cancelled: '' };
// A file ready this soon after the tap goes straight to the share sheet (later, phones want a fresh tap).
const QUICK_MS = 1000;

function act(text, onclick, cls = '') {
  return el('button', { class: `tm-act control ${cls}`.trim(), type: 'button', onclick }, text);
}

// onPlay(tape). onRename(tape, title) and onDelete(tape) resolve when done (onRename to the renamed tape).
// makeFile(tape, formatId, onProgress, job) resolves to { blob, name }. share(blob, name) resolves to a word from
// data/share.js.
export function createTapeMenu({ onPlay, onRename, onDelete, makeFile, share }) {
  let tape = null;
  let saved = false; // opened right after a mixtape was saved: Share comes first
  let job = null; // the file being made: { cancelled }
  let file = null; // the file made: { blob, name }

  const art = el('div', { class: 'tm-tape', 'aria-hidden': 'true' });
  const note = el('p', { class: 'tm-note', hidden: true }, 'Mixtape saved to the shelf.');
  const title = el('h2', { class: 'tm-title', id: 'tm-title' });
  const meta = el('p', { class: 'tm-meta' });
  const body = el('div', { class: 'tm-body' });
  const said = el('p', { class: 'tm-said', role: 'status' });
  const close = el('button', { class: 'tm-close', type: 'button', 'aria-label': 'Close' }, icon('close'));
  const node = el(
    'dialog',
    { class: 'tape-menu', 'aria-labelledby': 'tm-title' },
    el('div', { class: 'tm-card' }, art, el('div', { class: 'tm-side' }, note, title, meta, body, said), close),
  );

  const hide = () => node.open && node.close();
  function stopJob() {
    if (job) job.cancelled = true;
    job = null;
  }
  close.addEventListener('click', hide);
  node.addEventListener('close', stopJob);
  node.addEventListener('click', (e) => {
    if (e.target === node) hide();
  });

  const say = (text) => setText(said, text || '');

  // Puts one step in the menu (the keys, the formats, the progress...), clears the last message, and moves focus
  // to the step's first control.
  function show(view, ...children) {
    node.dataset.view = view;
    say('');
    body.replaceChildren(...children);
    const first = body.querySelector('input, button');
    if (first && node.open) first.focus();
  }

  function draw() {
    const card = tapeCard(tape);
    const cassette = createCassette({ ...SHELL, label: card.label });
    cassette.update({ title: card.title, len: card.len });
    art.replaceChildren(cassette.node);
    setText(title, card.title);
    setText(meta, card.meta);
  }

  function keys() {
    const play = act('Play', () => {
      hide();
      onPlay(tape);
    });
    const send = act('Share', formats);
    const first = saved ? [send, play] : [play, send];
    first[0].classList.add('pri');
    show('menu', el('div', { class: 'tm-row' }, ...first, act('Rename', rename), act('Delete', confirmDelete)));
  }

  function formats() {
    show(
      'share',
      el('p', { class: 'tm-q' }, 'Share as'),
      el('div', { class: 'tm-row' }, ...FORMATS.map((f, i) => el(
        'button',
        { class: `tm-format${i === 0 ? ' pri' : ''}`, type: 'button', onclick: () => make(f.id) },
        el('span', { class: 'control' }, f.name),
        el('span', { class: 'tm-fnote' }, f.note),
      ))),
      el('div', { class: 'tm-row' }, act('Back', keys)),
    );
  }

  function make(formatId) {
    stopJob();
    const mine = { cancelled: false };
    const started = performance.now();
    job = mine;
    file = null;
    const words = el('p', { class: 'tm-q' }, progressText(formatId, null));
    const fill = el('i');
    const bar = el('div', { class: 'tm-bar', role: 'progressbar', 'aria-label': 'Making the file', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
    show('making', words, bar, el('div', { class: 'tm-row' }, act('Cancel', () => {
      stopJob();
      formats();
    })));
    const progress = (fraction) => {
      if (job !== mine) return;
      setText(words, progressText(formatId, fraction));
      if (fraction === null) return;
      const pct = Math.round(fraction * 100);
      fill.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', String(pct));
    };
    makeFile(tape, formatId, progress, mine).then(
      (made) => {
        if (job !== mine) return;
        job = null;
        file = made;
        ready();
        if (performance.now() - started < QUICK_MS) send();
      },
      (error) => {
        if (job !== mine) return;
        job = null;
        formats();
        if (error.name !== 'AbortError') say("Couldn't make the file. Try the other format.");
      },
    );
  }

  function ready() {
    show(
      'ready',
      el('p', { class: 'tm-q' }, `${file.name}, ${sizeText(file.blob.size)}`),
      el('div', { class: 'tm-row' }, act('Share', send, 'pri'), act('Back', formats)),
    );
  }

  async function send() {
    const result = await share(file.blob, file.name);
    if (result === 'shared') hide();
    else say(AFTER[result]);
  }

  function rename() {
    const input = el('input', {
      class: 'tm-input', type: 'text', value: tape.title || '', maxlength: String(TITLE_MAX), 'aria-label': 'Name',
      autocomplete: 'off', enterkeyhint: 'done', spellcheck: 'false',
    });
    const form = el(
      'form',
      { class: 'tm-rename', onsubmit: (e) => { e.preventDefault(); keep(cleanTitle(input.value)); } },
      input,
      el('div', { class: 'tm-row' }, el('button', { class: 'tm-act control pri', type: 'submit' }, 'Save'), act('Cancel', keys)),
    );
    show('rename', form);
    input.select();
  }

  async function keep(name) {
    if (!name) return say('Type a name first.');
    if (name === tape.title) return keys();
    try {
      tape = await onRename(tape, name);
      draw();
      keys();
      say('Renamed.');
    } catch {
      say("Couldn't rename it. Try again.");
    }
  }

  function confirmDelete() {
    show(
      'delete',
      el('p', { class: 'tm-q' }, "Delete this tape? It can't be undone."),
      el('div', { class: 'tm-row' }, act('Keep it', keys), act('Delete', remove, 'ink')),
    );
  }

  async function remove() {
    try {
      await onDelete(tape);
      hide();
    } catch {
      say("Couldn't delete it. Try again.");
    }
  }

  return {
    node,
    // saved: true right after a mixtape was saved (says so, and offers Share first).
    open(next, { saved: justSaved = false } = {}) {
      stopJob();
      tape = next;
      saved = justSaved;
      file = null;
      note.hidden = !saved;
      draw();
      keys();
      if (!node.open) node.showModal();
    },
    close: hide,
  };
}
