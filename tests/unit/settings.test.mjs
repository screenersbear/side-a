import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings } from '../../data/settings.js';

function memory() {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

describe('saveSettings', () => {
  it('keeps only the station and the record source', () => {
    const store = memory();
    expect(saveSettings({ station: 2, source: 'line', playing: true }, store)).toBe(true);
    expect(JSON.parse(store.data['side-a.settings'])).toEqual({ station: 2, source: 'line' });
  });
  it('says so when storage is full or blocked', () => {
    const full = { setItem: () => { throw new Error('quota'); } };
    expect(saveSettings({ station: 1, source: 'mic' }, full)).toBe(false);
  });
  it('says so when there is no storage', () => {
    expect(saveSettings({ station: 1, source: 'mic' }, null)).toBe(false);
  });
});

describe('loadSettings', () => {
  it('reads back what was saved', () => {
    const store = memory();
    saveSettings({ station: 3, source: 'line' }, store);
    expect(loadSettings(store)).toEqual({ station: 3, source: 'line' });
  });
  it('is empty the first time', () => {
    expect(loadSettings(memory())).toEqual({});
    expect(loadSettings(null)).toEqual({});
  });
  it('is empty when what was saved is broken', () => {
    const store = memory();
    store.data['side-a.settings'] = '{oops';
    expect(loadSettings(store)).toEqual({});
    store.data['side-a.settings'] = '[1,2]';
    expect(loadSettings(store)).toEqual({});
    store.data['side-a.settings'] = '7';
    expect(loadSettings(store)).toEqual({});
    store.data['side-a.settings'] = 'null';
    expect(loadSettings(store)).toEqual({});
  });
  it('is empty when storage is blocked', () => {
    expect(loadSettings({ getItem: () => { throw new Error('blocked'); } })).toEqual({});
  });
});

describe('the browser storage default', () => {
  beforeEach(() => localStorage.clear());
  it('uses localStorage when none is given', () => {
    expect(saveSettings({ station: 1, source: 'mic' })).toBe(true);
    expect(loadSettings()).toEqual({ station: 1, source: 'mic' });
  });
});
