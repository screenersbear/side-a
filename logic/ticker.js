// The song line's ticker (HANDOFF "Long song titles"): a title too long for its line holds still for 2 s, so the
// start can be read, then glides left at about 25 px a second and loops: the title, a dot gap, the title again.

export const HOLD_SECONDS = 2;
export const PX_PER_SECOND = 25;

// Does text `textPx` wide overflow a line `linePx` wide? (A pixel's grace for rounding.)
export function overflows(textPx, linePx) {
  return linePx > 0 && textPx > linePx + 1;
}

// One loop of the ticker, for a title (with its gap) `loopPx` wide: how long it takes in ms, and how far through it
// (0 to 1) the hold ends and the glide starts.
export function tickerTiming(loopPx, { hold = HOLD_SECONDS, speed = PX_PER_SECOND } = {}) {
  const glide = Math.max(0, loopPx) / speed;
  const total = hold + glide;
  return { duration: Math.round(total * 1000), holdUntil: total ? hold / total : 1 };
}
