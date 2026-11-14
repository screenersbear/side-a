import { describe, it, expect } from 'vitest';
import { mmss, shortDate, clockTime, tapeTitle, cleanTitle, TITLE_MAX } from '../../logic/tape-names.js';

const at = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).getTime();

describe('mmss', () => {
  it('writes minutes and seconds with two digits each', () => {
    expect(mmss(0.4)).toBe('00:00');
    expect(mmss(9)).toBe('00:09');
    expect(mmss(134)).toBe('02:14');
    expect(mmss(600)).toBe('10:00');
  });
  it('drops parts of a second', () => {
    expect(mmss(59.99)).toBe('00:59');
    expect(mmss(60)).toBe('01:00');
  });
  it('keeps counting past an hour', () => {
    expect(mmss(3665)).toBe('61:05');
  });
  it('reads anything that is not a time as 00:00', () => {
    expect(mmss(0)).toBe('00:00');
    expect(mmss(-5)).toBe('00:00');
    expect(mmss(NaN)).toBe('00:00');
    expect(mmss(Infinity)).toBe('00:00');
    expect(mmss(undefined)).toBe('00:00');
    expect(mmss('12')).toBe('00:12');
  });
});

describe('shortDate', () => {
  it('writes month and day', () => {
    expect(shortDate(at(2026, 11, 14, 9, 0))).toBe('Nov 14');
    expect(shortDate(at(2026, 1, 1, 0, 0))).toBe('Jan 1');
    expect(shortDate(at(2026, 12, 31, 23, 59))).toBe('Dec 31');
  });
  it('is empty for a date that is not real', () => {
    expect(shortDate('soon')).toBe('');
    expect(shortDate(NaN)).toBe('');
  });
});

describe('clockTime', () => {
  it('writes a 12-hour time', () => {
    expect(clockTime(at(2026, 11, 14, 21, 41))).toBe('9:41 PM');
    expect(clockTime(at(2026, 11, 14, 9, 5))).toBe('9:05 AM');
  });
  it('gets midnight and noon right', () => {
    expect(clockTime(at(2026, 11, 14, 0, 0))).toBe('12:00 AM');
    expect(clockTime(at(2026, 11, 14, 12, 30))).toBe('12:30 PM');
    expect(clockTime(at(2026, 11, 14, 11, 59))).toBe('11:59 AM');
  });
  it('is empty for a time that is not real', () => {
    expect(clockTime('later')).toBe('');
    expect(clockTime(undefined)).toBe('');
  });
});

describe('tapeTitle', () => {
  const kexp = { freq: 90.3, name: 'KEXP' };
  const when = at(2026, 11, 14, 21, 41);
  it('names a voice note by its date and time', () => {
    expect(tapeTitle('voice', kexp, when)).toBe('Nov 14, 9:41 PM');
  });
  it('names taped radio by station and date', () => {
    expect(tapeTitle('radio', kexp, when)).toBe('90.3 KEXP, Nov 14');
  });
  it('still names tapes without a date', () => {
    expect(tapeTitle('radio', kexp, 'never')).toBe('90.3 KEXP');
    expect(tapeTitle('voice', kexp, 'never')).toBe('Voice note');
  });
  it('treats radio with no station as a voice note', () => {
    expect(tapeTitle('radio', null, when)).toBe('Nov 14, 9:41 PM');
  });
});

describe('cleanTitle', () => {
  it('collapses and trims spaces', () => {
    expect(cleanTitle('  Late   Night\n Drive ')).toBe('Late Night Drive');
  });
  it('keeps at most TITLE_MAX characters, with no space left at the end', () => {
    expect(TITLE_MAX).toBe(60);
    expect(cleanTitle('a'.repeat(70))).toBe('a'.repeat(60));
    expect(cleanTitle(`${'a'.repeat(59)} b`)).toBe('a'.repeat(59));
  });
  it('nothing typed is an empty name', () => {
    expect(cleanTitle('   ')).toBe('');
    expect(cleanTitle(undefined)).toBe('');
    expect(cleanTitle(42)).toBe('42');
  });
});
