import { describe, it, expect } from 'vitest';
import {
  SILENT_PEAK, CHECK_MAX_BYTES, SILENT_TEXT, NOT_SAVED_TEXT, peakOf, canMeasure, verdict, checkText, dbText,
} from '../../logic/sound-check.js';

describe('peakOf', () => {
  it('finds the loudest sample across every channel, up or down', () => {
    expect(peakOf([Float32Array.from([0, 0.1, -0.25]), Float32Array.from([0.2, -0.05])])).toBe(0.25);
    expect(peakOf([Float32Array.from([0.5]), Float32Array.from([-0.75])])).toBe(0.75);
  });
  it('is 0 for silence, no channels or nothing', () => {
    expect(peakOf([new Float32Array(10)])).toBe(0);
    expect(peakOf([])).toBe(0);
    expect(peakOf()).toBe(0);
  });
});

describe('canMeasure', () => {
  it('decodes files up to the limit, and not empty ones', () => {
    expect(canMeasure(1)).toBe(true);
    expect(canMeasure(CHECK_MAX_BYTES)).toBe(true);
    expect(canMeasure(CHECK_MAX_BYTES + 1)).toBe(false);
    expect(canMeasure(0)).toBe(false);
    expect(canMeasure(undefined)).toBe(false);
  });
});

describe('verdict', () => {
  it('a file stored whole with sound in it is fine', () => {
    expect(verdict({ bytes: 100, stored: 100, peak: 0.3 })).toBe('sound');
    expect(verdict({ bytes: 100, stored: 100, peak: SILENT_PEAK })).toBe('sound');
  });
  it('quieter than about -80 dB all the way through is silent', () => {
    expect(verdict({ bytes: 100, stored: 100, peak: 0 })).toBe('silent');
    expect(verdict({ bytes: 100, stored: 100, peak: SILENT_PEAK / 2 })).toBe('silent');
  });
  it('nothing stored, or less than was recorded, is not saved (whatever the level)', () => {
    expect(verdict({ bytes: 100, stored: 0, peak: 0.3 })).toBe('not-saved');
    expect(verdict({ bytes: 100, stored: 60, peak: 0.3 })).toBe('not-saved');
    expect(verdict({ bytes: 100, stored: undefined, peak: 0.3 })).toBe('not-saved');
    expect(verdict({ bytes: 100, stored: null, peak: 0 })).toBe('not-saved');
  });
  it('a level that couldn\'t be read is unknown', () => {
    expect(verdict({ bytes: 100, stored: 100, peak: null })).toBe('unknown');
    expect(verdict({ bytes: 100, stored: 100, peak: NaN })).toBe('unknown');
    expect(verdict({ bytes: 100, stored: 100 })).toBe('unknown');
  });
});

describe('checkText', () => {
  it('says when a recording came out silent or didn\'t save, and nothing otherwise', () => {
    expect(checkText('silent')).toBe(SILENT_TEXT);
    expect(SILENT_TEXT).toBe('This recording came out silent.');
    expect(checkText('not-saved')).toBe(NOT_SAVED_TEXT);
    expect(NOT_SAVED_TEXT).toBe("This recording didn't save properly.");
    expect(checkText('sound')).toBe('');
    expect(checkText('unknown')).toBe('');
  });
});

describe('dbText', () => {
  it('gives the level in decibels', () => {
    expect(dbText(1)).toBe('0.0 dB');
    expect(dbText(0.5)).toBe('-6.0 dB');
    expect(dbText(0.0001)).toBe('-80.0 dB');
  });
  it('says silence for all zeros or below -120 dB, and ? when the level wasn\'t read', () => {
    expect(dbText(0)).toBe('silence');
    expect(dbText(1e-30)).toBe('silence');
    expect(dbText(0.000001)).toBe('-120.0 dB');
    expect(dbText(null)).toBe('?');
    expect(dbText(NaN)).toBe('?');
    expect(dbText(-1)).toBe('?');
  });
});
