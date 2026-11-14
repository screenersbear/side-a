// Adding a clip: the part of a tape between a start and an end handle, at least MIN_CLIP long. The handles
// move by dragging or in steps (the ‹ › buttons); a step is bigger on long tapes. Pure rules for pages/clip.js.
import { clock } from './mix.js';

export const MIN_CLIP = 1;
export const BAR_COUNT = 72;

export function trimStep(duration) {
  if (duration <= 120) return 1;
  return duration <= 600 ? 5 : 15;
}

// A new selection: the whole tape.
export function startTrim(duration) {
  const d = Math.max(0, Number(duration) || 0);
  return { start: 0, end: d, duration: d };
}

const tenths = (n) => Math.round(n * 10) / 10;

// Puts one handle at time t, never closer than MIN_CLIP to the other one or off the tape.
export function setEdge(trim, edge, t) {
  const n = Number(t);
  if (!Number.isFinite(n)) return trim;
  if (edge === 'start') return { ...trim, start: Math.min(Math.max(0, trim.end - MIN_CLIP), Math.max(0, tenths(n))) };
  return { ...trim, end: Math.max(Math.min(trim.duration, trim.start + MIN_CLIP), Math.min(trim.duration, tenths(n))) };
}

export function moveEdge(trim, edge, steps) {
  return setEdge(trim, edge, trim[edge] + steps * trimStep(trim.duration));
}

// The handle closer to time t (the one a drag there moves).
export function nearestEdge(trim, t) {
  return Math.abs(t - trim.start) <= Math.abs(t - trim.end) ? 'start' : 'end';
}

export function canAdd(trim) {
  return trim.end - trim.start >= MIN_CLIP;
}

export function trimText(trim) {
  return { range: `${clock(trim.start)} to ${clock(trim.end)}`, length: `${clock(trim.end - trim.start)} long` };
}

// The waveform: the loudest sample in each of `count` slices, scaled so the loudest slice is 1.
export function peaks(samples, count = BAR_COUNT) {
  const list = samples && samples.length ? samples : [];
  const size = list.length / count;
  const bars = Array.from({ length: count }, (_, i) => {
    let top = 0;
    for (let k = Math.floor(i * size); k < Math.floor((i + 1) * size); k++) top = Math.max(top, Math.abs(list[k]) || 0);
    return top;
  });
  const loudest = Math.max(...bars);
  return loudest > 0 ? bars.map((b) => b / loudest) : bars;
}
