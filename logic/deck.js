// The deck: what state it's in, and what each button and event does to it.
// Pure functions only (no sound, no screen), so every rule here is easy to test.
// The sound follows the state: see sound-plan.js.
import { STATIONS, stepStation, isStation } from './stations.js';
import { tapeTitle } from './tape-names.js';

// Rewind and fast forward jump this many seconds.
export const SKIP_SECONDS = 10;

// The deck when the app opens: radio, quiet (phones don't let sound start on its own).
export function startState(saved = {}) {
  const s = saved || {};
  return {
    mode: 'radio', // 'radio' or 'tape'
    playing: false, // sound on: radio, a tape, or recording
    recording: false,
    tuning: false, // radio pressed, waiting for the station to start
    source: s.source === 'line' ? 'line' : 'mic', // what Record tapes in tape mode: the mic or the radio
    station: isStation(s.station) ? s.station : 0,
    tape: null, // the tape in the deck: { id, kind, title, duration, created, blob }
    draft: null, // the tape being recorded or saved: { kind, title }
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
  const kind = source === 'mic' ? 'voice' : 'radio';
  const draft = { kind, title: tapeTitle(kind, STATIONS[s.station], now) };
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

function pickPreset(s, index) {
  if (!isStation(index)) return s;
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
    case 'preset': return pickPreset(s, action.index);
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
    default: return s;
  }
}
