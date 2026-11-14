// The deck's controls: transport keys, two-way switches (Radio / Tape, Mic / Radio in), preset keys.
import { el, setPressed } from './el.js';
import { icon } from './icons.js';
import { makeHoldable } from './hold.js';

const KEY_ORDER = ['rec', 'play', 'rew', 'ff', 'stop'];

// Record, Play, Rewind, Fast forward, Stop. onPress(type) gets 'rec', 'play', 'rew', 'ff' or 'stop'.
// Looks can change the order, the key class and the Record symbol (the Deck look's piano keys).
export function createTransport(onPress, { order = KEY_ORDER, cls = 'k', recIcon = 'rec' } = {}) {
  const key = (type, label, pressable) =>
    el('button', { class: cls, type: 'button', 'aria-label': label, 'aria-pressed': pressable ? 'false' : null, 'data-key': type, onclick: () => onPress(type) }, icon(type === 'rec' ? recIcon : type));
  const keys = {
    rec: key('rec', 'Record', true),
    play: key('play', 'Play', true),
    rew: key('rew', 'Rewind', false),
    ff: key('ff', 'Fast forward', false),
    stop: key('stop', 'Stop', true),
  };
  const node = el('div', { class: 'transport' }, order.map((type) => keys[type]));

  function update(v) {
    setPressed(keys.rec, v.recording);
    setPressed(keys.play, v.playOn);
    setPressed(keys.stop, v.stopped);
    keys.rew.setAttribute('aria-label', v.rewLabel);
    keys.ff.setAttribute('aria-label', v.ffLabel);
  }
  return { node, update };
}

// A row of underlined words where one is picked. options: [{ id, text }]. onPick(id).
export function createSwitch(groupLabel, options, onPick, cls = 'seg') {
  const buttons = options.map((o) =>
    el('button', { class: `${cls} control`, type: 'button', 'aria-pressed': 'false', 'data-id': o.id, onclick: () => onPick(o.id) }, o.text),
  );
  const node = el('div', { class: 'switch', role: 'group', 'aria-label': groupLabel }, buttons);

  function update(activeId) {
    buttons.forEach((b) => setPressed(b, b.dataset.id === activeId));
  }
  return { node, update };
}

// The four preset keys, like a car radio's: onPick(index) on a tap, onHold(index) when held down for a second
// (to save the station on the dial there).
export function createPresets(count, { onPick, onHold }) {
  const hint = el('span', { class: 'visually-hidden', id: 'preset-hint' }, 'Hold to save the station on the dial here.');
  const buttons = Array.from({ length: count }, (_, i) => {
    const button = el('button', { class: 'p', type: 'button', 'aria-pressed': 'false', 'aria-describedby': 'preset-hint' }, String(i + 1));
    makeHoldable(button, { onTap: () => onPick(i), onHold: () => onHold(i) });
    return button;
  });
  const node = el('div', { class: 'presets' }, buttons, hint);

  function update(presets) {
    presets.forEach((p, i) => {
      setPressed(buttons[i], p.on);
      buttons[i].setAttribute('aria-label', p.label);
    });
  }
  return { node, update };
}
