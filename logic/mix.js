// A mixtape in the making: clips cut from tapes on the shelf, played one after another. Between two clips the
// join is 'none' (straight on) or 'fade' (the next clip fades in, FADE_SECONDS). The red play line marks a time
// in the mix; Cut splits the clip under it. Pure rules: pages/mix.js shows them, audio/mixdown.js plays them.
// A clip: { tapeId, title, kind, from, to } (seconds into its tape).

export const FADE_SECONDS = 1.5;
// A cut leaves at least this much on both sides.
export const MIN_PIECE = 0.5;

export function emptyMix() {
  return { clips: [], joins: [], sel: -1, line: 0 };
}

const clipLength = (clip) => clip.to - clip.from;

export function mixLength(mix) {
  return mix.clips.reduce((sum, clip) => sum + clipLength(clip), 0);
}

// Where each clip starts in the mix, in seconds.
function starts(mix) {
  let at = 0;
  return mix.clips.map((clip) => {
    const start = at;
    at += clipLength(clip);
    return start;
  });
}

export function addClip(mix, clip) {
  if (!clip || !(clipLength(clip) > 0)) return mix;
  const joins = mix.clips.length ? [...mix.joins, 'none'] : mix.joins;
  return { ...mix, clips: [...mix.clips, clip], joins, sel: -1 };
}

// Tapping a clip selects it; tapping it again lets go.
export function selectClip(mix, index) {
  if (!mix.clips[index]) return mix;
  return { ...mix, sel: mix.sel === index ? -1 : index };
}

// Removes the selected clip and the join into it (for the first clip, the join after it).
export function removeSelected(mix) {
  const index = mix.sel;
  if (!mix.clips[index]) return mix;
  const clips = mix.clips.filter((_, k) => k !== index);
  const joins = mix.joins.filter((_, k) => k !== Math.max(0, index - 1));
  const next = { ...mix, clips, joins, sel: -1 };
  return { ...next, line: Math.min(mix.line, mixLength(next)) };
}

export function toggleJoin(mix, index) {
  if (!mix.joins[index]) return mix;
  const joins = mix.joins.map((join, k) => (k === index ? (join === 'fade' ? 'none' : 'fade') : join));
  return { ...mix, joins };
}

// Moves the red line to time t (tenths of a second, kept inside the mix).
export function setLine(mix, t) {
  const n = Number(t);
  const line = Math.min(mixLength(mix), Math.max(0, Number.isFinite(n) ? Math.round(n * 10) / 10 : 0));
  return line === mix.line ? mix : { ...mix, line };
}

// The clip playing at time t and how far into it, or null (an empty mix, or the very end).
export function clipAt(mix, t) {
  const at = starts(mix);
  const index = mix.clips.findIndex((clip, i) => t >= at[i] && t < at[i] + clipLength(clip));
  return index < 0 ? null : { index, offset: t - at[index] };
}

export function canCut(mix) {
  const hit = clipAt(mix, mix.line);
  return Boolean(hit) && hit.offset >= MIN_PIECE && clipLength(mix.clips[hit.index]) - hit.offset >= MIN_PIECE;
}

// Splits the clip under the red line in two, joined with 'none'. The second piece is selected, so Remove
// right after drops what comes after the line.
export function cutAtLine(mix) {
  if (!canCut(mix)) return mix;
  const { index, offset } = clipAt(mix, mix.line);
  const clip = mix.clips[index];
  const cut = clip.from + offset;
  const clips = [...mix.clips.slice(0, index), { ...clip, to: cut }, { ...clip, from: cut }, ...mix.clips.slice(index + 1)];
  const joins = [...mix.joins.slice(0, index), 'none', ...mix.joins.slice(index)];
  return { ...mix, clips, joins, sel: index + 1 };
}

// What to play, in order: each clip's tape and part, when it starts in the mix, and how long it fades in.
export function mixPlan(mix) {
  const at = starts(mix);
  return mix.clips.map((clip, i) => ({
    tapeId: clip.tapeId,
    from: clip.from,
    to: clip.to,
    at: at[i],
    fade: i > 0 && mix.joins[i - 1] === 'fade' ? Math.min(FADE_SECONDS, clipLength(clip) / 2) : 0,
  }));
}

// Seconds as m:ss ("1:05").
export function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The word for where a clip came from, written on it under its title.
const SOURCES = { voice: 'Voice', radio: 'Radio', mix: 'Mix' };

// What the timeline shows, left to right: clips, and a join between each two.
export function timeline(mix) {
  const items = [];
  mix.clips.forEach((clip, i) => {
    const fade = i > 0 && mix.joins[i - 1] === 'fade';
    if (i > 0) {
      const how = fade ? 'fade in' : 'none';
      items.push({ type: 'join', index: i - 1, fade, text: fade ? 'Fade in' : 'None', aria: `Into ${clip.title}: ${how}. Tap to change.` });
    }
    const len = clock(clipLength(clip));
    const selected = i === mix.sel;
    items.push({
      type: 'clip', index: i, title: clip.title, kind: clip.kind, src: SOURCES[clip.kind] || 'Voice', len,
      seconds: clipLength(clip), fade, selected,
      aria: `${clip.title}, ${len}${selected ? ', selected' : ''}`,
    });
  });
  return items;
}

// The ruler's marks: seven times from the start to the end of the mix.
export function rulerMarks(total) {
  return Array.from({ length: 7 }, (_, k) => (total * k) / 6);
}

// The line under the tools, saying what a tap does now.
export function mixHint(mix) {
  if (!mix.clips.length) return 'Add a clip from any tape to start.';
  if (mix.sel >= 0) return 'Remove the selected piece, or tap it again to let go.';
  if (canCut(mix)) return 'Cut splits the clip at the red line.';
  return 'Tap a clip to select it. Tap a gap to switch None and Fade in.';
}
