// The transport key symbols, drawn on a grid: outline shapes with one stroke weight. Record is the one red dot.
// Static markup only (no user text), so it's safe to set as HTML.
const SVG = (w, h, vb, body) => `<svg width="${w}" height="${h}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const LINE = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"';

export const ICONS = {
  rec: SVG(20, 20, '0 0 20 20', '<circle cx="10" cy="10" r="6.5" fill="#E8322B"/>'),
  play: SVG(20, 20, '0 0 22 22', `<path d="M6 4 L18 11 L6 18 Z" ${LINE}/>`),
  rew: SVG(24, 20, '0 0 26 22', `<path d="M12 5 L4 11 L12 17 Z M22 5 L14 11 L22 17 Z" ${LINE}/>`),
  ff: SVG(24, 20, '0 0 26 22', `<path d="M4 5 L12 11 L4 17 Z M14 5 L22 11 L14 17 Z" ${LINE}/>`),
  stop: SVG(20, 20, '0 0 22 22', `<rect x="5" y="5" width="12" height="12" ${LINE}/>`),
  back: SVG(16, 16, '0 0 16 16', '<path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = ICONS[name];
  return span;
}
