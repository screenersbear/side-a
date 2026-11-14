// What the SIDE A browser tests share: stand-in stations (a quiet tone), a muted page with a test-signal mic,
// opening the deck, picking a look, and putting two tapes on the shelf. Each *.spec.mjs file imports these.
// The stations are a stand-in tone, the mic is a test signal and every test is muted, so no internet is needed.
import { expect } from '@playwright/test';
import { STATIONS } from '../../logic/stations.js';
import { Mp3Encoder } from '../../vendor/lamejs.js';

// Half a minute of quiet tone as an MP3 stream, standing in for a station's (made with the app's own encoder).
const tones = new Map();
export function toneMp3(seconds = 30, rate = 44100) {
  const name = `${seconds}s at ${rate}`;
  if (tones.has(name)) return tones.get(name);
  const n = seconds * rate;
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.round(2000 * Math.sin((i / rate) * 2 * Math.PI * 440));
  const encoder = new Mp3Encoder(1, rate, 64);
  const parts = [];
  const keep = (b) => parts.push(Buffer.from(b.buffer, b.byteOffset, b.length));
  for (let at = 0; at < n; at += 1152) keep(encoder.encodeBuffer(pcm.subarray(at, at + 1152)));
  keep(encoder.flush());
  tones.set(name, Buffer.concat(parts));
  return tones.get(name);
}

// In the page: muted sound and a test-signal mic (silentMic: a mic that hands over nothing but silence, the way a
// broken one can on a phone).
function fakeSources({ micError, silentMic }) {
  // Tests stay silent (Starky's rule: mute while testing the radio).
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function mutedPlay() {
    this.muted = true;
    return play.call(this);
  };
  // And they stay muted.
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
    if (silentMic) {
      const hush = ctx.createGain();
      hush.gain.value = 0;
      osc.connect(hush).connect(out);
    } else osc.connect(out);
    osc.start();
    await ctx.resume();
    return out.stream;
  };
}

// In the page: the station named in blocked plays but won't let the app read its stream, like a real station
// without CORS. The app's own connection to it fails the way a CORS refusal does; the plain audio element plays it.
// Staged in the page because Playwright's stand-in answers skip the browser's CORS check.
function blockStation(blocked) {
  const fetch = window.fetch;
  window.fetch = function refused(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    return url === blocked ? Promise.reject(new TypeError('Failed to fetch')) : fetch.call(this, input, init);
  };
}

// Every station plays a tone, or `stream` (with a CORS header, so the app can read it and tape it).
export async function openDeck(page, { micError = '', blocked = '', silentMic = false, stream = null } = {}) {
  const body = stream || toneMp3();
  const headers = { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*' };
  for (const s of STATIONS) {
    await page.route(s.url, (route) => route.fulfill({ status: 200, body, headers }));
  }
  await page.addInitScript(fakeSources, { micError, silentMic });
  if (blocked) await page.addInitScript(blockStation, blocked);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
}

export const status = (page) => page.locator('.status');
// Can this browser feed the radio player itself (MediaSource)? Only then can it tape the radio.
export const canFeed = (page) => page.evaluate(() => {
  const MS = window.ManagedMediaSource || window.MediaSource;
  return Boolean(MS && MS.isTypeSupported('audio/mpeg'));
});

// What the tape check found for each new tape (its "SIDE A tape check: {...}" console lines, audio/sound-check.js).
export function tapeChecks(page) {
  const checks = [];
  page.on('console', (msg) => {
    const [, json] = msg.text().match(/^SIDE A tape check: (.*)$/) || [];
    if (json) checks.push(JSON.parse(json));
  });
  return checks;
}
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
