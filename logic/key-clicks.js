// Key clicks (HANDOFF "Depth pass"): pressing a key makes a short mechanical click, made on the phone (no sound
// files; the recipe is clack() in the mockup's Main.dc.html). Play and Record clunk, then latch; Stop, Rewind and
// Fast forward clunk; every other key ticks. audio/key-clicks.js plays them.

const LATCH = ['play', 'rec'];
const CLUNK = ['stop', 'rew', 'ff'];

// The click for a key: 'latch', 'clunk' or 'tick'. key: a transport key's data-key, or nothing for other keys.
export function clickFor(key) {
  if (LATCH.includes(key)) return 'latch';
  if (CLUNK.includes(key)) return 'clunk';
  return 'tick';
}

// How each kind sounds: a burst of noise through a band-pass filter (a clunk lower, longer and louder than a
// tick), a clunk with a short low thump under it; a latch is a clunk then a tick, LATCH_MS later.
export const LATCH_MS = 70;
export function clickRecipe(heavy) {
  return heavy
    ? { seconds: 0.03, fade: 3, band: 1700, q: 1.4, gain: 0.9, thump: { from: 150, to: 55, seconds: 0.06, gain: 0.55 } }
    : { seconds: 0.012, fade: 5, band: 3400, q: 1.4, gain: 0.45, thump: null };
}

// The noise burst: `length` samples fading out (faster with a higher `fade`). random() gives 0 to 1.
export function clickNoise(length, fade, random = Math.random) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = (random() * 2 - 1) * (1 - i / length) ** fade;
  return out;
}
