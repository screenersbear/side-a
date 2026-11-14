// The symbols, drawn on a grid: outline shapes with one stroke weight. Record is the one red dot (a red bar on
// the Deck look's piano keys).
// Static markup only (no user text), so it's safe to set as HTML.
const SVG = (w, h, vb, body) => `<svg width="${w}" height="${h}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const LINE = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"';

export const ICONS = {
  rec: SVG(20, 20, '0 0 20 20', '<circle cx="10" cy="10" r="6.5" fill="#E8322B"/>'),
  recBar: SVG(26, 4, '0 0 26 4', '<rect width="26" height="4" fill="#E8322B"/>'),
  play: SVG(20, 20, '0 0 22 22', `<path d="M6 4 L18 11 L6 18 Z" ${LINE}/>`),
  rew: SVG(24, 20, '0 0 26 22', `<path d="M12 5 L4 11 L12 17 Z M22 5 L14 11 L22 17 Z" ${LINE}/>`),
  ff: SVG(24, 20, '0 0 26 22', `<path d="M4 5 L12 11 L4 17 Z M14 5 L22 11 L14 17 Z" ${LINE}/>`),
  stop: SVG(20, 20, '0 0 22 22', `<rect x="5" y="5" width="12" height="12" ${LINE}/>`),
  back: SVG(16, 16, '0 0 16 16', '<path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // The mix screens: add, cut, and the two joins between clips (fade in, straight on).
  plus: SVG(12, 12, '0 0 12 12', '<path d="M6 1 V11 M1 6 H11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  cut: SVG(16, 16, '0 0 16 16', '<circle cx="4" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 10 L12 2 M10.5 10 L4 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  fadeIn: SVG(28, 20, '0 0 28 20', '<path d="M2 18 L26 2 L26 18 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  straight: SVG(28, 20, '0 0 28 20', '<path d="M14 2 V18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  // The tape menu's close button.
  close: SVG(16, 16, '0 0 16 16', '<path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  // Boombox: beside the song playing.
  note: SVG(14, 14, '0 0 14 14', '<path d="M5 11 V3 L12 1.5 V9.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3.5" cy="11" r="1.8" fill="currentColor"/><circle cx="10.5" cy="9.5" r="1.8" fill="currentColor"/>'),
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = ICONS[name];
  return span;
}
