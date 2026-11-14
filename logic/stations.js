// The four radio presets: real public stations whose streams let the app tape them (they allow it in a browser).
// freq is each station's real FM frequency, which is where the needle sits on the dial.
export const STATIONS = [
  { freq: 88.3, name: 'WBGO Jazz', place: 'Newark', url: 'https://ais-sa8.cdnstream1.com/3629_128.mp3' },
  { freq: 89.3, name: 'The Current', place: 'Minneapolis', url: 'https://current.stream.publicradio.org/current.mp3' },
  { freq: 90.3, name: 'KEXP', place: 'Seattle', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3' },
  { freq: 98.9, name: 'KUTX', place: 'Austin', url: 'https://streams.kut.org/4428_192.mp3' },
];

// The FM dial runs from 88 to 108 MHz, with a numbered tick every 4.
export const DIAL_LOW = 88;
export const DIAL_HIGH = 108;
export const DIAL_TICKS = [88, 92, 96, 100, 104, 108];

// Where a frequency sits on the dial, from 0 (left) to 100 (right), kept on the dial.
export function dialPercent(freq) {
  const f = Number(freq);
  if (!Number.isFinite(f)) return 0;
  const pct = ((f - DIAL_LOW) / (DIAL_HIGH - DIAL_LOW)) * 100;
  return Math.min(100, Math.max(0, pct));
}

// The station before or after this one, going round: after the last comes the first.
export function stepStation(index, delta, count = STATIONS.length) {
  if (!Number.isInteger(count) || count < 1) return 0;
  const i = Number.isInteger(index) ? index : 0;
  const d = Number.isInteger(delta) ? delta : 0;
  return (((i + d) % count) + count) % count;
}

// A frequency written the way the dial shows it: one decimal place.
export function freqText(freq) {
  const f = Number(freq);
  return Number.isFinite(f) ? f.toFixed(1) : '';
}

// Is this a preset number the deck has?
export function isStation(index) {
  return Number.isInteger(index) && index >= 0 && index < STATIONS.length;
}
