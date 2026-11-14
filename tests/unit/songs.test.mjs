import { describe, it, expect } from 'vitest';
import { parseNowPlaying, addSong, songAt, songLine } from '../../logic/songs.js';

describe('parseNowPlaying', () => {
  it('splits "Artist - Title"', () => {
    expect(parseNowPlaying('The Paper Lanterns - Night Swim')).toEqual({ artist: 'The Paper Lanterns', title: 'Night Swim' });
  });
  it('splits at the first dash only, so titles keep theirs', () => {
    expect(parseNowPlaying('Mara Quell Trio - Blue Hour - Live')).toEqual({ artist: 'Mara Quell Trio', title: 'Blue Hour - Live' });
  });
  it('keeps text without a dash whole, as the title', () => {
    expect(parseNowPlaying('Morning Edition')).toEqual({ artist: '', title: 'Morning Edition' });
  });
  it('tidies spaces', () => {
    expect(parseNowPlaying('  A   Band -  A  Song ')).toEqual({ artist: 'A Band', title: 'A Song' });
  });
  it('uses the artist as the title when the title is missing', () => {
    expect(parseNowPlaying('Just Words - ')).toEqual({ artist: '', title: 'Just Words' });
  });
  it('ignores empty or punctuation-only text', () => {
    expect(parseNowPlaying('')).toBeNull();
    expect(parseNowPlaying(' - ')).toBeNull();
    expect(parseNowPlaying(null)).toBeNull();
    expect(parseNowPlaying(undefined)).toBeNull();
  });
  it('ignores what stations send between songs', () => {
    expect(parseNowPlaying('THIS STATION WILL CONTINUE AFTER THIS BREAK')).toBeNull();
    expect(parseNowPlaying("Zeta 92.3 (WCMQ) — We`ll Be Right Back After This Message")).toBeNull();
    expect(parseNowPlaying('Commercial Break')).toBeNull();
    expect(parseNowPlaying('Non-music: - KZMP-FM')).toBeNull();
    expect(parseNowPlaying('Break My Heart - Dua Lipa')).not.toBeNull();
  });
  it('drops the invisible mark some stations put first', () => {
    expect(parseNowPlaying('\uFEFFDays Of The New - The Down Town')).toEqual({ artist: 'Days Of The New', title: 'The Down Town' });
  });
  it('reads letters from any language and numbers', () => {
    expect(parseNowPlaying('Ñu - 99')).toEqual({ artist: 'Ñu', title: '99' });
  });
});

describe('addSong', () => {
  it('adds a new song with the second it started', () => {
    expect(addSong([], 0, 'A - One')).toEqual([{ at: 0, artist: 'A', title: 'One' }]);
    expect(addSong([{ at: 0, artist: 'A', title: 'One' }], 184.6, 'B - Two')).toEqual([
      { at: 0, artist: 'A', title: 'One' },
      { at: 185, artist: 'B', title: 'Two' },
    ]);
  });
  it('skips the song that is already playing', () => {
    const list = [{ at: 0, artist: 'A', title: 'One' }];
    expect(addSong(list, 30, 'A - One')).toBe(list);
  });
  it('a song that comes back after another is added again', () => {
    const list = [{ at: 0, artist: 'A', title: 'One' }, { at: 60, artist: 'B', title: 'Two' }];
    expect(addSong(list, 90, 'A - One')).toHaveLength(3);
  });
  it('same title by a different artist is a new song', () => {
    const list = [{ at: 0, artist: 'A', title: 'One' }];
    expect(addSong(list, 5, 'B - One')).toHaveLength(2);
  });
  it('ignores empty text', () => {
    const list = [{ at: 0, artist: 'A', title: 'One' }];
    expect(addSong(list, 10, '')).toBe(list);
  });
  it('starts a list when there is none', () => {
    expect(addSong(undefined, 3, 'X - Y')).toEqual([{ at: 3, artist: 'X', title: 'Y' }]);
    expect(addSong(undefined, 3, '')).toEqual([]);
  });
  it('reads nonsense times as the start, never before it', () => {
    expect(addSong([], 'soon', 'X - Y')[0].at).toBe(0);
    expect(addSong([], -4, 'X - Y')[0].at).toBe(0);
  });
});

describe('songLine', () => {
  it('names the song and the artist', () => {
    expect(songLine({ artist: 'The Paper Lanterns', title: 'Night Swim' })).toBe('Night Swim · The Paper Lanterns');
  });
  it('just the title when there is no artist', () => {
    expect(songLine({ artist: '', title: 'Morning Edition' })).toBe('Morning Edition');
  });
});

describe('songAt', () => {
  const songs = [{ at: 0, artist: 'A', title: 'One' }, { at: 60, artist: 'B', title: 'Two' }];
  it('finds the song playing at a time', () => {
    expect(songAt(songs, 0).title).toBe('One');
    expect(songAt(songs, 59).title).toBe('One');
    expect(songAt(songs, 60).title).toBe('Two');
    expect(songAt(songs, 600).title).toBe('Two');
  });
  it('is null before the first song or without songs', () => {
    expect(songAt([{ at: 10, artist: '', title: 'Late' }], 5)).toBeNull();
    expect(songAt(undefined, 5)).toBeNull();
  });
});
