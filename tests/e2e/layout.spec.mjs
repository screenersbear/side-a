// Nothing on the deck overlaps (HANDOFF "Layout fixes after the bands pass", Starky 2026-11-14): on an iPhone SE,
// a 14 and a Pro Max held sideways, in all four looks, in RADIO and TAPE, every key, switch and link keeps at least
// 8 px from the next and stays on the screen. A key that's on counts where it's drawn, pressed in. Upright, the
// "Turn it sideways" phone stays clear of the stripes and inside the margins, all the way round its turn.
import { test, expect } from '@playwright/test';
import { openDeck, pickLook } from './side-a-setup.mjs';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name === 'iphone', 'these set their own screen sizes; the other projects cover them');
});

const SIDEWAYS = [[667, 375], [844, 390], [932, 430]];
const UPRIGHT = [[375, 667], [390, 844], [430, 932]];
const MIN_GAP = 8;

// Every control on the deck showing: its name and where it's drawn. Then what's wrong: any that leave the screen,
// and any two closer than 8 px (side by side or one above the other, whichever way they're apart).
function crowding(minGap) {
  const deck = document.querySelector('.deck:not([hidden])');
  const boxes = [...deck.querySelectorAll('button, a, input, select, [role=slider]')]
    .map((e) => ({ name: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24), b: e.getBoundingClientRect() }))
    .filter(({ b }) => b.width > 0 && b.height > 0);
  const problems = [];
  boxes.forEach(({ name, b }) => {
    if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) problems.push(`${name} is off the screen`);
  });
  boxes.forEach((one, i) => boxes.slice(i + 1).forEach((two) => {
    const across = Math.max(two.b.left - one.b.right, one.b.left - two.b.right);
    const down = Math.max(two.b.top - one.b.bottom, one.b.top - two.b.bottom);
    const gap = Math.max(across, down);
    if (gap < minGap) problems.push(`${one.name} and ${two.name} are ${gap.toFixed(1)} px apart`);
  }));
  return { count: boxes.length, problems };
}

for (const look of ['Pocket', 'Deck', 'Sport', 'Boombox']) {
  test(`${look}: keys stay 8 px apart and on the screen, on small and big phones`, async ({ page }) => {
    await openDeck(page);
    if (look !== 'Pocket') await pickLook(page, look);
    for (const [width, height] of SIDEWAYS) {
      await page.setViewportSize({ width, height });
      for (const mode of ['RADIO', 'TAPE']) {
        await page.getByRole('button', { name: mode, exact: true }).click();
        await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(150); // the key finishes pressing in
        const { count, problems } = await page.evaluate(crowding, MIN_GAP);
        expect(count, `${look} ${width}x${height} ${mode}: the controls were found`).toBeGreaterThan(12);
        expect(problems, `${look} ${width}x${height} ${mode}`).toEqual([]);
      }
    }
  });
}

// The upright screen: the circle the phone fills as it turns, the margins, the stripes and the words under it.
function rotateRoom() {
  const screen = document.querySelector('.rotate');
  const svg = document.querySelector('.rotate-phone svg');
  const box = document.querySelector('.rotate-phone').getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const r = Math.hypot(svg.clientWidth, svg.clientHeight) / 2;
  const pad = getComputedStyle(screen);
  let touched = 0;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    const hit = document.elementsFromPoint(x + r * Math.cos(a), y + r * Math.sin(a));
    if (hit.some((e) => e.matches('.rotate-stripes i'))) touched++;
  }
  return {
    touched,
    left: x - r - parseFloat(pad.paddingLeft),
    right: innerWidth - parseFloat(pad.paddingRight) - (x + r),
    above: y - r,
    words: document.querySelector('.rotate-words h2').getBoundingClientRect().top - (y + r),
  };
}

test('upright: the turning phone never meets the stripes and stays inside the margins', async ({ page }) => {
  await openDeck(page);
  for (const [width, height] of UPRIGHT) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('heading', { name: 'Turn it sideways.' })).toBeVisible();
    const room = await page.evaluate(rotateRoom);
    const at = `${width}x${height}`;
    expect(room.touched, `${at}: points where the stripes cross the phone`).toBe(0);
    expect(room.left, `${at}: room inside the left margin`).toBeGreaterThanOrEqual(0);
    expect(room.right, `${at}: room inside the right margin`).toBeGreaterThanOrEqual(0);
    expect(room.above, `${at}: room above`).toBeGreaterThan(0);
    expect(room.words, `${at}: room above "Turn it sideways."`).toBeGreaterThanOrEqual(0);
  }
});
