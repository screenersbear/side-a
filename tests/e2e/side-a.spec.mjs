// SIDE A flows in a real browser: radio, recording a voice note, taping the radio, the shelf, the looks in
// Settings, making a mixtape, the portrait prompt.
// The stations are a stand-in tone, the mic is a test signal and every test is muted, so no internet is needed.
import { test, expect } from '@playwright/test';
import { STATIONS, stationAt } from '../../logic/stations.js';

// No service worker here: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
test.use({ serviceWorkers: 'block' });

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

// In the page: muted sound and a test-signal mic.
function fakeSources({ micError }) {
  // Tests stay silent (Starky's rule: mute while testing the radio).
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function mutedPlay() {
    this.muted = true;
    return play.call(this);
  };
  // Web Audio too (the mix plays through it): every live context's speakers go through a silent gain.
  if (window.BaseAudioContext) {
    const speakers = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination');
    Object.defineProperty(BaseAudioContext.prototype, 'destination', {
      configurable: true,
      get() {
        const real = speakers.get.call(this);
        if (window.OfflineAudioContext && this instanceof OfflineAudioContext) return real;
        if (!this.quiet) {
          this.quiet = this.createGain();
          this.quiet.gain.value = 0;
          this.quiet.connect(real);
        }
        return this.quiet;
      },
    });
  }
  if (micError) {
    // WebKit on GitHub's Linux machines has no mic or recorder at all, so the app would stop at "This browser
    // can't record." Stand in for both, so the test reaches the mic refusing (what an iPhone does).
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    if (!('MediaRecorder' in window)) window.MediaRecorder = class { static isTypeSupported() { return false; } };
  }
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

// In the page: the station named in blocked plays but won't share its sound, like a real station without CORS.
// Asked to share (crossOrigin), it fails to load; asked the plain way, it plays. This is staged in the page
// because Playwright's stand-in answers skip the browser's CORS check.
function blockStation(blocked) {
  const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return src.get.call(this); },
    set(value) { src.set.call(this, value === blocked && this.crossOrigin ? 'data:audio/wav;base64,' : value); },
  });
}

// Every station plays a tone (with a CORS header, so it shares its sound and can be taped).
async function openDeck(page, { micError = '', blocked = '' } = {}) {
  const wav = toneWav();
  const headers = { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' };
  for (const s of STATIONS) {
    await page.route(s.url, (route) => route.fulfill({ status: 200, body: wav, headers }));
  }
  await page.addInitScript(fakeSources, { micError });
  if (blocked) await page.addInitScript(blockStation, blocked);
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
  await expect(status(page)).toHaveText('WBGO Jazz, preset 1, off');
  await page.getByRole('button', { name: /^Preset 2:/ }).click();
  await expect(status(page)).toHaveText('The Current, preset 2');
  // The Current sends no song titles, so the song line stays empty.
  await expect(line(page)).toHaveText('');
  await expect(page.getByRole('button', { name: /^Preset 2:/ })).toHaveAttribute('aria-pressed', 'true');
  await key(page, 'Next station').click();
  const next = STATIONS[stationAt(89.3) + 1];
  await expect(page.locator('.big')).toHaveText(next.freq.toFixed(1));
  await expect(status(page)).toHaveText(next.name);
  await key(page, 'Previous station').click();
  await expect(page.locator('.big')).toHaveText('89.3');
  await key(page, 'Stop').click();
  await expect(status(page)).toHaveText('The Current, preset 2, off');
});

test('Next seeks up the dial to a station that does not allow recording, and Record says so', async ({ page }) => {
  await openDeck(page);
  await key(page, 'Play').click();
  for (let i = stationAt(88.3); i < stationAt(91.1); i++) await key(page, 'Next station').click();
  await expect(page.locator('.big')).toHaveText('91.1');
  await expect(status(page)).toHaveText('WFMU');
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText("Recording isn't allowed on this station.");
  await expect(key(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'RADIO' })).toHaveAttribute('aria-pressed', 'true');
});

test('a station that blocks taping when Record is pressed shows the same message and keeps playing', async ({ page }) => {
  await openDeck(page, { blocked: STATIONS[stationAt(90.3)].url });
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  await expect(status(page)).toHaveText('KEXP, preset 3');
  await key(page, 'Record').click();
  await expect(status(page)).toHaveText("Recording isn't allowed on this station.");
  await expect(page.locator('.big')).toHaveText('90.3');
  await expect(key(page, 'Play')).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByRole('heading', { name: 'Tape shelf' })).toBeVisible();
  const tape = page.getByRole('button', { name: /^Play .*Voice note/ });
  await expect(tape).toHaveCount(1);
  await tape.click();
  await expect(page.getByRole('heading', { name: 'Tape shelf' })).toBeHidden();
  await expect(status(page)).toHaveText(/Tape, (playing|stopped)/);
});

test('tapes the radio and files it under Radio', async ({ page }) => {
  await openDeck(page);
  test.skip(!(await page.evaluate(() => 'MediaRecorder' in window)), 'this browser has no recorder');
  await key(page, 'Play').click();
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 88.3 FM');
  await expect(page.locator('.big')).not.toHaveText('00:00', { timeout: 5000 });
  await page.waitForTimeout(600);
  // Record again stops it, the same as Stop.
  await key(page, 'Record').click();
  await expect(key(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await expect(line(page)).toHaveText(/^88\.3 WBGO Jazz, /);

  await page.getByRole('link', { name: 'Shelf ›' }).click();
  await page.getByRole('button', { name: 'Radio', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Play 88\.3 WBGO Jazz.*Taped from radio/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Voice', exact: true }).click();
  await expect(page.getByText('No voice notes yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Mixes', exact: true }).click();
  await expect(page.getByText('No mixtapes yet.')).toBeVisible();
});

test('taping a station that names its songs puts the song on the tape', async ({ page }) => {
  const song = { results: [{ play_type: 'trackplay', artist: 'The Paper Lanterns', song: 'Night Swim' }] };
  await page.route('https://api.kexp.org/v2/plays/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(song),
  }));
  await openDeck(page);
  test.skip(!(await page.evaluate(() => 'MediaRecorder' in window)), 'this browser has no recorder');
  await page.getByRole('button', { name: /^Preset 3:/ }).click();
  // The deck shows the song while the station plays, in every look.
  await expect(status(page)).toHaveText('KEXP, preset 3');
  await expect(line(page)).toHaveText('Night Swim · The Paper Lanterns');
  await pickLook(page, 'Boombox');
  await expect(line(page)).toHaveText('Night Swim · The Paper Lanterns');
  await expect(page.locator('.look-boombox .now .icon')).toBeVisible();
  await key(page, 'Record').click();
  await expect(line(page)).toHaveText('Taping 90.3 FM');
  await page.waitForTimeout(1200);
  await key(page, 'Stop').click();
  await expect(line(page)).toHaveText('Night Swim · The Paper Lanterns');

  await page.getByRole('link', { name: 'Shelf ›' }).click();
  await expect(page.getByRole('button', { name: /^Play 90\.3, Night Swim by The Paper Lanterns: Taped from radio/ })).toHaveCount(1);
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

const card = (page, look) => page.getByRole('button', { name: new RegExp(`^${look}`, 'i') });
const movingPart = (page) => page.locator('.deck .on.levels, .deck .bay.on, .deck .on.meters, .deck .on.eq-row, .deck .on.speaker');

async function pickLook(page, look) {
  await page.getByRole('link', { name: 'Settings ›' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await card(page, look).click();
  await expect(card(page, look)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Deck', exact: true }).click();
  await expect(page.locator(`.look-${look.toLowerCase()}`)).toBeVisible();
}

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
  await expect(status(page)).toHaveText('The Current, preset 2');
  await pickLook(page, 'Boombox');
  await expect(status(page)).toHaveText('The Current, preset 2');
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
    await expect(status(page)).toHaveText('The Current, preset 2');
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

// Two tapes on the shelf (quiet tones as WAV files), made in the page with the app's own code.
async function addTapes(page) {
  await page.evaluate(async () => {
    const { saveTape } = await import('/data/tapes.js');
    const { encodeWav } = await import('/logic/wav.js');
    const tone = (seconds, hz) => {
      const sound = Float32Array.from({ length: seconds * 8000 }, (_, i) => 0.2 * Math.sin((i / 8000) * 2 * Math.PI * hz));
      return new Blob([encodeWav([sound], 8000)], { type: 'audio/wav' });
    };
    await saveTape({ kind: 'voice', title: 'Note to self', duration: 6, created: 1, mime: 'audio/wav', blob: tone(6, 330) });
    await saveTape({ kind: 'radio', title: '90.3 KEXP, Nov 14', duration: 10, created: 2, mime: 'audio/wav', blob: tone(10, 440) });
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

  // The radio tape (the newest, picked first), its end brought in by 2 seconds.
  await page.getByRole('link', { name: /add clip/i }).click();
  await expect(page.getByRole('heading', { name: 'Add a clip' })).toBeVisible();
  await expect(page.getByRole('button', { name: '90.3 KEXP, Nov 14' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.clip-range')).toHaveText('0:00 to 0:10');
  await page.getByRole('button', { name: 'Move end earlier' }).click();
  await page.getByRole('button', { name: 'Move end earlier' }).click();
  await expect(page.locator('.clip-range')).toHaveText('0:00 to 0:08');
  await page.getByRole('button', { name: /add to mix/i }).click();

  // The whole voice note.
  await page.getByRole('link', { name: /add clip/i }).click();
  await page.getByRole('button', { name: 'Note to self' }).click();
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
  await page.getByRole('button', { name: 'Mixes', exact: true }).click();
  const tape = page.getByRole('button', { name: /^Play .*: Mixtape, 00:09$/ });
  await expect(tape).toHaveCount(1);
  await tape.click();
  await expect(status(page)).toHaveText(/Tape, (playing|stopped)/);
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
