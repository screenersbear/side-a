// SIDE A in a real browser: the menu a tape on the shelf opens. Share as MP3 or WAV (or a download where the
// browser can't share files), Rename and Delete. Shared set-up: side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { openDeck, addTapes } from './side-a-setup.mjs';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  const upright = info.titlePath.includes('upright phone');
  test.skip(info.project.name === 'iphone' && !upright, 'the deck only shows sideways; iphone-landscape covers it');
});

// In the page: a stand-in share sheet that notes each file it's given (name, type, size, first bytes).
async function fakeShareSheet(page) {
  await page.evaluate(() => {
    window.sharedFiles = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ files }) => {
        const f = files[0];
        const head = Array.from(new Uint8Array(await f.slice(0, 2).arrayBuffer()));
        window.sharedFiles.push({ name: f.name, type: f.type, size: f.size, head });
      },
    });
  });
}
const lastShared = (page) => page.evaluate(() => window.sharedFiles[window.sharedFiles.length - 1]);

// A file made quickly goes to the share sheet by itself; a slower one waits for a tap on Share. Either way, wait
// until the share sheet has had `count` files.
async function shareMade(page, count) {
  await expect.poll(async () => {
    if ((await page.evaluate(() => window.sharedFiles.length)) >= count) return true;
    const share = page.locator('dialog.tape-menu[data-view="ready"] .tm-act.pri');
    if (await share.count()) await share.click({ timeout: 1000 }).catch(() => {});
    return false;
  }, { timeout: 20000 }).toBe(true);
}

test('a tape\'s menu shares it as MP3 or WAV, renames it and deletes it', async ({ page }) => {
  await openDeck(page);
  await addTapes(page);
  await page.goto('/#/shelf');
  await fakeShareSheet(page);
  const tape = page.getByRole('button', { name: 'Note to self: Voice note, 00:06' });
  const menu = page.getByRole('dialog');
  await tape.click();
  await expect(menu.getByRole('heading', { name: 'Note to self' })).toBeVisible();
  await expect(menu.getByText('Voice note, 00:06')).toBeVisible();
  for (const name of ['Play', 'Share', 'Rename', 'Delete']) await expect(menu.getByRole('button', { name, exact: true })).toBeVisible();

  // MP3, made on the phone: the share sheet gets "Note to self.mp3", and the menu closes.
  await menu.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(menu.getByText('Share as')).toBeVisible();
  await menu.getByRole('button', { name: /^MP3/ }).click();
  await shareMade(page, 1);
  const mp3 = await lastShared(page);
  expect(mp3).toMatchObject({ name: 'Note to self.mp3', type: 'audio/mpeg', head: [0xff, 0xfb] });
  expect(mp3.size).toBeGreaterThan(100_000);
  await expect(menu).toBeHidden();

  // WAV: this tape already is one, so it goes as it is.
  await tape.click();
  await menu.getByRole('button', { name: 'Share', exact: true }).click();
  await menu.getByRole('button', { name: /^WAV/ }).click();
  await shareMade(page, 2);
  await expect(menu).toBeHidden();
  expect(await lastShared(page)).toMatchObject({ name: 'Note to self.wav', type: 'audio/wav', size: 44 + 6 * 8000 * 2 });

  // Rename: tidied, saved, and on the shelf.
  await tape.click();
  await menu.getByRole('button', { name: 'Rename', exact: true }).click();
  const field = menu.getByRole('textbox', { name: 'Name' });
  await expect(field).toHaveValue('Note to self');
  await field.fill('   ');
  await menu.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(menu.getByText('Type a name first.')).toBeVisible();
  await field.fill('  Late   Night Drive ');
  await field.press('Enter');
  await expect(menu.getByRole('heading', { name: 'Late Night Drive' })).toBeVisible();
  await expect(menu.getByText('Renamed.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  const renamed = page.getByRole('button', { name: 'Late Night Drive: Voice note, 00:06' });
  await expect(renamed).toHaveCount(1);

  // Delete asks first; Keep it goes back.
  await renamed.click();
  await menu.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(menu.getByText("Delete this tape? It can't be undone.")).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await menu.getByRole('button', { name: 'Keep it' }).click();
  await menu.getByRole('button', { name: 'Delete', exact: true }).click();
  await menu.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(renamed).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^90\.3 KEXP, Nov 14: Taped from radio/ })).toHaveCount(1);
});

test('where the browser can\'t share files, Share downloads the file', async ({ page, browserName }) => {
  await openDeck(page);
  await addTapes(page);
  await page.goto('/#/shelf');
  // What the app hands the browser is a link to the file, named after the tape: checked in every browser. Chromium
  // then downloads it for real. WebKit's own handling of such a download differs by platform (it failed in Linux
  // WebKit on GitHub while passing on a Mac), so there the link is checked and the browser's part left out.
  const real = browserName === 'chromium';
  await page.evaluate((follow) => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    window.links = [];
    document.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a[download]');
      if (!link) return;
      window.links.push({ name: link.download, blob: link.href.startsWith('blob:') });
      if (!follow) e.preventDefault();
    }, true);
  }, real);
  await page.getByRole('button', { name: /^Note to self/ }).click();
  const menu = page.getByRole('dialog');
  await menu.getByRole('button', { name: 'Share', exact: true }).click();
  const download = real ? page.waitForEvent('download') : null;
  await menu.getByRole('button', { name: /^WAV/ }).click();
  await expect.poll(() => page.evaluate(() => window.links)).toEqual([{ name: 'Note to self.wav', blob: true }]);
  if (real) expect((await download).suggestedFilename()).toBe('Note to self.wav');
  await expect(menu.getByText('Downloaded.')).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
});
