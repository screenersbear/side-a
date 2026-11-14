// Plays the key clicks (recipe in logic/key-clicks.js) through Web Audio of their own, never through the radio or
// a tape. The sound starts on the first key press (phones only allow it after a tap) and rests between presses.
import { clickRecipe, clickNoise, LATCH_MS } from '../logic/key-clicks.js';

const REST_MS = 3000;

export function createKeyClicks() {
  let ctx = null;
  let rest = 0;

  function sound(heavy) {
    const r = clickRecipe(heavy);
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * r.seconds), ctx.sampleRate);
    buffer.getChannelData(0).set(clickNoise(buffer.length, r.fade));
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = r.band;
    band.Q.value = r.q;
    const gain = ctx.createGain();
    gain.gain.value = r.gain;
    noise.connect(band).connect(gain).connect(ctx.destination);
    noise.start(t);
    if (r.thump) {
      const low = ctx.createOscillator();
      const lowGain = ctx.createGain();
      low.frequency.setValueAtTime(r.thump.from, t);
      low.frequency.exponentialRampToValueAtTime(r.thump.to, t + r.thump.seconds * 0.8);
      lowGain.gain.setValueAtTime(r.thump.gain, t);
      lowGain.gain.exponentialRampToValueAtTime(0.001, t + r.thump.seconds);
      low.connect(lowGain).connect(ctx.destination);
      low.start(t);
      low.stop(t + r.thump.seconds + 0.01);
    }
  }

  // kind: 'latch', 'clunk' or 'tick'.
  function play(kind) {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume();
      sound(kind !== 'tick');
      if (kind === 'latch') setTimeout(() => sound(false), LATCH_MS);
      // Once the keys go quiet, let go of the sound, so the phone isn't kept busy for nothing.
      clearTimeout(rest);
      rest = setTimeout(() => ctx.state === 'running' && ctx.suspend(), REST_MS);
    } catch {
      // No sound to be had: the key still works.
    }
  }

  return { play };
}
