// Small things the deck remembers between visits: the last station (its frequency) and the record source,
// and, each kept on its own so saving the station never touches them, the look picked in Settings and the presets.
const KEY = 'side-a.settings';
const LOOK_KEY = 'side-a.look';
const PRESETS_KEY = 'side-a.presets';

// The id of the look picked in Settings, or '' when none was picked (or storage is blocked).
export function loadLook(storage = globalThis.localStorage) {
  try {
    const saved = storage && storage.getItem(LOOK_KEY);
    return typeof saved === 'string' ? saved : '';
  } catch {
    return '';
  }
}

export function saveLook(id, storage = globalThis.localStorage) {
  try {
    storage.setItem(LOOK_KEY, String(id));
    return true;
  } catch {
    return false;
  }
}

// The four preset keys' frequencies, as saved by holding a key, or null when none were saved (or storage is
// blocked). logic/stations.js cleanPresets() checks them against the dial.
export function loadPresets(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(PRESETS_KEY));
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function savePresets(freqs, storage = globalThis.localStorage) {
  try {
    storage.setItem(PRESETS_KEY, JSON.stringify(freqs));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

export function saveSettings(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify({ freq: state.freq, source: state.source }));
    return true;
  } catch {
    return false;
  }
}
