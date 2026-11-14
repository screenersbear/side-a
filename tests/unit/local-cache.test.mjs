import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocal, saveLocal } from '../../data/local-stations.js';
import { LOCAL } from './local-fixtures.mjs';

function memory() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

describe('FM2’s stations on the phone', () => {
  it('read back with the name of where they are from, and nothing more of the place', () => {
    const store = memory();
    expect(saveLocal({ where: { lat: 34.1, lon: -118.4, label: 'Beverly Hills CA' }, stations: LOCAL }, store)).toBe(true);
    expect(JSON.parse(store.data['side-a.local']).where).toEqual({ label: 'Beverly Hills CA' });
    expect(loadLocal(store)).toEqual({ where: { label: 'Beverly Hills CA' }, stations: LOCAL });
  });
  it('have no name for the phone’s location, or a broken one', () => {
    const store = memory();
    saveLocal({ where: { label: '' }, stations: LOCAL }, store);
    expect(loadLocal(store).where).toEqual({ label: '' });
    store.setItem('side-a.local', JSON.stringify({ where: { label: 7 }, stations: LOCAL }));
    expect(loadLocal(store).where).toEqual({ label: '' });
    store.setItem('side-a.local', JSON.stringify({ stations: LOCAL }));
    expect(loadLocal(store).where).toEqual({ label: '' });
  });
  it('are none the first time, when what was kept no longer makes sense, or without storage', () => {
    expect(loadLocal(memory())).toBeNull();
    const store = memory();
    store.setItem('side-a.local', JSON.stringify({ where: { label: 'x' }, stations: [{ freq: 'x' }] }));
    expect(loadLocal(store)).toBeNull();
    store.setItem('side-a.local', 'not json');
    expect(loadLocal(store)).toBeNull();
    expect(loadLocal(null)).toBeNull();
  });
  it('say so when they cannot be kept', () => {
    expect(saveLocal({ where: { label: '' }, stations: LOCAL }, { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(saveLocal({ where: { label: '' }, stations: LOCAL }, null)).toBe(false);
  });
  describe('in the browser’s storage by default', () => {
    beforeEach(() => localStorage.clear());
    it('uses localStorage when none is given', () => {
      expect(saveLocal({ where: { label: 'NYC' }, stations: LOCAL })).toBe(true);
      expect(loadLocal()).toEqual({ where: { label: 'NYC' }, stations: LOCAL });
    });
  });
});
