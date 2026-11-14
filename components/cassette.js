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

function body(colors, clipId) {
  const svg = svgEl('svg', { class: 'cassette-art', viewBox: '0 0 1004 638', 'aria-hidden': 'true', focusable: 'false' });
  const defs = svgEl('defs', {});
  const clip = svgEl('clipPath', { id: clipId });
  clip.append(svgEl('rect', { x: 200, y: 205, width: 604, height: 190, rx: 30 }));
  defs.append(clip);
  const packs = svgEl('g', { 'clip-path': `url(#${clipId})` });
  packs.append(svgEl('circle', { cx: 289.5, cy: 300, r: 135, fill: colors.pack }), svgEl('circle', { cx: 714.5, cy: 300, r: 95, fill: colors.pack }));
  svg.append(
    defs,
    svgEl('rect', { width: 1004, height: 638, rx: 32, fill: colors.shell }),
    svgEl('rect', { x: 50, y: 40, width: 904, height: 400, rx: 16, fill: colors.label }),
    svgEl('rect', { x: 50, y: 405, width: 904, height: 26, fill: colors.band }),
    svgEl('rect', { x: 200, y: 205, width: 604, height: 190, rx: 30, fill: colors.win }),
    packs,
    svgEl('polygon', { points: '170,520 834,520 774,638 230,638', fill: 'none', stroke: colors.win, 'stroke-width': 4 }),
    svgEl('circle', { cx: 330, cy: 585, r: 16, fill: colors.win }),
    svgEl('circle', { cx: 674, cy: 585, r: 16, fill: colors.win }),
    svgEl('rect', { x: 472, y: 562, width: 60, height: 40, rx: 6, fill: colors.win }),
    ...[[25, 25], [979, 25], [25, 613], [979, 613], [502, 590]].map(([cx, cy]) => svgEl('circle', { cx, cy, r: 9, fill: colors.win })),
  );
  return svg;
}

const DEFAULTS = { shell: '#B9C1BC', label: '#FAFAF7', band: '#FF8A3D', win: '#29323A', pack: '#7C868C', hub: '#FAFAF7', ink: '#29323A' };

// colors: shell, label, band, win, pack, hub, ink (label text). Returns { node, update({ title, side, len, counter, rec, reelOn }) }.
export function createCassette(colorsIn = {}) {
  const colors = { ...DEFAULTS, ...colorsIn };
  count += 1;
  const reels = [el('div', { class: 'reel reel-left' }, hub(colors)), el('div', { class: 'reel reel-right' }, hub(colors))];
  const title = el('span', { class: 'c-title' });
  const side = el('span', { class: 'c-side' }, 'A');
  const len = el('span', { class: 'c-len' }, 'C90');
  const counter = el('span', { class: 'c-counter' });
  const rec = el('span', { class: 'c-rec', hidden: true }, el('span', { class: 'c-rec-dot blink' }), 'REC');
  const node = el('div', { class: 'cassette', style: { '--label-ink': colors.ink } }, body(colors, `cassette-window-${count}`), ...reels, counter, title, rec, side, len);

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
