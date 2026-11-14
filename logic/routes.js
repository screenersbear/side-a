// Which screen the address shows: #/shelf is the tape shelf, #/settings is Settings, anything else is the deck.
const SCREENS = ['shelf', 'settings'];

export function screenFor(hash) {
  const h = String(hash || '').replace(/^#\/?/, '').split(/[?/]/)[0].toLowerCase();
  return SCREENS.includes(h) ? h : 'deck';
}

export function hashFor(screen) {
  return SCREENS.includes(screen) ? `#/${screen}` : '#/';
}
