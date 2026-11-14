// FM2 LOCAL's stations, kept on the phone with the name of where they were found for ("Beverly Hills CA", or ''
// for the phone's location), so the band opens at once next time and Settings can say where. Only the label is kept,
// not the place itself. Found again when the user changes where, in Settings.
import { goodList } from '../logic/local-stations.js';

const KEY = 'side-a.local';

// { where: { label }, stations }, or null when none were found yet (or what was kept no longer makes sense).
export function loadLocal(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY));
    if (!saved || !goodList(saved.stations)) return null;
    const label = saved.where && typeof saved.where.label === 'string' ? saved.where.label : '';
    return { where: { label }, stations: saved.stations };
  } catch {
    return null;
  }
}

export function saveLocal({ where, stations }, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify({ where: { label: where.label }, stations }));
    return true;
  } catch {
    return false;
  }
}
