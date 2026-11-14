// Which screen the address shows: #/shelf is the tape shelf, anything else is the deck.
export function screenFor(hash) {
  const h = String(hash || '').replace(/^#\/?/, '').split(/[?/]/)[0].toLowerCase();
  return h === 'shelf' ? 'shelf' : 'deck';
}

export function hashFor(screen) {
  return screen === 'shelf' ? '#/shelf' : '#/';
}
