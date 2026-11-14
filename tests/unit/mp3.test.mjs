import { describe, it, expect } from 'vitest';
import { Mp3Encoder } from '@breezystack/lamejs';
import { SLICE, toPcm16, encodeMp3 } from '../../logic/mp3.js';

// A stand-in encoder that notes what it was given.
function fakeEncoder() {
  const calls = [];
  class Fake {
    constructor(channels, rate, kbps) {
      calls.push(['new', channels, rate, kbps]);
    }
    encodeBuffer(left, right) {
      calls.push(['slice', left.length, right ? right.length : null, left[0], right ? right[0] : null]);
      return new Int8Array(left.length ? 3 : 0);
    }
    flush() {
      calls.push(['flush']);
      return new Int8Array(2);
    }
  }
  return { Fake, calls };
}

describe('toPcm16', () => {
  it('turns -1..1 into 16-bit whole numbers, clipping anything louder', () => {
    expect(Array.from(toPcm16(Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -2])))).toEqual([0, 32767, -32768, 16384, -16384, 32767, -32768]);
  });
  it('gives an Int16Array the same length', () => {
    const out = toPcm16(new Float32Array(5));
    expect(out).toBeInstanceOf(Int16Array);
    expect(out.length).toBe(5);
  });
});

describe('encodeMp3', () => {
  it('slices are whole MP3 frames, about a second long', () => {
    expect(SLICE % 1152).toBe(0);
    expect(SLICE).toBe(43776);
  });

  it('stereo: both channels, a slice at a time, then the end of the file', async () => {
    const { Fake, calls } = fakeEncoder();
    const left = new Float32Array(SLICE + 10).fill(0.5);
    const right = new Float32Array(SLICE + 10).fill(-0.5);
    const progress = [];
    let pauses = 0;
    const blob = await encodeMp3([left, right], 44100, Fake, {
      onProgress: (f) => progress.push(f),
      pause: async () => { pauses += 1; },
    });
    expect(calls).toEqual([
      ['new', 2, 44100, 192],
      ['slice', SLICE, SLICE, 16384, -16384],
      ['slice', 10, 10, 16384, -16384],
      ['flush'],
    ]);
    expect(progress).toEqual([SLICE / (SLICE + 10), 1]);
    expect(pauses).toBe(2);
    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBe(3 + 3 + 2);
  });

  it('mono: one channel, at the bitrate asked for', async () => {
    const { Fake, calls } = fakeEncoder();
    await encodeMp3([new Float32Array(4).fill(1)], 48000, Fake, { kbps: 128 });
    expect(calls).toEqual([['new', 1, 48000, 128], ['slice', 4, null, 32767, null], ['flush']]);
  });

  it('no sound is just the end of the file', async () => {
    const { Fake, calls } = fakeEncoder();
    const blob = await encodeMp3([new Float32Array(0)], 44100, Fake);
    expect(calls).toEqual([['new', 1, 44100, 192], ['flush']]);
    expect(blob.size).toBe(2);
  });

  it('leaves out empty pieces', async () => {
    class Quiet {
      encodeBuffer() { return new Int8Array(0); }
      flush() { return new Int8Array(0); }
    }
    const blob = await encodeMp3([new Float32Array(3)], 44100, Quiet);
    expect(blob.size).toBe(0);
  });

  it('with the real encoder (LAME), makes an MP3 a phone can play', async () => {
    const rate = 44100;
    const tone = Float32Array.from({ length: rate }, (_, i) => 0.3 * Math.sin((i / rate) * 2 * Math.PI * 440));
    const blob = await encodeMp3([tone, tone], rate, Mp3Encoder);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // An MPEG-1 Layer III frame starts 0xFF 0xFB; one second at 192 kbps is about 24 KB.
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfb]);
    expect(bytes.length).toBeGreaterThan(20_000);
    expect(bytes.length).toBeLessThan(30_000);
  });
});
