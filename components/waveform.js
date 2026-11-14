// A tape's sound as a row of bars with two mango handles, the start and end of the part being picked. The part
// between them is mango, the rest grey. Dragging moves the nearer handle: onDrag(edge, seconds).
import { el } from './el.js';
import { BAR_COUNT, nearestEdge } from '../logic/trim.js';

export function createWaveform(onDrag) {
  const bars = Array.from({ length: BAR_COUNT }, () => el('span', { class: 'bar' }));
  const start = el('div', { class: 'handle' });
  const end = el('div', { class: 'handle' });
  const node = el('div', { class: 'waveform', 'aria-hidden': 'true' }, bars, start, end);
  let trim = null;
  let edge = 'start';

  const timeAt = (event) => {
    const box = node.getBoundingClientRect();
    return (Math.min(Math.max(0, event.clientX - box.left), box.width) / box.width) * trim.duration;
  };
  node.addEventListener('pointerdown', (event) => {
    if (!trim || !trim.duration) return;
    node.setPointerCapture(event.pointerId);
    edge = nearestEdge(trim, timeAt(event));
    onDrag(edge, timeAt(event));
  });
  node.addEventListener('pointermove', (event) => {
    if (trim && node.hasPointerCapture(event.pointerId)) onDrag(edge, timeAt(event));
  });

  // levels: one 0..1 height per bar (logic/trim.js peaks), or none while the tape is being read.
  function update(next, levels) {
    trim = next;
    const share = (t) => (trim.duration ? t / trim.duration : 0);
    start.style.left = `${share(trim.start) * 100}%`;
    end.style.left = `${share(trim.end) * 100}%`;
    bars.forEach((bar, i) => {
      const middle = (i + 0.5) / BAR_COUNT;
      bar.style.height = `${12 + (levels ? levels[i] : 0) * 80}%`;
      bar.classList.toggle('in', middle >= share(trim.start) && middle <= share(trim.end));
    });
  }

  return { node, update };
}
