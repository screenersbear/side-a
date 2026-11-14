// SIDE A: starts the deck, keeps its state, sends each change to the sound engine, and switches between
// the deck, the tape shelf and Settings (the address after # says which).
import { startState, deckReducer } from './logic/deck.js';
import { deckView } from './logic/deck-view.js';
import { soundPlan } from './logic/sound-plan.js';
import { STATIONS } from './logic/stations.js';
import { screenFor, hashFor } from './logic/routes.js';
import { lookFor } from './logic/looks.js';
import { loadSettings, saveSettings, loadLook, saveLook } from './data/settings.js';
import { listTapes, newestTape } from './data/tapes.js';
import { createEngine } from './audio/engine.js';
import { createDeckPage } from './pages/deck.js';
import { createShelfPage } from './pages/shelf.js';
import { createSettingsPage } from './pages/settings.js';

const root = document.getElementById('app');
const themeColor = document.querySelector('meta[name="theme-color"]');
let state = startState(loadSettings());
let carryOut = () => {};

function dispatch(action) {
  const next = deckReducer(state, action);
  if (next === state) return;
  const prev = state;
  state = next;
  // Sound first, in the same tap, so phones let it play.
  carryOut(soundPlan(prev, next, action.type));
  if (next.station !== prev.station || next.source !== prev.source) saveSettings({ freq: STATIONS[next.station].freq, source: next.source });
  deck.update(deckView(next));
  if (action.type === 'saved' && screenFor(location.hash) === 'shelf') refreshShelf();
}

let deck = createDeckPage(dispatch, loadLook());

// A new look builds a new deck screen; the deck's state (and whatever is playing) carries on as it was.
function wearLook(id) {
  saveLook(id);
  const next = createDeckPage(dispatch, id);
  next.update(deckView(state));
  next.node.hidden = deck.node.hidden;
  deck.node.replaceWith(next.node);
  deck = next;
  settings.show(deck.look);
  if (themeColor) themeColor.setAttribute('content', lookFor(deck.look).body);
}

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
const settings = createSettingsPage({ onPick: wearLook });
carryOut = createEngine(dispatch);

function refreshShelf() {
  listTapes().then(shelf.show, () => shelf.show([]));
}

const TITLES = { deck: 'SIDE A', shelf: 'Tape shelf · SIDE A', settings: 'Settings · SIDE A' };

function showScreen() {
  const screen = screenFor(location.hash);
  deck.node.hidden = screen !== 'deck';
  shelf.node.hidden = screen !== 'shelf';
  settings.node.hidden = screen !== 'settings';
  document.title = TITLES[screen];
  if (screen === 'shelf') refreshShelf();
}

root.replaceChildren(deck.node, shelf.node, settings.node);
deck.update(deckView(state));
settings.show(deck.look);
if (themeColor) themeColor.setAttribute('content', lookFor(deck.look).body);
showScreen();
window.addEventListener('hashchange', showScreen);

// The newest tape waits in the deck for when Tape is pressed.
newestTape().then((tape) => tape && dispatch({ type: 'restore', tape }), () => {});

// Keep a copy of the app on the phone so it opens offline (tapes play without the internet; the radio needs it).
// Also on 127.0.0.1, the test server, so the offline check runs. Not on localhost, so edits show up while working.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
