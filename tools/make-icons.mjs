// Draws the Home Screen icon (the Pocket look's oval tape window and red pinstripe) and saves it as PNGs in images/.
// Uses the test browser to turn the drawing into pictures: npm run build.
import { chromium } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'images');
mkdirSync(out, { recursive: true });

function hub(cx, cy) {
  const teeth = [0, 60, 120, 180, 240, 300]
    .map((a) => `<rect x="${cx - 4}" y="${cy - 38}" width="8" height="14" fill="#FAFAF7" transform="rotate(${a} ${cx} ${cy})"/>`)
    .join('');
  return `<circle cx="${cx}" cy="${cy}" r="46" fill="#FAFAF7"/><circle cx="${cx}" cy="${cy}" r="30" fill="#29323A"/>${teeth}`;
}

// scale < 1 leaves the empty edge that "maskable" icons need.
function art(scale) {
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><clipPath id="w"><rect x="56" y="168" width="400" height="176" rx="88"/></clipPath></defs>
  <rect width="512" height="512" fill="#FAFAF7"/>
  <g transform="${t}">
    <rect x="0" y="92" width="512" height="18" fill="#E8322B"/>
    <rect x="56" y="168" width="400" height="176" rx="88" fill="#29323A"/>
    <g clip-path="url(#w)"><circle cx="176" cy="256" r="118" fill="#7C868C"/><circle cx="336" cy="256" r="78" fill="#7C868C"/></g>
    ${hub(176, 256)}${hub(336, 256)}
    <rect x="40" y="152" width="432" height="208" rx="104" fill="none" stroke="#29323A" stroke-width="14"/>
    <rect x="136" y="398" width="240" height="14" fill="#E8322B"/>
  </g>
</svg>`;
}

const SIZES = [
  { file: 'icon-180.png', size: 180, scale: 1 },
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, scale } of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${art(scale).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: join(out, file), clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`images/${file}`);
}
await browser.close();
