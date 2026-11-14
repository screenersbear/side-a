// FM1 WORLD: every station on its dial (data/stations.js, the US, and data/world-stations.js), its four presets, and
// how Next and Previous move. FM2 LOCAL's stations come from where the user is (logic/local-stations.js); the
// functions here take a band's list, FM1's by default.
// Next and Previous seek to the next station up or down the dial, like the seek button on a real radio.
import { STATION_LIST } from '../data/stations.js';
import { WORLD_LIST } from '../data/world-stations.js';

// Low to high on the dial, so Next always moves the needle right.
export const STATIONS = [...STATION_LIST, ...WORLD_LIST].sort((a, b) => a.freq - b.freq);

// FM1's four number keys: favourite stations, by frequency. These until a key is held to save another station there.
export const PRESET_FREQS = [88.3, 89.3, 90.3, 98.9];

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

// Is this a station number the dial has?
export function isStation(index, list = STATIONS) {
  return Number.isInteger(index) && index >= 0 && index < list.length;
}

// The station on a frequency, as its number on the dial, or -1 when nothing is there.
export function stationAt(freq, list = STATIONS) {
  const f = Number(freq);
  return list.findIndex((s) => Math.abs(s.freq - f) < 0.05);
}

// The four presets from what was saved on the phone: each saved frequency that's on the dial, else that key's
// default. Always four, each exactly a station's frequency.
export function cleanPresets(saved, list = STATIONS, defaults = PRESET_FREQS) {
  const mine = Array.isArray(saved) ? saved : [];
  return defaults.map((fallback, i) => {
    const at = stationAt(mine[i], list);
    return at >= 0 ? list[at].freq : fallback;
  });
}

// The station a preset key tunes to (key 0 to 3), or -1.
export function presetStation(key, presets = PRESET_FREQS, list = STATIONS) {
  if (!Number.isInteger(key) || key < 0 || key >= presets.length) return -1;
  return stationAt(presets[key], list);
}

// Can this station be taped? Some streams don't allow recording.
export function canTape(station) {
  return Boolean(station) && station.tape !== false;
}
