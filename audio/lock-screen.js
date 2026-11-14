// The phone's lock screen and Control Center (Media Session): what plays (station or tape, the song, a cassette
// picture), and their buttons work the deck. Skip changes station on the radio and jumps 10 seconds on a tape.
// Browsers without Media Session just don't show it. What it says comes from logic/lock-screen.js.
import { lockScreen } from '../logic/lock-screen.js';

const ARTWORK = [
  { src: 'images/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: 'images/icon-512.png', sizes: '512x512', type: 'image/png' },
];

// Returns update(state), to call after every change to the deck.
export function createLockScreen(dispatch, session = globalThis.navigator && navigator.mediaSession) {
  if (!session) return () => {};
  // A button the phone doesn't have throws: leave it out.
  const handle = (action, run) => {
    try {
      session.setActionHandler(action, run ? () => run() : null);
    } catch {
      // not on this phone
    }
  };
  const send = (type) => () => dispatch({ type });
  handle('play', send('play'));
  handle('pause', send('stop'));
  handle('stop', send('stop'));
  let shown = '';

  return function update(state) {
    const info = lockScreen(state);
    const key = JSON.stringify(info);
    if (key === shown) return;
    shown = key;
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({ title: info.title, artist: info.artist, album: info.album, artwork: ARTWORK });
    }
    session.playbackState = info.playing ? 'playing' : 'paused';
    handle('previoustrack', info.skip === 'station' && send('rew'));
    handle('nexttrack', info.skip === 'station' && send('ff'));
    handle('seekbackward', info.skip === 'seek' && send('rew'));
    handle('seekforward', info.skip === 'seek' && send('ff'));
  };
}
