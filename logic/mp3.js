// Turns decoded sound into an MP3, one slice at a time, so the screen keeps moving and the progress can be shown.
// The encoder (LAME, from vendor/lamejs.js) is passed in, so this file stays plain and testable.
import { MP3_KBPS } from './export.js';

// About one second of sound per slice (a whole number of MP3 frames of 1152 samples).
export const SLICE = 1152 * 38;

// Sound as the encoder wants it: -1..1 floats to 16-bit whole numbers.
export function toPcm16(floats) {
  const out = new Int16Array(floats.length);
  for (let i = 0; i < floats.length; i += 1) {
    const s = Math.max(-1, Math.min(1, floats[i]));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

// channels: one or two Float32Arrays of the same length. Encoder: LAME's Mp3Encoder.
// onProgress(fraction) after each slice; pause() between slices (waits while the app is hidden).
// Resolves to the MP3 file as a Blob.
export async function encodeMp3(channels, sampleRate, Encoder, { kbps = MP3_KBPS, onProgress = () => {}, pause = () => Promise.resolve() } = {}) {
  const stereo = channels.length > 1;
  const encoder = new Encoder(stereo ? 2 : 1, sampleRate, kbps);
  const [left, right] = channels;
  const parts = [];
  const keep = (bytes) => {
    if (bytes.length) parts.push(bytes);
  };
  for (let at = 0; at < left.length; at += SLICE) {
    const l = toPcm16(left.subarray(at, at + SLICE));
    keep(stereo ? encoder.encodeBuffer(l, toPcm16(right.subarray(at, at + SLICE))) : encoder.encodeBuffer(l));
    onProgress(Math.min(1, (at + SLICE) / left.length));
    await pause();
  }
  keep(encoder.flush());
  return new Blob(parts, { type: 'audio/mpeg' });
}
