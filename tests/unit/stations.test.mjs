import { describe, it, expect } from 'vitest';
import { STATIONS, DIAL_LOW, DIAL_HIGH, DIAL_TICKS, dialPercent, stepStation, freqText, isStation } from '../../logic/stations.js';

describe('STATIONS', () => {
  it('has four presets, each with a dial spot, a name, a place and a secure stream', () => {
    expect(STATIONS).toHaveLength(4);
    for (const s of STATIONS) {
      expect(s.freq).toBeGreaterThanOrEqual(DIAL_LOW);
      expect(s.freq).toBeLessThanOrEqual(DIAL_HIGH);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.place.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https:\/\//);
    }
  });
  it('runs left to right on the dial', () => {
    const freqs = STATIONS.map((s) => s.freq);
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b));
  });
  it('has a dial from 88 to 108 with a tick every 4', () => {
    expect([DIAL_LOW, DIAL_HIGH]).toEqual([88, 108]);
    expect(DIAL_TICKS).toEqual([88, 92, 96, 100, 104, 108]);
  });
});

describe('dialPercent', () => {
  it('puts the ends of the dial at 0 and 100', () => {
    expect(dialPercent(88)).toBe(0);
    expect(dialPercent(108)).toBe(100);
  });
  it('puts a station in between at its share of the way', () => {
    expect(dialPercent(98)).toBe(50);
    expect(dialPercent(90.3)).toBeCloseTo(11.5, 5);
    expect(dialPercent('103')).toBe(75);
  });
  it('keeps frequencies off the dial on it', () => {
    expect(dialPercent(80)).toBe(0);
    expect(dialPercent(120)).toBe(100);
  });
  it('reads nonsense as the left end', () => {
    expect(dialPercent(undefined)).toBe(0);
    expect(dialPercent('loud')).toBe(0);
    expect(dialPercent(Infinity)).toBe(0);
  });
});

describe('stepStation', () => {
  it('moves one along', () => {
    expect(stepStation(1, 1)).toBe(2);
    expect(stepStation(2, -1)).toBe(1);
  });
  it('goes round at both ends', () => {
    expect(stepStation(3, 1)).toBe(0);
    expect(stepStation(0, -1)).toBe(3);
    expect(stepStation(0, -5, 4)).toBe(3);
    expect(stepStation(2, 9, 4)).toBe(3);
  });
  it('uses the count it is given', () => {
    expect(stepStation(1, 1, 2)).toBe(0);
    expect(stepStation(0, 0, 1)).toBe(0);
  });
  it('treats bad input as no move from the first station', () => {
    expect(stepStation(1.5, 1)).toBe(1);
    expect(stepStation(2, 0.5)).toBe(2);
    expect(stepStation(2, 1, 0)).toBe(0);
    expect(stepStation(2, 1, -3)).toBe(0);
    expect(stepStation(2, 1, 2.5)).toBe(0);
  });
});

describe('freqText', () => {
  it('writes one decimal place', () => {
    expect(freqText(88.3)).toBe('88.3');
    expect(freqText(100)).toBe('100.0');
    expect(freqText('98.94')).toBe('98.9');
  });
  it('is empty for nonsense', () => {
    expect(freqText(undefined)).toBe('');
    expect(freqText('fm')).toBe('');
    expect(freqText(NaN)).toBe('');
  });
});

describe('isStation', () => {
  it('knows the four presets', () => {
    expect([0, 1, 2, 3].map(isStation)).toEqual([true, true, true, true]);
  });
  it('rejects numbers past either end', () => {
    expect(isStation(-1)).toBe(false);
    expect(isStation(4)).toBe(false);
  });
  it('rejects things that are not whole numbers', () => {
    expect(isStation(1.5)).toBe(false);
    expect(isStation('1')).toBe(false);
    expect(isStation(undefined)).toBe(false);
  });
});
