// Where the mix timeline puts things, in pixels. Each clip is as wide as its share of the mix (at least MIN_W, so
// it can be tapped), with a JOIN_W button between two clips. From this the red line finds its place, a drag on the
// ruler reads back as a time, and the ruler's times find theirs. seconds: each clip's length, in order.

export const JOIN_W = 56;
export const MIN_W = 56;

// { clips: [{ left, width }], width }. Wider than `width` only when the clips can't fit (the row then scrolls).
export function layoutTimeline(seconds, width) {
  let room = Math.max(0, width - Math.max(0, seconds.length - 1) * JOIN_W);
  let rest = seconds.reduce((sum, s) => sum + s, 0);
  const widths = [];
  // Shortest first: a clip that would be too thin gets MIN_W, and the others share what's left.
  const order = seconds.map((_, i) => i).sort((a, b) => seconds[a] - seconds[b]);
  for (const i of order) {
    widths[i] = Math.max(MIN_W, rest > 0 ? (room * seconds[i]) / rest : 0);
    room = Math.max(0, room - widths[i]);
    rest -= seconds[i];
  }
  let x = 0;
  const clips = widths.map((w) => {
    const left = x;
    x += w + JOIN_W;
    return { left, width: w };
  });
  const used = clips.length ? x - JOIN_W : 0;
  return { clips, width: Math.max(width, used) };
}

// The x of time t: inside its clip, or the right end of the last clip.
export function timeToX(layout, seconds, t) {
  let start = 0;
  for (let i = 0; i < seconds.length; i++) {
    const last = i === seconds.length - 1;
    if (t < start + seconds[i] || last) {
      const share = Math.min(1, Math.max(0, (t - start) / seconds[i]));
      return layout.clips[i].left + share * layout.clips[i].width;
    }
    start += seconds[i];
  }
  return 0;
}

// The time at x. A join reads as the start of the clip after it; before the row is 0, after it the end.
export function xToTime(layout, seconds, x) {
  let start = 0;
  for (let i = 0; i < seconds.length; i++) {
    const { left, width } = layout.clips[i];
    if (x < left) return start;
    if (x <= left + width) return start + ((x - left) / width) * seconds[i];
    start += seconds[i];
  }
  return start;
}

// The ruler's labels, placed under their times; one too close to the label before it is left out.
export function rulerLabels(layout, seconds, times, gap = 36) {
  const labels = [];
  for (const t of times) {
    const x = timeToX(layout, seconds, t);
    const before = labels[labels.length - 1];
    if (!before || x - before.x >= gap) labels.push({ x, t });
  }
  return labels;
}
