import { describe, it, expect, vi, afterEach } from 'vitest';
import { whereAmI, placeOfZip, stationsNear } from '../../data/find-local.js';

const answer = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const geo = (result) => ({
  getCurrentPosition: vi.fn((ok, fail, options) => (result.coords ? ok(result) : fail(result))),
});

afterEach(() => vi.unstubAllGlobals());

describe('whereAmI', () => {
  it('gives the phone’s location to about 10 km, asking for no more accuracy than that', async () => {
    const g = geo({ coords: { latitude: 40.71277, longitude: -74.00597 } });
    await expect(whereAmI(g)).resolves.toEqual({ lat: 40.7, lon: -74, label: '' });
    expect(g.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, maximumAge: 600000, timeout: 15000 });
  });
  it('says Denied when location is off for the app, Unavailable otherwise', async () => {
    await expect(whereAmI(geo({ code: 1 }))).rejects.toMatchObject({ name: 'Denied' });
    await expect(whereAmI(geo({ code: 3 }))).rejects.toMatchObject({ name: 'Unavailable' });
    await expect(whereAmI(geo(null ?? {}))).rejects.toMatchObject({ name: 'Unavailable' });
    await expect(whereAmI(geo({ coords: { latitude: 'x', longitude: 0 } }))).rejects.toMatchObject({ name: 'Unavailable' });
    await expect(whereAmI(null)).rejects.toMatchObject({ name: 'Unavailable' });
  });
  it('uses the phone’s own location by default', async () => {
    vi.stubGlobal('navigator', { geolocation: geo({ coords: { latitude: 1, longitude: 2 } }) });
    await expect(whereAmI()).resolves.toEqual({ lat: 1, lon: 2, label: '' });
  });
});

describe('placeOfZip', () => {
  const place = { places: [{ 'place name': 'Beverly Hills', longitude: '-118.4065', latitude: '34.0901', 'state abbreviation': 'CA' }] };
  it('looks the ZIP code up', async () => {
    const fetcher = vi.fn(async () => answer(200, place));
    await expect(placeOfZip('90210', fetcher)).resolves.toEqual({ lat: 34.1, lon: -118.4, label: 'Beverly Hills CA' });
    expect(fetcher).toHaveBeenCalledWith('https://api.zippopotam.us/us/90210');
  });
  it('says NotFound for a code that isn’t one, one that doesn’t exist, or an answer with no place', async () => {
    const fetcher = vi.fn(async () => answer(404, {}));
    await expect(placeOfZip('9021', fetcher)).rejects.toMatchObject({ name: 'NotFound' });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(placeOfZip('00000', fetcher)).rejects.toMatchObject({ name: 'NotFound' });
    await expect(placeOfZip('00000', async () => answer(200, {}))).rejects.toMatchObject({ name: 'NotFound' });
  });
  it('passes on a failed connection, and a server error, as something else', async () => {
    await expect(placeOfZip('90210', async () => { throw new TypeError('offline'); })).rejects.toMatchObject({ name: 'TypeError' });
    await expect(placeOfZip('90210', async () => answer(500, {}))).rejects.toMatchObject({ name: 'NetworkError' });
  });
  it('uses the browser’s fetch by default', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, place)));
    await expect(placeOfZip('90210')).resolves.toMatchObject({ label: 'Beverly Hills CA' });
  });
});

describe('stationsNear', () => {
  const kiss = { name: '101.5 Kiss FM', tags: '', state: 'New York', codec: 'MP3', url_resolved: 'https://s.test/kiss', clickcount: 3, geo_distance: 5000 };
  it('asks Radio Browser and gives FM2’s dial', async () => {
    const fetcher = vi.fn(async () => answer(200, [kiss]));
    await expect(stationsNear({ lat: 40.7, lon: -74 }, fetcher)).resolves.toEqual([
      { freq: 101.5, name: '101.5 Kiss FM', place: 'New York', url: 'https://s.test/kiss', clicks: 3 },
    ]);
    expect(fetcher.mock.calls[0][0]).toMatch(/^https:\/\/all\.api\.radio-browser\.info\/json\/stations\/search\?geo_lat=40\.7&geo_long=-74&/);
  });
  it('says NoStations when none near there name a frequency', async () => {
    await expect(stationsNear({ lat: 0, lon: 0 }, async () => answer(200, []))).rejects.toMatchObject({ name: 'NoStations' });
  });
  it('uses the browser’s fetch by default', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(200, [kiss])));
    await expect(stationsNear({ lat: 40.7, lon: -74 })).resolves.toHaveLength(1);
  });
});
