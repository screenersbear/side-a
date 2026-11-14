// The engine: carries out the steps from logic/sound-plan.js with the real radio, tape player and recorders,
// and tells the deck what happened (station live, tape position, recording saved) through dispatch.
import { createRadio } from './radio.js';
import { createTapePlayer } from './tape-player.js';
import { startMic, startLine, measureSeconds } from './recorder.js';
import { watchTitles } from './now-playing.js';
import { recordError, radioError, worthKeeping, tapeSeconds } from '../logic/recording.js';
import { addSong } from '../logic/songs.js';
import { STATIONS } from '../logic/stations.js';
import { saveTape } from '../data/tapes.js';
import { checkTape } from './sound-check.js';

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
  let titles = null; // reads the playing station's song titles
  let lastText = null; // the last one read

  function seconds(j) {
    return j.startedAt ? (performance.now() - j.startedAt) / 1000 : 0;
  }

  // While the radio plays: show each song the station names, and note it on the tape when the radio is taped
  // (with the second it started on the tape).
  function listen(station) {
    hangUp();
    titles = watchTitles(STATIONS[station], (text) => {
      lastText = text;
      dispatch({ type: 'heard', station, text });
      if (job && job.line && job.startedAt) job.songs = addSong(job.songs, seconds(job), text);
    });
  }

  function hangUp() {
    if (titles) titles.stop();
    titles = null;
    lastText = null;
  }

  function startRecording(step) {
    const j = { draft: step.draft, line: step.source === 'line', startedAt: 0, timer: 0, session: null, stopped: false, songs: [] };
    job = j;
    const onEnd = () => dispatch({ type: 'stop' });
    const start = step.source === 'line' ? startLine({ radio }) : startMic({ onEnd });
    j.ready = start.then(
      (session) => {
        j.session = session;
        if (j.stopped) return;
        j.startedAt = performance.now();
        j.timer = setInterval(() => dispatch({ type: 'tick', pos: seconds(j) }), 250);
        // Taping the radio: the tape starts with the song already playing.
        if (j.line && lastText !== null) j.songs = addSong(j.songs, 0, lastText);
      },
      (error) => {
        if (job === j) job = null;
        // A station that won't be taped keeps playing; a mic that won't start stops the deck.
        if (!j.stopped) dispatch({ type: step.source === 'line' ? 'refused' : 'fail', message: recordError(error, step.source) });
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
    const { blob, notes } = await j.session.stop();
    if (!worthKeeping(blob, length)) return dispatch({ type: 'unsaved', message: 'Nothing was taped.' });
    const real = await measureSeconds(blob);
    let saved;
    try {
      const songs = j.draft.kind === 'radio' ? { songs: j.songs } : {};
      saved = await saveTape({ ...j.draft, ...songs, duration: tapeSeconds(real || length), created: Date.now(), mime: blob.type, blob });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      dispatch({ type: 'saved', tape: saved });
    } catch {
      return dispatch({ type: 'unsaved', message: "The phone is full. The tape wasn't saved." });
    }
    // Read back and listened to: one that came out silent (or didn't save whole) says so.
    const text = await checkTape(saved, { bytes: blob.size, notes: { ...notes, taped: Number(length.toFixed(1)) } });
    if (text) dispatch({ type: 'warn', text });
  }

  const run = {
    'radio.play': (st) => {
      radio.play(st.url, st.tapeable);
      listen(st.station);
    },
    'radio.stop': () => {
      radio.stop();
      hangUp();
    },
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
