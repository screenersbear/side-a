// The tuning wheel (HANDOFF "Manual tuning wheel"): turned by hand, the dial moves in 0.1 MHz steps. Within 0.2 MHz
// of a station it locks on (with a soft click) and plays it; between stations the radio is quiet: "FM, searching".
// The deck keeps the frequency between stations in `between` (null when it's on a station).
import { STATIONS, DIAL_LOW, DIAL_HIGH } from './stations.js';

export const LOCK_MHZ = 0.2;
export const SEARCHING = 'FM, searching';
export const STATIC_LINE = 'Static. Keep turning.';
export const TUNE_FIRST = 'Tune to a station first.';

// A frequency on the dial: kept between 88 and 108, to one decimal place.
export function onDial(freq) {
  const f = Number(freq);
  if (!Number.isFinite(f)) return DIAL_LOW;
  return Math.round(Math.min(DIAL_HIGH, Math.max(DIAL_LOW, f)) * 10) / 10;
}

// Where the dial is: between stations, or on the station.
export function dialFreq(s, list = STATIONS) {
  return s.between ?? list[s.station].freq;
}

// The station the wheel locks onto at this frequency (the nearest within 0.2 MHz; the lower one on a tie), or -1.
export function lockAt(freq, list = STATIONS) {
  // (A hair of tolerance: 90.5 - 90.3 isn't exactly 0.2 in a computer's arithmetic.)
  const near = 1e-9;
  let best = -1;
  let gap = LOCK_MHZ + near;
  list.forEach((st, i) => {
    const d = Math.abs(st.freq - freq);
    if (d <= gap && (best < 0 || d < gap - near)) {
      best = i;
      gap = d;
    }
  });
  return best;
}

// Where an arrow key (step 0.1 or -0.1; Page Up or Down: 1 or -1) moves the dial from `freq`. It moves on past the
// station it's locked to, so the keys never get stuck on one.
export function stepDial(freq, step, list = STATIONS) {
  const from = lockAt(freq, list);
  let f = onDial(freq + step);
  while (from >= 0 && lockAt(f, list) === from && f > DIAL_LOW && f < DIAL_HIGH) f = onDial(f + step);
  return f;
}

// The station Next (1) or Previous (-1) seeks to from between stations: the next one up or down the dial, going
// round at the ends. The list runs low to high.
export function seekFrom(freq, direction, list = STATIONS) {
  if (direction > 0) {
    const up = list.findIndex((st) => st.freq > freq);
    return up >= 0 ? up : 0;
  }
  const below = list.filter((st) => st.freq < freq).length;
  return below > 0 ? below - 1 : list.length - 1;
}

// Did the wheel just lock onto a station? (It clicks softly when it does.)
export function lockedOn(prev, next) {
  return next.between === null && (prev.between !== null || prev.station !== next.station);
}
