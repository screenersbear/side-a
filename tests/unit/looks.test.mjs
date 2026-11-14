import { describe, it, expect } from 'vitest';
import { LOOKS, lookFor } from '../../logic/looks.js';

describe('LOOKS', () => {
  it('has the four looks, Pocket first', () => {
    expect(LOOKS.map((l) => l.id)).toEqual(['pocket', 'deck', 'sport', 'boombox']);
    expect(LOOKS.map((l) => l.name)).toEqual(['Pocket', 'Deck', 'Sport', 'Boombox']);
  });
  it('gives each look its body colour, a line about it, and a full set of cassette colours', () => {
    for (const look of LOOKS) {
      expect(look.body).toMatch(/^#[0-9A-F]{6}$/);
      expect(look.about.length).toBeGreaterThan(0);
      expect(Object.keys(look.cassette).sort()).toEqual(['band', 'hub', 'ink', 'label', 'pack', 'shell', 'win']);
    }
  });
  it('only the Deck look has the wide band', () => {
    expect(LOOKS.filter((l) => l.bandBig).map((l) => l.id)).toEqual(['deck']);
  });
  it('matches the mockup colours', () => {
    expect(lookFor('sport')).toMatchObject({ body: '#FFD100', cassette: { shell: '#3A434B', band: '#3DDC4A' } });
    expect(lookFor('boombox')).toMatchObject({ body: '#FFAFAB', cassette: { label: '#0A4FD6', ink: '#FAFAF7' } });
  });
});

describe('lookFor', () => {
  it('finds a look by id', () => {
    expect(lookFor('deck').name).toBe('Deck');
    expect(lookFor('boombox').name).toBe('Boombox');
  });
  it('is Pocket for anything unknown', () => {
    expect(lookFor('').id).toBe('pocket');
    expect(lookFor('disco').id).toBe('pocket');
    expect(lookFor(undefined).id).toBe('pocket');
  });
});
