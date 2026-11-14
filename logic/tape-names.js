// Counters and the names written on new tapes.
import { freqText } from './stations.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function two(n) {
  return n < 10 ? `0${n}` : String(n);
}

// Seconds as a tape counter: 00:00, 02:14, 61:05. Anything that isn't a time reads 00:00.
export function mmss(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '00:00';
  const whole = Math.floor(s);
  return `${two(Math.floor(whole / 60))}:${two(whole % 60)}`;
}

// A date as "Nov 14".
export function shortDate(when) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// A time as "9:41 PM".
export function clockTime(when) {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${two(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

// The name a new tape gets. Voice notes: "Nov 14, 9:41 PM". Taped radio: "90.3 KEXP, Nov 14".
export function tapeTitle(kind, station, when) {
  const date = shortDate(when);
  if (kind === 'radio' && station) {
    const name = `${freqText(station.freq)} ${station.name}`;
    return date ? `${name}, ${date}` : name;
  }
  const time = clockTime(when);
  return date ? `${date}, ${time}` : 'Voice note';
}

// The longest name a tape can be given.
export const TITLE_MAX = 60;

// A name typed for a tape, tidied: spaces collapsed and trimmed, at most TITLE_MAX characters. '' when nothing's left.
export function cleanTitle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX).trim();
}
