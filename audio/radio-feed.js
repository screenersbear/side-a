// The radio's one connection to a station that lets the app read its stream (CORS): the app reads it, frame by
// frame (logic/stream-frames.js), and hands it to the audio element through a MediaSource. Because the app keeps the
// frames it handed over, a radio tape is cut from exactly the sound that played, from the moment REC was pressed.
// (Web Audio can't tape it: on iPhones it hears only silence from a live stream. Found 2026-11-14.)
import { createFrameReader, framesBetween, MIME } from '../logic/stream-frames.js';

// Seconds of sound kept behind the play line, in the player and in memory (all of it while taping).
const KEEP = 30;

const Source = () => window.ManagedMediaSource || window.MediaSource;

// Can this browser feed an audio element itself? (iPhones: iOS 17.1 or later.)
export function canFeed() {
  const MS = Source();
  return Boolean(MS && MS.isTypeSupported && MS.isTypeSupported(MIME.mp3));
}

function joined(frames) {
  const bytes = new Uint8Array(frames.reduce((n, f) => n + f.bytes.length, 0));
  let i = 0;
  for (const f of frames) {
    bytes.set(f.bytes, i);
    i += f.bytes.length;
  }
  return bytes;
}

// Feeds `audio` from the station at `url`. onRefused(): the station wouldn't let the app read it (nothing played).
// onLost(): the stream broke or ended after it had started.
export function createFeed(audio, url, { onRefused, onLost }) {
  const MS = Source();
  const source = new MS();
  const control = new AbortController();
  const reader = createFrameReader();
  const queue = []; // { bytes, change } waiting for the player
  let frames = []; // what was handed over, with times (the last KEEP seconds, or everything while taping)
  let buffer = null;
  let last = null; // the last frame handed over
  let heard = false; // any sound arrived
  let done = false;
  let stopped = false;
  let tapingFrom = null; // seconds into the stream where the tape starts, while taping
  let stoppedAt = 0; // where the sound was when the feed stopped (a tape cut after that ends there)
  // Settles once: the first sound arrived, or the station refused (SecurityError) or the feed stopped first.
  let hear = null;
  const firstSound = new Promise((resolve, reject) => {
    hear = { resolve, reject };
  });
  firstSound.catch(() => {});
  const failure = (name) => Object.assign(new Error(name), { name });

  function refuse() {
    hear.reject(failure('SecurityError'));
    if (!stopped) onRefused();
  }

  // ManagedMediaSource (iPhones) only plays when AirPlay is off for the element, or given another source for it.
  audio.disableRemotePlayback = true;
  const objectUrl = URL.createObjectURL(source);
  audio.src = objectUrl;
  source.addEventListener('sourceopen', read, { once: true });

  async function read() {
    let body;
    try {
      const response = await fetch(url, { signal: control.signal, cache: 'no-store' });
      if (!response.ok || !response.body) throw new Error(`station answered ${response.status}`);
      body = response.body.getReader();
    } catch {
      refuse();
      return;
    }
    try {
      for (;;) {
        const { value, done: over } = await body.read();
        if (stopped) return;
        if (over) break;
        take(reader.push(value));
      }
    } catch {
      if (stopped) return;
      if (!heard) return refuse();
    }
    // The station hung up: play what's left, then the player ends (the radio says No signal).
    done = true;
    pump();
  }

  function take(got) {
    if (!got.length) return;
    if (!buffer) {
      buffer = source.addSourceBuffer(MIME[got[0].format]);
      buffer.mode = 'sequence';
      buffer.addEventListener('updateend', pump);
    }
    if (!heard) hear.resolve();
    heard = true;
    // A change of sample rate or channels (an ad at another rate) starts a new piece, so the player resets for it.
    let piece = [];
    for (const f of got) {
      const change = last && (f.format !== last.format || f.rate !== last.rate || f.channels !== last.channels);
      if (change && piece.length) {
        queue.push({ bytes: joined(piece), change: false, format: piece[0].format });
        piece = [];
      }
      if (change) queue.push({ bytes: new Uint8Array(0), change: true, format: f.format });
      piece.push(f);
      last = f;
    }
    queue.push({ bytes: joined(piece), change: false, format: piece[0].format });
    frames.push(...got);
    forget();
    pump();
  }

  // Lets go of what's long past: the frames in memory, and the sound in the player.
  function forget() {
    const keepFrom = Math.min(audio.currentTime - KEEP, tapingFrom === null ? Infinity : tapingFrom);
    if (frames.length && frames[0].at < keepFrom - 5) frames = frames.filter((f) => f.at >= keepFrom);
  }

  function pump() {
    if (stopped || !buffer || buffer.updating) return;
    const behind = audio.currentTime - KEEP;
    if (buffer.buffered.length && buffer.buffered.start(0) < behind - 10) {
      buffer.remove(0, behind);
      return;
    }
    const next = queue.shift();
    if (!next) {
      if (done && source.readyState === 'open') source.endOfStream();
      return;
    }
    try {
      if (next.change) {
        if (typeof buffer.changeType === 'function') buffer.changeType(MIME[next.format]);
        pump();
        return;
      }
      buffer.appendBuffer(next.bytes);
    } catch (error) {
      if (error && error.name === 'QuotaExceededError') {
        // The player is full: drop more of the past and try again.
        queue.unshift(next);
        buffer.remove(0, Math.max(0, audio.currentTime - 5));
        return;
      }
      stop();
      onLost();
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    stoppedAt = audio.currentTime;
    hear.reject(failure('AbortError'));
    control.abort();
    try {
      if (source.readyState === 'open') source.endOfStream();
    } catch {
      // already closing
    }
    URL.revokeObjectURL(objectUrl);
  }

  return {
    stop,
    // Resolves when the station's sound starts arriving (at once if it already has).
    heard: () => firstSound,
    // REC: the tape starts at the sound playing now. Returns where, in seconds into the stream.
    mark() {
      tapingFrom = audio.currentTime;
      return tapingFrom;
    },
    // Stop: the frames heard from `from` to now. Taping is over, so the past can be let go again.
    cut(from) {
      const part = framesBetween(frames, from, stopped ? stoppedAt : audio.currentTime);
      tapingFrom = null;
      return part;
    },
    // For the tape check's log line.
    notes: () => ({ feed: window.ManagedMediaSource ? 'managed' : 'mediasource', format: last ? last.format : 'none', rate: last ? last.rate : 0 }),
  };
}
