// What the SIDE A browser tests share: stand-in stations (a quiet tone), a muted page with a test-signal mic,
// opening the deck, picking a look, and putting two tapes on the shelf. Each *.spec.mjs file imports these.
// The stations are a stand-in tone, the mic is a test signal and every test is muted, so no internet is needed.
import { expect } from '@playwright/test';
import { STATIONS } from '../../logic/stations.js';

// A few seconds of quiet tone as a WAV file, standing in for a station's stream.
function toneWav(seconds = 20, rate = 8000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) buf[44 + i] = 128 + Math.round(8 * Math.sin((i / rate) * 2 * Math.PI * 440));
  return buf;
}

// In the page: muted sound and a test-signal mic.
function fakeSources({ micError }) {
  // Tests stay silent (Starky's rule: mute while testing the radio).
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function mutedPlay() {
    this.muted = true;
    return play.call(this);
  };
  // And they stay muted (the radio unmutes the plain element that takes over after taping).
  const muted = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');
  Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    configurable: true,
    get() { return muted.get.call(this); },
    set() { muted.set.call(this, true); },
  });
  // Web Audio too (the mix plays through it): every live context's speakers go through a silent gain.
  if (window.BaseAudioContext) {
    const speakers = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination');
    Object.defineProperty(BaseAudioContext.prototype, 'destination', {
      configurable: true,
      get() {
        const real = speakers.get.call(this);
        if (window.OfflineAudioContext && this instanceof OfflineAudioContext) return real;
        if (!this.quiet) {
          this.quiet = this.createGain();
          this.quiet.gain.value = 0;
          this.quiet.connect(real);
        }
        return this.quiet;
      },
    });
  }
  if (micError) {
    // WebKit on GitHub's Linux machines has no mic or recorder at all, so the app would stop at "This browser
    // can't record." Stand in for both, so the test reaches the mic refusing (what an iPhone does).
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    if (!('MediaRecorder' in window)) window.MediaRecorder = class { static isTypeSupported() { return false; } };
  }
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async () => {
    if (micError) throw new DOMException('no', micError);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const out = ctx.createMediaStreamDestination();
    osc.connect(out);
    osc.start();
    await ctx.resume();
    return out.stream;
  };
}

// In the page: the station named in blocked plays but won't share its sound, like a real station without CORS.
// Asked to share (crossOrigin), it fails to load; asked the plain way, it plays. This is staged in the page
// because Playwright's stand-in answers skip the browser's CORS check.
function blockStation(blocked) {
  const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return src.get.call(this); },
    set(value) { src.set.call(this, value === blocked && this.crossOrigin ? 'data:audio/wav;base64,' : value); },
  });
}

// Every station plays a tone (with a CORS header, so it shares its sound and can be taped).
export async function openDeck(page, { micError = '', blocked = '' } = {}) {
  const wav = toneWav();
  const headers = { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' };
  for (const s of STATIONS) {
    await page.route(s.url, (route) => route.fulfill({ status: 200, body: wav, headers }));
  }
  await page.addInitScript(fakeSources, { micError });
  if (blocked) await page.addInitScript(blockStation, blocked);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
}

export const status = (page) => page.locator('.status');
export const line = (page) => page.locator('.line');
export const key = (page, name) => page.getByRole('button', { name, exact: true });

export const card = (page, look) => page.getByRole('button', { name: new RegExp(`^${look}`, 'i') });
export const movingPart = (page) => page.locator('.deck .on.levels, .deck .bay.on, .deck .on.meters, .deck .on.eq-row, .deck .on.speaker');

export async function pickLook(page, look) {
  await page.getByRole('link', { name: 'Settings ›' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await card(page, look).click();
  await expect(card(page, look)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Deck', exact: true }).click();
  await expect(page.locator(`.look-${look.toLowerCase()}`)).toBeVisible();
}

// Two tapes on the shelf (quiet tones as WAV files), made in the page with the app's own code.
export async function addTapes(page) {
  await page.evaluate(async () => {
    const { saveTape } = await import('/data/tapes.js');
    const { encodeWav } = await import('/logic/wav.js');
    const tone = (seconds, hz) => {
      const sound = Float32Array.from({ length: seconds * 8000 }, (_, i) => 0.2 * Math.sin((i / 8000) * 2 * Math.PI * hz));
      return new Blob([encodeWav([sound], 8000)], { type: 'audio/wav' });
    };
    await saveTape({ kind: 'voice', title: 'Note to self', duration: 6, created: 1, mime: 'audio/wav', blob: tone(6, 330) });
    await saveTape({ kind: 'radio', title: '90.3 KEXP, Nov 14', duration: 10, created: 2, mime: 'audio/wav', blob: tone(10, 440) });
  });
}
