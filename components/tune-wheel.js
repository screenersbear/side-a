// The tuning wheel (HANDOFF "Manual tuning wheel", from TuneWheel.dc.html): drag it, or use the arrow keys (it's a
// slider for screen readers), and the dial moves in 0.1 MHz steps. kind 'h': a ribbed thumbwheel seen edge-on,
// dragged sideways; 'v': the same standing up, dragged up and down; 'knob': a round knob turned by dragging.
// The ridges slide (or the knob turns) as the frequency changes. Colours come from the look's CSS.
// onTune(freq) while dragging; onStep(step) for a key (0.1, or 1 for Page Up / Down). The deck locks onto stations.
import { el } from './el.js';
import { DIAL_LOW, DIAL_HIGH } from '../logic/stations.js';

const MHZ_PER_PX = 0.02;
const KEYS = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 1, PageDown: -1 };

function knobParts() {
  const notches = Array.from({ length: 16 }, (_, i) => el('span', { class: 'tw-notch', style: { '--a': `${i * 22.5}deg` } }));
  return el('span', { class: 'tw-turn', 'aria-hidden': 'true' }, notches, el('span', { class: 'tw-mark' }));
}

export function createTuneWheel(kind, { onTune, onStep }) {
  const knob = kind === 'knob';
  const turn = knob ? knobParts() : null;
  const node = el(
    'div',
    {
      class: `tw tw-${kind}`,
      role: 'slider',
      tabindex: '0',
      'aria-label': knob ? 'Tuning knob' : 'Tuning wheel',
      'aria-valuemin': DIAL_LOW,
      'aria-valuemax': DIAL_HIGH,
      'aria-orientation': kind === 'v' ? 'vertical' : 'horizontal',
    },
    turn,
  );
  let freq = DIAL_LOW;
  let drag = null;

  node.addEventListener('pointerdown', (e) => {
    try {
      node.setPointerCapture(e.pointerId);
    } catch {
      // Capture only keeps the drag going off the wheel; it works without.
    }
    drag = { x: e.clientX, y: e.clientY, freq };
  });
  node.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = drag.y - e.clientY;
    const moved = kind === 'h' ? dx : kind === 'v' ? dy : dx + dy;
    onTune(drag.freq + moved * MHZ_PER_PX);
  });
  const letGo = () => {
    drag = null;
  };
  node.addEventListener('pointerup', letGo);
  node.addEventListener('pointercancel', letGo);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onTune(e.key === 'Home' ? DIAL_LOW : DIAL_HIGH);
      return;
    }
    const step = KEYS[e.key];
    if (!step) return;
    e.preventDefault();
    onStep(step);
  });

  // The dial moved: the ridges slide 3 px a step (repeating every 8), or the knob turns 300 degrees end to end.
  function update(nextFreq, text) {
    if (nextFreq === freq && node.getAttribute('aria-valuetext') === text) return;
    freq = nextFreq;
    node.setAttribute('aria-valuenow', freq.toFixed(1));
    node.setAttribute('aria-valuetext', text);
    if (knob) turn.style.transform = `rotate(${(((freq - DIAL_LOW) / (DIAL_HIGH - DIAL_LOW)) * 300).toFixed(1)}deg)`;
    else node.style.setProperty('--ridge', `${(((freq - DIAL_LOW) * 30) % 8).toFixed(1)}px`);
  }

  return { node, update };
}
