import { describe, it, expect } from 'vitest';
import { startState, deckReducer, radioOn, tapeOn, SKIP_SECONDS, SHORT_NOTICE_MS, savedText, LEFT_APP } from '../../logic/deck.js';
import { STATIONS, PRESET_FREQS, stationAt } from '../../logic/stations.js';
import { NOT_ALLOWED } from '../../logic/recording.js';

const WBGO = stationAt(88.3);
const CURRENT = stationAt(89.3);
const KEXP = stationAt(90.3);
const WFMU = stationAt(91.1);
const LAST = STATIONS.length - 1;

const NOW = new Date(2026, 10, 14, 21, 41).getTime();
const blob = { size: 10 };
const TAPE = { id: 7, kind: 'voice', title: 'Nov 14, 9:41 PM', duration: 30, blob };
const run = (s, ...actions) => actions.reduce((st, a) => deckReducer(st, typeof a === 'string' ? { type: a } : a), s);
const fresh = () => startState();
const radioPlaying = () => run(fresh(), 'play', 'live');
const tapeIn = (extra = {}) => ({ ...fresh(), mode: 'tape', tape: TAPE, ...extra });

describe('startState', () => {
  it('opens on the radio, quiet, preset 1, mic', () => {
    expect(fresh()).toEqual({
      mode: 'radio', playing: false, recording: false, tuning: false, source: 'mic',
      station: WBGO, presets: PRESET_FREQS, tape: null, draft: null, pos: 0, notice: '', heard: null,
    });
  });
  it('uses the presets saved on the phone, and starts on preset 1 when no station was saved', () => {
    const s = startState({ presets: [91.1, 89.3, 90.3, 98.9] });
    expect(s.presets).toEqual([91.1, 89.3, 90.3, 98.9]);
    expect(s.station).toBe(WFMU);
    expect(startState({ presets: 'junk' }).presets).toEqual(PRESET_FREQS);
  });
  it('remembers the last station (by frequency) and record source', () => {
    const s = startState({ freq: 90.3, source: 'line' });
    expect(s.station).toBe(KEXP);
    expect(s.source).toBe('line');
  });
  it('ignores saved values that make no sense', () => {
    const s = startState({ freq: 90.2, source: 'tv' });
    expect(s.station).toBe(WBGO);
    expect(s.source).toBe('mic');
    expect(startState(null).station).toBe(WBGO);
    expect(startState({ station: 2 }).station).toBe(WBGO);
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
    const s = run({ ...radioPlaying(), station: KEXP }, { type: 'rec', now: NOW });
    expect(s).toMatchObject({ mode: 'tape', recording: true, playing: true, source: 'line', pos: 0, tuning: false, notice: '' });
    expect(s.draft).toEqual({ kind: 'radio', title: '90.3 KEXP, Nov 14', from: 'radio', freq: 90.3, station: 'KEXP' });
  });
  it('in tape mode, records from the chosen source', () => {
    const mic = run(tapeIn({ pos: 12 }), { type: 'rec', now: NOW });
    expect(mic).toMatchObject({ recording: true, playing: true, source: 'mic', pos: 0 });
    expect(mic.draft).toEqual({ kind: 'voice', title: 'Nov 14, 9:41 PM', from: 'tape' });
    const line = run(tapeIn({ source: 'line' }), { type: 'rec', now: NOW });
    expect(line.draft.kind).toBe('radio');
    expect(line.source).toBe('line');
  });
  it('keeps the tape that was in, clears an old notice', () => {
    const s = run(tapeIn({ notice: 'Blank tape. Press record.' }), { type: 'rec', now: NOW });
    expect(s.tape).toBe(TAPE);
    expect(s.notice).toBe('');
  });
  it('pressed again while recording, stops it, the same as Stop', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW });
    const again = deckReducer(s, { type: 'rec', now: NOW + 5000 });
    expect(again).toEqual(deckReducer(s, { type: 'stop' }));
    expect(again).toMatchObject({ recording: false, playing: false });
    expect(again.draft).toBe(s.draft);
  });
  it('on a station that does not allow it, just says so and keeps playing', () => {
    const before = { ...radioPlaying(), station: WFMU };
    const s = run(before, { type: 'rec', now: NOW });
    expect(s).toEqual({ ...before, notice: NOT_ALLOWED });
  });
  it('from Radio in, on a station that does not allow it, says so', () => {
    const s = run(tapeIn({ source: 'line', station: WFMU }), { type: 'rec', now: NOW });
    expect(s).toMatchObject({ recording: false, playing: false, mode: 'tape', notice: NOT_ALLOWED, draft: null });
  });
  it('the mic still records while tuned to that station', () => {
    const s = run(tapeIn({ station: WFMU }), { type: 'rec', now: NOW });
    expect(s).toMatchObject({ recording: true, notice: '' });
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
  it('taping the radio: saves the tape and the radio plays on, like a boombox; Stop again turns it off', () => {
    const s = run({ ...radioPlaying(), station: KEXP, notice: '' }, { type: 'rec', now: NOW }, 'stop');
    expect(s).toMatchObject({ mode: 'radio', station: KEXP, playing: true, recording: false, tuning: false, notice: '' });
    expect(s.draft.kind).toBe('radio');
    expect(run(s, 'stop')).toMatchObject({ mode: 'radio', playing: false });
  });
  it('taping the radio from tape (Radio in) also leaves the radio playing', () => {
    const s = run(tapeIn({ source: 'line', station: KEXP }), { type: 'rec', now: NOW }, 'stop');
    expect(s).toMatchObject({ mode: 'radio', station: KEXP, playing: true, recording: false });
  });
  it('Record pressed again does the same as Stop when taping the radio', () => {
    const s = run({ ...radioPlaying(), station: KEXP }, { type: 'rec', now: NOW });
    expect(deckReducer(s, { type: 'rec', now: NOW + 5000 })).toEqual(deckReducer(s, { type: 'stop' }));
  });
  it('Radio in chosen but not recording: Stop just stops', () => {
    expect(run(tapeIn({ source: 'line', playing: true }), 'stop')).toMatchObject({ mode: 'tape', playing: false });
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
  it('seek to the next station up or down the dial and play it', () => {
    expect(run(fresh(), 'ff')).toMatchObject({ station: WBGO + 1, playing: true, tuning: true, mode: 'radio' });
    expect(run(fresh(), 'rew').station).toBe(WBGO - 1);
    expect(run({ ...fresh(), station: LAST }, 'ff').station).toBe(0);
    expect(run({ ...fresh(), station: 0 }, 'rew').station).toBe(LAST);
  });
  it('reach every station on the dial, one press at a time', () => {
    let s = fresh();
    const heard = new Set([s.station]);
    for (let n = 1; n < STATIONS.length; n++) {
      const before = STATIONS[s.station].freq;
      s = run(s, 'ff');
      // Each press moves up the dial, except the one jump from the top back to the bottom.
      if (s.station !== 0) expect(STATIONS[s.station].freq).toBeGreaterThan(before);
      heard.add(s.station);
    }
    expect(heard.size).toBe(STATIONS.length);
    expect(run(s, 'ff').station).toBe(WBGO);
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
  it('tune to the preset station and play it', () => {
    expect(run(fresh(), { type: 'preset', key: 2 })).toMatchObject({ station: KEXP, mode: 'radio', playing: true, tuning: true, notice: '' });
  });
  it('switch from tape to radio, ending a recording', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW }, { type: 'preset', key: 1 });
    expect(s).toMatchObject({ mode: 'radio', recording: false, playing: true, station: CURRENT });
  });
  it('do nothing for the station already playing', () => {
    const s = { ...radioPlaying(), station: CURRENT };
    expect(deckReducer(s, { type: 'preset', key: 1 })).toBe(s);
  });
  it('start the same station again when the radio is off or on tape', () => {
    expect(run({ ...fresh(), station: CURRENT }, { type: 'preset', key: 1 }).playing).toBe(true);
    expect(run(tapeIn({ station: CURRENT }), { type: 'preset', key: 1 }).mode).toBe('radio');
  });
  it('ignore presets the deck does not have', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'preset', key: 4 })).toBe(s);
    expect(deckReducer(s, { type: 'preset' })).toBe(s);
  });
  it('tune to the stations saved on them', () => {
    const s = { ...fresh(), presets: [88.3, 91.1, 90.3, 98.9] };
    expect(run(s, { type: 'preset', key: 1 }).station).toBe(WFMU);
  });
});

describe('Holding a preset key', () => {
  const hold = (key) => ({ type: 'savePreset', key });
  it('saves the station on the dial there, and says so', () => {
    const s = run({ ...radioPlaying(), station: WFMU }, hold(1));
    expect(s.presets).toEqual([88.3, 91.1, 90.3, 98.9]);
    expect(s.notice).toBe('Saved to preset 2');
    expect(s).toMatchObject({ station: WFMU, mode: 'radio', playing: true });
  });
  it('works with the radio off too, and leaves it off', () => {
    const s = run({ ...fresh(), station: WFMU }, hold(3));
    expect(s.presets).toEqual([88.3, 89.3, 90.3, 91.1]);
    expect(s.playing).toBe(false);
  });
  it('then a tap on that key tunes to the saved station', () => {
    const s = run({ ...fresh(), station: WFMU }, hold(0), { type: 'preset', key: 1 }, { type: 'preset', key: 0 });
    expect(s.station).toBe(WFMU);
  });
  it('on tape is just a press: it tunes to the preset and saves nothing', () => {
    const s = run(tapeIn({ station: WFMU }), hold(2));
    expect(s).toMatchObject({ mode: 'radio', station: KEXP, playing: true, notice: '' });
    expect(s.presets).toEqual(PRESET_FREQS);
  });
  it('ignores keys the deck does not have', () => {
    const s = radioPlaying();
    expect(deckReducer(s, hold(4))).toBe(s);
    expect(deckReducer(s, hold(-1))).toBe(s);
    expect(deckReducer(s, { type: 'savePreset' })).toBe(s);
  });
  it('the message goes after a short while, unless something else replaced it', () => {
    expect(SHORT_NOTICE_MS).toBe(2000);
    expect(savedText(0)).toBe('Saved to preset 1');
    const s = run({ ...radioPlaying(), station: WFMU }, hold(1));
    expect(deckReducer(s, { type: 'calm', text: 'Saved to preset 2' }).notice).toBe('');
    const other = { ...s, notice: 'No signal.' };
    expect(deckReducer(other, { type: 'calm', text: 'Saved to preset 2' })).toBe(other);
    const quiet = radioPlaying();
    expect(deckReducer(quiet, { type: 'calm', text: '' })).toBe(quiet);
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

describe('Refused (the station would not let its stream be taped)', () => {
  it('after Record on the radio: back to the radio, still playing, with the message', () => {
    const s = run(radioPlaying(), { type: 'rec', now: NOW }, { type: 'refused', message: NOT_ALLOWED });
    expect(s).toMatchObject({ mode: 'radio', playing: true, recording: false, draft: null, notice: NOT_ALLOWED });
  });
  it('after Record from Radio in on tape: back to tape, stopped', () => {
    const s = run(tapeIn({ source: 'line' }), { type: 'rec', now: NOW }, { type: 'refused', message: "Couldn't reach the station." });
    expect(s).toMatchObject({ mode: 'tape', playing: false, recording: false, draft: null, notice: "Couldn't reach the station." });
  });
  it('after Stop the radio plays on (Stop only ended the taping)', () => {
    const s = run(radioPlaying(), { type: 'rec', now: NOW }, 'stop', { type: 'refused', message: 'x' });
    expect(s).toMatchObject({ mode: 'radio', playing: true, draft: null });
  });
  it('stays off if the radio was turned off', () => {
    const s = run(radioPlaying(), { type: 'rec', now: NOW }, 'stop', 'stop', { type: 'refused', message: 'x' });
    expect(s).toMatchObject({ mode: 'radio', playing: false });
  });
  it('uses the not-allowed message when none is given', () => {
    expect(run(radioPlaying(), { type: 'rec', now: NOW }, 'refused').notice).toBe(NOT_ALLOWED);
  });
  it('does nothing when nothing is being recorded', () => {
    const s = radioPlaying();
    expect(deckReducer(s, { type: 'refused', message: 'x' })).toBe(s);
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

describe('Heard (the song a station names)', () => {
  const heard = (station, text) => ({ type: 'heard', station, text });
  const NIGHT_SWIM = { artist: 'The Paper Lanterns', title: 'Night Swim' };
  it('keeps the song with its station', () => {
    const s = run(radioPlaying(), heard(KEXP, 'The Paper Lanterns - Night Swim'));
    expect(s.heard).toEqual({ station: KEXP, song: NIGHT_SWIM });
  });
  it('a break message or nothing is no song', () => {
    expect(run(radioPlaying(), heard(KEXP, "We'll be right back")).heard).toEqual({ station: KEXP, song: null });
    expect(run(radioPlaying(), heard(KEXP, '')).heard).toEqual({ station: KEXP, song: null });
  });
  it('the same song again changes nothing', () => {
    const s = run(radioPlaying(), heard(KEXP, 'The Paper Lanterns - Night Swim'));
    expect(deckReducer(s, heard(KEXP, ' The Paper Lanterns -  Night Swim '))).toBe(s);
    const quiet = run(radioPlaying(), heard(KEXP, ''));
    expect(deckReducer(quiet, heard(KEXP, 'Be right back'))).toBe(quiet);
  });
  it('a new song, a new artist, a break or another station replaces it', () => {
    const s = run(radioPlaying(), heard(KEXP, 'The Paper Lanterns - Night Swim'));
    expect(deckReducer(s, heard(KEXP, 'The Paper Lanterns - Low Tide')).heard.song.title).toBe('Low Tide');
    expect(deckReducer(s, heard(KEXP, 'June Avenue - Night Swim')).heard.song.artist).toBe('June Avenue');
    expect(deckReducer(s, heard(KEXP, '')).heard).toEqual({ station: KEXP, song: null });
    expect(run(s, heard(KEXP, ''), heard(KEXP, 'The Paper Lanterns - Night Swim')).heard.song).toEqual(NIGHT_SWIM);
    expect(deckReducer(s, heard(WFMU, 'The Paper Lanterns - Night Swim')).heard).toEqual({ station: WFMU, song: NIGHT_SWIM });
  });
});

describe('Hidden (the phone locked or another app came up)', () => {
  it('stops a mic recording, says so, and the tape is saved', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW }, 'hidden');
    expect(s).toMatchObject({ mode: 'tape', recording: false, playing: false, notice: LEFT_APP });
    expect(s.draft).not.toBeNull();
    expect(LEFT_APP).toBe('Recording stopped when you left the app. The tape is saved.');
  });
  it('stops taping the radio; the radio plays on, as with Stop', () => {
    const s = run(radioPlaying(), { type: 'rec', now: NOW }, 'hidden');
    expect(s).toMatchObject({ mode: 'radio', recording: false, playing: true, notice: LEFT_APP });
  });
  it('changes nothing when nothing is recording, playing or not', () => {
    for (const s of [fresh(), radioPlaying(), tapeIn({ playing: true })]) expect(deckReducer(s, { type: 'hidden' })).toBe(s);
  });
});

describe('Closing (the app is closed)', () => {
  it('turns the radio off, and stops a tape where it is', () => {
    expect(run(radioPlaying(), 'closing')).toMatchObject({ mode: 'radio', playing: false, tuning: false });
    expect(run(fresh(), 'play', 'closing')).toMatchObject({ playing: false, tuning: false });
    expect(run(tapeIn({ playing: true, pos: 12 }), 'closing')).toMatchObject({ mode: 'tape', playing: false, pos: 12, tape: TAPE });
  });
  it('stops any recording, the radio too when taping it', () => {
    expect(run(tapeIn(), { type: 'rec', now: NOW }, 'closing')).toMatchObject({ recording: false, playing: false });
    const taping = run(radioPlaying(), { type: 'rec', now: NOW });
    const s = deckReducer(taping, { type: 'closing' });
    expect(s).toMatchObject({ recording: false, playing: false, tuning: false });
    expect(radioOn(s)).toBe(false);
  });
  it('keeps the station, tape, notice and presets', () => {
    const s = { ...radioPlaying(), notice: 'x' };
    const next = deckReducer(s, { type: 'closing' });
    expect(next).toEqual({ ...s, playing: false });
  });
  it('changes nothing when nothing sounds', () => {
    for (const s of [fresh(), tapeIn(), tapeIn({ pos: 5 })]) expect(deckReducer(s, { type: 'closing' })).toBe(s);
  });
});

describe('Eject (a tape deleted from the shelf)', () => {
  const eject = (id) => ({ type: 'eject', id });
  it('empties the deck when it held that tape, and stops it playing', () => {
    expect(run(tapeIn({ playing: true, pos: 12 }), eject(7))).toMatchObject({ mode: 'tape', tape: null, pos: 0, playing: false });
    expect(run(tapeIn({ pos: 12 }), eject(7))).toMatchObject({ tape: null, pos: 0, playing: false });
  });
  it('leaves the radio playing when the tape was only waiting in the deck', () => {
    const s = { ...radioPlaying(), tape: TAPE, pos: 5 };
    expect(deckReducer(s, eject(7))).toMatchObject({ mode: 'radio', playing: true, tape: null, pos: 0 });
  });
  it('a recording carries on', () => {
    const s = run(tapeIn(), { type: 'rec', now: NOW });
    expect(deckReducer(s, eject(7))).toMatchObject({ recording: true, playing: true, tape: null });
  });
  it('another tape, or an empty deck, changes nothing', () => {
    const s = tapeIn({ playing: true });
    expect(deckReducer(s, eject(8))).toBe(s);
    expect(deckReducer(fresh(), eject(7))).toEqual(fresh());
  });
});

describe('Retitle (a tape renamed on the shelf)', () => {
  it('the tape in the deck takes the new name', () => {
    const s = deckReducer(tapeIn({ pos: 3 }), { type: 'retitle', tape: { ...TAPE, title: 'Late Night Drive', named: true } });
    expect(s.tape).toEqual({ ...TAPE, title: 'Late Night Drive', named: true });
    expect(s.tape.blob).toBe(blob);
    expect(s.pos).toBe(3);
  });
  it('another tape, no tape, or an empty deck changes nothing', () => {
    const s = tapeIn();
    expect(deckReducer(s, { type: 'retitle', tape: { id: 8, title: 'X' } })).toBe(s);
    expect(deckReducer(s, { type: 'retitle' })).toBe(s);
    const empty = fresh();
    expect(deckReducer(empty, { type: 'retitle', tape: { id: 7, title: 'X' } })).toBe(empty);
  });
});

describe('Warn (a new tape came out silent, or didn\'t save whole)', () => {
  it('shows the message, and the deck carries on as it was', () => {
    const s = tapeIn({ pos: 3, playing: true });
    const warned = deckReducer(s, { type: 'warn', text: 'This recording came out silent.' });
    expect(warned).toEqual({ ...s, notice: 'This recording came out silent.' });
  });
  it('the next press clears it', () => {
    const warned = deckReducer(tapeIn(), { type: 'warn', text: 'This recording came out silent.' });
    expect(deckReducer(warned, { type: 'play' }).notice).toBe('');
  });
  it('no message changes nothing', () => {
    const s = tapeIn();
    expect(deckReducer(s, { type: 'warn', text: '' })).toBe(s);
    expect(deckReducer(s, { type: 'warn' })).toBe(s);
  });
});

describe('deckReducer', () => {
  it('ignores actions it does not know', () => {
    const s = fresh();
    expect(deckReducer(s, { type: 'nonsense' })).toBe(s);
    expect(deckReducer(s)).toBe(s);
  });
});
