// Which screen the address shows: #/shelf the tape shelf, #/settings Settings, #/mix the mix being made,
// #/clip adding a clip to it. Anything else is the deck.
const SCREENS = ['shelf', 'settings', 'mix', 'clip'];

export function screenFor(hash) {
  const h = String(hash || '').replace(/^#\/?/, '').split(/[?/]/)[0].toLowerCase();
  return SCREENS.includes(h) ? h : 'deck';
}

export function hashFor(screen) {
  return SCREENS.includes(screen) ? `#/${screen}` : '#/';
}
