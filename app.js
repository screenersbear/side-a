// SIDE A: starts the deck, keeps its state, sends each change to the sound engine, and switches between
// the deck, the tape shelf, Settings and the mix screens (the address after # says which).
import { startState, deckReducer, SHORT_NOTICE_MS, savedText } from './logic/deck.js';
import { deckView } from './logic/deck-view.js';
import { soundPlan } from './logic/sound-plan.js';
import { STATIONS } from './logic/stations.js';
import { screenFor, hashFor } from './logic/routes.js';
import { lookFor } from './logic/looks.js';
import { loadSettings, saveSettings, loadLook, saveLook, loadPresets, savePresets } from './data/settings.js';
import { listTapes, newestTape } from './data/tapes.js';
import { createEngine } from './audio/engine.js';
import { createDeckPage } from './pages/deck.js';
import { createShelfPage } from './pages/shelf.js';
import { createSettingsPage } from './pages/settings.js';
import { createMixing } from './pages/mixing.js';

const root = document.getElementById('app');
const themeColor = document.querySelector('meta[name="theme-color"]');
let state = startState({ ...loadSettings(), presets: loadPresets() });
let carryOut = () => {};

function dispatch(action) {
  const next = deckReducer(state, action);
  if (next === state) return;
  const prev = state;
  state = next;
  // Sound first, in the same tap, so phones let it play.
  carryOut(soundPlan(prev, next, action.type));
  if (next.station !== prev.station || next.source !== prev.source) saveSettings({ freq: STATIONS[next.station].freq, source: next.source });
  if (next.presets !== prev.presets) savePresets(next.presets);
  // "Saved to preset 2" shows for a moment, then the status line comes back.
  if (action.type === 'savePreset' && next.notice === savedText(action.key)) {
    setTimeout(() => dispatch({ type: 'calm', text: next.notice }), SHORT_NOTICE_MS);
  }
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
  onNewMix: () => mixing.fresh(),
});
const settings = createSettingsPage({ onPick: wearLook });
const mixing = createMixing({
  onSaved: () => {
    location.hash = hashFor('shelf');
  },
  // The mix plays alone: the deck stops (unless it's taping, which carries on).
  quiet: () => {
    if (!state.recording) dispatch({ type: 'stop' });
  },
});
carryOut = createEngine(dispatch);

function refreshShelf() {
  listTapes().then(shelf.show, () => shelf.show([]));
}

const TITLES = { deck: 'SIDE A', shelf: 'Tape shelf · SIDE A', settings: 'Settings · SIDE A', mix: 'New mix · SIDE A', clip: 'Add a clip · SIDE A' };

function showScreen() {
  const screen = screenFor(location.hash);
  deck.node.hidden = screen !== 'deck';
  shelf.node.hidden = screen !== 'shelf';
  settings.node.hidden = screen !== 'settings';
  mixing.mixNode.hidden = screen !== 'mix';
  mixing.clipNode.hidden = screen !== 'clip';
  document.title = TITLES[screen];
  if (screen === 'shelf') refreshShelf();
  if (screen === 'mix') mixing.showMix();
  else mixing.leave();
  if (screen === 'clip') mixing.showClip();
}

root.replaceChildren(deck.node, shelf.node, settings.node, ...mixing.nodes);
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
