import { describe, it, expect } from 'vitest';
import { BANDS, listOf, stationOf, tune, startBands, switchBand, takeLocals, bandMemory } from '../../logic/bands.js';
import { startState, deckReducer } from '../../logic/deck.js';
import { STATIONS, PRESET_FREQS, stationAt } from '../../logic/stations.js';
import { LOCAL } from './local-fixtures.mjs';

const KEXP = stationAt(90.3);
const KUTX = stationAt(98.9);
const run = (s, ...actions) => actions.reduce((st, a) => deckReducer(st, typeof a === 'string' ? { type: a } : a), s);
const withLocals = (saved = {}) => startState(saved, LOCAL);
const onLocal = () => run(withLocals(), { type: 'locals', list: LOCAL });

describe('the BAND key', () => {
  it('reads FM1 WORLD or FM2 LOCAL, with the mockup words for screen readers', () => {
    expect(BANDS.world).toEqual({ big: 'FM1', small: 'WORLD', label: 'Band FM1, top stations from the US and around the world. Tap for FM2, local stations.' });
    expect(BANDS.local).toEqual({ big: 'FM2', small: 'LOCAL', label: 'Band FM2, local stations. Tap for FM1, world stations.' });
  });
});

describe('listOf and stationOf', () => {
  it('give the band showing and its station', () => {
    const s = startState();
    expect(listOf(s)).toBe(STATIONS);
    expect(stationOf(s).name).toBe('WBGO Jazz');
    const l = onLocal();
    expect(listOf(l)).toBe(LOCAL);
    expect(stationOf(l).name).toBe('WFUV');
  });
});

describe('tune', () => {
  it('puts the radio on a station, playing, and ends the FM2 hello', () => {
    const s = { ...startState(), mode: 'tape', between: 99.9, recording: true, notice: 'x', intro: true };
    expect(tune(s, KEXP)).toMatchObject({ mode: 'radio', station: KEXP, between: null, playing: true, recording: false, tuning: true, notice: '', intro: false });
  });
});

describe('startBands', () => {
  it('opens on FM1 with no local stations yet', () => {
    expect(startBands({}, undefined)).toEqual({
      band: 'world', local: [], station: stationAt(88.3), presets: PRESET_FREQS, other: { freq: undefined, presets: [] }, intro: false,
    });
  });
  it('opens FM1 on its last station, with FM2 remembered', () => {
    const s = startBands({ freq: 90.3, localFreq: 97.1, localPresets: [97.1, 93.9, 90.7, 104.3] }, LOCAL);
    expect(s).toMatchObject({ band: 'world', station: KEXP, local: LOCAL });
    expect(s.other).toEqual({ freq: 97.1, presets: [97.1, 93.9, 90.7, 104.3] });
  });
  it('opens on FM2 when it was left there, on its last station', () => {
    const s = startBands({ band: 'local', freq: 90.3, localFreq: 101.5 }, LOCAL);
    expect(s).toMatchObject({ band: 'local', station: 3, presets: [90.7, 93.9, 97.1, 101.5] });
    expect(s.other).toEqual({ freq: 90.3, presets: PRESET_FREQS });
  });
  it('opens FM2 on its first preset when its last station has gone', () => {
    expect(startBands({ band: 'local', localFreq: 88.9 }, LOCAL).station).toBe(0);
    expect(startBands({ band: 'local', localPresets: [101.5, 99.9] }, LOCAL)).toMatchObject({ station: 3, presets: [101.5, 93.9, 97.1, 101.5] });
  });
  it('opens on FM1 when FM2 was left on but its stations are no longer known', () => {
    expect(startBands({ band: 'local', freq: 98.9 }, []).band).toBe('world');
    expect(startBands({ band: 'local', freq: 98.9 }, []).station).toBe(KUTX);
  });
});

describe('switchBand', () => {
  it('goes to FM2 on its first preset, playing, the first time', () => {
    const s = run(withLocals(), 'band');
    expect(s).toMatchObject({ band: 'local', station: 0, mode: 'radio', playing: true, tuning: true, presets: [90.7, 93.9, 97.1, 101.5] });
    expect(s.other).toEqual({ freq: 88.3, presets: PRESET_FREQS });
  });
  it('comes back to the station and presets each band was left on', () => {
    let s = run(withLocals(), { type: 'preset', key: 2 }, 'band', 'ff', 'ff', { type: 'savePreset', key: 0 });
    expect(stationOf(s).name).toBe('Hot 97');
    expect(s.presets).toEqual([97.1, 93.9, 97.1, 101.5]);
    s = run(s, 'band');
    expect(s).toMatchObject({ band: 'world', station: KEXP, presets: PRESET_FREQS });
    s = run(s, 'band');
    expect(s).toMatchObject({ band: 'local', presets: [97.1, 93.9, 97.1, 101.5] });
    expect(stationOf(s).name).toBe('Hot 97');
  });
  it('remembers the station it was on, not the place between stations', () => {
    const s = run(withLocals(), { type: 'preset', key: 2 }, { type: 'dial', freq: 100.3 }, 'band');
    expect(s.other.freq).toBe(90.3);
  });
  it('comes back to the nearest station, or the first preset, when the one it was on has gone', () => {
    const near = { ...withLocals(), other: { freq: 97.2, presets: [90.7, 93.9, 97.1, 101.5] } };
    expect(switchBand(near).station).toBe(2);
    const gone = { ...withLocals(), other: { freq: 107.9, presets: [101.5, 93.9, 97.1, 101.5] } };
    expect(switchBand(gone).station).toBe(3);
    const lost = { ...withLocals(), other: { freq: 107.9, presets: [] } };
    expect(switchBand(lost).station).toBe(0);
  });
  it('forgets the song the last band named', () => {
    const s = run(withLocals(), 'play', { type: 'heard', station: stationAt(88.3), text: 'A - B' }, 'band');
    expect(s.heard).toBeNull();
  });
  it('does nothing while recording, or before FM2 has stations', () => {
    const rec = run(withLocals(), 'play', 'rec');
    expect(switchBand(rec)).toBe(rec);
    const none = startState();
    expect(run(none, 'band')).toBe(none);
  });
  it('goes back to FM1 even with no local stations (only FM2 needs them)', () => {
    const s = { ...onLocal() };
    expect(run(s, 'band').band).toBe('world');
  });
});

describe('takeLocals', () => {
  it('opens FM2 on the new stations, playing preset 1, saying what they are', () => {
    const s = run(startState({ freq: 90.3 }), { type: 'locals', list: LOCAL });
    expect(s).toMatchObject({ band: 'local', local: LOCAL, station: 0, playing: true, tuning: true, intro: true, presets: [90.7, 93.9, 97.1, 101.5] });
    expect(s.other).toEqual({ freq: 90.3, presets: PRESET_FREQS });
  });
  it('keeps FM1 remembered when new stations replace FM2 (a new place in Settings)', () => {
    const s = run(startState({ freq: 90.3 }), { type: 'locals', list: LOCAL }, { type: 'locals', list: LOCAL.slice(1) });
    expect(s.other).toEqual({ freq: 90.3, presets: PRESET_FREQS });
    expect(s.local).toHaveLength(4);
    expect(stationOf(s).name).toBe('WNYC');
  });
  it('the hello goes once the user tunes', () => {
    expect(run(onLocal(), 'ff').intro).toBe(false);
    expect(run(onLocal(), { type: 'dial', freq: 99.0 }).intro).toBe(false);
    expect(run(onLocal(), { type: 'preset', key: 3 }).intro).toBe(false);
    expect(run(onLocal(), 'stop').intro).toBe(true);
  });
  it('ignores an empty or broken list, and anything while recording', () => {
    const s = startState();
    expect(takeLocals(s, [])).toBe(s);
    expect(takeLocals(s, null)).toBe(s);
    const rec = run(s, 'play', 'rec');
    expect(takeLocals(rec, LOCAL)).toBe(rec);
  });
});

describe('FM2 works like FM1', () => {
  it('Next and Previous go round its stations', () => {
    expect(stationOf(run(onLocal(), 'rew')).name).toBe('WAXQ');
    expect(stationOf(run(onLocal(), 'ff', 'ff')).name).toBe('Hot 97');
  });
  it('the wheel locks onto its stations and searches between them', () => {
    expect(run(onLocal(), { type: 'dial', freq: 101.4 }).station).toBe(3);
    expect(run(onLocal(), { type: 'dial', freq: 99.0 }).between).toBe(99);
    expect(run(onLocal(), { type: 'dial', step: 0.1 }, { type: 'dial', step: 0.1 }, { type: 'dial', step: 0.1 }).between).toBe(91.2);
    expect(run(onLocal(), { type: 'dial', freq: 99.0 }, 'ff').station).toBe(3);
  });
  it('its presets tune, and hold to save', () => {
    expect(stationOf(run(onLocal(), { type: 'preset', key: 1 })).name).toBe('WNYC');
    expect(run(onLocal(), 'ff', { type: 'savePreset', key: 3 }).presets).toEqual([90.7, 93.9, 97.1, 93.9]);
  });
  it('a radio tape remembers the FM2 station', () => {
    const s = run(onLocal(), 'live', { type: 'rec', now: 0 });
    expect(s.draft).toMatchObject({ kind: 'radio', freq: 90.7, station: 'WFUV' });
  });
});

describe('bandMemory', () => {
  it('keeps each band’s last station and presets, whichever band is showing', () => {
    const world = run(withLocals({ freq: 90.3 }), { type: 'locals', list: LOCAL }, 'ff', 'band');
    expect(bandMemory(world)).toEqual({ band: 'world', freq: 90.3, presets: PRESET_FREQS, localFreq: 93.9, localPresets: [90.7, 93.9, 97.1, 101.5] });
    const local = run(world, 'band');
    expect(bandMemory(local)).toEqual({ band: 'local', freq: 90.3, presets: PRESET_FREQS, localFreq: 93.9, localPresets: [90.7, 93.9, 97.1, 101.5] });
  });
});
