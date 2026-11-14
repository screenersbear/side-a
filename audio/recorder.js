// Recorders. Each start function resolves to a session with stop(), which resolves to the recording (a Blob),
// and calls onEnd if the sound stops by itself (the mic is taken away, the station drops out).
import { pickRecordType } from '../logic/recording.js';

// The mic, through MediaRecorder.
export async function startMic({ onEnd }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw Object.assign(new Error('no recorder'), { name: 'NotSupportedError' });
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickRecordType((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
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
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }));
        };
        if (recorder.state === 'inactive') return finish();
        recorder.addEventListener('stop', finish, { once: true });
        recorder.stop();
      });
    },
  };
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

// The radio: keeps the station's own MP3 stream as it arrives, so the tape sounds exactly like the broadcast.
export async function startStream({ url, onEnd }) {
  const control = new AbortController();
  const response = await fetch(url, { signal: control.signal, cache: 'no-store' });
  if (!response.ok || !response.body) throw Object.assign(new Error('no stream'), { name: 'NetworkError' });
  const type = (response.headers.get('content-type') || 'audio/mpeg').split(';')[0];
  const reader = response.body.getReader();
  const chunks = [];
  let stopping = false;

  const reading = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } catch {
      // Stopped on purpose, or the connection dropped: either way, keep what arrived.
    }
    if (!stopping) onEnd();
  })();

  return {
    async stop() {
      stopping = true;
      control.abort();
      await reading;
      return new Blob(chunks, { type });
    },
  };
}
