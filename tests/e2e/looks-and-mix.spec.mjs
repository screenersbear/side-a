// SIDE A in a real browser: the four looks in Settings, and making a mixtape from two tapes. Shared set-up:
// side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { openDeck, status, line, key, pickLook, card, movingPart, addTapes } from './side-a-setup.mjs';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  const upright = info.titlePath.includes('upright phone');
  test.skip(info.project.name === 'iphone' && !upright, 'the deck only shows sideways; iphone-landscape covers it');
});

test('Settings changes the look, and the deck keeps it after a reload', async ({ page }) => {
  await openDeck(page);
  await expect(page.locator('.look-pocket')).toBeVisible();
  await page.getByRole('link', { name: 'Settings ›' }).click();
  await expect(card(page, 'Pocket')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'Pocket')).toContainText('In use');
  await card(page, 'Sport').click();
  await expect(card(page, 'Sport')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'Sport')).toContainText('In use');
  await expect(card(page, 'Pocket')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: 'Deck', exact: true }).click();
  await expect(page.locator('.look-sport')).toBeVisible();
  await page.reload();
  await expect(page.locator('.look-sport')).toBeVisible();
  await expect(page.locator('.look-pocket')).toHaveCount(0);
});

test('changing the look keeps the radio playing', async ({ page }) => {
  await openDeck(page);
  await page.getByRole('button', { name: /^Preset 2:/ }).click();
  await expect(status(page)).toHaveText('The Current, Minneapolis MN');
  await pickLook(page, 'Boombox');
  await expect(status(page)).toHaveText('The Current, Minneapolis MN');
  await expect(page.getByRole('button', { name: /^Preset 2:/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');
});

for (const look of ['Deck', 'Sport', 'Boombox']) {
  test(`the ${look} look has every control on screen, and its moving part runs only while sound plays`, async ({ page }) => {
    await openDeck(page);
    await pickLook(page, look);
    const size = page.viewportSize();
    for (const name of ['Record', 'Play', 'Previous station', 'Next station', 'Stop', 'RADIO', 'TAPE']) {
      const box = await key(page, name).boundingBox();
      expect(box, `${name} is shown`).not.toBeNull();
      const inside = box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 0.5 && box.y + box.height <= size.height + 0.5;
      expect(inside, `${name} is on screen`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: /^Preset 2:/ }).click();
    await expect(status(page)).toHaveText('The Current, Minneapolis MN');
    await expect(line(page)).toHaveText('');
    await expect(movingPart(page)).toHaveCount(1);
    await key(page, 'Stop').click();
    await expect(movingPart(page)).toHaveCount(0);
    await key(page, 'TAPE').click();
    await expect(key(page, 'MIC')).toBeVisible();
    await expect(key(page, 'RADIO IN')).toBeVisible();
    await expect(page.getByRole('link', { name: /shelf ›/i })).toBeVisible();
  });
}

test('makes a mixtape: two clips, a cut, a piece removed, a fade in, saved to the shelf', async ({ page }) => {
  await openDeck(page);
  await addTapes(page);
  await page.goto('/#/shelf');
  await page.getByRole('link', { name: /new mix/i }).click();
  await expect(page.getByRole('heading', { name: 'New mix' })).toBeVisible();
  await expect(page.getByText('No clips yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: /save mixtape/i })).toBeDisabled();

  // Add clip opens the shelf as a popup. A tape can be heard first (Listen: it counts up, Stop ends it), then
  // tapped to use it: the radio tape, its end brought in by 2 seconds.
  await page.getByRole('button', { name: /add clip/i }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a tape' });
  await expect(picker).toBeVisible();
  const listen = picker.getByRole('button', { name: 'Listen to 90.3 KEXP, Nov 14' });
  await listen.click();
  await expect(listen).toHaveAttribute('aria-pressed', 'true');
  await expect(listen).toHaveText('Stop');
  await expect(picker.getByText(/^00:0[1-9] of 00:10$/)).toBeVisible({ timeout: 5000 });
  await listen.click();
  await expect(listen).toHaveAttribute('aria-pressed', 'false');
  await expect(listen).toHaveText('Listen');
  await picker.getByRole('button', { name: /^Use 90\.3 KEXP, Nov 14/ }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Add a clip' })).toBeVisible();
  await expect(page.locator('.clip-tape')).toHaveText('90.3 KEXP, Nov 14');
  await expect(page.locator('.clip-range')).toHaveText('0:00 to 0:10');
  await page.getByRole('button', { name: 'Move end earlier' }).click();
  await page.getByRole('button', { name: 'Move end earlier' }).click();
  await expect(page.locator('.clip-range')).toHaveText('0:00 to 0:08');
  await page.getByRole('button', { name: /add to mix/i }).click();

  // The whole voice note: closing the popup without choosing goes back to the mix; then Change tape on the clip
  // screen swaps the tape (the radio tape first, then the voice note).
  await page.getByRole('button', { name: /add clip/i }).click();
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(page.getByRole('heading', { name: 'New mix' })).toBeVisible();
  await page.getByRole('button', { name: /add clip/i }).click();
  await picker.getByRole('button', { name: /^Use 90\.3 KEXP, Nov 14/ }).click();
  await page.getByRole('button', { name: 'Change tape' }).click();
  await picker.getByRole('button', { name: /^Use Note to self/ }).click();
  await expect(page.locator('.clip-tape')).toHaveText('Note to self');
  await expect(page.locator('.clip-range')).toHaveText('0:00 to 0:06');
  await page.getByRole('button', { name: /add to mix/i }).click();

  const clips = page.locator('.track .clip');
  await expect(clips).toHaveCount(2);
  await expect(page.locator('.mix-total')).toHaveText('0:14');

  // Play it (silently) to hear where to cut: the red line follows the sound.
  const ruler = page.getByRole('slider', { name: 'Red line' });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  await expect.poll(async () => Number(await ruler.getAttribute('aria-valuenow')), { timeout: 5000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();

  // Cut at 3 seconds, then remove the piece after the cut.
  await ruler.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(ruler).toHaveAttribute('aria-valuetext', '0:03');
  await page.getByRole('button', { name: 'Cut', exact: true }).click();
  await expect(clips).toHaveCount(3);
  await expect(clips.nth(1)).toHaveAttribute('aria-label', '90.3 KEXP, Nov 14, 0:05, selected');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(clips).toHaveCount(2);
  await expect(page.locator('.mix-total')).toHaveText('0:09');

  // Dragging on the ruler moves the line too.
  const box = await ruler.boundingBox();
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect.poll(async () => Number(await ruler.getAttribute('aria-valuenow'))).toBeGreaterThan(3);

  // The voice note fades in.
  await page.getByRole('button', { name: /^Into Note to self: none/ }).click();
  await expect(page.getByRole('button', { name: /^Into Note to self: fade in/ })).toBeVisible();

  await page.getByRole('button', { name: /save mixtape/i }).click();
  await expect(page.getByRole('heading', { name: 'Tape shelf' })).toBeVisible();
  // The new mixtape's menu opens, offering Share first.
  const menu = page.getByRole('dialog');
  await expect(menu.getByText('Mixtape saved to the shelf.')).toBeVisible();
  await expect(menu.locator('.tm-act').first()).toHaveText('Share');
  await expect(menu.locator('.tm-act').first()).toHaveClass(/pri/);
  await menu.getByRole('button', { name: 'Close' }).click();
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Mixes', exact: true }).click();
  const tape = page.getByRole('button', { name: /: Mixtape, 00:09$/ });
  await expect(tape).toHaveCount(1);
  await tape.click();
  await expect(menu.getByText('Mixtape saved to the shelf.')).toBeHidden();
  await menu.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(status(page)).toHaveText(/Tape, (playing|stopped)/);
});
