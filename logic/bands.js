// The two bands (HANDOFF "Bands: FM1 WORLD and FM2 LOCAL", Starky 2026-11-14). FM1 WORLD: the US and world stations
// (logic/stations.js). FM2 LOCAL: the real dial near the user (logic/local-stations.js), once they've said where.
// The deck keeps the band showing in `band`, its stations in `local`, and the other band's place and presets in
// `other`, so each band remembers its last station and has its own four presets. Pure, so it can be tested.
import { STATIONS, stationAt, presetStation, cleanPresets } from './stations.js';
import { lockAt } from './dial.js';
import { localPresets } from './local-stations.js';

// The BAND key: big FM1 or FM2, small WORLD or LOCAL, and what a screen reader says (the mockup's words).
export const BANDS = {
  world: { big: 'FM1', small: 'WORLD', label: 'Band FM1, top stations from the US and around the world. Tap for FM2, local stations.' },
  local: { big: 'FM2', small: 'LOCAL', label: 'Band FM2, local stations. Tap for FM1, world stations.' },
};

// The stations on the band showing.
export function listOf(s) {
  return s.band === 'local' ? s.local : STATIONS;
}

// The station the deck is on (or was last on, between stations).
export function stationOf(s) {
  return listOf(s)[s.station];
}

// Tuning to a station on the band showing: the radio comes on with it.
export function tune(s, station) {
  return { ...s, mode: 'radio', station, between: null, playing: true, recording: false, tuning: true, notice: '', intro: false };
}

// Where a band was left: its station (by frequency, so a newer local list still finds it) and its presets.
function leftAt(s) {
  return { freq: stationOf(s).freq, presets: s.presets };
}

// The station a band comes back to: the one it was left on (or the nearest), else its first preset.
function backTo(place, list) {
  const at = lockAt(place.freq, list);
  return at >= 0 ? at : Math.max(0, presetStation(0, place.presets, list));
}

// The deck when the app opens on the band (and stations) it was left on. FM2 only if its stations are still known.
export function startBands(saved, local) {
  const locals = Array.isArray(local) ? local : [];
  const world = { freq: saved.freq, presets: cleanPresets(saved.presets) };
  const near = { freq: saved.localFreq, presets: cleanPresets(saved.localPresets, locals, localPresets(locals)) };
  const band = saved.band === 'local' && locals.length ? 'local' : 'world';
  const here = band === 'local' ? near : world;
  const list = band === 'local' ? locals : STATIONS;
  const last = stationAt(here.freq, list);
  return {
    band,
    local: locals,
    station: last >= 0 ? last : presetStation(0, here.presets, list),
    presets: here.presets,
    other: band === 'local' ? world : near,
    intro: false,
  };
}

// The BAND key: over to the other band, on the station it was left on, playing. Not while recording, and not to
// FM2 before its stations are found (the app asks where the user is then).
export function switchBand(s) {
  const band = s.band === 'local' ? 'world' : 'local';
  const list = band === 'local' ? s.local : STATIONS;
  if (s.recording || !list.length) return s;
  const moved = { ...s, band, presets: s.other.presets, other: leftAt(s), heard: null };
  return tune(moved, backTo(s.other, list));
}

// Local stations were found (where the user is, given the first time FM2 is asked for, or changed in Settings).
// FM2 opens on them, playing its first preset, and says what they are until the user tunes.
export function takeLocals(s, list) {
  if (s.recording || !Array.isArray(list) || !list.length) return s;
  const presets = localPresets(list);
  const other = s.band === 'local' ? s.other : leftAt(s);
  const moved = { ...s, band: 'local', local: list, presets, other, heard: null };
  return { ...tune(moved, presetStation(0, presets, list)), intro: true };
}

// What to keep on the phone so each band opens where it was left: { band, freq, presets, localFreq, localPresets }.
export function bandMemory(s) {
  const here = leftAt(s);
  const world = s.band === 'local' ? s.other : here;
  const near = s.band === 'local' ? here : s.other;
  return { band: s.band, freq: world.freq, presets: world.presets, localFreq: near.freq, localPresets: near.presets };
}
