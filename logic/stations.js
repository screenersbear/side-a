// The radio band: every station on the dial (data/stations.js), the four presets, and how Next and Previous move.
// Next and Previous seek to the next station up or down the dial, like the seek button on a real radio.
import { STATION_LIST } from '../data/stations.js';

// Low to high on the dial, so Next always moves the needle right.
export const STATIONS = [...STATION_LIST].sort((a, b) => a.freq - b.freq);

// The four number keys: favourite stations, by frequency.
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
export function isStation(index) {
  return Number.isInteger(index) && index >= 0 && index < STATIONS.length;
}

// The station on a frequency, as its number on the dial, or -1 when nothing is there.
export function stationAt(freq) {
  const f = Number(freq);
  return STATIONS.findIndex((s) => Math.abs(s.freq - f) < 0.05);
}

// The station a preset key tunes to (key 0 to 3), or -1.
export function presetStation(key) {
  if (!Number.isInteger(key) || key < 0 || key >= PRESET_FREQS.length) return -1;
  return stationAt(PRESET_FREQS[key]);
}

// Which preset key a station is on, 1 to 4, or 0 when it isn't a preset.
export function presetNumber(index) {
  if (!isStation(index)) return 0;
  return PRESET_FREQS.findIndex((f) => stationAt(f) === index) + 1;
}

// Can this station be taped? Some streams don't allow recording.
export function canTape(station) {
  return Boolean(station) && station.tape !== false;
}
