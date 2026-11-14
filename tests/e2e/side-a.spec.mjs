// SIDE A flows in a real browser: radio, recording a voice note, taping the radio, the shelf, the portrait prompt.
// The stations and the mic are stand-ins (a short tone, a test signal), so these tests are silent and need no internet.
import { test, expect } from '@playwright/test';
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

// In the page: muted sound, a test-signal mic, and station streams that keep arriving until stopped (for taping the radio).
function fakeSources(micError) {
  // Tests stay silent (Starky's rule: mute while testing the radio).
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function mutedPlay() {
    this.muted = true;
    return play.call(this);
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    if (!/^https:\/\//.test(String(url))) return realFetch(url, opts);
    const stream = new ReadableStream({
      start(c) {
        const t = setInterval(() => c.enqueue(new Uint8Array(2000)), 100);
        opts.signal?.addEventListener('abort', () => {
          clearInterval(t);
          c.error(new DOMException('stopped', 'AbortError'));
        });
      },
    });
    return Promise.resolve(new Response(stream, { headers: { 'content-type': 'audio/mpeg' } }));
  };
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

async function openDeck(page, { micError = '' } = {}) {
  const wav = toneWav();
  for (const s of STATIONS) {
    await page.route(s.url, (route) => route.fulfill({ status: 200, body: wav, headers: { 'content-type': 'audio/wav' } }));
  }
  await page.addInitScript(fakeSources, micError);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeVisible();
}

const status = (page) => page.locator('.status');
const line = (page) => page.locator('.line');
const key = (page, name) => page.getByRole('button', { name, exact: true });

test.beforeEach(async ({}, info) => {
  const upright = info.titlePath.includes('upright phone');
  test.skip(info.project.name === 'iphone' && !upright, 'the deck only shows sideways; iphone-landscape covers it');
});

test('the radio plays a preset and changes station', async ({ page }) => {
  await openDeck(page);
  await expect(status(page)).toHaveText('FM, preset 1, off');
  await page.getByRole('button', { name: /^Preset 2:/ }).click();
  await expect(status(page)).toHaveText('FM, preset 2');
  await expect(line(page)).toHaveText('The Current, Minneapolis');
  await expect(page.getByRole('button', { name: /^Preset 2:/ })).toHaveAttribute('aria-pressed', 'true');
  await key(page, 'Next station').click();
  await expect(page.locator('.big')).toHaveText('90.3');
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('FM, preset 3, off');
});

test('records a voice note, then plays it from the shelf', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the stand-in mic needs Chromium');
  await openDeck(page);
  test.skip(!(await page.evaluate(() => 'MediaRecorder' in window)), 'this browser has no recorder');
  await page.getByRole('button', { name: 'TAPE' }).click();
  await expect(line(page)).toHaveText('Blank tape');
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText('Recording');
  await expect(line(page)).toHaveText('Mic to side A');
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await page.waitForTimeout(600);
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('Tape, stopped');
  await expect(line(page)).not.toHaveText(/Saving|Blank/);

  await page.getByRole('link', { name: 'Shelf ›' }).click();
  await expect(page.getByRole('heading', { name: 'TAPE SHELF' })).toBeVisible();
  const tape = page.getByRole('button', { name: /^Play .*Voice note/ });
  await expect(tape).toHaveCount(1);
  await tape.click();
  await expect(page.getByRole('heading', { name: 'TAPE SHELF' })).toBeHidden();
  await expect(status(page)).toHaveText(/Tape, (playing|stopped)/);
});

test('tapes the radio and files it under Radio', async ({ page }) => {
  await openDeck(page);
  await key(page, 'Play').click();
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 88.3 FM');
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await page.waitForTimeout(600);
  await key(page, 'Stop').click();
  await expect(line(page)).toHaveText(/^88\.3 WBGO Jazz, /);

  await page.getByRole('link', { name: 'Shelf ›' }).click();
  await page.getByRole('button', { name: 'Radio', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Play 88\.3 WBGO Jazz.*Taped from radio/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Voice', exact: true }).click();
  await expect(page.getByText('No voice notes yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Mixes', exact: true }).click();
  await expect(page.getByText('No mixtapes yet.')).toBeVisible();
});

test('the blank tape opens the deck ready to record from the mic', async ({ page }) => {
  await openDeck(page);
  await page.goto('/#/shelf');
  await expect(page.getByText('No tapes yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Blank tape, start a new recording' }).click();
  await expect(line(page)).toHaveText('Blank tape');
  await expect(page.getByRole('button', { name: 'MIC' })).toHaveAttribute('aria-pressed', 'true');
  await key(page, 'Play').click();
  await expect(status(page)).toHaveText('Blank tape. Press record.');
});

test('says so when the mic is not allowed', async ({ page }) => {
  await openDeck(page, { micError: 'NotAllowedError' });
  await page.getByRole('button', { name: 'TAPE' }).click();
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText('Mic is off. Allow it for SIDE A in Settings.');
  await expect(key(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
});

test.describe('upright phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'iphone' && info.project.name !== 'desktop-chrome', 'checked once per engine');
  });
  test('asks to turn it sideways and hides the deck', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Turn it\s*sideways\./ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeHidden();
  });
});
