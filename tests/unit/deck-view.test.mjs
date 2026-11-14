import { describe, it, expect } from 'vitest';
import { deckView } from '../../logic/deck-view.js';
import { startState } from '../../logic/deck.js';

const TAPE = { id: 1, kind: 'voice', title: 'Nov 14, 9:41 PM', duration: 134, blob: { size: 1 } };
const fresh = (extra = {}) => ({ ...startState(), ...extra });
const tape = (extra = {}) => fresh({ mode: 'tape', tape: TAPE, ...extra });

describe('deckView on the radio', () => {
  it('shows the frequency, station and preset', () => {
    const v = deckView(fresh({ station: 2, playing: true }));
    expect(v).toMatchObject({
      isRadio: true, isTape: false, big: '90.3', unit: 'MHz', counter: '',
      status: 'FM, preset 3', line: 'KEXP, Seattle', dialLabel: 'Tuned to 90.3 FM',
      rewLabel: 'Previous station', ffLabel: 'Next station',
    });
    expect(v.needle).toBeCloseTo(11.5, 5);
  });
  it('says when the radio is off or tuning in', () => {
    expect(deckView(fresh()).status).toBe('FM, preset 1, off');
    expect(deckView(fresh({ playing: true, tuning: true })).status).toBe('Tuning in');
  });
  it('lights the playing preset only', () => {
    const v = deckView(fresh({ station: 1 }));
    expect(v.presets.map((p) => p.on)).toEqual([false, true, false, false]);
    expect(v.presets.map((p) => p.n)).toEqual([1, 2, 3, 4]);
    expect(v.presets[3].label).toBe('Preset 4: 98.9 KUTX');
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
  it('no preset is lit on tape', () => {
    expect(deckView(tape({ station: 2 })).presets.every((p) => !p.on)).toBe(true);
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
    const v = deckView(tape({ recording: true, playing: true, source: 'line', station: 3, draft: { kind: 'radio', title: 'x' } }));
    expect(v.line).toBe('Taping 98.9 FM');
  });
  it('while saving, shows the new tape and says it is saving', () => {
    const v = deckView(tape({ draft }));
    expect(v).toMatchObject({ line: 'Saving the tape', tapeTitle: 'Nov 14, 9:41 PM', tapeLength: 'C90' });
  });
});
