// SIDE A: starts the deck, keeps its state, sends each change to the sound engine, and switches between
// the deck and the tape shelf (the address after # says which).
import { startState, deckReducer } from './logic/deck.js';
import { deckView } from './logic/deck-view.js';
import { soundPlan } from './logic/sound-plan.js';
import { screenFor, hashFor } from './logic/routes.js';
import { loadSettings, saveSettings } from './data/settings.js';
import { listTapes, newestTape } from './data/tapes.js';
import { createEngine } from './audio/engine.js';
import { createDeckPage } from './pages/deck.js';
import { createShelfPage } from './pages/shelf.js';

const root = document.getElementById('app');
let state = startState(loadSettings());
let carryOut = () => {};

function dispatch(action) {
  const next = deckReducer(state, action);
  if (next === state) return;
  const prev = state;
  state = next;
  // Sound first, in the same tap, so phones let it play.
  carryOut(soundPlan(prev, next, action.type));
  if (next.station !== prev.station || next.source !== prev.source) saveSettings(next);
  deck.update(deckView(next));
  if (action.type === 'saved' && screenFor(location.hash) === 'shelf') refreshShelf();
}

const deck = createDeckPage(dispatch);
const shelf = createShelfPage({
  onPick: (tape) => {
    dispatch({ type: 'load', tape });
    location.hash = hashFor('deck');
  },
  onBlank: () => {
    dispatch({ type: 'blank' });
    location.hash = hashFor('deck');
  },
});
carryOut = createEngine(dispatch);

function refreshShelf() {
  listTapes().then(shelf.show, () => shelf.show([]));
}

function showScreen() {
  const screen = screenFor(location.hash);
  deck.node.hidden = screen !== 'deck';
  shelf.node.hidden = screen !== 'shelf';
  document.title = screen === 'shelf' ? 'Tape shelf · SIDE A' : 'SIDE A';
  if (screen === 'shelf') refreshShelf();
}

root.replaceChildren(deck.node, shelf.node);
deck.update(deckView(state));
showScreen();
window.addEventListener('hashchange', showScreen);

// The newest tape waits in the deck for when Tape is pressed.
newestTape().then((tape) => tape && dispatch({ type: 'restore', tape }), () => {});

// Keep a copy of the app on the phone so it opens offline (tapes play without the internet; the radio needs it).
// Also on 127.0.0.1, the test server, so the offline check runs. Not on localhost, so edits show up while working.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
