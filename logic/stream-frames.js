// A station's stream, read frame by frame: MP3 (MPEG audio, layer III) and AAC (ADTS), the formats stations send.
// Each frame is a short slice of sound of known length, so the app knows which bytes were playing at any moment:
// a radio tape is cut from the very bytes the listener heard (audio/radio-feed.js), never from a second connection.

const MP3_KBPS = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG-2 and 2.5
};
const MP3_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const AAC_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

export const MIME = { mp3: 'audio/mpeg', aac: 'audio/aac' };

// An MP3 frame header at i: 11 sync bits, then version, layer III, bitrate, sample rate, padding, channels.
function mp3At(b, i) {
  const version = (b[i + 1] >> 3) & 3; // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5 (1 is reserved)
  const layer = (b[i + 1] >> 1) & 3; // 1: layer III
  const kbps = MP3_KBPS[version === 3 ? 1 : 2][b[i + 2] >> 4];
  const rates = MP3_RATES[version];
  if (!rates || layer !== 1 || !kbps) return null;
  const rate = rates[(b[i + 2] >> 2) & 3];
  if (!rate) return null;
  const pad = (b[i + 2] >> 1) & 1;
  const samples = version === 3 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * kbps * 1000) / rate) + pad;
  const channels = (b[i + 3] >> 6) === 3 ? 1 : 2;
  return { format: 'mp3', length, samples, rate, channels };
}

// An AAC (ADTS) frame header at i: 12 sync bits, layer 0, then the sample rate, channels and the frame's length.
function aacAt(b, i) {
  const rate = AAC_RATES[(b[i + 2] >> 2) & 15];
  const length = ((b[i + 3] & 3) << 11) | (b[i + 4] << 3) | (b[i + 5] >> 5);
  const headerLength = b[i + 1] & 1 ? 7 : 9;
  if (!rate || length <= headerLength) return null;
  const channels = ((b[i + 2] & 1) << 2) | (b[i + 3] >> 6) || 2;
  const samples = 1024 * ((b[i + 6] & 3) + 1);
  return { format: 'aac', length, samples, rate, channels };
}

// The frame starting at byte i, or null when there's no frame header there (or not enough bytes yet to tell).
export function frameAt(bytes, i = 0) {
  if (i < 0 || i + 7 > bytes.length || bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) return null;
  const isAac = (bytes[i + 1] & 0xf6) === 0xf0; // 12 sync bits and layer 0
  return isAac ? aacAt(bytes, i) : mp3At(bytes, i);
}

// Two frames in a row of the same kind: real sound, not stray bytes that happen to look like a header.
function solidAt(bytes, i) {
  const frame = frameAt(bytes, i);
  if (!frame) return null;
  const next = frameAt(bytes, i + frame.length);
  return next && next.format === frame.format ? frame : null;
}

// How many bytes an ID3 tag at the start takes (some streams open with one), or 0.
function id3Length(b) {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0;
  return 10 + ((b[6] & 0x7f) << 21) + ((b[7] & 0x7f) << 14) + ((b[8] & 0x7f) << 7) + (b[9] & 0x7f);
}

function join(a, b) {
  if (!a.length) return b;
  const both = new Uint8Array(a.length + b.length);
  both.set(a);
  both.set(b, a.length);
  return both;
}

// Reads the stream as it arrives. push(chunk) gives back every whole frame in it so far:
// { bytes, at (seconds into the stream), seconds, format, rate, channels }. Bytes between frames are skipped.
export function createFrameReader() {
  let rest = new Uint8Array(0);
  let started = false;
  let synced = false;
  let at = 0;

  return {
    push(chunk) {
      let b = join(rest, chunk);
      if (!started) {
        if (b.length < 10) {
          rest = b;
          return [];
        }
        started = true;
        const tag = id3Length(b);
        if (tag > b.length) {
          rest = b; // wait for the whole tag
          started = false;
          return [];
        }
        b = b.subarray(tag);
      }
      const frames = [];
      let i = 0;
      while (i + 7 <= b.length) {
        const frame = synced ? frameAt(b, i) : solidAt(b, i);
        if (!frame) {
          // Lost or not yet found: wait for more bytes if this could still be a frame, else move on one byte.
          if (!synced && frameAt(b, i) && i + frameAt(b, i).length + 7 > b.length) break;
          synced = false;
          i += 1;
          continue;
        }
        if (i + frame.length > b.length) break;
        synced = true;
        const seconds = frame.samples / frame.rate;
        frames.push({ bytes: b.slice(i, i + frame.length), at, seconds, format: frame.format, rate: frame.rate, channels: frame.channels });
        at += seconds;
        i += frame.length;
      }
      rest = b.slice(i);
      return frames;
    },
  };
}

// The frames heard from `from` to `to` (seconds into the stream): each frame that starts in that time.
export function framesBetween(frames, from, to) {
  return frames.filter((f) => f.at >= from && f.at < to);
}

const same = (a, b) => a.format === b.format && a.rate === b.rate && a.channels === b.channels;

// The frames in runs that share one format, sample rate and channel count. Ads can come at another sample rate,
// and a file that changes rate part way plays those parts at the wrong speed, so such a tape is made again at one
// rate (audio/radio-tape.js), each run decoded on its own.
export function soundRuns(frames) {
  const runs = [];
  for (const f of frames) {
    const run = runs[runs.length - 1];
    if (run && same(run[0], f)) run.push(f);
    else runs.push([f]);
  }
  return runs;
}

// Do all the frames share one format, sample rate and channel count?
export function oneSound(frames) {
  return soundRuns(frames).length <= 1;
}

// How long the frames last, in seconds.
export function lengthOf(frames) {
  return frames.reduce((sum, f) => sum + f.seconds, 0);
}
