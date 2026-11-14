import { describe, it, expect } from 'vitest';
import { MIME, frameAt, createFrameReader, framesBetween, soundRuns, oneSound, lengthOf } from '../../logic/stream-frames.js';

// An MP3 frame: MPEG-1 layer III by default (128 kbps, 44.1 kHz, stereo, 417 bytes), filled with `fill`.
function mp3({ version = 3, kbpsIndex = 9, rateIndex = 0, pad = 0, mono = false, fill = 0 } = {}) {
  const header = [0xff, 0xe0 | (version << 3) | (1 << 1) | 1, (kbpsIndex << 4) | (rateIndex << 2) | (pad << 1), mono ? 0xc0 : 0];
  const info = frameAt(Uint8Array.from([...header, 0, 0, 0]));
  const bytes = new Uint8Array(info.length).fill(fill);
  bytes.set(header);
  return bytes;
}

// An AAC (ADTS) frame: 44.1 kHz, stereo, `length` bytes, no CRC (7-byte header) unless crc.
function aac({ length = 200, rateIndex = 4, channels = 2, crc = false, blocks = 0 } = {}) {
  const bytes = new Uint8Array(length);
  bytes.set([
    0xff, crc ? 0xf0 : 0xf1, (1 << 6) | (rateIndex << 2) | (channels >> 2), ((channels & 3) << 6) | (length >> 11),
    (length >> 3) & 0xff, ((length & 7) << 5) | 0x1f, 0xfc | blocks,
  ]);
  return bytes;
}

const join = (...parts) => {
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    all.set(p, i);
    i += p.length;
  }
  return all;
};

describe('frameAt', () => {
  it('reads an MP3 frame: MPEG-1 layer III', () => {
    expect(frameAt(mp3())).toEqual({ format: 'mp3', length: 417, samples: 1152, rate: 44100, channels: 2 });
    expect(frameAt(mp3({ pad: 1, mono: true }))).toEqual({ format: 'mp3', length: 418, samples: 1152, rate: 44100, channels: 1 });
    expect(frameAt(mp3({ kbpsIndex: 14, rateIndex: 1 }))).toMatchObject({ length: 960, rate: 48000 });
    expect(frameAt(mp3({ rateIndex: 2 }))).toMatchObject({ rate: 32000, length: 576 });
  });
  it('reads MPEG-2 and 2.5 frames, half as long', () => {
    expect(frameAt(mp3({ version: 2, kbpsIndex: 8 }))).toEqual({ format: 'mp3', length: 208, samples: 576, rate: 22050, channels: 2 });
    expect(frameAt(mp3({ version: 0, kbpsIndex: 4, rateIndex: 2 }))).toEqual({ format: 'mp3', length: 288, samples: 576, rate: 8000, channels: 2 });
  });
  it('reads an AAC frame, with or without its CRC, and its blocks', () => {
    expect(frameAt(aac())).toEqual({ format: 'aac', length: 200, samples: 1024, rate: 44100, channels: 2 });
    expect(frameAt(aac({ crc: true, rateIndex: 3, channels: 1, blocks: 1 }))).toEqual({ format: 'aac', length: 200, samples: 2048, rate: 48000, channels: 1 });
    expect(frameAt(aac({ channels: 0 })).channels).toBe(2);
    expect(frameAt(aac({ channels: 6 })).channels).toBe(6);
  });
  it('a frame can start part way in', () => {
    expect(frameAt(join(new Uint8Array(3), mp3()), 3)).toMatchObject({ length: 417 });
  });
  it('no frame: no sync, too few bytes, or a header that can\'t be', () => {
    expect(frameAt(new Uint8Array(10))).toBeNull();
    expect(frameAt(Uint8Array.from([0xff, 0xfb, 0x90]))).toBeNull();
    expect(frameAt(mp3(), -1)).toBeNull();
    expect(frameAt(Uint8Array.from([0xff, 0x0b, 0x90, 0, 0, 0, 0]))).toBeNull(); // not enough sync bits
    expect(frameAt(Uint8Array.from([0xff, 0xeb, 0x90, 0, 0, 0, 0]))).toBeNull(); // reserved version
    expect(frameAt(Uint8Array.from([0xff, 0xfd, 0x90, 0, 0, 0, 0]))).toBeNull(); // layer II
    expect(frameAt(Uint8Array.from([0xff, 0xfb, 0x00, 0, 0, 0, 0]))).toBeNull(); // free bitrate
    expect(frameAt(Uint8Array.from([0xff, 0xfb, 0xf0, 0, 0, 0, 0]))).toBeNull(); // bad bitrate
    expect(frameAt(Uint8Array.from([0xff, 0xfb, 0x9c, 0, 0, 0, 0]))).toBeNull(); // reserved sample rate
    expect(frameAt(aac({ rateIndex: 15 }))).toBeNull();
    expect(frameAt(aac({ length: 7 }))).toBeNull();
    expect(frameAt(aac({ length: 8, crc: true }))).toBeNull();
  });
});

describe('MIME', () => {
  it('names each format the way the browser wants it', () => {
    expect(MIME).toEqual({ mp3: 'audio/mpeg', aac: 'audio/aac' });
  });
});

describe('createFrameReader', () => {
  it('gives back each whole frame with its time in the stream', () => {
    const reader = createFrameReader();
    const frames = reader.push(join(mp3({ fill: 1 }), mp3({ fill: 2 }), mp3({ fill: 3 })));
    expect(frames.map((f) => f.bytes[100])).toEqual([1, 2, 3]);
    expect(frames[0]).toMatchObject({ at: 0, format: 'mp3', rate: 44100, channels: 2 });
    expect(frames[0].seconds).toBeCloseTo(1152 / 44100);
    expect(frames[1].at).toBeCloseTo(1152 / 44100);
    expect(frames[0].bytes).toHaveLength(417);
  });
  it('carries part of a frame over to the next piece of the stream', () => {
    const reader = createFrameReader();
    const stream = join(mp3({ fill: 1 }), mp3({ fill: 2 }), mp3({ fill: 3 }), mp3({ fill: 4 }));
    const got = [...reader.push(stream.subarray(0, 600)), ...reader.push(stream.subarray(600, 1000)), ...reader.push(stream.subarray(1000))];
    expect(got.map((f) => f.bytes[100])).toEqual([1, 2, 3, 4]);
    expect(got[3].at).toBeCloseTo((3 * 1152) / 44100);
  });
  it('before it has locked on, a first frame waits until the next one shows it is sound', () => {
    const reader = createFrameReader();
    const stream = join(mp3({ fill: 1 }), mp3({ fill: 2 }));
    expect(reader.push(stream.subarray(0, 420))).toEqual([]);
    expect(reader.push(stream.subarray(420)).map((f) => f.bytes[100])).toEqual([1, 2]);
  });
  it('waits for the first ten bytes before it starts', () => {
    const reader = createFrameReader();
    const stream = join(mp3({ fill: 1 }), mp3({ fill: 2 }), mp3({ fill: 3 }));
    expect(reader.push(stream.subarray(0, 5))).toEqual([]);
    expect(reader.push(stream.subarray(5)).map((f) => f.bytes[100])).toEqual([1, 2, 3]);
  });
  it('skips stray bytes before the first frame, and bytes that only look like a header', () => {
    const fake = Uint8Array.from([0xff, 0xfb, 0x90, 0, 9, 9, 9, 9, 9, 9, 9, 9]); // a header with no frame after it
    const reader = createFrameReader();
    const frames = reader.push(join(Uint8Array.from([1, 2, 3]), fake, mp3({ fill: 1 }), mp3({ fill: 2 }), mp3({ fill: 3 })));
    expect(frames.map((f) => f.bytes[100])).toEqual([1, 2, 3]);
  });
  it('finds the sound again after damage in the middle', () => {
    const reader = createFrameReader();
    const frames = reader.push(join(mp3({ fill: 1 }), mp3({ fill: 2 }), Uint8Array.from([5, 5, 5, 5, 5]), mp3({ fill: 3 }), mp3({ fill: 4 }), mp3({ fill: 5 })));
    expect(frames.map((f) => f.bytes[100])).toEqual([1, 2, 3, 4, 5]);
  });
  it('skips an ID3 tag at the start, waiting for all of it', () => {
    const tag = new Uint8Array(30);
    tag.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20]);
    const stream = join(tag, mp3({ fill: 1 }), mp3({ fill: 2 }), mp3({ fill: 3 }));
    const reader = createFrameReader();
    expect(reader.push(stream.subarray(0, 12))).toEqual([]);
    expect(reader.push(stream.subarray(12)).map((f) => f.bytes[100])).toEqual([1, 2, 3]);
  });
  it('reads AAC streams too', () => {
    const reader = createFrameReader();
    const frames = reader.push(join(aac(), aac(), aac()));
    expect(frames).toHaveLength(3);
    expect(frames[1]).toMatchObject({ format: 'aac', rate: 44100 });
    expect(frames[1].at).toBeCloseTo(1024 / 44100);
  });
  it('keeps reading when the sample rate changes (an ad at another rate)', () => {
    const reader = createFrameReader();
    const frames = reader.push(join(mp3({ fill: 1 }), mp3({ rateIndex: 1, fill: 2 }), mp3({ rateIndex: 1, fill: 3 })));
    expect(frames.map((f) => f.rate)).toEqual([44100, 48000, 48000]);
  });
});

describe('framesBetween, oneSound and lengthOf', () => {
  const at = (t, extra = {}) => ({ at: t, seconds: 0.5, format: 'mp3', rate: 44100, channels: 2, ...extra });
  const frames = [at(0), at(0.5), at(1), at(1.5)];
  it('the frames heard between two moments: each one that starts in that time', () => {
    expect(framesBetween(frames, 0.5, 1.5).map((f) => f.at)).toEqual([0.5, 1]);
    expect(framesBetween(frames, 0.4, 0.6).map((f) => f.at)).toEqual([0.5]);
    expect(framesBetween(frames, 2, 3)).toEqual([]);
  });
  it('one sound: the same format, rate and channels all through', () => {
    expect(oneSound(frames)).toBe(true);
    expect(oneSound([])).toBe(true);
    expect(oneSound([at(0), at(1, { rate: 48000 })])).toBe(false);
    expect(oneSound([at(0), at(1, { channels: 1 })])).toBe(false);
    expect(oneSound([at(0), at(1, { format: 'aac' })])).toBe(false);
  });
  it('runs of one sound: a new run wherever the format, rate or channels change', () => {
    const ad = [at(1, { rate: 48000 }), at(1.5, { rate: 48000 })];
    const runs = soundRuns([at(0), at(0.5), ...ad, at(2)]);
    expect(runs.map((r) => r.map((f) => f.at))).toEqual([[0, 0.5], [1, 1.5], [2]]);
    expect(soundRuns([at(0), at(0.5, { channels: 1 })])).toHaveLength(2);
    expect(soundRuns([])).toEqual([]);
  });
  it('how long they last', () => {
    expect(lengthOf(frames)).toBe(2);
    expect(lengthOf([])).toBe(0);
  });
});
