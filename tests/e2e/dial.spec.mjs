// SIDE A in a real browser, the radio dial's newer parts: long song titles as a ticker, and the tuning wheel.
// Shared set-up: side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { openDeck, status, line, key, pickLook, movingPart } from './side-a-setup.mjs';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name === 'iphone', 'the deck only shows sideways; iphone-landscape covers it');
});

// KEXP names its songs: this one, through a stand-in for its feed.
async function kexpPlays(page, artist, song) {
  const body = JSON.stringify({ results: [{ play_type: 'trackplay', artist, song }] });
  await page.route('https://api.kexp.org/v2/plays/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body,
  }));
}

const gliding = (page) => page.evaluate(() => document.querySelectorAll('.line .tick-in').length
  && document.querySelector('.line .tick-in').getAnimations().filter((a) => a.playState === 'running').length);

test('a song title too long for its line scrolls like a ticker, in every look; a short one stays still', async ({ page }) => {
  const long = 'Low Tide (Extended Version, Live from the Basement Sessions)';
  const artist = 'Ostrich Choir and the Night Shift Orchestra';
  await kexpPlays(page, artist, long);
  await openDeck(page);
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  await expect(status(page)).toHaveText('KEXP, Seattle WA');
  for (const look of ['Pocket', 'Deck', 'Sport', 'Boombox']) {
    if (look !== 'Pocket') await pickLook(page, look);
    await expect(line(page)).toHaveClass(/ticking/);
    await expect.poll(() => gliding(page)).toBe(1);
    // Screen readers get the title once, not the moving copies.
    await expect(line(page).locator('.visually-hidden')).toHaveText(`${long} · ${artist}`);
    await expect(line(page).locator('.tick-in')).toHaveAttribute('aria-hidden', 'true');
  }
});

test('a short song title does not move', async ({ page }) => {
  await kexpPlays(page, 'June', 'Rain');
  await openDeck(page);
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  await expect(line(page)).toHaveText('Rain · June');
  await expect(line(page)).not.toHaveClass(/ticking/);
  expect(await gliding(page)).toBe(0);
});

test('with less motion asked for, a long title shows its start and stays still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await kexpPlays(page, 'Ostrich Choir and the Night Shift Orchestra', 'Low Tide (Extended Version, Live from the Basement Sessions)');
  await openDeck(page);
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  await expect(line(page)).toHaveText(/^Low Tide/);
  await expect(line(page)).not.toHaveClass(/ticking/);
  expect(await gliding(page)).toBe(0);
});

const wheel = (page) => page.getByRole('slider', { name: /^Tuning (wheel|knob)$/ });

test('the tuning wheel steps 0.1 MHz with the arrow keys, locks onto stations, and searches between them', async ({ page }) => {
  await openDeck(page);
  await page.getByRole('button', { name: /^Preset 4:/ }).click();
  await expect(status(page)).toHaveText('KUTX, Austin TX');
  await expect(wheel(page)).toHaveAttribute('aria-valuetext', '98.9 FM, KUTX');
  await wheel(page).focus();
  // On past each station: 99.1, 99.3, 99.5, 99.7.
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.big')).toHaveText('99.7');
  await expect(status(page)).toHaveText(/^K-Star Country/);
  // Then off the station: nothing on 100.0, so the radio goes quiet and the look's moving part stops.
  await page.keyboard.press('ArrowRight');
  await expect(status(page)).toHaveText('FM, searching');
  await expect(line(page)).toHaveText('Static. Keep turning.');
  await expect(page.locator('.big')).toHaveText('100.0');
  await expect(wheel(page)).toHaveAttribute('aria-valuetext', '100.0 FM, between stations');
  await expect(movingPart(page)).toHaveCount(0);
  // Record wants a station; Next finds the next one up.
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText('Tune to a station first.');
  await key(page, 'Next station').click();
  await expect(page.locator('.big')).toHaveText('101.1');
  await expect(status(page)).toHaveText(/^WIOE Oldies/);
  await expect(movingPart(page)).toHaveCount(1);
});

test('dragging the wheel tunes by hand, in every look (the Boombox has a knob)', async ({ page }) => {
  await openDeck(page);
  await page.getByRole('button', { name: /^Preset 4:/ }).click();
  await expect(status(page)).toHaveText('KUTX, Austin TX');
  const drag = async (dx, dy) => {
    const box = await wheel(page).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2);
    await page.mouse.move(x + dx, y + dy);
    await page.mouse.up();
  };
  // Pocket's wheel stands up: up is higher. 60 px is 1.2 MHz: 98.9 to 100.1, between stations.
  await drag(0, -60);
  await expect(page.locator('.big')).toHaveText('100.1');
  await expect(status(page)).toHaveText('FM, searching');
  for (const [look, dx] of [['Deck', 50], ['Sport', -50], ['Boombox', 50]]) {
    await pickLook(page, look);
    const before = Number(await page.locator('.big').textContent());
    await drag(dx, 0);
    await expect.poll(async () => Number(await page.locator('.big').textContent())).not.toBe(before);
  }
  await expect(wheel(page)).toHaveAttribute('aria-label', 'Tuning knob');
});
