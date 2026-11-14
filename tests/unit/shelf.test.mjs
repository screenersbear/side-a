import { describe, it, expect } from 'vitest';
import { KINDS, FILTERS, isFilter, filterTapes, tapeCard, emptyText } from '../../logic/shelf.js';

const v1 = { id: 1, kind: 'voice', title: 'Nov 1, 9:00 AM', duration: 48, created: 100 };
const r1 = { id: 2, kind: 'radio', title: '90.3 KEXP, Nov 2', duration: 1860, created: 300 };
const v2 = { id: 3, kind: 'voice', title: 'Nov 3, 8:00 PM', duration: 134, created: 200 };
const ALL = [v1, r1, v2];

describe('KINDS and FILTERS', () => {
  it('give each kind its label colour and name', () => {
    expect(KINDS.voice).toEqual({ label: '#FFD100', name: 'Voice note' });
    expect(KINDS.radio).toEqual({ label: '#1FC8F0', name: 'Taped from radio' });
    expect(KINDS.mix).toEqual({ label: '#FF8A3D', name: 'Mixtape' });
  });
  it('list the four filters in order', () => {
    expect(FILTERS.map((f) => f.id)).toEqual(['all', 'voice', 'radio', 'mix']);
    expect(FILTERS.map((f) => f.name)).toEqual(['All', 'Voice', 'Radio', 'Mixes']);
  });
});

describe('isFilter', () => {
  it('knows the filters', () => {
    expect(isFilter('all')).toBe(true);
    expect(isFilter('mix')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isFilter('video')).toBe(false);
    expect(isFilter(undefined)).toBe(false);
  });
});

describe('filterTapes', () => {
  it('shows every tape, newest first', () => {
    expect(filterTapes(ALL, 'all').map((t) => t.id)).toEqual([2, 3, 1]);
  });
  it('shows one kind', () => {
    expect(filterTapes(ALL, 'voice').map((t) => t.id)).toEqual([3, 1]);
    expect(filterTapes(ALL, 'radio').map((t) => t.id)).toEqual([2]);
    expect(filterTapes(ALL, 'mix')).toEqual([]);
  });
  it('shows everything for an unknown or missing filter', () => {
    expect(filterTapes(ALL, 'video')).toHaveLength(3);
    expect(filterTapes(ALL)).toHaveLength(3);
  });
  it('does not change the list it is given', () => {
    const list = [...ALL];
    filterTapes(list, 'all');
    expect(list).toEqual(ALL);
  });
  it('skips broken entries and tapes of unknown kinds', () => {
    expect(filterTapes([null, { kind: 'vhs', created: 1 }, v1], 'all')).toEqual([v1]);
  });
  it('puts tapes with no date last', () => {
    const undated = { id: 9, kind: 'voice', title: 'x' };
    expect(filterTapes([undated, v1], 'all').map((t) => t.id)).toEqual([1, 9]);
    expect(filterTapes([v1, undated], 'all').map((t) => t.id)).toEqual([1, 9]);
  });
  it('is empty for something that is not a list', () => {
    expect(filterTapes(null, 'all')).toEqual([]);
    expect(filterTapes('tapes', 'voice')).toEqual([]);
  });
});

describe('tapeCard for a radio tape with song titles', () => {
  const songs = [
    { at: 0, artist: 'The Paper Lanterns', title: 'Night Swim' },
    ...[1, 2, 3, 4, 5].map((n) => ({ at: n * 200, artist: `Band ${n}`, title: `Song ${n}` })),
  ];
  const tape = { kind: 'radio', title: '101.9 The Long Drive, Nov 14', freq: 101.9, station: 'The Long Drive', duration: 1860, songs };
  it('puts the station number and first song on the label, the artist and the rest underneath', () => {
    expect(tapeCard(tape)).toEqual({
      title: '101.9 · Night Swim', len: '31:00', meta: 'Radio · The Paper Lanterns, +5 more', label: '#1FC8F0',
      aria: 'Play 101.9, Night Swim by The Paper Lanterns and 5 more songs: Taped from radio, 31:00',
    });
  });
  it('one song: no "more"', () => {
    const card = tapeCard({ ...tape, songs: songs.slice(0, 1) });
    expect(card.meta).toBe('Radio · The Paper Lanterns');
    expect(card.aria).toBe('Play 101.9, Night Swim by The Paper Lanterns: Taped from radio, 31:00');
  });
  it('two songs: "1 more song"', () => {
    expect(tapeCard({ ...tape, songs: songs.slice(0, 2) }).aria).toContain('and 1 more song:');
  });
  it('a first song without an artist names the station instead', () => {
    const card = tapeCard({ ...tape, songs: [{ at: 0, artist: '', title: 'Morning Edition' }] });
    expect(card.meta).toBe('Radio · The Long Drive');
    expect(card.aria).toBe('Play 101.9, Morning Edition: Taped from radio, 31:00');
    expect(tapeCard({ ...tape, station: '', songs: [{ at: 0, artist: '', title: 'X' }] }).meta).toBe('Radio · Radio');
  });
  it('without songs, or without a station number, it is an ordinary radio tape', () => {
    expect(tapeCard({ ...tape, songs: [] }).title).toBe('101.9 The Long Drive, Nov 14');
    expect(tapeCard({ ...tape, songs: undefined }).meta).toBe('Taped from radio, 31:00');
    expect(tapeCard({ ...tape, freq: undefined }).title).toBe('101.9 The Long Drive, Nov 14');
  });
  it('only radio tapes get song titles', () => {
    expect(tapeCard({ ...tape, kind: 'voice' }).meta).toBe('Voice note, 31:00');
  });
});

describe('tapeCard', () => {
  it('writes the title, kind and length', () => {
    expect(tapeCard(r1)).toEqual({
      title: '90.3 KEXP, Nov 2', len: '31:00', meta: 'Taped from radio, 31:00', label: '#1FC8F0',
      aria: 'Play 90.3 KEXP, Nov 2: Taped from radio, 31:00',
    });
  });
  it('uses the voice note look for a voice note', () => {
    const c = tapeCard(v1);
    expect(c.label).toBe('#FFD100');
    expect(c.meta).toBe('Voice note, 00:48');
  });
  it('names a tape with no title by its kind', () => {
    expect(tapeCard({ kind: 'mix', duration: 2700 }).title).toBe('Mixtape');
  });
  it('treats an unknown kind as a voice note', () => {
    expect(tapeCard({ kind: 'vhs', title: 'x', duration: 0 }).meta).toBe('Voice note, 00:00');
  });
});

describe('emptyText', () => {
  it('says what is missing for each filter', () => {
    expect(emptyText('all')).toBe('No tapes yet.');
    expect(emptyText('voice')).toBe('No voice notes yet.');
    expect(emptyText('radio')).toBe('Nothing taped from the radio yet.');
    expect(emptyText('mix')).toBe('No mixtapes yet.');
  });
  it('falls back to the All line', () => {
    expect(emptyText('video')).toBe('No tapes yet.');
    expect(emptyText()).toBe('No tapes yet.');
  });
});
