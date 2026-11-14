import { describe, it, expect } from 'vitest';
import {
  LOCAL_INTRO, LOCAL_PREFIX, NEAR_KM, WIDE_KM, MOST, roundPlace, searchUrl, zipUrl, zipPlace, freqIn, townOf,
  localStations, localPresets, goodList, localError, LOCAL_ERRORS, OFFLINE,
} from '../../logic/local-stations.js';

// A station as Radio Browser lists it.
const rb = (name, extra = {}) => ({
  name, tags: '', state: 'New York', codec: 'MP3', url_resolved: `https://s.test/${encodeURIComponent(name)}`,
  clickcount: 5, geo_distance: 10000, ...extra,
});

describe('the words', () => {
  it('match the handoff', () => {
    expect(LOCAL_INTRO).toBe('Local stations near you, at their real frequencies.');
    expect(LOCAL_PREFIX).toBe('Local · ');
    expect([NEAR_KM, WIDE_KM, MOST]).toEqual([100, 200, 40]);
  });
});

describe('roundPlace', () => {
  it('keeps one decimal place, about 10 km', () => {
    expect(roundPlace(40.71277, -74.00597)).toEqual({ lat: 40.7, lon: -74 });
    expect(roundPlace('34.0901', '-118.4065')).toEqual({ lat: 34.1, lon: -118.4 });
    expect(roundPlace(-90, 180)).toEqual({ lat: -90, lon: 180 });
  });
  it('is null for a place that is not on Earth', () => {
    expect(roundPlace(91, 0)).toBeNull();
    expect(roundPlace(0, -181)).toBeNull();
    expect(roundPlace('x', 0)).toBeNull();
    expect(roundPlace(0, undefined)).toBeNull();
  });
});

describe('searchUrl', () => {
  it('asks Radio Browser for working https stations within 200 km, most listened to first', () => {
    const u = new URL(searchUrl({ lat: 40.7, lon: -74 }));
    expect(u.origin + u.pathname).toBe('https://all.api.radio-browser.info/json/stations/search');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      geo_lat: '40.7', geo_long: '-74', geo_distance: '200000', hidebroken: 'true', is_https: 'true',
      order: 'clickcount', reverse: 'true', limit: '500',
    });
  });
});

describe('zipUrl and zipPlace', () => {
  it('look up five-digit US ZIP codes only', () => {
    expect(zipUrl('90210')).toBe('https://api.zippopotam.us/us/90210');
    expect(zipUrl(' 10001 ')).toBe('https://api.zippopotam.us/us/10001');
    for (const bad of ['9021', '902100', 'abcde', '', null, undefined]) expect(zipUrl(bad)).toBe('');
  });
  it('read the place and its name from the answer', () => {
    const answer = { places: [{ 'place name': 'Beverly Hills', longitude: '-118.4065', latitude: '34.0901', 'state abbreviation': 'CA' }] };
    expect(zipPlace(answer)).toEqual({ lat: 34.1, lon: -118.4, label: 'Beverly Hills CA' });
    expect(zipPlace({ places: [{ longitude: '-74', latitude: '40.7' }] })).toEqual({ lat: 40.7, lon: -74, label: '' });
  });
  it('are null for an answer with no place', () => {
    expect(zipPlace(null)).toBeNull();
    expect(zipPlace({})).toBeNull();
    expect(zipPlace({ places: [] })).toBeNull();
    expect(zipPlace({ places: [{ latitude: 'x', longitude: '0' }] })).toBeNull();
  });
});

describe('freqIn', () => {
  it('finds an FM frequency in a name or tags', () => {
    expect(freqIn('101.5 Kiss FM')).toBe(101.5);
    expect(freqIn('WFUV 90,7')).toBe(90.7);
    expect(freqIn('KTU 103.5 The Beat')).toBe(103.5);
    expect(freqIn('jazz,88.1,public')).toBe(88.1);
    expect(freqIn('107.9')).toBe(107.9);
  });
  it('finds nothing off the FM dial, in longer numbers, or with no decimal', () => {
    for (const t of ['Hot 97', '87.9 FM', '108.1', '88.0', '1101.5', '101.55', '1.101.5', 'WALM', '', null, undefined]) expect(freqIn(t)).toBeNull();
  });
});

describe('townOf', () => {
  it('takes the town from Radio Browser’s state', () => {
    expect(townOf('Dover, NJ')).toBe('Dover');
    expect(townOf('New Jersey')).toBe('New Jersey');
    expect(townOf(' Brooklyn , New York')).toBe('Brooklyn');
    expect(townOf('')).toBe('');
    expect(townOf(undefined)).toBe('');
  });
});

describe('localStations', () => {
  it('puts each station that names its frequency on the dial, low to high', () => {
    const list = localStations([rb('101.5 Kiss FM', { state: 'New York City, New York', clickcount: 26 }), rb('WFUV', { tags: 'college,90.7', codec: 'AAC+' })]);
    expect(list).toEqual([
      { freq: 90.7, name: 'WFUV', place: 'New York', url: 'https://s.test/WFUV', clicks: 5 },
      { freq: 101.5, name: '101.5 Kiss FM', place: 'New York City', url: 'https://s.test/101.5%20Kiss%20FM', clicks: 26 },
    ]);
  });
  it('skips stations with no frequency, no https stream, a format the phone can’t play, or no name', () => {
    expect(localStations([
      rb('Hot 97'), rb('94.3 The Point', { url_resolved: 'http://s.test/x' }), rb('93.9 Opus', { codec: 'OGG' }),
      rb('92.1', { name: '   ' }), rb('', { name: undefined, tags: '96.3' }), rb('95.5 HLS', { codec: undefined }), rb('99.1 None', { url_resolved: undefined }), null,
    ])).toEqual([]);
  });
  it('keeps the most listened-to station on each frequency', () => {
    const list = localStations([rb('97.1 Low', { clickcount: 2 }), rb('97.1 High', { clickcount: 9 }), rb('97,1 Mid', { clickcount: 'x' })]);
    expect(list.map((s) => s.name)).toEqual(['97.1 High']);
  });
  it('keeps to 100 km, unless fewer than four stations are that close', () => {
    const near = ['88.1 A', '88.3 B', '88.5 C', '88.7 D'].map((n) => rb(n, { geo_distance: 100000 }));
    const far = rb('99.9 Far', { geo_distance: 150000 });
    expect(localStations([...near, far]).map((s) => s.name)).toEqual(['88.1 A', '88.3 B', '88.5 C', '88.7 D']);
    expect(localStations([...near.slice(1), far]).map((s) => s.name)).toEqual(['88.3 B', '88.5 C', '88.7 D', '99.9 Far']);
    expect(localStations([rb('99.9 Too far', { geo_distance: 200001 })])).toEqual([]);
  });
  it('shortens long names, and keeps to the 40 most listened to', () => {
    const long = localStations([rb(`101.1 ${'Very '.repeat(12)}Long  Name`)])[0].name;
    expect(long).toHaveLength(40);
    expect(long.endsWith('…')).toBe(true);
    const many = Array.from({ length: 60 }, (_, i) => rb(`${(88.1 + i * 0.2).toFixed(1)} S${i}`, { clickcount: i }));
    const list = localStations(many);
    expect(list).toHaveLength(MOST);
    expect(list[0].name).toBe('92.1 S20');
    expect(list.at(-1).name).toBe('99.9 S59');
  });
  it('is empty for an answer that is not a list', () => {
    expect(localStations(null)).toEqual([]);
    expect(localStations({})).toEqual([]);
  });
});

describe('localPresets', () => {
  const st = (freq, clicks) => ({ freq, clicks });
  it('are the four most listened-to stations, low to high', () => {
    expect(localPresets([st(88.1, 1), st(90.7, 9), st(93.9, 30), st(97.1, 15), st(101.5, 26)])).toEqual([90.7, 93.9, 97.1, 101.5]);
  });
  it('repeat when there are fewer than four, and are none for no stations', () => {
    expect(localPresets([st(90.7, 1), st(93.9, 2)])).toEqual([90.7, 93.9, 90.7, 93.9]);
    expect(localPresets([st(99.5, 0)])).toEqual([99.5, 99.5, 99.5, 99.5]);
    expect(localPresets([])).toEqual([]);
    expect(localPresets(null)).toEqual([]);
  });
});

describe('goodList', () => {
  const st = (freq, extra = {}) => ({ freq, name: 'N', url: 'https://s.test', ...extra });
  it('accepts a dial of named stations with streams, low to high', () => {
    expect(goodList([st(88.1), st(107.9)])).toBe(true);
    expect(goodList([st(88)])).toBe(true);
    expect(goodList([st(108)])).toBe(true);
  });
  it('turns down anything else', () => {
    for (const bad of [
      null, [], 'x', [null], [st(87.9)], [st(108.1)], [st('99.1')], [st(99.1, { url: 1 })], [st(99.1, { name: null })],
      [st(99.1), st(99.1)], [st(99.3), st(99.1)],
    ]) expect(goodList(bad)).toBe(false);
  });
});

describe('localError', () => {
  it('has words for each way finding stations can fail', () => {
    expect(localError({ name: 'NotFound' })).toBe("That ZIP code wasn't found. Check it and try again.");
    expect(localError({ name: 'NoStations' })).toBe('No stations near there name an FM frequency yet.');
    expect(localError({ name: 'Denied' })).toBe('Location is off for SIDE A. Type a ZIP code instead.');
    expect(localError({ name: 'Unavailable' })).toBe("The phone couldn't tell where it is. Type a ZIP code instead.");
    expect(Object.keys(LOCAL_ERRORS)).toHaveLength(4);
  });
  it('anything else is the connection', () => {
    expect(localError({ name: 'TypeError' })).toBe(OFFLINE);
    expect(localError(null)).toBe("Couldn't reach the station list. Check the connection and try again.");
  });
});
