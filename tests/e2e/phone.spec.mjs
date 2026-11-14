// SIDE A in a real browser, the phone side of things: leaving the app mid-recording, the radio on one plain audio
// element with no Web Audio (so a locked phone keeps playing it, taping or not), the lock screen, and closing the app.
// Shared set-up: side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { STATIONS, stationAt } from '../../logic/stations.js';
import { canFeed, openDeck, status, line, key, addTapes } from './side-a-setup.mjs';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  const upright = info.titlePath.includes('upright phone');
  test.skip(info.project.name === 'iphone' && !upright, 'the deck only shows sideways; iphone-landscape covers it');
});

test('leaving the app while recording stops it and saves the tape', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the stand-in mic needs Chromium');
  await openDeck(page);
  test.skip(!(await page.evaluate(() => 'MediaRecorder' in window)), 'this browser has no recorder');
  await page.getByRole('button', { name: 'TAPE' }).click();
  await key(page, 'Record').click();
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await page.waitForTimeout(600);
  // The phone locks: the page is hidden for a moment.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  await expect(status(page)).toHaveText('Recording stopped when you left the app. The tape is saved.');
  await expect(key(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: /shelf$/i }).click();
  await expect(page.getByRole('button', { name: /: Voice note, / })).toHaveCount(1);
});

test('the radio plays on one audio element over one connection, never Web Audio, and taping it opens no other', async ({ page }) => {
  await page.addInitScript(() => {
    window.radioLog = { webAudio: 0, played: [] };
    const make = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function logged(el) {
      window.radioLog.webAudio += 1;
      return make.call(this, el);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function noted() {
      window.radioLog.played.push(this);
      return play.call(this);
    };
  });
  const url = STATIONS[stationAt(88.3)].url;
  const connections = [];
  page.on('request', (r) => r.url() === url && connections.push(r));
  await openDeck(page);
  test.skip(!(await canFeed(page)), "this browser can't feed the radio player itself");
  // Web Audio on a live stream is silent on iPhones and stops when the phone locks, so the radio never uses it.
  const radio = () => page.evaluate(() => {
    const { webAudio, played } = window.radioLog;
    const elements = [...new Set(played)];
    return { webAudio, elements: elements.length, playing: elements.filter((a) => !a.paused).length };
  });
  await key(page, 'Play').click();
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  await expect.poll(radio).toEqual({ webAudio: 0, elements: 1, playing: 1 });
  // Taping twice: the same element plays on, uninterrupted, and the station is still only called once
  // (Starky: never a second connection, so the tape is what was heard, from the moment REC is pressed).
  for (let i = 0; i < 2; i++) {
    await key(page, 'Record').click();
    await expect(line(page)).toHaveText('Taping 88.3 FM');
    await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
    await key(page, 'Stop').click();
    await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  }
  await page.getByRole('link', { name: /shelf$/i }).click();
  await expect(page.getByRole('button', { name: /^88\.3 WBGO Jazz.*Taped from radio/ })).toHaveCount(2);
  expect(await radio()).toEqual({ webAudio: 0, elements: 1, playing: 1 });
  expect(connections).toHaveLength(1);
});

test('the lock screen shows the station and its song, and its buttons work the deck', async ({ page }) => {
  const song = { results: [{ play_type: 'trackplay', artist: 'The Paper Lanterns', song: 'Night Swim' }] };
  await page.route('https://api.kexp.org/v2/plays/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(song),
  }));
  await page.addInitScript(() => {
    window.lockKeys = {};
    if (!window.MediaSession) return;
    const set = MediaSession.prototype.setActionHandler;
    MediaSession.prototype.setActionHandler = function noted(action, run) {
      window.lockKeys[action] = run;
      return set.call(this, action, run);
    };
  });
  await openDeck(page);
  test.skip(!(await page.evaluate(() => 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined')), 'no Media Session here');
  // A tape waiting in the deck, for the last part.
  await addTapes(page);
  await page.goto('/');
  const lock = () => page.evaluate(() => {
    const m = navigator.mediaSession.metadata;
    return { title: m.title, artist: m.artist, album: m.album, state: navigator.mediaSession.playbackState, art: m.artwork.length };
  });
  await expect.poll(lock).toEqual({ title: 'WBGO Jazz', artist: '88.3 FM, Newark NJ', album: 'SIDE A', state: 'paused', art: 2 });
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  await expect.poll(lock).toEqual({ title: 'Night Swim', artist: 'The Paper Lanterns', album: 'KEXP, Seattle WA', state: 'playing', art: 2 });
  // The lock screen's buttons: next station, then pause (the radio goes off).
  await page.evaluate(() => window.lockKeys.nexttrack());
  await expect(page.locator('.big')).toHaveText(STATIONS[stationAt(90.3) + 1].freq.toFixed(1));
  await page.evaluate(() => window.lockKeys.pause());
  await expect(status(page)).toHaveText(/, off$/);
  await expect.poll(() => page.evaluate(() => navigator.mediaSession.playbackState)).toBe('paused');
  // On tape, skip jumps through the tape instead of changing station.
  await page.getByRole('button', { name: 'TAPE' }).click();
  await expect.poll(lock).toMatchObject({ title: '90.3 KEXP, Nov 14', artist: 'Taped from radio', state: 'paused' });
  await expect.poll(() => page.evaluate(() => [window.lockKeys.nexttrack, typeof window.lockKeys.seekforward])).toEqual([null, 'function']);
});

test('closing the app stops the sound; locking the phone or switching apps does not', async ({ page }) => {
  await page.addInitScript(() => {
    window.played = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function noted() {
      window.played.push(this);
      return play.call(this);
    };
  });
  await openDeck(page);
  const sounding = () => page.evaluate(() => window.played.filter((a) => !a.paused).length);
  await key(page, 'Play').click();
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  await expect.poll(sounding).toBe(1);
  // Locked or another app in front: the page is hidden, then back. The radio plays on.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Kept for coming back to (the back/forward cache): plays on too.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  expect(await sounding()).toBe(1);
  // Closed: quiet.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ, off');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'false');
  expect(await sounding()).toBe(0);
});
