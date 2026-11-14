// Recording helpers: which sound format to record in, and plain words for what went wrong.

// Formats to try, best first. MP4 (AAC) plays everywhere, including iPhones; WebM is Chrome's own.
export const RECORD_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

// The first format this browser can record, or '' to let the browser choose.
export function pickRecordType(isSupported) {
  if (typeof isSupported !== 'function') return '';
  return RECORD_TYPES.find((type) => {
    try {
      return isSupported(type) === true;
    } catch {
      return false;
    }
  }) || '';
}

// Recordings shorter than this aren't kept.
export const MIN_SECONDS = 0.5;

export function worthKeeping(blob, seconds) {
  return Boolean(blob && blob.size > 0 && Number(seconds) >= MIN_SECONDS);
}

// A recording's length as saved on the tape: whole seconds, at least 1.
export function tapeSeconds(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 1;
  return Math.max(1, Math.round(s));
}

// Shown when Record is pressed on a station that doesn't allow recording.
export const NOT_ALLOWED = "Recording isn't allowed on this station.";

// Plain words for why recording couldn't start.
export function recordError(error, source) {
  const name = (error && error.name) || '';
  if (source === 'line') {
    if (name === 'AbortError') return '';
    // The station plays but its stream can't be fetched: it doesn't allow recording in a browser.
    if (name === 'TypeError') return NOT_ALLOWED;
    return "Couldn't reach the station.";
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Mic is off. Allow it for SIDE A in Settings.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No mic found.';
  if (name === 'NotReadableError') return 'The mic is busy in another app.';
  return "This browser can't record.";
}

// Plain words for why the radio stopped.
export function radioError(name) {
  if (name === 'NotAllowedError') return 'Press play to start the radio.';
  return 'No signal. Check the internet.';
}
