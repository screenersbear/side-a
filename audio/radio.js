// The radio: plays a station's live stream through one audio element, never through Web Audio.
// A station that lets the app read its stream (CORS) is fed through the app's own connection (radio-feed.js), so
// taping cuts exactly what was heard, from the moment REC is pressed (Starky, 2026-11-14: never a second connection).
// A station that won't is played the plain way and can't be taped. Web Audio is out: on iPhones it hears only
// silence from a live stream, which made radio tapes silent (found 2026-11-14), and a locked iPhone silences it.
// One element for every station: once a tap has started it, the phone lets it play again without another tap.
import { canFeed, createFeed } from './radio-feed.js';

export function createRadio({ onLive, onLost }) {
  let tuned = false;
  let url = '';
  let feed = null;
  let attempt = 0;
  const audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('playing', () => tuned && onLive());
  // A live stream only errors or ends when the signal drops.
  audio.addEventListener('error', () => failed(''));
  audio.addEventListener('ended', () => failed(''));

  function failed(name) {
    if (!tuned) return;
    drop();
    onLost(name);
  }

  function play() {
    const mine = attempt;
    audio.play().catch((error) => {
      // AbortError: a newer station or Stop came first, which is fine.
      if (mine === attempt && error.name !== 'AbortError') failed(error.name);
    });
  }

  // The plain way: the element reads the stream itself.
  function plainly() {
    feed = null;
    audio.removeAttribute('crossorigin');
    audio.src = url;
    play();
  }

  function fed() {
    const mine = attempt;
    feed = createFeed(audio, url, {
      // The station won't let the app read its stream: play it the plain way instead (it just can't be taped).
      onRefused: () => {
        if (mine !== attempt || !tuned) return;
        feed.stop();
        plainly();
      },
      onLost: () => mine === attempt && failed(''),
    });
    play();
  }

  // Nothing left from the last station: its connection closed.
  function drop() {
    attempt += 1;
    if (feed) feed.stop();
    feed = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  return {
    play(nextUrl, tapeable) {
      tuned = true;
      url = nextUrl;
      drop();
      if (tapeable && canFeed()) fed();
      else plainly();
    },
    stop() {
      tuned = false;
      drop();
    },
    // Taping: from the sound playing now. ready settles when the station's sound arrives (or rejects with
    // SecurityError if it refuses the app first); stop() gives the frames heard since; notes() is for the tape
    // check's log. Throws SecurityError when the station is playing the plain way, NotSupportedError when this
    // browser can't feed the player itself (iPhones before iOS 17.1).
    tap() {
      if (!feed) {
        const name = canFeed() ? 'SecurityError' : 'NotSupportedError';
        throw Object.assign(new Error('not taped'), { name });
      }
      const f = feed;
      const from = f.mark();
      return {
        ready: f.heard(),
        stop: () => f.cut(from),
        notes: () => ({ ...f.notes(), from: Number(from.toFixed(2)) }),
      };
    },
  };
}
