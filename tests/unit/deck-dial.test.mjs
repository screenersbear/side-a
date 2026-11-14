// The deck with the tuning wheel: locking onto stations, between stations, and what the rest of the deck does there.
import { describe, it, expect } from 'vitest';
import { startState, deckReducer, radioOn } from '../../logic/deck.js';
import { deckView } from '../../logic/deck-view.js';
import { lockScreen } from '../../logic/lock-screen.js';
import { soundPlan } from '../../logic/sound-plan.js';
import { STATIONS, stationAt } from '../../logic/stations.js';
import { SEARCHING, STATIC_LINE, TUNE_FIRST } from '../../logic/dial.js';

const KEXP = stationAt(90.3);
const KSTAR = stationAt(99.7);
const WIOE = stationAt(101.1);
const NOW = new Date(2026, 10, 14, 21, 41).getTime();
const TAPE = { id: 7, kind: 'voice', title: 'Note', duration: 30, blob: { size: 1 } };
const act = (s, a) => deckReducer(s, typeof a === 'string' ? { type: a } : a);
const run = (s, ...actions) => actions.reduce(act, s);
const radio = (station = KEXP) => run({ ...startState(), station }, 'play', 'live');
const turned = (freq, s = radio()) => act(s, { type: 'dial', freq });
const between = () => turned(100.4);

describe('the tuning wheel', () => {
  it('locks onto a station within 0.2 MHz and plays it', () => {
    const s = turned(99.8);
    expect(s).toMatchObject({ mode: 'radio', station: KSTAR, between: null, playing: true, tuning: true });
    expect(soundPlan(radio(), s, 'dial')).toEqual([{ do: 'radio.play', url: STATIONS[KSTAR].url, tapeable: true, station: KSTAR }]);
  });
  it('between stations the radio goes quiet: FM, searching', () => {
    const s = between();
    expect(s).toMatchObject({ between: 100.4, playing: true, tuning: false });
    expect(radioOn(s)).toBe(false);
    expect(soundPlan(radio(), s, 'dial')).toEqual([{ do: 'radio.stop' }]);
    expect(deckView(s)).toMatchObject({ status: SEARCHING, line: STATIC_LINE, big: '100.4', dial: 100.4, dialText: '100.4 FM, between stations', sounding: false });
    expect(deckView(radio()).sounding).toBe(true);
    expect(deckView(s).presets.every((p) => !p.on)).toBe(true);
    expect(lockScreen(s)).toMatchObject({ title: SEARCHING, artist: '100.4 FM' });
  });
  it('turning on between stations changes nothing more; coming back to the station plays it again', () => {
    const s = between();
    expect(turned(100.4, s)).toBe(s);
    expect(turned(100.6, s).between).toBe(100.6);
    const back = turned(99.7, s);
    expect(back).toMatchObject({ station: KSTAR, between: null });
    expect(soundPlan(s, back, 'dial')).toEqual([{ do: 'radio.play', url: STATIONS[KSTAR].url, tapeable: true, station: KSTAR }]);
  });
  it('turning within the station it is on changes nothing', () => {
    const s = radio(KSTAR);
    expect(turned(99.8, s)).toBe(s);
  });
  it('arrow keys step 0.1 MHz, moving on past the station it was on', () => {
    const s = act(radio(KSTAR), { type: 'dial', step: 0.1 });
    expect(s.between).toBe(100);
    expect(act(s, { type: 'dial', step: -0.1 })).toMatchObject({ station: KSTAR, between: null });
  });
  it('from tape, or with the radio off, the wheel turns the radio on', () => {
    expect(turned(90.3, { ...startState(), mode: 'tape', tape: TAPE })).toMatchObject({ mode: 'radio', station: KEXP, playing: true });
    expect(turned(100.4, startState())).toMatchObject({ mode: 'radio', between: 100.4, playing: true });
  });
  it('does nothing while recording, like Next and Previous', () => {
    const s = act(radio(), { type: 'rec', now: NOW });
    expect(turned(100.4, s)).toBe(s);
  });
});

describe('the deck between stations', () => {
  it('Next and Previous seek to the next station up or down', () => {
    expect(act(between(), 'ff')).toMatchObject({ station: WIOE, between: null });
    expect(act(between(), 'rew')).toMatchObject({ station: KSTAR, between: null });
  });
  it('a preset key tunes to its station', () => {
    expect(act(between(), { type: 'preset', key: 2 })).toMatchObject({ station: KEXP, between: null, tuning: true });
  });
  it('Record asks to tune to a station first; so does saving a preset', () => {
    expect(act(between(), { type: 'rec', now: NOW })).toMatchObject({ recording: false, notice: TUNE_FIRST });
    expect(act(between(), { type: 'savePreset', key: 0 })).toMatchObject({ notice: TUNE_FIRST, presets: startState().presets });
    const tape = { ...between(), mode: 'tape', source: 'line' };
    expect(act(tape, { type: 'rec', now: NOW })).toMatchObject({ recording: false, notice: TUNE_FIRST });
  });
  it('Stop turns it off; Play and Radio turn it back on, still searching', () => {
    const off = act(between(), 'stop');
    expect(deckView(off).status).toBe('FM, off');
    expect(deckView(off).line).toBe('');
    expect(act(off, 'play')).toMatchObject({ playing: true, tuning: false, between: 100.4 });
    const tape = act(between(), 'toTape');
    expect(act(tape, 'toRadio')).toMatchObject({ mode: 'radio', playing: true, tuning: false, between: 100.4 });
  });
});
