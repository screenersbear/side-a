import { describe, it, expect } from 'vitest';
import { onDial, dialFreq, lockAt, stepDial, seekFrom, lockedOn, LOCK_MHZ } from '../../logic/dial.js';
import { STATIONS, stationAt } from '../../logic/stations.js';

const at = (f) => stationAt(f);
const LIST = [{ freq: 88.5 }, { freq: 90.1 }, { freq: 90.5 }, { freq: 107.9 }];

describe('onDial', () => {
  it('keeps a frequency on the dial, to one decimal place', () => {
    expect(onDial(99.96)).toBe(100);
    expect(onDial(87)).toBe(88);
    expect(onDial(120)).toBe(108);
    expect(onDial('nope')).toBe(88);
  });
});

describe('dialFreq', () => {
  it('is the frequency between stations, or the station\'s', () => {
    expect(dialFreq({ between: 100.4, station: 0 })).toBe(100.4);
    expect(dialFreq({ between: null, station: at(90.3) })).toBe(90.3);
    expect(dialFreq({ between: null, station: 1 }, LIST)).toBe(90.1);
  });
});

describe('lockAt', () => {
  it('locks onto the nearest station within 0.2 MHz', () => {
    expect(LOCK_MHZ).toBe(0.2);
    expect(lockAt(88.7, LIST)).toBe(0);
    expect(lockAt(88.8, LIST)).toBe(-1);
    expect(lockAt(90.4, LIST)).toBe(2);
    expect(lockAt(90.2, LIST)).toBe(1);
  });
  it('takes the lower station on a tie', () => {
    expect(lockAt(90.3, LIST)).toBe(1);
  });
  it('uses the dial by default', () => {
    expect(lockAt(100.4)).toBe(-1);
    expect(lockAt(99.8)).toBe(at(99.7));
  });
});

describe('stepDial', () => {
  it('moves on past the station it is locked to, so the keys never stick', () => {
    expect(stepDial(88.5, 0.1, LIST)).toBe(88.8);
    expect(stepDial(88.8, 0.1, LIST)).toBe(88.9);
    expect(stepDial(88.5, -0.1, LIST)).toBe(88.2);
    expect(stepDial(98.9, 0.1)).toBe(99.1);
  });
  it('stops at the ends of the dial', () => {
    expect(stepDial(107.9, 0.1, LIST)).toBe(108);
    expect(stepDial(88.1, -1, [{ freq: 88.1 }])).toBe(88);
  });
  it('Page Up and Down move a whole MHz', () => {
    expect(stepDial(95, 1, LIST)).toBe(96);
  });
});

describe('seekFrom', () => {
  it('Next finds the next station up the dial, going round at the top', () => {
    expect(seekFrom(89, 1, LIST)).toBe(1);
    expect(seekFrom(108, 1, LIST)).toBe(0);
  });
  it('Previous finds the next one down, going round at the bottom', () => {
    expect(seekFrom(95, -1, LIST)).toBe(2);
    expect(seekFrom(88, -1, LIST)).toBe(3);
  });
  it('uses the dial by default', () => {
    expect(STATIONS[seekFrom(100.4, 1)].freq).toBe(101.1);
  });
});

describe('lockedOn', () => {
  it('is true when the wheel comes onto a station, or onto a different one', () => {
    expect(lockedOn({ between: 100.4, station: 3 }, { between: null, station: 3 })).toBe(true);
    expect(lockedOn({ between: null, station: 3 }, { between: null, station: 4 })).toBe(true);
    expect(lockedOn({ between: null, station: 3 }, { between: null, station: 3 })).toBe(false);
    expect(lockedOn({ between: null, station: 3 }, { between: 100.4, station: 3 })).toBe(false);
  });
});
