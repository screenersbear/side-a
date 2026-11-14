// The engine: carries out the steps from logic/sound-plan.js with the real radio, tape player and recorders,
// and tells the deck what happened (station live, tape position, recording saved) through dispatch.
import { createRadio } from './radio.js';
import { createTapePlayer } from './tape-player.js';
import { startMic, startStream, measureSeconds } from './recorder.js';
import { recordError, radioError, worthKeeping, tapeSeconds } from '../logic/recording.js';
import { saveTape } from '../data/tapes.js';

export function createEngine(dispatch) {
  const radio = createRadio({
    onLive: () => dispatch({ type: 'live' }),
    onLost: (name) => dispatch({ type: 'lost', message: radioError(name) }),
  });
  const tape = createTapePlayer({
    onTime: (pos) => dispatch({ type: 'tick', pos }),
    onEnded: () => dispatch({ type: 'ended' }),
    onFail: (message) => dispatch({ type: 'fail', message }),
  });
  let job = null; // the recording in progress

  function seconds(j) {
    return j.startedAt ? (performance.now() - j.startedAt) / 1000 : 0;
  }

  function startRecording(step) {
    const j = { draft: step.draft, startedAt: 0, timer: 0, session: null, stopped: false };
    job = j;
    const onEnd = () => dispatch({ type: 'stop' });
    const start = step.source === 'line' ? startStream({ url: step.url, onEnd }) : startMic({ onEnd });
    j.ready = start.then(
      (session) => {
        j.session = session;
        if (j.stopped) return;
        j.startedAt = performance.now();
        j.timer = setInterval(() => dispatch({ type: 'tick', pos: seconds(j) }), 250);
      },
      (error) => {
        if (job === j) job = null;
        if (!j.stopped) dispatch({ type: 'fail', message: recordError(error, step.source) });
      },
    );
  }

  async function stopRecording() {
    const j = job;
    job = null;
    if (!j) return;
    j.stopped = true;
    clearInterval(j.timer);
    const length = seconds(j);
    await j.ready;
    if (!j.session) return dispatch({ type: 'unsaved', message: '' });
    const blob = await j.session.stop();
    if (!worthKeeping(blob, length)) return dispatch({ type: 'unsaved', message: 'Nothing was taped.' });
    const real = await measureSeconds(blob);
    try {
      const saved = await saveTape({ ...j.draft, duration: tapeSeconds(real || length), created: Date.now(), mime: blob.type, blob });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      dispatch({ type: 'saved', tape: saved });
    } catch {
      dispatch({ type: 'unsaved', message: "The phone is full. The tape wasn't saved." });
    }
  }

  const run = {
    'radio.play': (st) => radio.play(st.url),
    'radio.stop': () => radio.stop(),
    'tape.load': (st) => tape.load(st.blob),
    'tape.play': (st) => tape.play(st.pos),
    'tape.pause': () => tape.pause(),
    'tape.seek': (st) => tape.seek(st.pos),
    'rec.start': (st) => startRecording(st),
    'rec.stop': () => stopRecording(),
  };

  return function carryOut(steps) {
    steps.forEach((step) => run[step.do](step));
  };
}
