// The radio: plays a station's live stream through an audio element.
// Stations that allow taping are asked to share their sound with the app (CORS). Then tap() can hand the
// recorder exactly what is playing, from the moment Record is pressed. A station that refuses plays anyway,
// the plain way, and just can't be taped.
export function createRadio({ onLive, onLost }) {
  const audio = new Audio();
  audio.preload = 'none';
  let tuned = false;
  let url = '';
  let shared = false; // asking the station to share its sound
  let attempt = 0;
  let graph = null; // Web Audio, made the first time the radio is taped; the sound goes through it from then on

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
    // The station wouldn't share its sound: play it the plain way instead.
    if (shared && name !== 'NotAllowedError') {
      shared = false;
      start();
      return;
    }
    onLost(name);
  }

  audio.addEventListener('playing', () => onLive());
  // A live stream only errors or ends when the signal drops.
  audio.addEventListener('error', () => failed(''));
  audio.addEventListener('ended', () => failed(''));

  return {
    play(nextUrl, tapeable) {
      tuned = true;
      url = nextUrl;
      shared = Boolean(tapeable);
      if (graph) graph.context.resume().catch(() => {});
      start();
    },
    stop() {
      tuned = false;
      audio.pause();
      // Drop the stream so the phone stops downloading it.
      audio.removeAttribute('src');
      audio.load();
    },
    // What's playing, as a sound stream for the recorder. release() lets go of it.
    tap() {
      if (!shared) throw Object.assign(new Error('not shared'), { name: 'SecurityError' });
      if (typeof AudioContext === 'undefined') throw Object.assign(new Error('no web audio'), { name: 'NotSupportedError' });
      if (!graph) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audio);
        source.connect(context.destination);
        graph = { context, source };
      }
      graph.context.resume().catch(() => {});
      const out = graph.context.createMediaStreamDestination();
      graph.source.connect(out);
      return { stream: out.stream, release: () => graph.source.disconnect(out) };
    },
  };
}
