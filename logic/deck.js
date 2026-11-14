// The deck: what state it's in, and what each button and event does to it.
// Pure functions only (no sound, no screen), so every rule here is easy to test.
// The sound follows the state: see sound-plan.js.
import { STATIONS, stepStation, stationAt, presetStation, canTape } from './stations.js';
import { tapeTitle } from './tape-names.js';
import { NOT_ALLOWED } from './recording.js';

// Rewind and fast forward jump this many seconds.
export const SKIP_SECONDS = 10;

// The deck when the app opens: radio, quiet (phones don't let sound start on its own),
// on the last station listened to (saved as its frequency), or preset 1.
export function startState(saved = {}) {
  const s = saved || {};
  const last = stationAt(s.freq);
  return {
    mode: 'radio', // 'radio' or 'tape'
    playing: false, // sound on: radio, a tape, or recording
    recording: false,
    tuning: false, // radio pressed, waiting for the station to start
    source: s.source === 'line' ? 'line' : 'mic', // what Record tapes in tape mode: the mic or the radio
    station: last >= 0 ? last : presetStation(0),
    tape: null, // the tape in the deck: { id, kind, title, duration, created, blob }
    draft: null, // the tape being recorded or saved: { kind, title, from: the mode Record was pressed in }
    pos: 0, // seconds: where the tape is, or how long the recording is
    notice: '', // a short message that replaces the status line
  };
}

// Is the radio sounding? Yes in radio mode, and while taping the radio.
export function radioOn(s) {
  return s.playing && (s.mode === 'radio' || (s.recording && s.source === 'line'));
}

// Is a saved tape playing?
export function tapeOn(s) {
  return s.playing && s.mode === 'tape' && !s.recording && hasSound(s.tape);
}

function hasSound(tape) {
  return Boolean(tape && tape.blob);
}

function tune(s, station) {
  return { ...s, mode: 'radio', station, playing: true, recording: false, tuning: true, notice: '' };
}

function record(s, now) {
  if (s.recording) return s;
  const source = s.mode === 'radio' ? 'line' : s.source;
  if (source === 'line' && !canTape(STATIONS[s.station])) return { ...s, notice: NOT_ALLOWED };
  const kind = source === 'mic' ? 'voice' : 'radio';
  const station = STATIONS[s.station];
  const draft = { kind, title: tapeTitle(kind, station, now), from: s.mode };
  // A radio tape remembers its station, for the song titles and the shelf ("101.9 · NIGHT SWIM").
  if (kind === 'radio') Object.assign(draft, { freq: station.freq, station: station.name });
  return { ...s, mode: 'tape', recording: true, playing: true, tuning: false, source, draft, pos: 0, notice: '' };
}

function play(s) {
  if (s.recording) return s;
  if (s.mode === 'radio') return s.playing ? s : { ...s, playing: true, tuning: true, notice: '' };
  if (!hasSound(s.tape)) return { ...s, playing: false, notice: 'Blank tape. Press record.' };
  const atEnd = s.pos >= s.tape.duration;
  return { ...s, playing: true, notice: '', pos: atEnd ? 0 : s.pos };
}

function stop(s) {
  if (!s.playing && !s.recording && !s.notice) return s;
  return { ...s, playing: false, recording: false, tuning: false, notice: '' };
}

// Rewind (-1) or fast forward (+1): changes station on the radio, winds the tape on tape.
function wind(s, direction) {
  if (s.recording) return s;
  if (s.mode === 'radio') return tune(s, stepStation(s.station, direction));
  if (!hasSound(s.tape)) return s;
  const pos = Math.min(s.tape.duration, Math.max(0, s.pos + direction * SKIP_SECONDS));
  return pos === s.pos ? s : { ...s, pos };
}

// A preset key (0 to 3) tunes to its station.
function pickPreset(s, key) {
  const index = presetStation(key);
  if (index < 0) return s;
  if (s.mode === 'radio' && s.playing && s.station === index) return s;
  return tune(s, index);
}

function toRadio(s) {
  if (s.mode === 'radio' && s.playing) return s;
  return { ...s, mode: 'radio', recording: false, playing: true, tuning: true, notice: '' };
}

function toTape(s) {
  if (s.mode === 'tape') return s;
  return { ...s, mode: 'tape', playing: false, recording: false, tuning: false, notice: '' };
}

function setSource(s, source) {
  if (s.recording || s.source === source) return s;
  return { ...s, source };
}

// A tape picked on the shelf goes in and plays.
function load(s, tape) {
  if (!tape) return s;
  return { ...s, mode: 'tape', tape, pos: 0, playing: true, recording: false, tuning: false, notice: '' };
}

// The blank tape on the shelf: an empty tape, ready to record a voice note.
function blank(s) {
  return { ...s, mode: 'tape', tape: null, pos: 0, playing: false, recording: false, tuning: false, source: 'mic', notice: '' };
}

// A recording has been saved. It goes in the deck, unless another tape is playing now.
function saved(s, tape) {
  if (!s.draft || !tape) return s;
  if (tapeOn(s)) return { ...s, draft: null };
  return { ...s, draft: null, tape, pos: 0 };
}

function ended(s) {
  if (s.mode !== 'tape' || s.recording || !s.tape) return s;
  return { ...s, playing: false, pos: s.tape.duration };
}

function tick(s, pos) {
  const p = Number(pos);
  if (!Number.isFinite(p) || p < 0 || p === s.pos) return s;
  return { ...s, pos: p };
}

// The station dropped out. Anything being taped from it is kept and saved.
function lost(s, message) {
  if (!radioOn(s)) return s;
  return { ...s, playing: false, recording: false, tuning: false, notice: message || 'No signal.' };
}

// The station wouldn't let its stream be taped. Back to how the deck was: the radio keeps playing if it was on.
function refused(s, message) {
  if (!s.draft) return s;
  const fromRadio = s.draft.from === 'radio';
  return {
    ...s, mode: fromRadio ? 'radio' : 'tape', playing: fromRadio && s.playing, recording: false, draft: null,
    notice: message || NOT_ALLOWED,
  };
}

// Recording couldn't start (no mic, mic not allowed): nothing to save.
function fail(s, message) {
  return { ...s, playing: false, recording: false, tuning: false, draft: null, notice: message || 'Something went wrong.' };
}

export function deckReducer(s, action = {}) {
  switch (action.type) {
    case 'rec': return record(s, action.now);
    case 'play': return play(s);
    case 'stop': return stop(s);
    case 'rew': return wind(s, -1);
    case 'ff': return wind(s, 1);
    case 'preset': return pickPreset(s, action.key);
    case 'toRadio': return toRadio(s);
    case 'toTape': return toTape(s);
    case 'toMic': return setSource(s, 'mic');
    case 'toLine': return setSource(s, 'line');
    case 'load': return load(s, action.tape);
    case 'blank': return blank(s);
    case 'restore': return s.tape || !action.tape ? s : { ...s, tape: action.tape };
    case 'saved': return saved(s, action.tape);
    case 'unsaved': return s.draft ? { ...s, draft: null, notice: action.message || '' } : s;
    case 'tick': return tick(s, action.pos);
    case 'ended': return ended(s);
    case 'live': return s.tuning ? { ...s, tuning: false } : s;
    case 'lost': return lost(s, action.message);
    case 'fail': return fail(s, action.message);
    case 'refused': return refused(s, action.message);
    default: return s;
  }
}
