// The deck's second line, as a ticker when it doesn't fit (rules in logic/ticker.js). It measures the real width,
// never guesses by characters. Still, showing the start, when the phone asks for less motion. Screen readers get
// the plain line once: the moving copy is hidden from them.
import { el } from './el.js';
import { overflows, tickerTiming } from '../logic/ticker.js';

export function createTicker(node) {
  let text = '';
  let glide = null;
  const still = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function plain() {
    if (glide) glide.cancel();
    glide = null;
    node.classList.remove('ticking');
    node.textContent = text;
  }

  // Lays the line out again: plain if it fits, or if motion is off; otherwise the ticker.
  function fit() {
    plain();
    if (!text || still.matches || !overflows(node.scrollWidth, node.clientWidth)) return;
    const once = el('span', { class: 'tick-one' }, text, el('span', { class: 'tick-gap' }, '·'));
    const track = el('span', { class: 'tick-in', 'aria-hidden': 'true' }, once, once.cloneNode(true));
    node.textContent = '';
    node.append(el('span', { class: 'visually-hidden' }, text), track);
    node.classList.add('ticking');
    const loop = once.getBoundingClientRect().width;
    const { duration, holdUntil } = tickerTiming(loop);
    glide = track.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: holdUntil },
        { transform: `translateX(${-loop}px)`, offset: 1 },
      ],
      { duration, iterations: Infinity },
    );
  }

  // Sizes change when the deck is first shown, the phone turns, or the fonts arrive.
  if (window.ResizeObserver) new ResizeObserver(fit).observe(node);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if (still.addEventListener) still.addEventListener('change', fit);

  return {
    set(next) {
      const t = String(next);
      if (t === text) return;
      text = t;
      fit();
    },
  };
}
