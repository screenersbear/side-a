import { describe, it, expect } from 'vitest';
import { JOIN_W, MIN_W, layoutTimeline, timeToX, xToTime, rulerLabels } from '../../logic/mix-layout.js';

describe('layoutTimeline', () => {
  it('joins and the thinnest clip are 56 px', () => {
    expect(JOIN_W).toBe(56);
    expect(MIN_W).toBe(56);
  });
  it('shares the room by length, with a join between each two clips', () => {
    const layout = layoutTimeline([10, 30], 456);
    expect(layout).toEqual({ clips: [{ left: 0, width: 100 }, { left: 156, width: 300 }], width: 456 });
  });
  it('gives a short clip the thinnest width and shares the rest', () => {
    const layout = layoutTimeline([1, 100, 99], 512);
    expect(layout.clips[0]).toEqual({ left: 0, width: 56 });
    expect(layout.clips[1].left).toBe(112);
    expect(layout.clips[1].width).toBeCloseTo(172.86, 1);
    expect(layout.clips[2].width).toBeCloseTo(171.14, 1);
    expect(layout.width).toBe(512);
  });
  it('grows past the screen when the clips cannot fit (the row then scrolls)', () => {
    const layout = layoutTimeline([5, 5, 5], 100);
    expect(layout.clips.map((c) => c.width)).toEqual([56, 56, 56]);
    expect(layout.width).toBe(56 * 3 + 56 * 2);
  });
  it('a single clip fills the row', () => {
    expect(layoutTimeline([42], 300)).toEqual({ clips: [{ left: 0, width: 300 }], width: 300 });
  });
  it('an empty mix has no clips', () => {
    expect(layoutTimeline([], 300)).toEqual({ clips: [], width: 300 });
  });
  it('clips with no length still get the thinnest width', () => {
    expect(layoutTimeline([0, 0], 300)).toEqual({ clips: [{ left: 0, width: 56 }, { left: 112, width: 56 }], width: 300 });
  });
});

describe('timeToX and xToTime', () => {
  const seconds = [10, 30];
  const layout = layoutTimeline(seconds, 456);
  it('places a time inside its clip', () => {
    expect(timeToX(layout, seconds, 0)).toBe(0);
    expect(timeToX(layout, seconds, 5)).toBe(50);
    expect(timeToX(layout, seconds, 10)).toBe(156);
    expect(timeToX(layout, seconds, 25)).toBe(306);
  });
  it('puts the end, and anything past it, at the right end', () => {
    expect(timeToX(layout, seconds, 40)).toBe(456);
    expect(timeToX(layout, seconds, 99)).toBe(456);
    expect(timeToX(layout, seconds, -5)).toBe(0);
  });
  it('is 0 without clips', () => {
    expect(timeToX(layoutTimeline([], 300), [], 5)).toBe(0);
  });
  it('reads an x back as a time', () => {
    expect(xToTime(layout, seconds, 50)).toBe(5);
    expect(xToTime(layout, seconds, 100)).toBe(10);
    expect(xToTime(layout, seconds, 306)).toBe(25);
    expect(xToTime(layout, seconds, 456)).toBe(40);
  });
  it('a join reads as the start of the next clip; outside the row, the ends', () => {
    expect(xToTime(layout, seconds, 120)).toBe(10);
    expect(xToTime(layout, seconds, -8)).toBe(0);
    expect(xToTime(layout, seconds, 600)).toBe(40);
    expect(xToTime(layoutTimeline([], 300), [], 40)).toBe(0);
  });
  it('round-trips', () => {
    for (const t of [0, 3.5, 9.9, 10, 17, 39.5]) expect(xToTime(layout, seconds, timeToX(layout, seconds, t))).toBeCloseTo(t, 6);
  });
});

describe('rulerLabels', () => {
  const seconds = [10, 30];
  const layout = layoutTimeline(seconds, 456);
  it('places each time and leaves out one too close to the last', () => {
    expect(rulerLabels(layout, seconds, [0, 2, 5, 10, 40])).toEqual([
      { x: 0, t: 0 }, { x: 50, t: 5 }, { x: 156, t: 10 }, { x: 456, t: 40 },
    ]);
  });
  it('takes another gap', () => {
    expect(rulerLabels(layout, seconds, [0, 2], 20)).toEqual([{ x: 0, t: 0 }, { x: 20, t: 2 }]);
    expect(rulerLabels(layout, seconds, [0, 2], 21)).toEqual([{ x: 0, t: 0 }]);
  });
});
