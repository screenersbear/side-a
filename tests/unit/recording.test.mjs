import { describe, it, expect } from 'vitest';
import { RECORD_TYPES, pickRecordType, MIN_SECONDS, worthKeeping, tapeSeconds, recordError, radioError, NOT_ALLOWED } from '../../logic/recording.js';

describe('pickRecordType', () => {
  it('prefers MP4, which plays on iPhones too', () => {
    expect(RECORD_TYPES[0]).toBe('audio/mp4');
    expect(pickRecordType(() => true)).toBe('audio/mp4');
  });
  it('falls back to WebM in order', () => {
    expect(pickRecordType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecordType((t) => t === 'audio/webm')).toBe('audio/webm');
  });
  it('lets the browser choose when nothing fits', () => {
    expect(pickRecordType(() => false)).toBe('');
  });
  it('counts only a plain yes, and survives a checker that breaks', () => {
    expect(pickRecordType(() => 'yes')).toBe('');
    expect(pickRecordType((t) => {
      if (t === 'audio/mp4') throw new Error('no');
      return true;
    })).toBe('audio/webm;codecs=opus');
  });
  it('lets the browser choose without a checker', () => {
    expect(pickRecordType(undefined)).toBe('');
    expect(pickRecordType('audio/mp4')).toBe('');
  });
});

describe('worthKeeping', () => {
  it('keeps a recording with sound that lasted long enough', () => {
    expect(worthKeeping({ size: 100 }, 2)).toBe(true);
    expect(worthKeeping({ size: 1 }, MIN_SECONDS)).toBe(true);
  });
  it('drops very short recordings', () => {
    expect(MIN_SECONDS).toBe(0.5);
    expect(worthKeeping({ size: 100 }, 0.49)).toBe(false);
    expect(worthKeeping({ size: 100 }, 0)).toBe(false);
  });
  it('drops empty or missing recordings', () => {
    expect(worthKeeping({ size: 0 }, 5)).toBe(false);
    expect(worthKeeping(null, 5)).toBe(false);
    expect(worthKeeping({ size: 10 }, 'long')).toBe(false);
  });
});

describe('tapeSeconds', () => {
  it('rounds to whole seconds', () => {
    expect(tapeSeconds(9.4)).toBe(9);
    expect(tapeSeconds(9.5)).toBe(10);
    expect(tapeSeconds(1860)).toBe(1860);
  });
  it('is at least one second', () => {
    expect(tapeSeconds(0.4)).toBe(1);
    expect(tapeSeconds(0)).toBe(1);
    expect(tapeSeconds(-3)).toBe(1);
  });
  it('reads nonsense as one second', () => {
    expect(tapeSeconds(NaN)).toBe(1);
    expect(tapeSeconds(Infinity)).toBe(1);
    expect(tapeSeconds(undefined)).toBe(1);
  });
});

describe('recordError', () => {
  const err = (name) => ({ name });
  it('explains mic problems in plain words', () => {
    expect(recordError(err('NotAllowedError'), 'mic')).toBe('Mic is off. Allow it for SIDE A in Settings.');
    expect(recordError(err('SecurityError'), 'mic')).toBe('Mic is off. Allow it for SIDE A in Settings.');
    expect(recordError(err('NotFoundError'), 'mic')).toBe('No mic found.');
    expect(recordError(err('OverconstrainedError'), 'mic')).toBe('No mic found.');
    expect(recordError(err('NotReadableError'), 'mic')).toBe('The mic is busy in another app.');
  });
  it('has a fallback for anything else', () => {
    expect(recordError(err('NotSupportedError'), 'mic')).toBe("This browser can't record.");
    expect(recordError(null, 'mic')).toBe("This browser can't record.");
  });
  it('says recording is not allowed when the station blocks its stream', () => {
    expect(NOT_ALLOWED).toBe("Recording isn't allowed on this station.");
    expect(recordError(err('TypeError'), 'line')).toBe(NOT_ALLOWED);
  });
  it('says the station could not be reached for other taping problems', () => {
    expect(recordError(err('NetworkError'), 'line')).toBe("Couldn't reach the station.");
    expect(recordError(null, 'line')).toBe("Couldn't reach the station.");
  });
  it('says nothing when taping the radio was stopped on purpose', () => {
    expect(recordError(err('AbortError'), 'line')).toBe('');
  });
});

describe('radioError', () => {
  it('asks for a tap when the phone blocked sound', () => {
    expect(radioError('NotAllowedError')).toBe('Press play to start the radio.');
  });
  it('blames the signal otherwise', () => {
    expect(radioError('')).toBe('No signal. Check the internet.');
    expect(radioError(undefined)).toBe('No signal. Check the internet.');
    expect(radioError('NotSupportedError')).toBe('No signal. Check the internet.');
  });
});
