// Sharing a tape as a file: the two formats, what the file is called, and the words shown while it's made.
// MP3 is made on the phone (audio/export.js); WAV is the full sound, and a mixtape already is one.

export const MP3_KBPS = 192;

export const FORMATS = [
  { id: 'mp3', name: 'MP3', ext: 'mp3', type: 'audio/mpeg', note: 'Smaller, about 1.4 MB a minute' },
  { id: 'wav', name: 'WAV', ext: 'wav', type: 'audio/wav', note: 'Full quality, about 10 MB a minute' },
];

// The format with this id; MP3 (the default) for anything else.
export function formatFor(id) {
  return FORMATS.find((f) => f.id === id) || FORMATS[0];
}

const typeOf = (tape) => (tape && (tape.mime || (tape.blob && tape.blob.type))) || '';

// Is the tape already a WAV file (a mixtape)? Then WAV shares it as it is.
export function isWav(tape) {
  return /wav/i.test(typeOf(tape));
}

// Is the tape already an MP3 file (a radio tape of an MP3 station: the broadcast itself)? Then MP3 shares it as it is.
export function isMp3(tape) {
  return /mpeg|mp3/i.test(typeOf(tape));
}

// The file's name: the tape's title, without the characters phones and computers don't allow in names.
// "Late Night Drive" -> "Late Night Drive.mp3". A tape with no usable title is "SIDE A tape".
export function fileName(title, ext) {
  const clean = String(title || '')
    .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return `${clean || 'SIDE A tape'}.${ext}`;
}

// A file's size in words: "840 KB", "3.1 MB", "12 MB".
export function sizeText(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1000 * 1000) return `${Math.max(1, Math.round(b / 1000))} KB`;
  const mb = b / (1000 * 1000);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

// What the menu says while the file is made. fraction: 0 to 1 once the MP3 is being made, or null while the tape is
// still being read.
export function progressText(format, fraction) {
  if (fraction === null || fraction === undefined) return 'Reading the tape';
  const pct = Math.min(100, Math.max(0, Math.round(fraction * 100)));
  return `Making the ${formatFor(format).name}, ${pct}%`;
}
