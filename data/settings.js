// Small things the deck remembers between visits: the last station (its frequency) and the record source,
// and the look picked in Settings (kept on its own, so saving the station never touches it).
const KEY = 'side-a.settings';
const LOOK_KEY = 'side-a.look';

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
