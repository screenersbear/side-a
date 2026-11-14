// SIDE A in a real browser: the two bands (HANDOFF "Bands"). FM1 WORLD has the US and world stations; FM2 LOCAL
// finds the stations near the user (Radio Browser and the ZIP code lookup are stand-ins here). Set-up: side-a-setup.mjs.
import { test, expect } from '@playwright/test';
import { openDeck, status, line, key, pickLook, toneMp3 } from './side-a-setup.mjs';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name === 'iphone', 'the deck only shows sideways; iphone-landscape covers it');
});

// Radio Browser's answer near New York: three stations that name their frequency, one that doesn't.
const NEAR = [
  { name: '101.5 Kiss FM', tags: '', state: 'New York City, New York', codec: 'MP3', url_resolved: 'https://local.test/kiss', clickcount: 26, geo_distance: 7000 },
  { name: 'WFUV', tags: 'college,90.7', state: 'New York', codec: 'AAC+', url_resolved: 'https://local.test/wfuv', clickcount: 9, geo_distance: 20000 },
  { name: 'WNYC 93.9', tags: '', state: 'New York', codec: 'MP3', url_resolved: 'https://local.test/wnyc', clickcount: 30, geo_distance: 3000 },
  { name: 'Hot 97', tags: '', state: 'New York', codec: 'MP3', url_resolved: 'https://local.test/hot', clickcount: 50, geo_distance: 3000 },
];
const NYC = { places: [{ 'place name': 'New York', longitude: '-73.9967', latitude: '40.7484', 'state abbreviation': 'NY' }] };
const cors = { 'access-control-allow-origin': '*' };

// Stand-ins for Radio Browser, the ZIP code lookup (10001 only) and the local stations' streams. Returns the
// addresses Radio Browser was asked.
async function nearby(page) {
  const asked = [];
  await page.route(/radio-browser\.info\/json\/stations\/search/, (route) => {
    asked.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(NEAR) });
  });
  await page.route('https://api.zippopotam.us/us/*', (route) => (route.request().url().endsWith('/10001')
    ? route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(NYC) })
    : route.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: '{}' })));
  await page.route('https://local.test/**', (route) => route.fulfill({ status: 200, body: toneMp3(), headers: { ...cors, 'content-type': 'audio/mpeg' } }));
  return asked;
}

const bandKey = (page) => page.getByRole('button', { name: /^Band FM[12]/ });
const finder = (page) => page.getByRole('dialog', { name: 'Local stations' });
const wheel = (page) => page.getByRole('slider', { name: /^Tuning (wheel|knob)$/ });

test('FM1 has the world stations too, at their home frequencies', async ({ page }) => {
  await openDeck(page);
  await wheel(page).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.big')).toHaveText('107.9');
  for (let i = 0; i < 7; i++) await key(page, 'Previous station').click();
  await expect(page.locator('.big')).toHaveText('105.8');
  await expect(status(page)).toHaveText('triple j, Sydney Australia');
  for (let i = 0; i < 4; i++) await key(page, 'Previous station').click();
  await expect(status(page)).toHaveText('FIP, Paris France');
  await expect(bandKey(page)).toHaveText('FM1WORLD');
});

test('FM2 asks for a ZIP code the first time, then plays the stations near it, each band keeping its place', async ({ page }) => {
  const asked = await nearby(page);
  await openDeck(page);
  await bandKey(page).click();
  await expect(finder(page)).toBeVisible();
  await expect(finder(page)).toContainText('Local stations near you, at their real frequencies.');
  await expect(finder(page).getByRole('button', { name: 'Find' })).toBeInViewport({ ratio: 1 });

  await finder(page).getByLabel('Or a US ZIP code').fill('1234');
  await finder(page).getByRole('button', { name: 'Find' }).click();
  await expect(finder(page).getByRole('status')).toHaveText("That ZIP code wasn't found. Check it and try again.");
  expect(asked).toEqual([]);

  await finder(page).getByLabel('Or a US ZIP code').fill('10001');
  await finder(page).getByRole('button', { name: 'Find' }).click();
  await expect(finder(page)).toBeHidden();
  // Asked about the place to one decimal place, about 10 km, not the exact spot.
  expect(new URL(asked[0]).searchParams.get('geo_lat')).toBe('40.7');
  expect(new URL(asked[0]).searchParams.get('geo_long')).toBe('-74');

  await expect(bandKey(page)).toHaveText('FM2LOCAL');
  await expect(bandKey(page)).toHaveAttribute('aria-label', 'Band FM2, local stations. Tap for FM1, world stations.');
  await expect(status(page)).toHaveText('Local · WFUV, New York');
  await expect(page.locator('.big')).toHaveText('90.7');
  await expect(line(page)).toHaveText('Local stations near you, at their real frequencies.');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');

  await key(page, 'Next station').click();
  await expect(status(page)).toHaveText('Local · WNYC 93.9, New York');
  await expect(line(page)).toHaveText('');
  await page.getByRole('button', { name: 'Preset 3: 101.5 101.5 Kiss FM' }).click();
  await expect(status(page)).toHaveText('Local · 101.5 Kiss FM, New York City');

  await bandKey(page).click();
  await expect(bandKey(page)).toHaveText('FM1WORLD');
  await expect(status(page)).toHaveText('WBGO Jazz, Newark NJ');
  await expect(page.getByRole('button', { name: /^Preset 1:/ })).toHaveAccessibleName('Preset 1: 88.3 WBGO Jazz');
  await bandKey(page).click();
  await expect(status(page)).toHaveText('Local · 101.5 Kiss FM, New York City');

  // Opened again: FM2, where it was left, without asking again.
  await page.reload();
  await expect(status(page)).toHaveText('Local · 101.5 Kiss FM, New York City, off');
  await expect(finder(page)).toBeHidden();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText('FM2 plays the stations near New York NY.')).toBeVisible();
});

test('FM2 can use the phone’s location instead, rounded off; Settings changes it', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop-chrome', 'location stand-ins are reliable in Chromium');
  const asked = await nearby(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 40.71277, longitude: -74.00597 });
  await openDeck(page);
  await bandKey(page).click();
  await finder(page).getByRole('button', { name: 'Use my location' }).click();
  await expect(status(page)).toHaveText('Local · WFUV, New York');
  expect(asked[0]).toContain('geo_lat=40.7&geo_long=-74&');

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText('FM2 plays the stations near your location.')).toBeVisible();
  await page.getByRole('button', { name: 'Change' }).click();
  await finder(page).getByLabel('Or a US ZIP code').fill('10001');
  await finder(page).getByRole('button', { name: 'Find' }).click();
  await expect(page.locator('.look-pocket')).toBeVisible();
  await expect(line(page)).toHaveText('Local stations near you, at their real frequencies.');
});

test('Not now leaves the deck on FM1', async ({ page }) => {
  await nearby(page);
  await openDeck(page);
  await bandKey(page).click();
  await finder(page).getByRole('button', { name: 'Not now' }).click();
  await expect(finder(page)).toBeHidden();
  await expect(bandKey(page)).toHaveText('FM1WORLD');
});

test('the BAND key sits where each look puts it, whole on screen', async ({ page }) => {
  await openDeck(page);
  for (const look of ['Pocket', 'Deck', 'Sport', 'Boombox']) {
    if (look !== 'Pocket') await pickLook(page, look);
    await key(page, 'RADIO').click();
    await expect(bandKey(page)).toBeInViewport({ ratio: 1 });
    await key(page, 'TAPE').click();
    // Deck and Boombox show it on the radio only.
    if (look === 'Deck' || look === 'Boombox') await expect(bandKey(page)).toBeHidden();
    else await expect(bandKey(page)).toBeInViewport({ ratio: 1 });
  }
});
