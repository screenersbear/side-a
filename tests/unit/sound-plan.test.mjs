import { describe, it, expect } from 'vitest';
import { soundPlan } from '../../logic/sound-plan.js';
import { startState, deckReducer } from '../../logic/deck.js';
import { STATIONS, stationAt } from '../../logic/stations.js';

const WBGO = stationAt(88.3);
const KEXP = stationAt(90.3);

const NOW = new Date(2026, 10, 14, 21, 41).getTime();
const blob = { size: 1 };
const TAPE = { id: 1, kind: 'voice', title: 't', duration: 30, blob };
const OTHER = { id: 2, kind: 'voice', title: 'u', duration: 20, blob: { size: 2 } };

// Run one action and return the steps it needs.
function plan(state, action) {
  const a = typeof action === 'string' ? { type: action } : action;
  const next = deckReducer(state, a);
  return soundPlan(state, next, a.type);
}
const fresh = () => startState();
const radio = (station = WBGO) => ({ ...fresh(), station, playing: true });
const tapeIn = (extra = {}) => ({ ...fresh(), mode: 'tape', tape: TAPE, ...extra });

describe('soundPlan: radio', () => {
  it('Play starts the station', () => {
    expect(plan(fresh(), 'play')).toEqual([{ do: 'radio.play', url: STATIONS[WBGO].url, tapeable: true, station: WBGO }]);
  });
  it('a new station replaces the old one', () => {
    expect(plan(radio(WBGO), 'ff')).toEqual([{ do: 'radio.play', url: STATIONS[WBGO + 1].url, tapeable: true, station: WBGO + 1 }]);
    expect(plan(radio(WBGO), { type: 'preset', key: 2 })).toEqual([{ do: 'radio.play', url: STATIONS[KEXP].url, tapeable: true, station: KEXP }]);
  });
  it('Stop stops the radio', () => {
    expect(plan(radio(), 'stop')).toEqual([{ do: 'radio.stop' }]);
  });
  it('nothing to do when the radio keeps playing the same station', () => {
    expect(plan(radio(), { type: 'live' })).toEqual([]);
  });
  it('the radio keeps playing, uninterrupted, when Record tapes it', () => {
    const steps = plan({ ...radio(KEXP), tuning: false }, { type: 'rec', now: NOW });
    expect(steps).toEqual([{ do: 'rec.start', source: 'line', draft: { kind: 'radio', title: '90.3 KEXP, Nov 14', from: 'radio', freq: 90.3, station: 'KEXP' } }]);
  });
  it('taping the radio from tape mode turns the radio on', () => {
    const steps = plan(tapeIn({ source: 'line', station: KEXP }), { type: 'rec', now: NOW });
    expect(steps.map((s) => s.do)).toEqual(['rec.start', 'radio.play']);
    expect(steps[1]).toMatchObject({ url: STATIONS[KEXP].url, station: KEXP });
  });
  it('a station that does not allow taping plays without asking it to share its sound', () => {
    const WFMU = stationAt(91.1);
    expect(plan(radio(WFMU - 1), 'ff')).toEqual([{ do: 'radio.play', url: STATIONS[WFMU].url, tapeable: false, station: WFMU }]);
  });
});

describe('soundPlan: tape', () => {
  it('loading a tape from the shelf loads and plays it from the top', () => {
    expect(plan(fresh(), { type: 'load', tape: TAPE })).toEqual([{ do: 'tape.load', blob }, { do: 'tape.play', pos: 0 }]);
  });
  it('loading from the shelf while the radio plays stops the radio first', () => {
    const steps = plan(radio(), { type: 'load', tape: TAPE });
    expect(steps.map((s) => s.do)).toEqual(['radio.stop', 'tape.load', 'tape.play']);
  });
  it('a different tape while one plays: load the new one and play it', () => {
    const steps = plan(tapeIn({ playing: true }), { type: 'load', tape: OTHER });
    expect(steps).toEqual([{ do: 'tape.load', blob: OTHER.blob }, { do: 'tape.play', pos: 0 }]);
  });
  it('Play plays from where the tape is', () => {
    expect(plan(tapeIn({ pos: 12 }), 'play')).toEqual([{ do: 'tape.play', pos: 12 }]);
  });
  it('Stop pauses the tape', () => {
    expect(plan(tapeIn({ playing: true }), 'stop')).toEqual([{ do: 'tape.pause' }]);
  });
  it('winding seeks, playing or not', () => {
    expect(plan(tapeIn({ pos: 5 }), 'ff')).toEqual([{ do: 'tape.seek', pos: 15 }]);
    expect(plan(tapeIn({ pos: 15, playing: true }), 'rew')).toEqual([{ do: 'tape.seek', pos: 5 }]);
  });
  it('the player moving the counter needs no seek', () => {
    expect(plan(tapeIn({ playing: true, pos: 1 }), { type: 'tick', pos: 2 })).toEqual([]);
  });
  it('a blank tape unloads the player', () => {
    expect(plan(tapeIn(), 'blank')).toEqual([{ do: 'tape.load', blob: null }]);
  });
  it('restoring the newest tape loads it without playing', () => {
    expect(plan(fresh(), { type: 'restore', tape: TAPE })).toEqual([{ do: 'tape.load', blob }]);
  });
});

describe('soundPlan: recording', () => {
  it('Record in tape mode starts the mic', () => {
    expect(plan(tapeIn(), { type: 'rec', now: NOW })).toEqual([
      { do: 'rec.start', source: 'mic', draft: { kind: 'voice', title: 'Nov 14, 9:41 PM', from: 'tape' } },
    ]);
  });
  it('Record while a tape plays pauses it first', () => {
    const steps = plan(tapeIn({ playing: true }), { type: 'rec', now: NOW });
    expect(steps.map((s) => s.do)).toEqual(['tape.pause', 'rec.start']);
  });
  it('Stop ends the recording', () => {
    const rec = deckReducer(tapeIn(), { type: 'rec', now: NOW });
    expect(plan(rec, 'stop')).toEqual([{ do: 'rec.stop' }]);
  });
  it('Stop while taping the radio ends the recording; the radio plays on, uninterrupted', () => {
    const rec = deckReducer(radio(), { type: 'rec', now: NOW });
    expect(plan(rec, 'stop')).toEqual([{ do: 'rec.stop' }]);
    expect(plan(deckReducer(rec, { type: 'stop' }), 'stop')).toEqual([{ do: 'radio.stop' }]);
  });
  it('Record on a station that does not allow it needs no sound changes', () => {
    expect(plan(radio(stationAt(91.1)), { type: 'rec', now: NOW })).toEqual([]);
  });
  it('a refused taping ends the recording and keeps the radio going', () => {
    const rec = deckReducer(radio(), { type: 'rec', now: NOW });
    expect(plan(rec, { type: 'refused', message: 'x' })).toEqual([{ do: 'rec.stop' }]);
  });
  it('switching to the radio while taping it keeps the radio going', () => {
    const rec = deckReducer(radio(), { type: 'rec', now: NOW });
    expect(plan(rec, 'toRadio')).toEqual([{ do: 'rec.stop' }]);
  });
  it('the saved tape loads into the player without playing', () => {
    const stopped = deckReducer(deckReducer(tapeIn({ tape: null }), { type: 'rec', now: NOW }), { type: 'stop' });
    expect(plan(stopped, { type: 'saved', tape: TAPE })).toEqual([{ do: 'tape.load', blob }]);
  });
});

describe('soundPlan', () => {
  it('has nothing to do when nothing changed', () => {
    const s = fresh();
    expect(soundPlan(s, s, 'play')).toEqual([]);
    expect(soundPlan(s, s)).toEqual([]);
  });
  it('only seeks for rewind and fast forward', () => {
    const a = tapeIn({ pos: 1 });
    const b = { ...a, pos: 9 };
    expect(soundPlan(a, b, 'tick')).toEqual([]);
    expect(soundPlan(a, b, 'rew')).toEqual([{ do: 'tape.seek', pos: 9 }]);
    expect(soundPlan(a, b, 'ff')).toEqual([{ do: 'tape.seek', pos: 9 }]);
  });
  it('does not seek when the position stayed put', () => {
    const a = tapeIn({ pos: 1 });
    expect(soundPlan(a, { ...a, notice: 'x' }, 'ff')).toEqual([]);
  });
});
