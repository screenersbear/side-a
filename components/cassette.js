// The cassette, at a real compact cassette's proportions (100.4 x 63.8 mm). Drawn in tenths of a millimetre.
// Used by the deck and the shelf. Sizes itself to its box; the words on the label scale with it.
import { el, setText } from './el.js';

const NS = 'http://www.w3.org/2000/svg';
let count = 0;

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function hub(colors) {
  const svg = svgEl('svg', { viewBox: '0 0 96 96', width: '100%', height: '100%', 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { cx: 48, cy: 48, r: 46, fill: colors.hub }), svgEl('circle', { cx: 48, cy: 48, r: 30, fill: colors.win }));
  for (let a = 0; a < 360; a += 60) {
    svg.append(svgEl('rect', { x: 45, y: 18, width: 6, height: 12, fill: colors.hub, transform: `rotate(${a} 48 48)` }));
  }
  return svg;
}

function noise(id, frequency, seed) {
  const filter = svgEl('filter', { id });
  filter.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: frequency, numOctaves: 2, seed, stitchTiles: 'stitch' }),
    svgEl('feColorMatrix', { type: 'saturate', values: 0 }),
  );
  return filter;
}

// The printed finish (HANDOFF.md): halftone tape packs, a dark off-register sliver under the band, slightly
// spread ink on every shape, and paper grain over it all.
function printDefs(ids, colors) {
  const dots = svgEl('pattern', { id: ids.dots, width: 11, height: 11, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  dots.append(svgEl('circle', { cx: 5.5, cy: 5.5, r: 3.4, fill: colors.pack }));
  const spread = svgEl('filter', { id: ids.spread, x: '-2%', y: '-2%', width: '104%', height: '104%' });
  spread.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.8, numOctaves: 2, seed: 4, result: 'n' }),
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 3 }),
  );
  return [dots, spread, noise(ids.grain, 0.95, 9)];
}

// Three tones (HANDOFF "Depth pass"), flat and hard-edged so it still reads as print: a white band along the
// shell's top and left edge, an ink band along its bottom and right (clipped to the rounded shell), and a thin
// shadow under and right of the label.
function shellTones(clipId) {
  const tones = svgEl('g', { 'clip-path': `url(#${clipId})` });
  tones.append(
    svgEl('rect', { width: 1004, height: 10, fill: '#FFFFFF', opacity: 0.5 }),
    svgEl('rect', { width: 10, height: 638, fill: '#FFFFFF', opacity: 0.5 }),
    svgEl('rect', { y: 626, width: 1004, height: 12, fill: '#29323A', opacity: 0.3 }),
    svgEl('rect', { x: 992, width: 12, height: 638, fill: '#29323A', opacity: 0.3 }),
  );
  return [tones, svgEl('rect', { x: 57, y: 47, width: 904, height: 400, rx: 16, fill: '#29323A', opacity: 0.22 })];
}

// The window: a dark band along its top, a faint light band at its bottom.
function windowTones() {
  return [
    svgEl('rect', { x: 200, y: 205, width: 604, height: 16, fill: '#12171B', opacity: 0.55 }),
    svgEl('rect', { x: 200, y: 383, width: 604, height: 12, fill: '#FFFFFF', opacity: 0.14 }),
  ];
}

function body(colors, n, printed, bandBig) {
  const ids = { clip: `cassette-window-${n}`, shell: `cassette-shell-${n}`, dots: `cassette-dots-${n}`, spread: `cassette-spread-${n}`, grain: `cassette-grain-${n}` };
  const svg = svgEl('svg', { class: 'cassette-art', viewBox: '0 0 1004 638', 'aria-hidden': 'true', focusable: 'false' });
  const defs = svgEl('defs', {});
  const clip = svgEl('clipPath', { id: ids.clip });
  clip.append(svgEl('rect', { x: 200, y: 205, width: 604, height: 190, rx: 30 }));
  const shellClip = svgEl('clipPath', { id: ids.shell });
  shellClip.append(svgEl('rect', { width: 1004, height: 638, rx: 32 }));
  defs.append(clip, shellClip, ...(printed ? printDefs(ids, colors) : []));
  const packFill = printed ? `url(#${ids.dots})` : colors.pack;
  // The band: a thin stripe low on the label, or (Deck look) a wide one across the middle.
  const band = bandBig ? { y: 180, height: 260 } : { y: 405, height: 26 };
  const packs = svgEl('g', { 'clip-path': `url(#${ids.clip})` });
  packs.append(svgEl('circle', { cx: 289.5, cy: 300, r: 135, fill: packFill }), svgEl('circle', { cx: 714.5, cy: 300, r: 95, fill: packFill }));
  if (printed) packs.append(...windowTones());
  const shapes = svgEl('g', printed ? { filter: `url(#${ids.spread})` } : {});
  shapes.append(
    svgEl('rect', { width: 1004, height: 638, rx: 32, fill: colors.shell }),
    ...(printed ? shellTones(ids.shell) : []),
    svgEl('rect', { x: 50, y: 40, width: 904, height: 400, rx: 16, fill: colors.label }),
    ...(printed ? [svgEl('rect', { x: 56, y: band.y + 5, width: 904, height: band.height, fill: '#29323A', opacity: 0.35 })] : []),
    svgEl('rect', { x: 50, y: band.y, width: 904, height: band.height, fill: colors.band }),
    svgEl('rect', { x: 200, y: 205, width: 604, height: 190, rx: 30, fill: colors.win }),
    packs,
    svgEl('polygon', { points: '170,520 834,520 774,638 230,638', fill: 'none', stroke: colors.win, 'stroke-width': 4 }),
    svgEl('circle', { cx: 330, cy: 585, r: 16, fill: colors.win }),
    svgEl('circle', { cx: 674, cy: 585, r: 16, fill: colors.win }),
    svgEl('rect', { x: 472, y: 562, width: 60, height: 40, rx: 6, fill: colors.win }),
    ...[[25, 25], [979, 25], [25, 613], [979, 613], [502, 590]].map(([cx, cy]) => svgEl('circle', { cx, cy, r: 9, fill: colors.win })),
  );
  svg.append(defs, shapes);
  if (printed) {
    svg.append(svgEl('rect', { class: 'c-grain', width: 1004, height: 638, rx: 32, filter: `url(#${ids.grain})`, opacity: 0.22 }));
  }
  return svg;
}

// Printed label text: an INDEX line under the title, and the tape type in the band (thin bands only).
function labelText() {
  return [
    el('span', { class: 'c-index-line', 'aria-hidden': 'true' }),
    el('span', { class: 'c-index', 'aria-hidden': 'true' }, 'INDEX'),
    el('span', { class: 'c-band-text', 'aria-hidden': 'true' }, 'COMPACT CASSETTE · NORMAL BIAS 120 µs · IEC TYPE I'),
  ];
}

const DEFAULTS = { shell: '#B9C1BC', label: '#FAFAF7', band: '#FF8A3D', win: '#29323A', pack: '#7C868C', hub: '#FAFAF7', ink: '#29323A' };

// colors: shell, label, band, win, pack, hub, ink (label text). printed: the printed finish (the deck's cassette).
// bandBig: the wide band of the Deck look. Returns { node, update({ title, side, len, counter, rec, reelOn }) }.
export function createCassette(colorsIn = {}, { printed = false, bandBig = false } = {}) {
  const colors = { ...DEFAULTS, ...colorsIn };
  count += 1;
  const reels = [el('div', { class: 'reel reel-left' }, hub(colors)), el('div', { class: 'reel reel-right' }, hub(colors))];
  const title = el('span', { class: 'c-title' });
  const side = el('span', { class: 'c-side' }, 'A');
  const len = el('span', { class: 'c-len' }, 'C90');
  const counter = el('span', { class: 'c-counter' });
  const rec = el('span', { class: 'c-rec', hidden: true }, el('span', { class: 'c-rec-dot blink' }), 'REC');
  const node = el(
    'div',
    { class: 'cassette', style: { '--label-ink': colors.ink } },
    body(colors, count, printed, bandBig), ...reels, counter, title, rec, ...(printed && !bandBig ? labelText() : []), side, len,
  );

  function update(v = {}) {
    setText(title, v.title ?? '');
    setText(side, v.side ?? 'A');
    setText(len, v.len ?? 'C90');
    setText(counter, v.counter ?? '');
    rec.hidden = !v.rec;
    reels.forEach((r) => r.classList.toggle('on', Boolean(v.reelOn)));
  }
  return { node, update };
}
