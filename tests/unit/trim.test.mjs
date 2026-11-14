import { describe, it, expect } from 'vitest';
import { MIN_CLIP, BAR_COUNT, trimStep, startTrim, setEdge, moveEdge, nearestEdge, canAdd, trimText, peaks } from '../../logic/trim.js';

describe('startTrim', () => {
  it('selects the whole tape', () => {
    expect(startTrim(48.25)).toEqual({ start: 0, end: 48.25, duration: 48.25 });
  });
  it('reads nonsense as an empty tape', () => {
    expect(startTrim(-2)).toEqual({ start: 0, end: 0, duration: 0 });
    expect(startTrim('x')).toEqual({ start: 0, end: 0, duration: 0 });
  });
  it('clips are at least a second; the waveform has 72 bars', () => {
    expect(MIN_CLIP).toBe(1);
    expect(BAR_COUNT).toBe(72);
  });
});

describe('trimStep', () => {
  it('moves a second on short tapes, more on long ones', () => {
    expect(trimStep(30)).toBe(1);
    expect(trimStep(120)).toBe(1);
    expect(trimStep(121)).toBe(5);
    expect(trimStep(600)).toBe(5);
    expect(trimStep(601)).toBe(15);
  });
});

describe('setEdge', () => {
  const trim = startTrim(60);
  it('puts a handle at a time, in tenths of a second', () => {
    expect(setEdge(trim, 'start', 12.34)).toEqual({ start: 12.3, end: 60, duration: 60 });
    expect(setEdge(trim, 'end', 40.06)).toEqual({ start: 0, end: 40.1, duration: 60 });
  });
  it('keeps both handles on the tape', () => {
    expect(setEdge(trim, 'start', -4).start).toBe(0);
    expect(setEdge(trim, 'end', 75).end).toBe(60);
  });
  it('keeps the handles a second apart', () => {
    const part = { start: 10, end: 20, duration: 60 };
    expect(setEdge(part, 'start', 19.5).start).toBe(19);
    expect(setEdge(part, 'end', 10.2).end).toBe(11);
    expect(setEdge(part, 'start', 18.9).start).toBe(18.9);
    expect(setEdge(part, 'end', 11.1).end).toBe(11.1);
  });
  it('on a tape shorter than a second the handles stay at the ends', () => {
    const tiny = startTrim(0.6);
    expect(setEdge(tiny, 'start', 0.3).start).toBe(0);
    expect(setEdge(tiny, 'end', 0.2).end).toBe(0.6);
  });
  it('ignores nonsense', () => {
    expect(setEdge(trim, 'start', 'x')).toBe(trim);
    expect(setEdge(trim, 'end', Infinity)).toBe(trim);
  });
});

describe('moveEdge', () => {
  it('moves a handle by steps', () => {
    expect(moveEdge(startTrim(60), 'start', 3).start).toBe(3);
    expect(moveEdge(startTrim(60), 'end', -2).end).toBe(58);
    expect(moveEdge(startTrim(900), 'end', -1).end).toBe(885);
  });
});

describe('nearestEdge', () => {
  const part = { start: 10, end: 20, duration: 60 };
  it('picks the handle closer to a time', () => {
    expect(nearestEdge(part, 2)).toBe('start');
    expect(nearestEdge(part, 14)).toBe('start');
    expect(nearestEdge(part, 15)).toBe('start');
    expect(nearestEdge(part, 16)).toBe('end');
    expect(nearestEdge(part, 50)).toBe('end');
  });
});

describe('canAdd', () => {
  it('needs a part at least a second long', () => {
    expect(canAdd({ start: 0, end: 1, duration: 5 })).toBe(true);
    expect(canAdd({ start: 0, end: 0.9, duration: 0.9 })).toBe(false);
  });
});

describe('trimText', () => {
  it('says where the part is and how long', () => {
    expect(trimText({ start: 27, end: 82, duration: 134 })).toEqual({ range: '0:27 to 1:22', length: '0:55 long' });
  });
});

describe('peaks', () => {
  it('takes the loudest sample in each slice, scaled to the loudest', () => {
    expect(peaks([0.1, -0.2, 0.4, 0.1, -0.05, 0.05], 3)).toEqual([0.5, 1, 0.125]);
  });
  it('makes 72 bars by default', () => {
    expect(peaks(new Float32Array(720).fill(0.25))).toHaveLength(72);
    expect(peaks(new Float32Array(720).fill(0.25))[71]).toBe(1);
  });
  it('is flat for silence, no sound, or nonsense', () => {
    expect(peaks([0, 0, 0, 0], 2)).toEqual([0, 0]);
    expect(peaks([], 3)).toEqual([0, 0, 0]);
    expect(peaks(null, 2)).toEqual([0, 0]);
    expect(peaks([NaN, 0.5], 2)).toEqual([0, 1]);
  });
  it('spreads a short sound over the bars', () => {
    expect(peaks([0.5, 1], 4)).toEqual([0, 0.5, 0, 1]);
  });
});
