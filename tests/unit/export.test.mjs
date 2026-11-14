import { describe, it, expect } from 'vitest';
import { MP3_KBPS, FORMATS, formatFor, isWav, isMp3, fileName, sizeText, progressText } from '../../logic/export.js';

describe('formats', () => {
  it('MP3 first (the default) at 192 kbps, then WAV', () => {
    expect(MP3_KBPS).toBe(192);
    expect(FORMATS.map((f) => [f.id, f.name, f.ext, f.type])).toEqual([
      ['mp3', 'MP3', 'mp3', 'audio/mpeg'],
      ['wav', 'WAV', 'wav', 'audio/wav'],
    ]);
    expect(FORMATS[0].note).toBe('Smaller, about 1.4 MB a minute');
    expect(FORMATS[1].note).toBe('Full quality, about 10 MB a minute');
  });
  it('formatFor finds a format, and falls back to MP3', () => {
    expect(formatFor('wav').id).toBe('wav');
    expect(formatFor('mp3').id).toBe('mp3');
    expect(formatFor('ogg').id).toBe('mp3');
    expect(formatFor().id).toBe('mp3');
  });
});

describe('isMp3', () => {
  it('a radio tape of an MP3 station already is one', () => {
    expect(isMp3({ mime: 'audio/mpeg' })).toBe(true);
    expect(isMp3({ blob: { type: 'audio/mp3' } })).toBe(true);
  });
  it('other tapes are not', () => {
    expect(isMp3({ mime: 'audio/mp4' })).toBe(false);
    expect(isMp3({ mime: 'audio/aac' })).toBe(false);
    expect(isMp3({ mime: 'audio/wav' })).toBe(false);
    expect(isMp3(null)).toBe(false);
  });
});

describe('isWav', () => {
  it('reads the tape\'s format, then its sound\'s', () => {
    expect(isWav({ mime: 'audio/wav' })).toBe(true);
    expect(isWav({ mime: 'audio/x-WAV' })).toBe(true);
    expect(isWav({ mime: '', blob: { type: 'audio/wav' } })).toBe(true);
    expect(isWav({ mime: 'audio/mp4', blob: { type: 'audio/wav' } })).toBe(false);
    expect(isWav({ blob: { type: 'audio/webm' } })).toBe(false);
    expect(isWav({})).toBe(false);
    expect(isWav(null)).toBe(false);
  });
});

describe('fileName', () => {
  it('is the tape\'s title with the format\'s ending', () => {
    expect(fileName('Late Night Drive', 'mp3')).toBe('Late Night Drive.mp3');
    expect(fileName('90.3 KEXP, Nov 14', 'wav')).toBe('90.3 KEXP, Nov 14.wav');
  });
  it('drops characters names can\'t have, and tidies the spaces', () => {
    expect(fileName('Mix: A/B "best" <3 | ok?*', 'mp3')).toBe('Mix A B best 3 ok.mp3');
    expect(fileName('Tab\there\u0000now\u007F', 'mp3')).toBe('Tab here now.mp3');
    expect(fileName('back\\slash', 'mp3')).toBe('back slash.mp3');
  });
  it('a name can\'t start with a dot', () => {
    expect(fileName('..hidden', 'mp3')).toBe('hidden.mp3');
  });
  it('keeps at most 80 characters, with no space left at the end', () => {
    expect(fileName('a'.repeat(90), 'mp3')).toBe(`${'a'.repeat(80)}.mp3`);
    expect(fileName(`${'a'.repeat(79)} b`, 'mp3')).toBe(`${'a'.repeat(79)}.mp3`);
  });
  it('no usable title is "SIDE A tape"', () => {
    expect(fileName('', 'mp3')).toBe('SIDE A tape.mp3');
    expect(fileName(' ?? ', 'wav')).toBe('SIDE A tape.wav');
    expect(fileName(undefined, 'mp3')).toBe('SIDE A tape.mp3');
  });
});

describe('sizeText', () => {
  it('small files in KB, at least 1', () => {
    expect(sizeText(0)).toBe('1 KB');
    expect(sizeText(1499)).toBe('1 KB');
    expect(sizeText(840_000)).toBe('840 KB');
    expect(sizeText(999_499)).toBe('999 KB');
  });
  it('MB with one decimal under 10, whole above', () => {
    expect(sizeText(1_000_000)).toBe('1.0 MB');
    expect(sizeText(3_140_000)).toBe('3.1 MB');
    expect(sizeText(9_940_000)).toBe('9.9 MB');
    expect(sizeText(10_000_000)).toBe('10 MB');
    expect(sizeText(12_600_000)).toBe('13 MB');
  });
  it('anything else reads 1 KB', () => {
    expect(sizeText(-5)).toBe('1 KB');
    expect(sizeText('x')).toBe('1 KB');
  });
});

describe('progressText', () => {
  it('reading first, then the percent made', () => {
    expect(progressText('mp3', null)).toBe('Reading the tape');
    expect(progressText('mp3')).toBe('Reading the tape');
    expect(progressText('mp3', 0)).toBe('Making the MP3, 0%');
    expect(progressText('mp3', 0.424)).toBe('Making the MP3, 42%');
    expect(progressText('wav', 1)).toBe('Making the WAV, 100%');
  });
  it('stays between 0 and 100', () => {
    expect(progressText('mp3', 1.5)).toBe('Making the MP3, 100%');
    expect(progressText('mp3', -1)).toBe('Making the MP3, 0%');
  });
});
