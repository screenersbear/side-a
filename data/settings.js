// Small things the deck remembers between visits: the band and each band's last station (its frequency), the record
// source, and, each kept on its own so saving the station never touches them, the look picked in Settings, each
// band's presets and whether keys click.
const KEY = 'side-a.settings';
const LOOK_KEY = 'side-a.look';
const PRESETS_KEY = 'side-a.presets';
const LOCAL_PRESETS_KEY = 'side-a.local-presets';
const CLICKS_KEY = 'side-a.clicks';

// Key clicks, on unless turned off in Settings (or storage is blocked, which can't remember the choice).
export function loadClicks(storage = globalThis.localStorage) {
  try {
    return storage.getItem(CLICKS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveClicks(on, storage = globalThis.localStorage) {
  try {
    storage.setItem(CLICKS_KEY, on ? 'on' : 'off');
    return true;
  } catch {
    return false;
  }
}

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
function loadList(key, storage) {
  try {
    const saved = JSON.parse(storage.getItem(key));
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveList(key, freqs, storage) {
  try {
    storage.setItem(key, JSON.stringify(freqs));
    return true;
  } catch {
    return false;
  }
}

export function loadPresets(storage = globalThis.localStorage) {
  return loadList(PRESETS_KEY, storage);
}

export function savePresets(freqs, storage = globalThis.localStorage) {
  return saveList(PRESETS_KEY, freqs, storage);
}

// FM2 LOCAL's four presets, kept apart from FM1's.
export function loadLocalPresets(storage = globalThis.localStorage) {
  return loadList(LOCAL_PRESETS_KEY, storage);
}

export function saveLocalPresets(freqs, storage = globalThis.localStorage) {
  return saveList(LOCAL_PRESETS_KEY, freqs, storage);
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
    const { band, freq, localFreq, source } = state;
    storage.setItem(KEY, JSON.stringify({ band, freq, localFreq, source }));
    return true;
  } catch {
    return false;
  }
}
