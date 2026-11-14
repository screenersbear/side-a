import { describe, it, expect } from 'vitest';
import { lockScreen } from '../../logic/lock-screen.js';
import { startState, deckReducer } from '../../logic/deck.js';
import { LOCAL } from './local-fixtures.mjs';
import { STATIONS, stationAt } from '../../logic/stations.js';

const KEXP = stationAt(90.3);
const NO_PLACE = STATIONS.findIndex((s) => !s.place);
const radio = (extra = {}) => ({ ...startState(), station: KEXP, ...extra });
const SONG = { artist: 'The Paper Lanterns', title: 'Night Swim' };
const TAPE = { id: 7, kind: 'voice', title: 'Late Night Drive', duration: 30 };

describe('lockScreen on the radio', () => {
  it('shows the station, its frequency and place; skip changes station', () => {
    expect(lockScreen(radio({ playing: true }))).toEqual({
      title: 'KEXP', artist: '90.3 FM, Seattle WA', album: 'SIDE A', playing: true, skip: 'station',
    });
    expect(lockScreen(radio()).playing).toBe(false);
  });
  it('a station with no place just has its frequency', () => {
    if (NO_PLACE < 0) return;
    const s = STATIONS[NO_PLACE];
    expect(lockScreen(radio({ station: NO_PLACE })).artist).toBe(`${s.freq.toFixed(1)} FM`);
  });
  it('shows the song the station names while it plays, with the station underneath', () => {
    const s = radio({ playing: true, heard: { station: KEXP, song: SONG } });
    expect(lockScreen(s)).toEqual({
      title: 'Night Swim', artist: 'The Paper Lanterns', album: 'KEXP, Seattle WA', playing: true, skip: 'station',
    });
  });
  it('a song with no artist has the station as its artist', () => {
    const s = radio({ playing: true, heard: { station: KEXP, song: { artist: '', title: 'Station ID' } } });
    expect(lockScreen(s)).toMatchObject({ title: 'Station ID', artist: 'KEXP, Seattle WA' });
  });
  it('no song when the radio is off, between songs, or for another station', () => {
    expect(lockScreen(radio({ heard: { station: KEXP, song: SONG } })).title).toBe('KEXP');
    expect(lockScreen(radio({ playing: true, heard: { station: KEXP, song: null } })).title).toBe('KEXP');
    expect(lockScreen(radio({ playing: true, heard: { station: KEXP + 1, song: SONG } })).title).toBe('KEXP');
  });
});

describe('lockScreen on tape', () => {
  const tape = (extra = {}) => ({ ...startState(), mode: 'tape', tape: TAPE, ...extra });
  it('shows the tape and its kind; skip jumps through it', () => {
    expect(lockScreen(tape({ playing: true }))).toEqual({
      title: 'Late Night Drive', artist: 'Voice note', album: 'SIDE A', playing: true, skip: 'seek',
    });
    expect(lockScreen(tape()).playing).toBe(false);
  });
  it('a tape with no title or a kind it doesn\'t know is a voice note', () => {
    expect(lockScreen(tape({ tape: { ...TAPE, title: '', kind: 'other' } }))).toMatchObject({ title: 'Voice note', artist: 'Voice note' });
    expect(lockScreen(tape({ tape: { ...TAPE, kind: 'mix' } })).artist).toBe('Mixtape');
  });
  it('a radio tape shows the song at the counter, with the tape\'s name underneath', () => {
    const songs = [{ at: 0, artist: 'A', title: 'One' }, { at: 60, artist: '', title: 'Two' }];
    const radioTape = { ...TAPE, kind: 'radio', title: '90.3 KEXP, Nov 14', songs };
    expect(lockScreen(tape({ tape: radioTape, pos: 10 }))).toMatchObject({ title: 'One', artist: 'A', album: '90.3 KEXP, Nov 14' });
    expect(lockScreen(tape({ tape: radioTape, pos: 61 }))).toMatchObject({ title: 'Two', artist: 'Taped from radio' });
  });
  it('an empty deck is a blank tape, with nothing to skip', () => {
    expect(lockScreen(tape({ tape: null }))).toEqual({ title: 'Blank tape', artist: 'SIDE A', album: 'SIDE A', playing: false, skip: '' });
  });
});

describe('lockScreen while recording', () => {
  it('says what is being recorded; no skipping', () => {
    const mic = { ...startState(), mode: 'tape', recording: true, playing: true, source: 'mic' };
    expect(lockScreen(mic)).toEqual({ title: 'Recording', artist: 'Mic to side A', album: 'SIDE A', playing: true, skip: '' });
    expect(lockScreen({ ...mic, source: 'line', station: KEXP }).artist).toBe('Taping 90.3 FM');
  });
});

describe('lockScreen on FM2', () => {
  it('shows the local station and where it is, and tapes it by its frequency', () => {
    const s = deckReducer(startState(), { type: 'locals', list: LOCAL });
    expect(lockScreen({ ...s, station: 3 })).toMatchObject({ title: 'Kiss FM', artist: '101.5 FM, New York City' });
    expect(lockScreen(deckReducer(s, { type: 'rec', now: 0 }))).toMatchObject({ title: 'Recording', artist: 'Taping 90.7 FM' });
  });
});
