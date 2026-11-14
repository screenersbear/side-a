import { describe, it, expect } from 'vitest';
import { overflows, tickerTiming, HOLD_SECONDS, PX_PER_SECOND } from '../../logic/ticker.js';

describe('overflows', () => {
  it('is true only when the title is wider than its line', () => {
    expect(overflows(300, 200)).toBe(true);
    expect(overflows(200, 200)).toBe(false);
    expect(overflows(201, 200)).toBe(false);
    expect(overflows(150, 200)).toBe(false);
  });
  it('is false for a line not laid out yet', () => {
    expect(overflows(300, 0)).toBe(false);
  });
});

describe('tickerTiming', () => {
  it('holds 2 s, then glides at 25 px a second', () => {
    expect(HOLD_SECONDS).toBe(2);
    expect(PX_PER_SECOND).toBe(25);
    // 200 px at 25 px/s is 8 s of glide after a 2 s hold.
    expect(tickerTiming(200)).toEqual({ duration: 10000, holdUntil: 0.2 });
  });
  it('takes other speeds and holds', () => {
    expect(tickerTiming(100, { hold: 1, speed: 50 })).toEqual({ duration: 3000, holdUntil: 1 / 3 });
  });
  it('a title with no width only holds', () => {
    expect(tickerTiming(-5)).toEqual({ duration: 2000, holdUntil: 1 });
    expect(tickerTiming(0, { hold: 0 })).toEqual({ duration: 0, holdUntil: 1 });
  });
});
