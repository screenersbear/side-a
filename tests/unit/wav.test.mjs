import { describe, it, expect } from 'vitest';
import { encodeWav } from '../../logic/wav.js';

const word = (bytes, at) => String.fromCharCode(...bytes.slice(at, at + 4));

describe('encodeWav', () => {
  const left = new Float32Array([0, 1, -1, 0.5]);
  const right = new Float32Array([0.25, -0.5, 2, -3]);
  const bytes = encodeWav([left, right], 44100);
  const view = new DataView(bytes.buffer);

  it('writes a 16-bit PCM WAV header', () => {
    expect(bytes).toHaveLength(44 + 4 * 2 * 2);
    expect(word(bytes, 0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 16);
    expect(word(bytes, 8)).toBe('WAVE');
    expect(word(bytes, 12)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(44100 * 4);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint16(34, true)).toBe(16);
    expect(word(bytes, 36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(16);
  });
  it('interleaves the channels, left then right, and keeps the sound inside full scale', () => {
    const samples = Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 8192, 32767, -16384, -32768, 32767, 16384, -32768]);
  });
  it('reads missing samples as silence', () => {
    const one = encodeWav([new Float32Array([NaN, 0.25])], 8000);
    const v = new DataView(one.buffer);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(28, true)).toBe(16000);
    expect(v.getUint16(32, true)).toBe(2);
    expect([v.getInt16(44, true), v.getInt16(46, true)]).toEqual([0, 8192]);
  });
  it('makes an empty file for no sound', () => {
    expect(encodeWav([], 44100)).toHaveLength(44);
  });
});
