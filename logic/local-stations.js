// FM2 LOCAL (HANDOFF "Bands", Starky 2026-11-14): the real dial near the user. Radio Browser lists stations with
// where they are; the ones near the user that name their FM frequency (in the name, or a tag) and stream over https
// in a format the phone plays go on the dial at that frequency. Pure: data/find-local.js does the asking, and the
// list is kept on the phone (data/local-stations.js).
import { DIAL_LOW, DIAL_HIGH } from './stations.js';

export const LOCAL_INTRO = 'Local stations near you, at their real frequencies.';
export const LOCAL_PREFIX = 'Local · ';
export const NEAR_KM = 100; // stations this close are local
export const WIDE_KM = 200; // further out only when fewer than four are that close
export const MOST = 40; // a dial this full is plenty
const NAME_CHARS = 40;
const CODECS = ['MP3', 'AAC', 'AAC+'];
const SEARCH = 'https://all.api.radio-browser.info/json/stations/search';
const ZIP = 'https://api.zippopotam.us/us/';

// Where the user is, kept to one decimal place (about 10 km): enough to find stations, not enough to find a house.
export function roundPlace(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: Math.round(la * 10) / 10, lon: Math.round(lo * 10) / 10 };
}

// Radio Browser's list of working https stations within 200 km of there, most listened to first.
export function searchUrl(place) {
  const q = new URLSearchParams({
    geo_lat: place.lat, geo_long: place.lon, geo_distance: WIDE_KM * 1000,
    hidebroken: 'true', is_https: 'true', order: 'clickcount', reverse: 'true', limit: '500',
  });
  return `${SEARCH}?${q}`;
}

// A US ZIP code (five digits) to look up, or '' when it isn't one.
export function zipUrl(zip) {
  const z = String(zip ?? '').trim();
  return /^\d{5}$/.test(z) ? ZIP + z : '';
}

// Where a ZIP code is, from the lookup's answer: { lat, lon, label: 'Beverly Hills CA' }, or null.
export function zipPlace(answer) {
  const p = answer && Array.isArray(answer.places) ? answer.places[0] : null;
  const place = p && roundPlace(p.latitude, p.longitude);
  if (!place) return null;
  const label = [p['place name'], p['state abbreviation']].filter(Boolean).join(' ');
  return { ...place, label };
}

// An FM frequency named in a station's name or tags ("101.5 Kiss FM", "WFUV 90,7"): 88.1 to 107.9, or null.
export function freqIn(text) {
  const m = String(text ?? '').match(/(?:^|[^\d.])((?:8[89]|9\d|10[0-7])[.,]\d)(?!\d)/);
  if (!m) return null;
  const f = Number(m[1].replace(',', '.'));
  return f > 88 ? f : null;
}

// The town from Radio Browser's "state" ("Dover, NJ" is Dover; "New Jersey" stays as it is).
export function townOf(state) {
  return String(state ?? '').split(',')[0].trim();
}

function tidy(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  return n.length > NAME_CHARS ? `${n.slice(0, NAME_CHARS - 1).trim()}…` : n;
}

function playable(r) {
  return /^https:\/\//.test(r.url_resolved || '') && CODECS.includes(String(r.codec || '').toUpperCase());
}

// Radio Browser's answer as a dial: one station per frequency (the most listened to), low to high, each
// { freq, name, place, url, clicks }. Those within 100 km, or 200 when fewer than four are that close.
export function localStations(answer) {
  const found = (Array.isArray(answer) ? answer : [])
    .filter((r) => r && playable(r))
    .map((r) => ({
      freq: freqIn(r.name) ?? freqIn(r.tags),
      name: tidy(r.name),
      place: townOf(r.state),
      url: r.url_resolved,
      clicks: Number(r.clickcount) || 0,
      km: Number(r.geo_distance) / 1000,
    }))
    .filter((st) => st.freq !== null && st.name && st.km <= WIDE_KM);
  const near = found.filter((st) => st.km <= NEAR_KM);
  const pool = near.length >= 4 ? near : found;
  const best = new Map();
  pool.forEach((st) => {
    const had = best.get(st.freq);
    if (!had || st.clicks > had.clicks) best.set(st.freq, st);
  });
  return [...best.values()]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, MOST)
    .map(({ km, ...st }) => st)
    .sort((a, b) => a.freq - b.freq);
}

// FM2's presets until the user saves others: its four most listened-to stations, low to high. A dial with fewer
// than four stations repeats them, so there are always four keys.
export function localPresets(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const top = [...list].sort((a, b) => b.clicks - a.clicks).slice(0, 4).sort((a, b) => a.freq - b.freq);
  return [0, 1, 2, 3].map((i) => top[i % top.length].freq);
}

// Is this a station list from the phone that still makes sense? Every entry a station with a name and a stream, on
// the dial, low to high.
export function goodList(list) {
  return Array.isArray(list) && list.length > 0 && list.every((st, i) => (
    Boolean(st) && typeof st.url === 'string' && typeof st.name === 'string' && typeof st.freq === 'number'
    && st.freq >= DIAL_LOW && st.freq <= DIAL_HIGH && (i === 0 || st.freq > list[i - 1].freq)
  ));
}

// What the location box says when finding stations didn't work, by the error's name (data/find-local.js).
export const LOCAL_ERRORS = {
  NotFound: "That ZIP code wasn't found. Check it and try again.",
  NoStations: 'No stations near there name an FM frequency yet.',
  Denied: 'Location is off for SIDE A. Type a ZIP code instead.',
  Unavailable: "The phone couldn't tell where it is. Type a ZIP code instead.",
};
export const OFFLINE = "Couldn't reach the station list. Check the connection and try again.";

export function localError(error) {
  return LOCAL_ERRORS[error && error.name] || OFFLINE;
}
