import { describe, it, expect } from 'vitest';
import {
  STATIONS, PRESET_FREQS, DIAL_LOW, DIAL_HIGH, DIAL_TICKS,
  dialPercent, stepStation, freqText, isStation, stationAt, presetStation, cleanPresets, canTape,
} from '../../logic/stations.js';
import { STATION_LIST } from '../../data/stations.js';
import { WORLD_LIST } from '../../data/world-stations.js';

describe('STATIONS', () => {
  it('has a station for most of the dial, each with a name and a secure stream', () => {
    expect(STATIONS.length).toBeGreaterThanOrEqual(60);
    for (const s of STATIONS) {
      expect(s.freq).toBeGreaterThanOrEqual(DIAL_LOW);
      expect(s.freq).toBeLessThanOrEqual(DIAL_HIGH);
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(typeof s.place).toBe('string');
      expect(s.url).toMatch(/^https:\/\//);
    }
  });
  it('runs low to high, one station per frequency, so Next always moves right', () => {
    const freqs = STATIONS.map((s) => s.freq);
    for (let i = 1; i < freqs.length; i++) expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
  });
  it('puts US stations on real US FM channels (odd tenths)', () => {
    for (const s of STATION_LIST) expect(Math.round(s.freq * 10) % 2).toBe(1);
  });
  it('puts world stations at their home frequency, or 0.1 MHz up where a US station has it', () => {
    expect(WORLD_LIST.length).toBeGreaterThanOrEqual(10);
    for (const s of WORLD_LIST) {
      const home = s.home ?? s.freq;
      expect(Math.round((s.freq - home) * 10)).toBe(s.home === undefined ? 0 : 1);
      expect(s.place).toMatch(/\S+ \S+/);
      if (s.home !== undefined) expect(STATION_LIST.some((us) => Math.abs(us.freq - s.home) < 0.05) || WORLD_LIST.some((w) => w !== s && w.freq === s.home)).toBe(true);
    }
  });
  it('has FIP, Radio Nova and triple j, as in the mockup', () => {
    expect(['FIP', 'Radio Nova', 'triple j'].map((n) => STATIONS.find((s) => s.name === n).place)).toEqual(['Paris France', 'Paris France', 'Sydney Australia']);
  });
  it('reaches from the bottom of the dial to the top', () => {
    expect(STATIONS[0].freq).toBeLessThan(89);
    expect(STATIONS[STATIONS.length - 1].freq).toBeGreaterThan(107);
  });
  it('sorts the list without changing the data file', () => {
    expect(STATIONS).not.toBe(STATION_LIST);
    expect(STATIONS).toHaveLength(STATION_LIST.length + WORLD_LIST.length);
  });
  it('sorts a list given out of order', () => {
    const byFreq = [...WORLD_LIST, ...STATION_LIST].reverse().sort((a, b) => a.freq - b.freq);
    expect(byFreq.map((s) => s.freq)).toEqual(STATIONS.map((s) => s.freq));
  });
  it('has a dial from 88 to 108 with a tick every 4', () => {
    expect([DIAL_LOW, DIAL_HIGH]).toEqual([88, 108]);
    expect(DIAL_TICKS).toEqual([88, 92, 96, 100, 104, 108]);
  });
});

describe('presets', () => {
  it('are four stations that are on the dial', () => {
    expect(PRESET_FREQS).toEqual([88.3, 89.3, 90.3, 98.9]);
    for (let key = 0; key < 4; key++) expect(isStation(presetStation(key))).toBe(true);
  });
  it('tune to WBGO, The Current, KEXP and KUTX', () => {
    expect([0, 1, 2, 3].map((k) => STATIONS[presetStation(k)].name)).toEqual(['WBGO Jazz', 'The Current', 'KEXP', 'KUTX']);
  });
  it('presetStation ignores keys the deck does not have', () => {
    expect(presetStation(-1)).toBe(-1);
    expect(presetStation(4)).toBe(-1);
    expect(presetStation(1.5)).toBe(-1);
    expect(presetStation(undefined)).toBe(-1);
  });
  it('work from saved presets too', () => {
    const mine = [88.3, 91.1, 90.3, 98.9];
    expect(presetStation(1, mine)).toBe(stationAt(91.1));
    expect(presetStation(4, mine)).toBe(-1);
  });
});

describe('cleanPresets', () => {
  it('keeps four saved frequencies that are on the dial', () => {
    expect(cleanPresets([91.1, 89.3, 90.3, 98.9])).toEqual([91.1, 89.3, 90.3, 98.9]);
  });
  it('is the defaults when nothing was saved', () => {
    expect(cleanPresets(null)).toEqual(PRESET_FREQS);
    expect(cleanPresets(undefined)).toEqual(PRESET_FREQS);
    expect(cleanPresets('88.3')).toEqual(PRESET_FREQS);
    expect(cleanPresets([])).toEqual(PRESET_FREQS);
  });
  it('puts back the default on any key whose saved station is not on the dial', () => {
    expect(cleanPresets([91.1, 90.2, null, 'x'])).toEqual([91.1, 89.3, 90.3, 98.9]);
    expect(cleanPresets([91.1])).toEqual([91.1, 89.3, 90.3, 98.9]);
  });
  it('gives each the station\'s own frequency, and only four', () => {
    expect(cleanPresets(['91.1', 91.12, 90.3, 98.9, 100.1])).toEqual([91.1, 91.1, 90.3, 98.9]);
  });
});

describe('stationAt', () => {
  it('finds a station by its frequency', () => {
    expect(STATIONS[stationAt(90.3)].name).toBe('KEXP');
    expect(STATIONS[stationAt('91.1')].name).toBe('WFMU');
  });
  it('allows for rounding', () => {
    expect(stationAt(90.30000001)).toBe(stationAt(90.3));
    expect(stationAt(90.34)).toBe(stationAt(90.3));
  });
  it('is -1 where nothing is on the dial', () => {
    expect(stationAt(90.2)).toBe(-1);
    expect(stationAt(120)).toBe(-1);
    expect(stationAt(undefined)).toBe(-1);
  });
});

describe('canTape', () => {
  it('lets most stations be taped', () => {
    expect(canTape(STATIONS[stationAt(90.3)])).toBe(true);
    expect(canTape({ name: 'x' })).toBe(true);
  });
  it('knows WFMU does not allow it', () => {
    expect(canTape(STATIONS[stationAt(91.1)])).toBe(false);
    expect(STATIONS.filter((s) => !canTape(s)).map((s) => s.name)).toEqual(['WFMU']);
  });
  it('says no for no station', () => {
    expect(canTape(undefined)).toBe(false);
    expect(canTape(null)).toBe(false);
  });
});

describe('dialPercent', () => {
  it('puts the ends of the dial at 0 and 100', () => {
    expect(dialPercent(88)).toBe(0);
    expect(dialPercent(108)).toBe(100);
  });
  it('puts a station in between at its share of the way', () => {
    expect(dialPercent(98)).toBe(50);
    expect(dialPercent(90.3)).toBeCloseTo(11.5, 5);
    expect(dialPercent('103')).toBe(75);
  });
  it('keeps frequencies off the dial on it', () => {
    expect(dialPercent(80)).toBe(0);
    expect(dialPercent(120)).toBe(100);
  });
  it('reads nonsense as the left end', () => {
    expect(dialPercent(undefined)).toBe(0);
    expect(dialPercent('loud')).toBe(0);
    expect(dialPercent(Infinity)).toBe(0);
  });
});

describe('stepStation', () => {
  it('moves one along the whole dial', () => {
    expect(stepStation(1, 1)).toBe(2);
    expect(stepStation(2, -1)).toBe(1);
  });
  it('goes round at both ends of the dial', () => {
    expect(stepStation(STATIONS.length - 1, 1)).toBe(0);
    expect(stepStation(0, -1)).toBe(STATIONS.length - 1);
    expect(stepStation(0, -5, 4)).toBe(3);
    expect(stepStation(2, 9, 4)).toBe(3);
  });
  it('visits every station once on the way round', () => {
    const seen = new Set();
    let i = 0;
    for (let n = 0; n < STATIONS.length; n++) {
      seen.add(i);
      i = stepStation(i, 1);
    }
    expect(seen.size).toBe(STATIONS.length);
    expect(i).toBe(0);
  });
  it('treats bad input as no move from the first station', () => {
    expect(stepStation(1.5, 1)).toBe(1);
    expect(stepStation(2, 0.5)).toBe(2);
    expect(stepStation(2, 1, 0)).toBe(0);
    expect(stepStation(2, 1, -3)).toBe(0);
    expect(stepStation(2, 1, 2.5)).toBe(0);
  });
});

describe('freqText', () => {
  it('writes one decimal place', () => {
    expect(freqText(88.3)).toBe('88.3');
    expect(freqText(100)).toBe('100.0');
    expect(freqText('98.94')).toBe('98.9');
  });
  it('is empty for nonsense', () => {
    expect(freqText(undefined)).toBe('');
    expect(freqText('fm')).toBe('');
    expect(freqText(NaN)).toBe('');
  });
});

describe('isStation', () => {
  it('knows every station on the dial', () => {
    expect(isStation(0)).toBe(true);
    expect(isStation(STATIONS.length - 1)).toBe(true);
  });
  it('rejects numbers past either end', () => {
    expect(isStation(-1)).toBe(false);
    expect(isStation(STATIONS.length)).toBe(false);
  });
  it('rejects things that are not whole numbers', () => {
    expect(isStation(1.5)).toBe(false);
    expect(isStation('1')).toBe(false);
    expect(isStation(undefined)).toBe(false);
  });
});
