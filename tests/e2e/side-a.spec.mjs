// SIDE A in a real browser: the radio and its presets, recording a voice note, taping the radio, the blank tape,
// the mic refusing, and the upright-phone prompt. Shared set-up: side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { STATIONS, stationAt } from '../../logic/stations.js';
import { canFeed, toneMp3, openDeck, status, line, key, pickLook, tapeChecks } from './side-a-setup.mjs';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  const upright = info.titlePath.includes('upright phone');
  test.skip(info.project.name === 'iphone' && !upright, 'the deck only shows sideways; iphone-landscape covers it');
});

test('the radio plays a preset and changes station', async ({ page }) => {
  await openDeck(page);
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ, off');
  await page.getByRole('button', { name: /^Preset 2:/ }).click();
  await expect(status(page)).toHaveText('The Current, Minneapolis MN');
  // The Current sends no song titles, so the song line stays empty.
  await expect(line(page)).toHaveText('');
  await expect(page.getByRole('button', { name: /^Preset 2:/ })).toHaveAttribute('aria-pressed', 'true');
  await key(page, 'Next station').click();
  const next = STATIONS[stationAt(89.3) + 1];
  await expect(page.locator('.big')).toHaveText(next.freq.toFixed(1));
  await expect(status(page)).toHaveText(next.place ? `${next.name}, ${next.place}` : next.name);
  await key(page, 'Previous station').click();
  await expect(page.locator('.big')).toHaveText('89.3');
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('The Current, Minneapolis MN, off');
});

test('Next seeks up the dial to a station that does not allow recording, and Record says so', async ({ page }) => {
  await openDeck(page);
  await key(page, 'Play').click();
  for (let i = stationAt(88.3); i < stationAt(91.1); i++) await key(page, 'Next station').click();
  await expect(page.locator('.big')).toHaveText('91.1');
  await expect(status(page)).toHaveText('WFMU, Jersey City NJ');
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText("Recording isn't allowed on this station.");
  await expect(key(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'RADIO' })).toHaveAttribute('aria-pressed', 'true');
});

test('holding a preset key saves the station there, like a car radio, and the phone remembers it', async ({ page }) => {
  await openDeck(page);
  await key(page, 'Play').click();
  for (let i = stationAt(88.3); i < stationAt(91.1); i++) await key(page, 'Next station').click();
  await expect(page.locator('.big')).toHaveText('91.1');
  const two = page.getByRole('button', { name: /^Preset 2:/ });
  // Held down for about a second.
  await two.hover();
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await expect(status(page)).toHaveText('Saved to preset 2');
  await expect(two).toHaveAttribute('aria-label', 'Preset 2: 91.1 WFMU');
  await expect(two).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.big')).toHaveText('91.1');
  // The message goes after a moment.
  await expect(status(page)).toHaveText('WFMU, Jersey City NJ');
  // A quick tap still tunes.
  await page.getByRole('button', { name: /^Preset 1:/ }).click();
  await expect(page.locator('.big')).toHaveText('88.3');
  await two.click();
  await expect(page.locator('.big')).toHaveText('91.1');
  // Remembered on the phone; the other keys keep their stations.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Preset 2:/ })).toHaveAttribute('aria-label', 'Preset 2: 91.1 WFMU');
  await expect(page.getByRole('button', { name: /^Preset 3:/ })).toHaveAttribute('aria-label', 'Preset 3: 90.3 KEXP');
});

test('a preset key held with Enter saves too, and a quick Enter tunes', async ({ page }) => {
  await openDeck(page);
  const four = page.getByRole('button', { name: /^Preset 4:/ });
  await four.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.big')).toHaveText('98.9');
  await key(page, 'Next station').click();
  const next = STATIONS[stationAt(98.9) + 1];
  await expect(page.locator('.big')).toHaveText(next.freq.toFixed(1));
  await four.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1200);
  await page.keyboard.up('Enter');
  await expect(status(page)).toHaveText('Saved to preset 4');
  await expect(four).toHaveAttribute('aria-label', `Preset 4: ${next.freq.toFixed(1)} ${next.name}`);
  await expect(page.locator('.big')).toHaveText(next.freq.toFixed(1));
});

test('a station that blocks taping when Record is pressed shows the same message and keeps playing', async ({ page }) => {
  await openDeck(page, { blocked: STATIONS[stationAt(90.3)].url });
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  await expect(status(page)).toHaveText('KEXP, Seattle WA');
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText("Recording isn't allowed on this station.");
  await expect(page.locator('.big')).toHaveText('90.3');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');
});

test('records a voice note, then plays it from the shelf', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the stand-in mic needs Chromium');
  const checks = tapeChecks(page);
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
  // The new tape is read back from storage and listened to: whole, with sound, so the deck says nothing more.
  await expect.poll(() => checks.length, { timeout: 5000 }).toBe(1);
  expect(checks[0]).toMatchObject({ result: 'sound', kind: 'voice', mutes: 0 });
  expect(checks[0].stored).toBe(checks[0].bytes);
  await expect(status(page)).toHaveText('Tape, stopped');

  await page.getByRole('link', { name: /shelf$/i }).click();
  await expect(page.getByRole('heading', { name: 'Tape shelf' })).toBeVisible();
  const tape = page.getByRole('button', { name: /: Voice note, / });
  await expect(tape).toHaveCount(1);
  // A tape opens its menu; Play puts it in the deck.
  await tape.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tape shelf' })).toBeHidden();
  await expect(status(page)).toHaveText(/Tape, (playing|stopped)/);
});

test('a recording that comes out silent says so', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the stand-in mic needs Chromium');
  const checks = tapeChecks(page);
  await openDeck(page, { silentMic: true });
  test.skip(!(await page.evaluate(() => 'MediaRecorder' in window)), 'this browser has no recorder');
  await page.getByRole('button', { name: 'TAPE' }).click();
  await key(page, 'Record').click();
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await page.waitForTimeout(600);
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('This recording came out silent.');
  expect(checks[0]).toMatchObject({ result: 'silent', kind: 'voice', loudest: 'silence', mutes: 0 });
  // It's kept, so it can be looked at (or deleted), and the next press brings the deck back.
  await key(page, 'Play').click();
  await expect(status(page)).not.toHaveText('This recording came out silent.');
  await page.getByRole('link', { name: /shelf$/i }).click();
  await expect(page.getByRole('button', { name: /: Voice note, / })).toHaveCount(1);
});

test('tapes the radio and files it under Radio', async ({ page }) => {
  const checks = tapeChecks(page);
  await openDeck(page);
  test.skip(!(await canFeed(page)), "this browser can't feed the radio player itself");
  await key(page, 'Play').click();
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 88.3 FM');
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await page.waitForTimeout(600);
  // Record again stops it, the same as Stop: the tape is saved and the radio plays on, like a boombox.
  await key(page, 'Record').click();
  await expect(key(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'RADIO' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => checks.length, { timeout: 5000 }).toBe(1);
  // The tape is the station's own sound, cut from the stream the app played, in every browser. (It used to go
  // through Web Audio, which hears only silence from a live stream in WebKit: silent radio tapes on iPhones, fixed
  // 2026-11-14.)
  expect(checks[0]).toMatchObject({ result: 'sound', kind: 'radio', mime: 'audio/mpeg', format: 'mp3' });
  expect(checks[0].frames).toBeGreaterThan(0);
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  // Stop again turns the radio off. The tape waits in the deck.
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ, off');
  await page.getByRole('button', { name: 'TAPE' }).click();
  await expect(line(page)).toHaveText(/^88\.3 WBGO Jazz, /);

  await page.getByRole('link', { name: /shelf$/i }).click();
  await page.getByRole('button', { name: 'Radio', exact: true }).click();
  await expect(page.getByRole('button', { name: /^88\.3 WBGO Jazz.*Taped from radio/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Voice', exact: true }).click();
  await expect(page.getByText('No voice notes yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Mixes', exact: true }).click();
  await expect(page.getByText('No mixtapes yet.')).toBeVisible();
});

test('Record with the radio off turns it on and tapes from its first sound, at the right speed through an ad at another rate', async ({ page }) => {
  const checks = tapeChecks(page);
  // Two seconds at 44.1 kHz, then the rest at 22.05 kHz, the way a station's ads can come in at another rate.
  await openDeck(page, { stream: Buffer.concat([toneMp3(2, 44100), toneMp3(30, 22050)]) });
  test.skip(!(await canFeed(page)), "this browser can't feed the radio player itself");
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 88.3 FM');
  await expect(page.locator('.big')).toHaveText('00:06', { timeout: 10000 });
  await key(page, 'Stop').click();
  await expect.poll(() => checks.length, { timeout: 5000 }).toBe(1);
  // Both rates made it onto one tape, made again at one rate, so it lasts as long as what was heard (taped as it
  // came, the 22.05 kHz part would play back at the wrong speed).
  expect(checks[0]).toMatchObject({ result: 'sound', kind: 'radio', mime: 'audio/mpeg', runs: 2 });
  expect(Math.abs(checks[0].seconds - checks[0].heardSeconds)).toBeLessThanOrEqual(0.6);
  expect(checks[0].heardSeconds).toBeGreaterThan(5);
  // The radio played on through the change.
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
});

test('taping a station that names its songs puts the song on the tape', async ({ page }) => {
  const song = { results: [{ play_type: 'trackplay', artist: 'The Paper Lanterns', song: 'Night Swim' }] };
  await page.route('https://api.kexp.org/v2/plays/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(song),
  }));
  await openDeck(page);
  test.skip(!(await canFeed(page)), "this browser can't feed the radio player itself");
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  // The deck shows the song while the station plays, in every look.
  await expect(status(page)).toHaveText('KEXP, Seattle WA');
  await expect(line(page)).toHaveText('Night Swim · The Paper Lanterns');
  await pickLook(page, 'Boombox');
  await expect(line(page)).toHaveText('Night Swim · The Paper Lanterns');
  await expect(page.locator('.look-boombox .now .icon')).toBeVisible();
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 90.3 FM');
  await page.waitForTimeout(1200);
  await key(page, 'Stop').click();
  // The radio plays on, still naming the song.
  await expect(status(page)).toHaveText('KEXP, Seattle WA');
  await expect(line(page)).toHaveText('Night Swim · The Paper Lanterns');

  await page.getByRole('link', { name: /shelf$/i }).click();
  await expect(page.getByRole('button', { name: /^90\.3, Night Swim by The Paper Lanterns: Taped from radio/ })).toHaveCount(1);
  await expect(page.getByText('Radio · The Paper Lanterns')).toBeVisible();
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
