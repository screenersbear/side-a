// SIDE A in a real browser, the phone side of things: leaving the app mid-recording, the radio back on a plain
// audio element after taping (so a locked phone keeps playing it), and the lock screen. Shared set-up:
// side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { STATIONS, stationAt } from '../../logic/stations.js';
import { openDeck, status, line, key, addTapes } from './side-a-setup.mjs';

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
  await page.getByRole('link', { name: 'Shelf ›' }).click();
  await expect(page.getByRole('button', { name: /: Voice note, / })).toHaveCount(1);
});

test('after taping the radio, a plain audio element plays it again: Web Audio only while taping', async ({ page }) => {
  await page.addInitScript(() => {
    window.radioLog = { tapped: [], contexts: [], played: [] };
    const make = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function logged(el) {
      window.radioLog.tapped.push(el);
      window.radioLog.contexts.push(this);
      return make.call(this, el);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function noted() {
      window.radioLog.played.push(this);
      return play.call(this);
    };
  });
  await openDeck(page);
  test.skip(!(await page.evaluate(() => 'MediaRecorder' in window)), 'this browser has no recorder');
  const radio = () => page.evaluate(() => {
    const { tapped, contexts, played } = window.radioLog;
    const now = [...new Set(played)].filter((a) => !a.paused && a.src.startsWith('http'));
    return { taps: tapped.length, closed: contexts.every((c) => c.state === 'closed'), playing: now.length, plain: now.every((a) => !tapped.includes(a)) };
  });
  await key(page, 'Play').click();
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  await expect.poll(radio).toEqual({ taps: 0, closed: true, playing: 1, plain: true });
  await key(page, 'Record').click();
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await expect.poll(radio).toEqual({ taps: 1, closed: false, playing: 1, plain: false });
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  // A fresh element takes over and the taped one (with its Web Audio) is let go.
  await expect.poll(radio, { timeout: 5000 }).toEqual({ taps: 1, closed: true, playing: 1, plain: true });
  // Taping again works, from the new element.
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 88.3 FM');
  await expect.poll(radio).toEqual({ taps: 2, closed: false, playing: 1, plain: false });
  await key(page, 'Stop').click();
  await expect.poll(radio, { timeout: 5000 }).toEqual({ taps: 2, closed: true, playing: 1, plain: true });
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
