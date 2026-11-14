// The mix screen: the clips in a row (label colour by kind, width by length), the join between each two (None or
// Fade in), the red play line on a ruler, and the tools: Add clip, Play, Cut, Remove, Save mixtape.
// From MixTimeline.dc.html. It only shows the mix and reports taps; pages/mixing.js changes the mix.
import { el, setText } from '../components/el.js';
import { icon } from '../components/icons.js';
import { KINDS } from '../logic/shelf.js';
import { timeline, mixLength, rulerMarks, clock, canCut, mixHint } from '../logic/mix.js';
import { layoutTimeline, timeToX, xToTime, rulerLabels } from '../logic/mix-layout.js';

const tool = (words, onclick, symbol) =>
  el('button', { class: 'tool control', type: 'button', onclick }, symbol ? icon(symbol) : null, el('span', {}, words));

function clipButton(item, on) {
  return el(
    'button',
    { class: item.selected ? 'clip sel' : 'clip', type: 'button', 'aria-label': item.aria, style: { background: (KINDS[item.kind] || KINDS.voice).label }, onclick: () => on.pick(item.index) },
    item.fade ? el('span', { class: 'clip-fade', 'aria-hidden': 'true' }) : null,
    el('span', { class: 'clip-title' }, item.title),
    el('span', { class: 'clip-foot' }, el('span', { class: 'clip-src' }, item.src), el('span', { class: 'clip-len' }, item.len)),
  );
}

function joinButton(item, on) {
  return el(
    'button',
    { class: 'join control', type: 'button', 'aria-label': item.aria, onclick: () => on.join(item.index) },
    icon(item.fade ? 'fadeIn' : 'straight'),
    el('span', {}, item.text),
  );
}

// on: { pick(i), join(i), line(t), cut(), remove(), play(), save() }
export function createMixPage(on) {
  const total = el('span', { class: 'mix-total' });
  const save = el('button', { class: 'pri control', type: 'button', onclick: on.save }, 'Save mixtape');
  const play = tool('Play', on.play, 'play');
  const cut = tool('Cut', on.cut, 'cut');
  const remove = tool('Remove', on.remove);
  const hint = el('span', { class: 'mix-hint', 'aria-live': 'polite' });
  const track = el('div', { class: 'track' });
  const marks = el('div', { class: 'marks', 'aria-hidden': 'true' });
  const ruler = el('div', { class: 'ruler', role: 'slider', tabindex: '0', 'aria-label': 'Red line', 'aria-valuemin': '0' }, marks);
  const line = el('div', { class: 'play-line', 'aria-hidden': 'true' });
  const row = el('div', { class: 'tl-row' }, track, ruler, line);
  const scroller = el('div', { class: 'tl' }, row);
  const empty = el('p', { class: 'mix-empty' }, 'No clips yet.');

  let mix = null;
  let state = {};
  let seconds = [];
  let layout = layoutTimeline([], 0);

  // Sizes the clips to the screen, then puts the red line and the ruler's times in place.
  function place() {
    if (!mix) return;
    layout = layoutTimeline(seconds, scroller.clientWidth);
    row.style.width = `${layout.width}px`;
    [...track.querySelectorAll('.clip')].forEach((node, i) => { node.style.width = `${layout.clips[i].width}px`; });
    const labels = rulerLabels(layout, seconds, rulerMarks(mixLength(mix)));
    // A time at either end sits inside the ruler instead of centred on its spot.
    const shift = (x) => (x <= 0 ? '0' : x >= layout.width - 1 ? '-100%' : '-50%');
    marks.replaceChildren(...labels.map((l) => el('span', { style: { left: `${l.x}px`, transform: `translateX(${shift(l.x)})` } }, clock(l.t))));
    moveLine(mix);
  }

  // Moves the red line only (dragging, or following the sound); Cut and the hint follow it.
  function moveLine(next) {
    mix = next;
    line.style.left = `${timeToX(layout, seconds, mix.line)}px`;
    ruler.setAttribute('aria-valuenow', String(mix.line));
    ruler.setAttribute('aria-valuetext', clock(mix.line));
    cut.disabled = !canCut(mix);
    setText(hint, state.note || mixHint(mix));
  }

  // Dragging on the ruler (or the line) moves the line; so do the arrow keys.
  const timeAt = (event) => xToTime(layout, seconds, event.clientX - row.getBoundingClientRect().left);
  ruler.addEventListener('pointerdown', (event) => {
    ruler.setPointerCapture(event.pointerId);
    on.line(timeAt(event));
  });
  ruler.addEventListener('pointermove', (event) => {
    if (ruler.hasPointerCapture(event.pointerId)) on.line(timeAt(event));
  });
  const KEYS = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
  ruler.addEventListener('keydown', (event) => {
    const end = mixLength(mix);
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? end : KEYS[event.key] ? mix.line + KEYS[event.key] : null;
    if (to === null) return;
    event.preventDefault();
    on.line(to);
  });

  const node = el(
    'section',
    { class: 'screen mix-screen', 'aria-label': 'New mix', hidden: true },
    el(
      'div',
      { class: 'mix-top' },
      el('a', { class: 'back control', href: '#/shelf' }, icon('back'), 'Shelf'),
      el('h1', { class: 'screen-title' }, 'New mix'),
      el('div', { class: 'grow' }),
      total,
      el('span', { class: 'mix-in-all' }, 'in all'),
      save,
    ),
    el('div', { class: 'mix-tools' }, el('button', { class: 'tool control', type: 'button', 'aria-haspopup': 'dialog', onclick: on.addClip }, icon('plus'), 'Add clip'), play, cut, remove, hint),
    el('div', { class: 'mix-body' }, empty, scroller),
  );

  // Shows the mix. state: { playing, saving, note } (note: a message instead of the hint).
  function show(next, now = {}) {
    mix = next;
    state = now;
    const items = timeline(mix);
    seconds = items.filter((i) => i.type === 'clip').map((i) => i.seconds);
    track.replaceChildren(...items.map((item) => (item.type === 'clip' ? clipButton(item, on) : joinButton(item, on))));
    const has = mix.clips.length > 0;
    empty.hidden = has;
    scroller.hidden = !has;
    setText(total, clock(mixLength(mix)));
    ruler.setAttribute('aria-valuemax', String(mixLength(mix)));
    play.replaceChildren(icon(state.playing ? 'stop' : 'play'), el('span', {}, state.playing ? 'Stop' : 'Play'));
    play.disabled = !has;
    remove.disabled = mix.sel < 0;
    save.disabled = !has || Boolean(state.saving);
    setText(save, state.saving ? 'Saving…' : 'Save mixtape');
    place();
  }

  window.addEventListener('resize', place);
  return { node, show, moveLine, place };
}
