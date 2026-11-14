// The deck's controls: transport keys, two-way switches (Radio / Tape, Mic / Radio in), preset keys.
import { el, setPressed } from './el.js';
import { icon } from './icons.js';

// Record, Play, Rewind, Fast forward, Stop. onPress(type) gets 'rec', 'play', 'rew', 'ff' or 'stop'.
export function createTransport(onPress) {
  const key = (type, label, pressable) =>
    el('button', { class: 'k', type: 'button', 'aria-label': label, 'aria-pressed': pressable ? 'false' : null, onclick: () => onPress(type) }, icon(type));
  const keys = {
    rec: key('rec', 'Record', true),
    play: key('play', 'Play', true),
    rew: key('rew', 'Rewind', false),
    ff: key('ff', 'Fast forward', false),
    stop: key('stop', 'Stop', true),
  };
  const node = el('div', { class: 'transport' }, Object.values(keys));

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
    el('button', { class: cls, type: 'button', 'aria-pressed': 'false', 'data-id': o.id, onclick: () => onPick(o.id) }, o.text),
  );
  const node = el('div', { class: 'switch', role: 'group', 'aria-label': groupLabel }, buttons);

  function update(activeId) {
    buttons.forEach((b) => setPressed(b, b.dataset.id === activeId));
  }
  return { node, update };
}

// The four preset keys. onPick(index).
export function createPresets(count, onPick) {
  const buttons = Array.from({ length: count }, (_, i) =>
    el('button', { class: 'p', type: 'button', 'aria-pressed': 'false', onclick: () => onPick(i) }, String(i + 1)),
  );
  const node = el('div', { class: 'presets' }, buttons);

  function update(presets) {
    presets.forEach((p, i) => {
      setPressed(buttons[i], p.on);
      buttons[i].setAttribute('aria-label', p.label);
    });
  }
  return { node, update };
}
