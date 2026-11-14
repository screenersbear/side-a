// Does a new tape have sound? Every new tape is checked once it's saved: how big its file is as the phone stored it,
// and its loudest level. One that came out silent (or didn't save whole) says so, so it never fails quietly
// (Starky, 2026-11-14). The reading back and decoding is in audio/sound-check.js.

// Quieter than this all the way through is silence: about -80 dB, far below a mic's or a station's own hiss.
export const SILENT_PEAK = 0.0001;

// Files bigger than this aren't decoded to find their level: a phone could run short of memory (about 11 minutes
// of a 192 kbps recording). Their size is still checked.
export const CHECK_MAX_BYTES = 16 * 1024 * 1024;

export const SILENT_TEXT = 'This recording came out silent.';
export const NOT_SAVED_TEXT = "This recording didn't save properly.";

// The loudest sample in the sound (each channel a list of samples from -1 to 1), from 0 (silence) to 1.
export function peakOf(channels) {
  let peak = 0;
  for (const data of channels || []) {
    for (let i = 0; i < data.length; i += 1) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

export function canMeasure(bytes) {
  return Number(bytes) > 0 && Number(bytes) <= CHECK_MAX_BYTES;
}

// What the check found. bytes: the size recorded; stored: the size the phone gave back; peak: the loudest level,
// or null when it couldn't be read (too big, or the browser couldn't open its own file).
// 'not-saved': the phone kept nothing, or less than was recorded. 'silent', 'sound', or 'unknown'.
export function verdict({ bytes, stored, peak }) {
  if (!(Number(stored) > 0) || Number(stored) !== Number(bytes)) return 'not-saved';
  if (typeof peak !== 'number' || !Number.isFinite(peak)) return 'unknown';
  return peak < SILENT_PEAK ? 'silent' : 'sound';
}

// What the deck says about it: '' when there's nothing to say.
export function checkText(result) {
  if (result === 'not-saved') return NOT_SAVED_TEXT;
  if (result === 'silent') return SILENT_TEXT;
  return '';
}

// A level for the log, in decibels: "-12.0 dB", "silence" (zeros, or below -120 dB: what's left of silence after
// a recorder's encoding) or "?" (not read).
export function dbText(peak) {
  if (typeof peak !== 'number' || !Number.isFinite(peak) || peak < 0) return '?';
  if (peak < 0.000001) return 'silence';
  return `${(20 * Math.log10(peak)).toFixed(1)} dB`;
}
