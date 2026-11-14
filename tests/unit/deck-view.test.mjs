import { describe, it, expect } from 'vitest';
import { deckView } from '../../logic/deck-view.js';
import { startState } from '../../logic/deck.js';
import { stationAt } from '../../logic/stations.js';

const WBGO = stationAt(88.3);
const CURRENT = stationAt(89.3);
const KEXP = stationAt(90.3);
const WFMU = stationAt(91.1);
const KUTX = stationAt(98.9);

const TAPE = { id: 1, kind: 'voice', title: 'Nov 14, 9:41 PM', duration: 134, blob: { size: 1 } };
const fresh = (extra = {}) => ({ ...startState(), ...extra });
const tape = (extra = {}) => fresh({ mode: 'tape', tape: TAPE, ...extra });

describe('deckView on the radio', () => {
  it('shows the frequency, station and preset', () => {
    const v = deckView(fresh({ station: KEXP, playing: true }));
    expect(v).toMatchObject({
      isRadio: true, isTape: false, big: '90.3', unit: 'MHz', counter: '',
      status: 'KEXP, Seattle WA', line: '', dialLabel: 'Tuned to 90.3 FM',
      rewLabel: 'Previous station', ffLabel: 'Next station',
    });
    expect(v.needle).toBeCloseTo(11.5, 5);
  });
  it('says when the radio is off or tuning in', () => {
    expect(deckView(fresh()).status).toBe('WBGO Jazz, Newark NJ, off');
    expect(deckView(fresh({ playing: true, tuning: true })).status).toBe('Tuning in');
  });
  it('a station that is not a preset says where it is too', () => {
    expect(deckView(fresh({ station: WFMU, playing: true }))).toMatchObject({ status: 'WFMU, Jersey City NJ', big: '91.1' });
    expect(deckView(fresh({ station: WFMU })).status).toBe('WFMU, Jersey City NJ, off');
  });
  it('a station with no town gives just its name', () => {
    expect(deckView(fresh({ station: stationAt(97.3), playing: true })).status).toBe('The Rock');
    expect(deckView(fresh({ station: stationAt(97.3) })).status).toBe('The Rock, off');
  });
  it('the second line is the song the station names, while it plays', () => {
    const song = { artist: 'The Paper Lanterns', title: 'Night Swim' };
    const on = fresh({ station: KEXP, playing: true, heard: { station: KEXP, song } });
    expect(deckView(on).line).toBe('Night Swim · The Paper Lanterns');
    expect(deckView({ ...on, heard: { station: KEXP, song: { artist: '', title: 'Morning Edition' } } }).line).toBe('Morning Edition');
    // Nothing between songs, from another station, before anything is heard, or with the radio off.
    expect(deckView({ ...on, heard: { station: KEXP, song: null } }).line).toBe('');
    expect(deckView({ ...on, heard: { station: KUTX, song } }).line).toBe('');
    expect(deckView({ ...on, heard: null }).line).toBe('');
    expect(deckView({ ...on, playing: false }).line).toBe('');
  });
  it('lights the playing preset only', () => {
    const v = deckView(fresh({ station: CURRENT }));
    expect(v.presets.map((p) => p.on)).toEqual([false, true, false, false]);
    expect(v.presets.map((p) => p.n)).toEqual([1, 2, 3, 4]);
    expect(v.presets[0].label).toBe('Preset 1: 88.3 WBGO Jazz');
    expect(v.presets[3].label).toBe('Preset 4: 98.9 KUTX');
    expect(deckView(fresh({ station: WFMU })).presets.some((p) => p.on)).toBe(false);
    expect(deckView(fresh({ station: KUTX })).status).toBe('KUTX, Austin TX, off');
    expect(deckView(fresh({ station: WBGO })).presets[0].on).toBe(true);
  });
  it('shows the presets saved on the phone', () => {
    const v = deckView(fresh({ station: WFMU, playing: true, presets: [88.3, 91.1, 90.3, 98.9] }));
    expect(v.presets[1]).toEqual({ n: 2, on: true, label: 'Preset 2: 91.1 WFMU' });
    expect(v.status).toBe('WFMU, Jersey City NJ');
  });
  it('keys: Play down while playing, Stop down while stopped', () => {
    expect(deckView(fresh({ playing: true }))).toMatchObject({ playOn: true, stopped: false, recording: false, sounding: true });
    expect(deckView(fresh())).toMatchObject({ playOn: false, stopped: true, sounding: false });
  });
  it('reels stay still for the radio', () => {
    expect(deckView(fresh({ playing: true })).reelOn).toBe(false);
  });
  it('a notice replaces the status', () => {
    expect(deckView(fresh({ notice: 'No signal. Check the internet.' })).status).toBe('No signal. Check the internet.');
  });
});

describe('deckView on tape', () => {
  it('shows the counter, the tape and its length', () => {
    const v = deckView(tape({ pos: 74 }));
    expect(v).toMatchObject({
      isTape: true, isRadio: false, big: '01:14', unit: '', counter: '01:14', status: 'Tape, stopped',
      line: 'Nov 14, 9:41 PM', tapeTitle: 'Nov 14, 9:41 PM', tapeLength: '02:14',
      rewLabel: 'Rewind', ffLabel: 'Fast forward',
    });
  });
  it('a radio tape with song titles names the song at the counter', () => {
    const songs = [{ at: 0, artist: 'The Paper Lanterns', title: 'Night Swim' }, { at: 60, artist: '', title: 'Station break' }];
    const radioTape = { ...TAPE, kind: 'radio', songs };
    expect(deckView(tape({ tape: radioTape, pos: 30 })).line).toBe('Night Swim · The Paper Lanterns');
    expect(deckView(tape({ tape: radioTape, pos: 61 })).line).toBe('Station break');
    expect(deckView(tape({ tape: { ...radioTape, songs: [{ at: 5, artist: 'A', title: 'B' }] }, pos: 2 })).line).toBe('Nov 14, 9:41 PM');
  });
  it('no preset is lit on tape', () => {
    expect(deckView(tape({ station: KEXP })).presets.every((p) => !p.on)).toBe(true);
  });
  it('reels turn while a tape plays', () => {
    expect(deckView(tape({ playing: true }))).toMatchObject({ reelOn: true, status: 'Tape, playing' });
  });
  it('a blank deck says so', () => {
    const v = deckView(fresh({ mode: 'tape' }));
    expect(v).toMatchObject({ line: 'Blank tape', tapeTitle: 'Blank', tapeLength: 'C90' });
  });
  it('shows the record source', () => {
    expect(deckView(tape())).toMatchObject({ isMic: true, isLine: false });
    expect(deckView(tape({ source: 'line' }))).toMatchObject({ isMic: false, isLine: true });
  });
});

describe('deckView while recording', () => {
  const draft = { kind: 'voice', title: 'Nov 14, 9:41 PM' };
  it('recording from the mic', () => {
    const v = deckView(tape({ recording: true, playing: true, draft, pos: 3 }));
    expect(v).toMatchObject({
      status: 'Recording', line: 'Mic to side A', recording: true, playOn: false, stopped: false,
      reelOn: true, tapeTitle: 'Nov 14, 9:41 PM', tapeLength: 'C90', counter: '00:03',
    });
  });
  it('taping the radio names the frequency', () => {
    const v = deckView(tape({ recording: true, playing: true, source: 'line', station: KUTX, draft: { kind: 'radio', title: 'x' } }));
    expect(v.line).toBe('Taping 98.9 FM');
  });
  it('while saving, shows the new tape and says it is saving', () => {
    const v = deckView(tape({ draft }));
    expect(v).toMatchObject({ line: 'Saving the tape', tapeTitle: 'Nov 14, 9:41 PM', tapeLength: 'C90' });
  });
});
