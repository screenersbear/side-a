import { describe, it, expect } from 'vitest';
import { screenFor, hashFor } from '../../logic/routes.js';

describe('screenFor', () => {
  it('opens the shelf for #/shelf', () => {
    expect(screenFor('#/shelf')).toBe('shelf');
    expect(screenFor('#shelf')).toBe('shelf');
    expect(screenFor('#/SHELF')).toBe('shelf');
    expect(screenFor('#/shelf/voice')).toBe('shelf');
    expect(screenFor('#/shelf?x=1')).toBe('shelf');
  });
  it('opens the deck for an empty address', () => {
    expect(screenFor('')).toBe('deck');
    expect(screenFor('#/')).toBe('deck');
    expect(screenFor(undefined)).toBe('deck');
  });
  it('opens the deck for anything unknown', () => {
    expect(screenFor('#/settings')).toBe('deck');
    expect(screenFor('#/shelves')).toBe('deck');
    expect(screenFor('#/x/shelf')).toBe('deck');
  });
});

describe('hashFor', () => {
  it('gives each screen its address', () => {
    expect(hashFor('shelf')).toBe('#/shelf');
    expect(hashFor('deck')).toBe('#/');
  });
  it('sends anything else to the deck', () => {
    expect(hashFor('radio')).toBe('#/');
    expect(hashFor()).toBe('#/');
  });
  it('round-trips with screenFor', () => {
    expect(screenFor(hashFor('shelf'))).toBe('shelf');
    expect(screenFor(hashFor('deck'))).toBe('deck');
  });
});
