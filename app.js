// SIDE A: starts the deck, keeps its state, sends each change to the sound engine and the lock screen, and switches
// between the deck, the tape shelf (with its tape menu), Settings and the mix screens (the address after # says which).
// FM2 LOCAL's stations are found the first time FM2 is asked for (the local finder box), and kept on the phone.
import { startState, deckReducer, SHORT_NOTICE_MS, savedText } from './logic/deck.js';
import { deckView } from './logic/deck-view.js';
import { soundPlan } from './logic/sound-plan.js';
import { bandMemory } from './logic/bands.js';
import { screenFor, hashFor } from './logic/routes.js';
import { lookFor } from './logic/looks.js';
import {
  loadSettings, saveSettings, loadLook, saveLook, loadPresets, savePresets, loadLocalPresets, saveLocalPresets, loadClicks, saveClicks,
} from './data/settings.js';
import { loadLocal, saveLocal } from './data/local-stations.js';
import { clickFor } from './logic/key-clicks.js';
import { lockedOn } from './logic/dial.js';
import { listTapes, newestTape, renameTape, deleteTape } from './data/tapes.js';
import { shareFile } from './data/share.js';
import { createEngine } from './audio/engine.js';
import { makeFile } from './audio/export.js';
import { forgetTape } from './audio/mixdown.js';
import { createLockScreen } from './audio/lock-screen.js';
import { createStayAwake } from './audio/stay-awake.js';
import { createKeyClicks } from './audio/key-clicks.js';
import { createDeckPage } from './pages/deck.js';
import { createShelfPage } from './pages/shelf.js';
import { createSettingsPage } from './pages/settings.js';
import { createMixing } from './pages/mixing.js';
import { createTapeMenu } from './components/tape-menu.js';
import { createLocalFinder } from './components/local-finder.js';

const root = document.getElementById('app');
const themeColor = document.querySelector('meta[name="theme-color"]');
const local = loadLocal();
let state = startState({ ...loadSettings(), presets: loadPresets(), localPresets: loadLocalPresets() }, local ? local.stations : []);
let carryOut = () => {};
let showLock = () => {};
const awake = createStayAwake();
// Keys click like a real deck's (Settings can turn it off).
const clicks = createKeyClicks();
let clicksOn = loadClicks();

// Each band's last station and presets, and the record source, kept on the phone.
function remember(prev, next) {
  if (['station', 'band', 'local', 'source', 'presets', 'other'].every((k) => next[k] === prev[k])) return;
  const keep = bandMemory(next);
  saveSettings({ ...keep, source: next.source });
  savePresets(keep.presets);
  saveLocalPresets(keep.localPresets);
}

function dispatch(action) {
  // FM2 before its stations are found: ask where the user is first.
  if (action.type === 'band' && state.band === 'world' && !state.local.length && !state.recording) return finder.open();
  const next = deckReducer(state, action);
  if (next === state) return;
  const prev = state;
  state = next;
  // Sound first, in the same tap, so phones let it play.
  carryOut(soundPlan(prev, next, action.type));
  // The tuning wheel clicks softly as it locks onto a station.
  if (action.type === 'dial' && clicksOn && lockedOn(prev, next)) clicks.play('tick');
  remember(prev, next);
  // "Saved to preset 2" shows for a moment, then the status line comes back.
  if (action.type === 'savePreset' && next.notice === savedText(action.key)) {
    setTimeout(() => dispatch({ type: 'calm', text: next.notice }), SHORT_NOTICE_MS);
  }
  deck.update(deckView(next));
  showLock(next);
  // The screen stays on while recording: when the phone locks, a web app stops recording.
  awake.want('recording', next.recording);
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

// Tapping a tape on the shelf opens its menu: Play, Share (MP3 or WAV), Rename, Delete.
const menu = createTapeMenu({
  onPlay: (tape) => {
    dispatch({ type: 'load', tape });
    location.hash = hashFor('deck');
  },
  onRename: async (tape, title) => {
    const renamed = await renameTape(tape.id, title);
    dispatch({ type: 'retitle', tape: renamed });
    refreshShelf();
    return renamed;
  },
  onDelete: async (tape) => {
    await deleteTape(tape.id);
    forgetTape(tape.id);
    mixing.forget(tape.id);
    dispatch({ type: 'eject', id: tape.id });
    refreshShelf();
  },
  // The screen stays on while the file is made.
  makeFile: async (...args) => {
    awake.want('export', true);
    try {
      return await makeFile(...args);
    } finally {
      awake.want('export', false);
    }
  },
  share: shareFile,
});

const shelf = createShelfPage({
  onPick: (tape) => menu.open(tape),
  onBlank: () => {
    dispatch({ type: 'blank' });
    location.hash = hashFor('deck');
  },
  onNewMix: () => mixing.fresh(),
});
const settings = createSettingsPage({ onPick: wearLook, onClicks: setClicks, onLocal: () => finder.open() });
// Local stations found: kept on the phone, and FM2 opens on them, on the deck.
const finder = createLocalFinder({
  onFound: (found) => {
    saveLocal(found);
    settings.showLocal(found.where.label);
    dispatch({ type: 'locals', list: found.stations });
    location.hash = hashFor('deck');
  },
});

// Every key on the deck and in Settings clicks.
function setClicks(on) {
  clicksOn = on;
  saveClicks(on);
  settings.showClicks(on);
}
document.addEventListener('click', (e) => {
  const key = clicksOn && e.target.closest && e.target.closest('.deck button, .deck .tk, .settings button, .settings a');
  if (key) clicks.play(clickFor(key.dataset.key));
}, true);
const mixing = createMixing({
  // The new mixtape is on the shelf, with its menu open to share it.
  onSaved: (tape, warning) => {
    location.hash = hashFor('shelf');
    menu.open(tape, { saved: true, warning });
  },
  // The mix plays alone: the deck stops (unless it's taping, which carries on).
  quiet: () => {
    if (!state.recording) dispatch({ type: 'stop' });
  },
});
carryOut = createEngine(dispatch);
showLock = createLockScreen(dispatch);

// A web app can't record with the phone locked or another app in front: stop and save what was taped.
// The radio and tapes play on (Starky: it should play when you lock or switch apps).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) dispatch({ type: 'hidden' });
});
// Closing the app stops the sound. pagehide is the page being closed (or left for another page), not the phone
// locking or another app coming up. iPhones may not say when a home-screen app is swiped away: then only a native
// wrapper can stop it.
window.addEventListener('pagehide', (e) => {
  if (!e.persisted) dispatch({ type: 'closing' });
});

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
  else menu.close();
  if (screen === 'mix') mixing.showMix();
  else mixing.leave();
  if (screen === 'clip') mixing.showClip();
}

root.replaceChildren(deck.node, shelf.node, settings.node, ...mixing.nodes, menu.node, finder.node);
deck.update(deckView(state));
showLock(state);
settings.show(deck.look);
settings.showClicks(clicksOn);
settings.showLocal(local ? local.where.label : null);
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
