import { describe, it, expect } from 'vitest';
import { clickFor, clickRecipe, clickNoise, LATCH_MS } from '../../logic/key-clicks.js';

describe('clickFor', () => {
  it('Play and Record latch, Stop, Rewind and Fast forward clunk, the rest tick', () => {
    expect(clickFor('play')).toBe('latch');
    expect(clickFor('rec')).toBe('latch');
    expect(['stop', 'rew', 'ff'].map(clickFor)).toEqual(['clunk', 'clunk', 'clunk']);
    expect(clickFor(undefined)).toBe('tick');
    expect(clickFor('preset')).toBe('tick');
  });
});

describe('clickRecipe', () => {
  it('a clunk is lower, longer and louder than a tick, with a thump under it', () => {
    const clunk = clickRecipe(true);
    const tick = clickRecipe(false);
    expect(clunk.band).toBeLessThan(tick.band);
    expect(clunk.seconds).toBeGreaterThan(tick.seconds);
    expect(clunk.gain).toBeGreaterThan(tick.gain);
    expect(clunk.thump).toEqual({ from: 150, to: 55, seconds: 0.06, gain: 0.55 });
    expect(tick.thump).toBeNull();
    expect(LATCH_MS).toBe(70);
  });
});

describe('clickNoise', () => {
  it('starts at full strength and fades to nothing', () => {
    const loud = clickNoise(4, 1, () => 1);
    expect(Array.from(loud)).toEqual([1, 0.75, 0.5, 0.25]);
    const fast = clickNoise(4, 3, () => 0);
    expect(fast[0]).toBe(-1);
    expect(fast[2]).toBeCloseTo(-0.125);
  });
  it('is random noise by default', () => {
    const n = clickNoise(64, 5);
    expect(n).toHaveLength(64);
    expect(n.every((v) => v >= -1 && v <= 1)).toBe(true);
  });
});
