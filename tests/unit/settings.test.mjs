import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings, saveSettings, loadLook, saveLook, loadPresets, savePresets, loadLocalPresets, saveLocalPresets, loadClicks, saveClicks,
} from '../../data/settings.js';

function memory() {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

describe('saveSettings', () => {
  it('keeps only the station frequency and the record source', () => {
    const store = memory();
    expect(saveSettings({ freq: 90.3, source: 'line', playing: true }, store)).toBe(true);
    expect(JSON.parse(store.data['side-a.settings'])).toEqual({ freq: 90.3, source: 'line' });
  });
  it('says so when storage is full or blocked', () => {
    const full = { setItem: () => { throw new Error('quota'); } };
    expect(saveSettings({ freq: 89.3, source: 'mic' }, full)).toBe(false);
  });
  it('says so when there is no storage', () => {
    expect(saveSettings({ freq: 89.3, source: 'mic' }, null)).toBe(false);
  });
});

describe('loadSettings', () => {
  it('reads back what was saved', () => {
    const store = memory();
    saveSettings({ freq: 98.9, source: 'line' }, store);
    expect(loadSettings(store)).toEqual({ freq: 98.9, source: 'line' });
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

describe('the look', () => {
  it('reads back the look picked', () => {
    const store = memory();
    expect(saveLook('sport', store)).toBe(true);
    expect(store.data['side-a.look']).toBe('sport');
    expect(loadLook(store)).toBe('sport');
  });
  it('is kept apart from the station, so saving one never loses the other', () => {
    const store = memory();
    saveLook('deck', store);
    saveSettings({ freq: 90.3, source: 'mic' }, store);
    expect(loadLook(store)).toBe('deck');
    expect(loadSettings(store)).toEqual({ freq: 90.3, source: 'mic' });
  });
  it('is none the first time, without storage, or when storage is blocked', () => {
    expect(loadLook(memory())).toBe('');
    expect(loadLook(null)).toBe('');
    expect(loadLook({ getItem: () => { throw new Error('blocked'); } })).toBe('');
  });
  it('says so when it cannot be saved', () => {
    expect(saveLook('deck', { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(saveLook('deck', null)).toBe(false);
  });
});

describe('the presets', () => {
  it('reads back the four frequencies saved', () => {
    const store = memory();
    expect(savePresets([88.3, 91.1, 90.3, 98.9], store)).toBe(true);
    expect(store.data['side-a.presets']).toBe('[88.3,91.1,90.3,98.9]');
    expect(loadPresets(store)).toEqual([88.3, 91.1, 90.3, 98.9]);
  });
  it('are kept apart from the station and the look', () => {
    const store = memory();
    savePresets([91.1, 89.3, 90.3, 98.9], store);
    saveSettings({ freq: 90.3, source: 'mic' }, store);
    saveLook('deck', store);
    expect(loadPresets(store)).toEqual([91.1, 89.3, 90.3, 98.9]);
    expect(loadSettings(store)).toEqual({ freq: 90.3, source: 'mic' });
  });
  it('are none the first time, when what was saved is not a list, without storage, or when it is blocked', () => {
    expect(loadPresets(memory())).toBeNull();
    const store = memory();
    store.setItem('side-a.presets', '{"1":88.3}');
    expect(loadPresets(store)).toBeNull();
    store.setItem('side-a.presets', 'not json');
    expect(loadPresets(store)).toBeNull();
    expect(loadPresets(null)).toBeNull();
    expect(loadPresets({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
  it('says so when they cannot be saved', () => {
    expect(savePresets([88.3], { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(savePresets([88.3], null)).toBe(false);
  });
});

describe('the bands', () => {
  it('keep the band and each band\u2019s last station', () => {
    const store = memory();
    saveSettings({ band: 'local', freq: 90.3, localFreq: 101.5, source: 'mic', presets: [1], playing: true }, store);
    expect(loadSettings(store)).toEqual({ band: 'local', freq: 90.3, localFreq: 101.5, source: 'mic' });
  });
  it('keep FM2\u2019s presets apart from FM1\u2019s', () => {
    const store = memory();
    savePresets([88.3, 89.3, 90.3, 98.9], store);
    expect(saveLocalPresets([90.7, 93.9, 97.1, 101.5], store)).toBe(true);
    expect(store.data['side-a.local-presets']).toBe('[90.7,93.9,97.1,101.5]');
    expect(loadLocalPresets(store)).toEqual([90.7, 93.9, 97.1, 101.5]);
    expect(loadPresets(store)).toEqual([88.3, 89.3, 90.3, 98.9]);
    expect(loadLocalPresets(memory())).toBeNull();
    expect(saveLocalPresets([1], null)).toBe(false);
  });
});

describe('key clicks', () => {
  it('are on until turned off, and remember it', () => {
    const store = memory();
    expect(loadClicks(store)).toBe(true);
    expect(saveClicks(false, store)).toBe(true);
    expect(store.data['side-a.clicks']).toBe('off');
    expect(loadClicks(store)).toBe(false);
    saveClicks(true, store);
    expect(loadClicks(store)).toBe(true);
  });
  it('stay on without storage, or when it is blocked', () => {
    expect(loadClicks(null)).toBe(true);
    expect(loadClicks({ getItem: () => { throw new Error('blocked'); } })).toBe(true);
  });
  it('says so when the choice cannot be saved', () => {
    expect(saveClicks(true, { setItem: () => { throw new Error('quota'); } })).toBe(false);
  });
});

describe('the browser storage default', () => {
  beforeEach(() => localStorage.clear());
  it('uses localStorage when none is given', () => {
    expect(saveSettings({ freq: 89.3, source: 'mic' })).toBe(true);
    expect(loadSettings()).toEqual({ freq: 89.3, source: 'mic' });
    expect(saveLocalPresets([90.7])).toBe(true);
    expect(loadLocalPresets()).toEqual([90.7]);
    expect(saveLook('boombox')).toBe(true);
    expect(loadLook()).toBe('boombox');
    expect(savePresets([91.1, 89.3, 90.3, 98.9])).toBe(true);
    expect(loadPresets()).toEqual([91.1, 89.3, 90.3, 98.9]);
  });
});
