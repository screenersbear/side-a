// SIDE A in a real browser, the radio dial's newer parts: long song titles as a ticker. Shared set-up:
// side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { openDeck, status, line, pickLook } from './side-a-setup.mjs';

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
