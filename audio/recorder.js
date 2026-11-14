// Recorders. Each start function resolves to a session with stop(), which resolves to the recording (a Blob),
// and calls onEnd if the sound stops by itself (the mic is taken away, the station drops out).
import { pickRecordType, RECORD_BITRATE, MIC_SETTINGS } from '../logic/recording.js';

const notSupported = () => Object.assign(new Error('no recorder'), { name: 'NotSupportedError' });

// Records a sound stream with MediaRecorder. release() runs once it has stopped (lets go of the mic or radio).
function recordStream(stream, { onEnd, release }) {
  const mimeType = pickRecordType((t) => MediaRecorder.isTypeSupported(t));
  const options = { audioBitsPerSecond: RECORD_BITRATE };
  if (mimeType) options.mimeType = mimeType;
  const recorder = new MediaRecorder(stream, options);
  const chunks = [];
  let stopping = false;
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  });
  stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
    if (!stopping) onEnd();
  }));
  recorder.start(1000);

  return {
    stop() {
      stopping = true;
      return new Promise((resolve) => {
        const finish = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }));
        };
        if (recorder.state === 'inactive') return finish();
        recorder.addEventListener('stop', finish, { once: true });
        recorder.stop();
      });
    },
  };
}

// The mic, as it is (no call clean-up), so voice notes sound like tape.
export async function startMic({ onEnd }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw notSupported();
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { ...MIC_SETTINGS } });
  return recordStream(stream, { onEnd, release: () => stream.getTracks().forEach((t) => t.stop()) });
}

// The radio: records what the app is playing, from now. Throws SecurityError when the station doesn't share it.
export async function startLine({ radio, onEnd }) {
  // The station's refusal comes first: it holds in every browser.
  const tap = radio.tap();
  if (typeof MediaRecorder === 'undefined') {
    tap.release();
    throw notSupported();
  }
  return recordStream(tap.stream, { onEnd, release: tap.release });
}

// How long a recording really is, read from the file. Radio tapes run longer than the time spent taping,
// because stations send a few seconds of sound at once when they connect. null when the file doesn't say.
export function measureSeconds(blob) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    const finish = (seconds) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    };
    const timer = setTimeout(() => finish(null), 3000);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => finish(audio.duration), { once: true });
    audio.addEventListener('error', () => finish(null), { once: true });
    audio.src = url;
  });
}
