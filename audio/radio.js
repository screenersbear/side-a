// The radio: plays a station's live stream through an audio element.
// Stations that allow taping are asked to share their sound with the app (CORS). Then tap() can hand the
// recorder exactly what is playing, from the moment Record is pressed. A station that refuses plays anyway,
// the plain way, and just can't be taped.
// The sound goes through Web Audio only while it's being taped: a locked phone silences Web Audio but keeps a
// plain audio element playing. When taping ends, a fresh plain element takes over (plain()).

import { peakOf, dbText } from '../logic/sound-check.js';

// After the switch, how long to wait to be sure the phone let the new element play with sound.
const SETTLE_MS = 1000;

// While taping: the loudest level Web Audio gets from the station (an iPhone can hand Web Audio silence from a
// live stream). Read four times a second; only for the tape check's log.
function listenTo(g) {
  const meter = g.context.createAnalyser();
  const samples = new Float32Array(meter.fftSize);
  let loudest = 0;
  g.source.connect(meter);
  const timer = setInterval(() => {
    meter.getFloatTimeDomainData(samples);
    loudest = Math.max(loudest, peakOf([samples]));
  }, 250);
  return {
    loudest: () => loudest,
    stop() {
      clearInterval(timer);
      try {
        g.source.disconnect(meter);
      } catch {
        // already let go
      }
    },
  };
}

export function createRadio({ onLive, onLost }) {
  let tuned = false;
  let url = '';
  let shared = false; // asking the station to share its sound
  let attempt = 0;
  let graph = null; // Web Audio, while taping: { context, source }
  let old = null; // while switching back to plain: { audio, graph }, still sounding until the new element plays

  function element() {
    const a = new Audio();
    a.preload = 'none';
    a.addEventListener('playing', () => a === audio && live());
    // A live stream only errors or ends when the signal drops.
    a.addEventListener('error', () => a === audio && failed(''));
    a.addEventListener('ended', () => a === audio && failed(''));
    return a;
  }
  let audio = element();

  function start() {
    attempt += 1;
    const mine = attempt;
    if (shared) audio.crossOrigin = 'anonymous';
    else audio.removeAttribute('crossorigin');
    audio.src = url;
    audio.play().catch((error) => {
      // AbortError: a newer station or Stop came first, which is fine.
      if (mine === attempt && error.name !== 'AbortError') failed(error.name);
    });
  }

  function failed(name) {
    if (!tuned) return;
    // The plain element wouldn't start: the one that was playing carries on.
    if (old) return keepOld();
    // The station wouldn't share its sound: play it the plain way instead.
    if (shared && name !== 'NotAllowedError') {
      shared = false;
      start();
      return;
    }
    onLost(name);
  }

  function live() {
    if (old) switchOver();
    onLive();
  }

  // No more sound or download from this element (or its Web Audio).
  function retire(a, g) {
    a.pause();
    a.removeAttribute('src');
    a.load();
    if (g) g.context.close().catch(() => {});
  }

  // Taping is over: a fresh plain element takes over. It starts muted, so the two never sound together; the old one
  // plays on until the new one does (switchOver). Call it from the tap that stops taping, so phones let it play.
  function plain() {
    if (!graph) return;
    const was = { audio, graph };
    graph = null;
    audio = element();
    if (!tuned) return retire(was.audio, was.graph);
    old = was;
    audio.muted = true;
    start();
  }

  function switchOver() {
    const was = old;
    const fresh = audio;
    old = null;
    was.graph.source.disconnect();
    fresh.muted = false;
    setTimeout(() => {
      // A phone that stops it once it has sound (it wants a tap for that): back to the one that was playing.
      if (fresh === audio && fresh.paused && tuned) {
        was.graph.source.connect(was.graph.context.destination);
        audio = was.audio;
        graph = was.graph;
        retire(fresh);
      } else retire(was.audio, was.graph);
    }, SETTLE_MS);
  }

  function keepOld() {
    const was = old;
    old = null;
    retire(audio);
    audio = was.audio;
    graph = was.graph;
  }

  // A new station or Stop: nothing left over from taping.
  function settle() {
    if (old) retire(old.audio, old.graph);
    old = null;
    audio.muted = false;
    if (!graph) return;
    const was = { audio, graph };
    graph = null;
    audio = element();
    retire(was.audio, was.graph);
  }

  return {
    play(nextUrl, tapeable) {
      tuned = true;
      url = nextUrl;
      shared = Boolean(tapeable);
      settle();
      start();
    },
    stop() {
      tuned = false;
      if (old) retire(old.audio, old.graph);
      old = null;
      audio.muted = false;
      audio.pause();
      // Drop the stream so the phone stops downloading it.
      audio.removeAttribute('src');
      audio.load();
    },
    plain,
    // What's playing, as a sound stream for the recorder. release() lets go of it. notes() says, for the tape
    // check's log, whether Web Audio was running and the loudest level it got from the station while taping.
    tap() {
      if (!shared) throw Object.assign(new Error('not shared'), { name: 'SecurityError' });
      if (typeof AudioContext === 'undefined') throw Object.assign(new Error('no web audio'), { name: 'NotSupportedError' });
      // Record again straight after a stop: the element still playing is the one to tape.
      if (old) keepOld();
      if (!graph) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audio);
        source.connect(context.destination);
        graph = { context, source };
      }
      const g = graph;
      const contextAtStart = g.context.state;
      g.context.resume().catch(() => {});
      const out = g.context.createMediaStreamDestination();
      g.source.connect(out);
      const meter = listenTo(g);
      return {
        stream: out.stream,
        notes: () => ({ contextAtStart, contextAtEnd: g.context.state, heard: dbText(meter.loudest()) }),
        release: () => {
          meter.stop();
          try {
            g.source.disconnect(out);
          } catch {
            // already let go (the switch to plain disconnects everything)
          }
          if (g === graph) plain();
        },
      };
    },
  };
}
