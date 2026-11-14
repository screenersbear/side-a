// Small things the deck remembers between visits: the last station (its frequency) and the record source.
const KEY = 'side-a.settings';

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
