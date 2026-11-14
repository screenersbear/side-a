// A finished mixtape as a WAV file: 16-bit sound that plays on every phone. channels: one Float32Array per
// channel, all the same length. Returns the file's bytes.
export function encodeWav(channels, sampleRate) {
  const count = channels.length;
  const frames = count ? channels[0].length : 0;
  const size = frames * count * 2;
  const bytes = new Uint8Array(44 + size);
  const view = new DataView(bytes.buffer);
  const text = (at, word) => [...word].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));

  text(0, 'RIFF');
  view.setUint32(4, 36 + size, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, size, true);

  let at = 44;
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < count; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][f] || 0));
      view.setInt16(at, v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff), true);
      at += 2;
    }
  }
  return bytes;
}
