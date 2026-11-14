import { describe, it, expect } from 'vitest';
import { startState, deckReducer, radioOn, tapeOn, SKIP_SECONDS } from '../../logic/deck.js';

const NOW = new Date(2026, 10, 14, 21, 41).getTime();
const blob = { size: 10 };
const TAPE = { id: 7, kind: 'voice', title: 'Nov 14, 9:41 PM', duration: 30, blob };
const run = (s, ...actions) => actions.reduce((st, a) => deckReducer(st, typeof a === 'string' ? { type: a } : a), s);
const fresh = () => startState();
const radioPlaying = () => run(fresh(), 'play', 'live');
const tapeIn = (extra = {}) => ({ ...fresh(), mode: 'tape', tape: TAPE, ...extra });

describe('startState', () => {
  it('opens on the radio, quiet, first preset, mic', () => {
    expect(fresh()).toEqual({
      mode: 'radio', playing: false, recording: false, tuning: false, source: 'mic',
      station: 0, tape: null, draft: null, pos: 0, notice: '',
    });
  });
  it('remembers the last station and record source', () => {
    const s = startState({ station: 2, source: 'line' });
    expect(s.station).toBe(2);
    expect(s.source).toBe('line');
  });
  it('ignores saved values that make no sense', () => {
    const s = startState({ station: 9, source: 'tv' });
    expect(s.station).toBe(0);
    expect(s.source).toBe('mic');
    expect(startState(null).station).toBe(0);
    expect(startState({ station: -1 }).station).toBe(0);
  });
});

describe('radioOn and tapeOn', () => {
  it('radio sounds in radio mode while playing', () => {
    expect(radioOn(radioPlaying())).toBe(true);
    expect(radioOn(fresh())).toBe(false);
  });
  it('radio sounds while taping it, not while taping the mic', () => {
    expect(radioOn({ ...fresh(), mode: 'tape', playing: true, recording: true, source: 'line' })).toBe(true);
    expect(radioOn({ ...fresh(), mode: 'tape', playing: true, recording: true, source: 'mic' })).toBe(false);
    expect(radioOn({ ...fresh(), mode: 'tape', playing: true, recording: false, source: 'line' })).toBe(false);
  });
  it('a tape sounds only in tape mode, playing, not recording, with a recording in it', () => {
    expect(tapeOn(tapeIn({ playing: true }))).toBe(true);
    expect(tapeOn(tapeIn({ playing: false }))).toBe(false);
    expect(tapeOn(tapeIn({ playing: true, recording: true }))).toBe(false);
    expect(tapeOn(tapeIn({ playing: true, mode: 'radio' }))).toBe(false);
    expect(tapeOn(tapeIn({ playing: true, tape: { ...TAPE, blob: null } }))).toBe(false);
    expect(tapeOn(tapeIn({ playing: true, tape: null }))).toBe(false);
  });
});

describe('Record', () => {
  it('on the radio, tapes the radio', () => {
    const s = run({ ...radioPlaying(), station: 2 }, { type: 'rec', now: NOW });
    expect(s).toMatchObject({ mode: 'tape', recording: true, playing: true, source: 'line', pos: 0, tuning: false, notice: '' });
    expect(s.draft).toEqual({ kind: 'radio', title: '90.3 KEXP, Nov 14' });
  });
  it('in tape mode, records from the chosen source', () => {
    const mic = run(tapeIn({ pos: 12 }), { type: 'rec', now: NOW });
    expect(mic).toMatchObject({ recording: true, playing: true, source: 'mic', pos: 0 });
    expect(mic.draft).toEqual({ kind: 'voice', title: 'Nov 14, 9:41 PM' });
    const line = run(tapeIn({ source: 'line' }), { type: 'rec', now: NOW });
    expect(line.draft.kind).toBe('radio');
    expect(line.source).toBe('line');
  });
  it('keeps the tape that was in, clears an old notice', () => {
    const s = run(tapeIn({ notice: 'Blank tape. Press record.' }), { type: 'rec', now: NOW });
    expect(s.tape).toBe(TAPE);
    expect(s.notice).toBe('');
  });
  it('does nothing while already recording', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW });
    expect(deckReducer(s, { type: 'rec', now: NOW + 5000 })).toBe(s);
  });
});

describe('Play', () => {
  it('turns the radio on and waits for it to tune in', () => {
    const s = run(fresh(), 'play');
    expect(s).toMatchObject({ playing: true, tuning: true, mode: 'radio' });
  });
  it('clears a notice when the radio comes on', () => {
    expect(run({ ...fresh(), notice: 'No signal.' }, 'play').notice).toBe('');
  });
  it('does nothing when the radio already plays', () => {
    const s = radioPlaying();
    expect(deckReducer(s, { type: 'play' })).toBe(s);
  });
  it('plays a tape from where it is', () => {
    const s = run(tapeIn({ pos: 12 }), 'play');
    expect(s).toMatchObject({ playing: true, pos: 12, notice: '' });
  });
  it('starts a tape again from the top once it has played to the end', () => {
    expect(run(tapeIn({ pos: 30 }), 'play').pos).toBe(0);
    expect(run(tapeIn({ pos: 31 }), 'play').pos).toBe(0);
    expect(run(tapeIn({ pos: 29.9 }), 'play').pos).toBe(29.9);
  });
  it('on a blank tape, says to press record', () => {
    const s = run({ ...fresh(), mode: 'tape' }, 'play');
    expect(s).toMatchObject({ playing: false, notice: 'Blank tape. Press record.' });
  });
  it('does nothing while recording', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW });
    expect(deckReducer(s, { type: 'play' })).toBe(s);
  });
});

describe('Stop', () => {
  it('stops the radio', () => {
    expect(run(radioPlaying(), 'stop')).toMatchObject({ playing: false, recording: false, tuning: false });
  });
  it('stops a recording and keeps its draft for saving', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW }, 'stop');
    expect(s).toMatchObject({ playing: false, recording: false });
    expect(s.draft.kind).toBe('voice');
  });
  it('clears a notice even when nothing plays', () => {
    expect(run({ ...fresh(), notice: 'No signal.' }, 'stop').notice).toBe('');
  });
  it('stops a radio that is still tuning in', () => {
    expect(run(fresh(), 'play', 'stop').tuning).toBe(false);
  });
  it('does nothing when already stopped', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'stop' })).toBe(s);
  });
});

describe('Rewind and fast forward', () => {
  it('change station on the radio and play it', () => {
    expect(run(fresh(), 'ff')).toMatchObject({ station: 1, playing: true, tuning: true, mode: 'radio' });
    expect(run(fresh(), 'rew').station).toBe(3);
    expect(run({ ...fresh(), station: 3 }, 'ff').station).toBe(0);
  });
  it('wind a tape by ten seconds', () => {
    expect(SKIP_SECONDS).toBe(10);
    expect(run(tapeIn({ pos: 12 }), 'ff').pos).toBe(22);
    expect(run(tapeIn({ pos: 12 }), 'rew').pos).toBe(2);
  });
  it('stop at either end of the tape', () => {
    expect(run(tapeIn({ pos: 25 }), 'ff').pos).toBe(30);
    expect(run(tapeIn({ pos: 4 }), 'rew').pos).toBe(0);
    const atEnd = tapeIn({ pos: 30 });
    expect(deckReducer(atEnd, { type: 'ff' })).toBe(atEnd);
    const atStart = tapeIn({ pos: 0 });
    expect(deckReducer(atStart, { type: 'rew' })).toBe(atStart);
  });
  it('keep a tape playing or stopped as it was', () => {
    expect(run(tapeIn({ playing: true }), 'ff').playing).toBe(true);
    expect(run(tapeIn({ playing: false }), 'ff').playing).toBe(false);
  });
  it('do nothing on a blank tape or while recording', () => {
    const blankTape = { ...fresh(), mode: 'tape' };
    expect(deckReducer(blankTape, { type: 'ff' })).toBe(blankTape);
    const rec = run(tapeIn(), { type: 'rec', now: NOW });
    expect(deckReducer(rec, { type: 'rew' })).toBe(rec);
    expect(deckReducer(rec, { type: 'ff' })).toBe(rec);
  });
});

describe('Presets', () => {
  it('tune to the preset and play it', () => {
    expect(run(fresh(), { type: 'preset', index: 2 })).toMatchObject({ station: 2, mode: 'radio', playing: true, tuning: true, notice: '' });
  });
  it('switch from tape to radio, ending a recording', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW }, { type: 'preset', index: 1 });
    expect(s).toMatchObject({ mode: 'radio', recording: false, playing: true, station: 1 });
  });
  it('do nothing for the station already playing', () => {
    const s = { ...radioPlaying(), station: 1 };
    expect(deckReducer(s, { type: 'preset', index: 1 })).toBe(s);
  });
  it('start the same station again when the radio is off or on tape', () => {
    expect(run({ ...fresh(), station: 1 }, { type: 'preset', index: 1 }).playing).toBe(true);
    expect(run(tapeIn({ station: 1 }), { type: 'preset', index: 1 }).mode).toBe('radio');
  });
  it('ignore presets the deck does not have', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'preset', index: 4 })).toBe(s);
    expect(deckReducer(s, { type: 'preset' })).toBe(s);
  });
});

describe('Radio / Tape switch', () => {
  it('Radio turns the radio on', () => {
    expect(run(tapeIn({ playing: true }), 'toRadio')).toMatchObject({ mode: 'radio', playing: true, tuning: true, recording: false });
    expect(run(fresh(), 'toRadio')).toMatchObject({ mode: 'radio', playing: true });
  });
  it('Radio ends a recording', () => {
    expect(run(tapeIn(), { type: 'rec', now: NOW }, 'toRadio').recording).toBe(false);
  });
  it('Radio does nothing while the radio plays', () => {
    const s = radioPlaying();
    expect(deckReducer(s, { type: 'toRadio' })).toBe(s);
  });
  it('Tape stops the radio and waits, tape position kept', () => {
    const s = run({ ...radioPlaying(), tape: TAPE, pos: 8, notice: 'x' }, 'toTape');
    expect(s).toMatchObject({ mode: 'tape', playing: false, tuning: false, pos: 8, notice: '' });
  });
  it('Tape does nothing in tape mode', () => {
    const s = tapeIn({ playing: true });
    expect(deckReducer(s, { type: 'toTape' })).toBe(s);
  });
});

describe('Mic / Radio in switch', () => {
  it('picks what Record tapes', () => {
    expect(run(tapeIn(), 'toLine').source).toBe('line');
    expect(run(tapeIn({ source: 'line' }), 'toMic').source).toBe('mic');
  });
  it('does nothing when already picked', () => {
    const s = tapeIn();
    expect(deckReducer(s, { type: 'toMic' })).toBe(s);
  });
  it('can not change while recording', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW });
    expect(deckReducer(s, { type: 'toLine' })).toBe(s);
  });
});

describe('Shelf actions', () => {
  it('load puts a tape in and plays it from the top', () => {
    const s = run({ ...radioPlaying(), pos: 40, notice: 'x' }, { type: 'load', tape: TAPE });
    expect(s).toMatchObject({ mode: 'tape', tape: TAPE, pos: 0, playing: true, recording: false, tuning: false, notice: '' });
  });
  it('load with no tape does nothing', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'load' })).toBe(s);
  });
  it('blank empties the deck, ready to record a voice note', () => {
    const s = run(tapeIn({ playing: true, pos: 5, source: 'line', notice: 'x' }), 'blank');
    expect(s).toMatchObject({ mode: 'tape', tape: null, pos: 0, playing: false, recording: false, tuning: false, source: 'mic', notice: '' });
  });
  it('blank ends a recording', () => {
    expect(run(tapeIn(), { type: 'rec', now: NOW }, 'blank').recording).toBe(false);
  });
});

describe('Restore', () => {
  it('puts the newest tape in an empty deck without playing it', () => {
    const s = run(fresh(), { type: 'restore', tape: TAPE });
    expect(s.tape).toBe(TAPE);
    expect(s.playing).toBe(false);
    expect(s.mode).toBe('radio');
  });
  it('leaves a deck that already has a tape alone', () => {
    const s = tapeIn();
    expect(deckReducer(s, { type: 'restore', tape: { ...TAPE, id: 9 } })).toBe(s);
  });
  it('does nothing without a tape', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'restore', tape: null })).toBe(s);
  });
});

describe('Saved and unsaved', () => {
  const recorded = () => run(tapeIn({ tape: null }), { type: 'rec', now: NOW }, 'stop');
  it('a saved recording goes in the deck at the start', () => {
    const s = run({ ...recorded(), pos: 14 }, { type: 'saved', tape: TAPE });
    expect(s).toMatchObject({ tape: TAPE, draft: null, pos: 0 });
  });
  it('a saved recording also goes in after switching to the radio', () => {
    const s = run(tapeIn({ tape: null }), { type: 'rec', now: NOW }, 'toRadio', { type: 'saved', tape: TAPE });
    expect(s).toMatchObject({ tape: TAPE, draft: null, mode: 'radio', playing: true });
  });
  it('a tape picked meanwhile keeps playing', () => {
    const other = { ...TAPE, id: 3 };
    const s = run(recorded(), { type: 'load', tape: other }, { type: 'saved', tape: TAPE });
    expect(s.tape).toBe(other);
    expect(s.draft).toBe(null);
  });
  it('saved does nothing without a draft or a tape', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'saved', tape: TAPE })).toBe(s);
    const r = recorded();
    expect(deckReducer(r, { type: 'saved' })).toBe(r);
  });
  it('unsaved drops the draft and says why', () => {
    const s = run(recorded(), { type: 'unsaved', message: 'Nothing was taped.' });
    expect(s).toMatchObject({ draft: null, notice: 'Nothing was taped.' });
    expect(run(recorded(), { type: 'unsaved' }).notice).toBe('');
  });
  it('unsaved does nothing without a draft', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'unsaved', message: 'x' })).toBe(s);
  });
});

describe('Tick and ended', () => {
  it('tick moves the counter', () => {
    expect(run(tapeIn({ playing: true }), { type: 'tick', pos: 4.2 }).pos).toBe(4.2);
    expect(run(tapeIn({ pos: 3 }), { type: 'tick', pos: 0 }).pos).toBe(0);
  });
  it('tick ignores nonsense and no change', () => {
    const s = tapeIn({ pos: 3 });
    expect(deckReducer(s, { type: 'tick', pos: NaN })).toBe(s);
    expect(deckReducer(s, { type: 'tick', pos: -1 })).toBe(s);
    expect(deckReducer(s, { type: 'tick', pos: 3 })).toBe(s);
    expect(deckReducer(s, { type: 'tick' })).toBe(s);
  });
  it('ended stops the tape at its end', () => {
    expect(run(tapeIn({ playing: true, pos: 29 }), 'ended')).toMatchObject({ playing: false, pos: 30 });
  });
  it('ended is ignored on the radio, while recording, or with no tape', () => {
    const radio = radioPlaying();
    expect(deckReducer(radio, { type: 'ended' })).toBe(radio);
    const rec = run(tapeIn(), { type: 'rec', now: NOW });
    expect(deckReducer(rec, { type: 'ended' })).toBe(rec);
    const empty = { ...fresh(), mode: 'tape' };
    expect(deckReducer(empty, { type: 'ended' })).toBe(empty);
  });
});

describe('Signal', () => {
  it('live ends tuning', () => {
    expect(run(fresh(), 'play', 'live').tuning).toBe(false);
  });
  it('live does nothing when not tuning', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'live' })).toBe(s);
  });
  it('lost stops the radio and says so', () => {
    const s = run(radioPlaying(), { type: 'lost', message: 'No signal. Check the internet.' });
    expect(s).toMatchObject({ playing: false, tuning: false, notice: 'No signal. Check the internet.' });
    expect(run(radioPlaying(), 'lost').notice).toBe('No signal.');
  });
  it('lost while taping the radio stops the recording but keeps it for saving', () => {
    const s = run(radioPlaying(), { type: 'rec', now: NOW }, { type: 'lost', message: 'gone' });
    expect(s).toMatchObject({ recording: false, playing: false });
    expect(s.draft.kind).toBe('radio');
  });
  it('lost is ignored when the radio is off', () => {
    const s = tapeIn({ playing: true });
    expect(deckReducer(s, { type: 'lost', message: 'x' })).toBe(s);
  });
});

describe('Fail', () => {
  it('stops everything, drops the draft, and says why', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW }, { type: 'fail', message: 'No mic found.' });
    expect(s).toMatchObject({ playing: false, recording: false, tuning: false, draft: null, notice: 'No mic found.' });
  });
  it('has a fallback message', () => {
    expect(run(fresh(), 'fail').notice).toBe('Something went wrong.');
  });
});

describe('deckReducer', () => {
  it('ignores actions it does not know', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'eject' })).toBe(s);
    expect(deckReducer(s)).toBe(s);
  });
});
