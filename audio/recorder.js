// Recorders. Each start function resolves to a session with stop(), which resolves to { blob, notes }: the recording,
// and what the recorder saw (for the tape check's log line, audio/sound-check.js). The mic's onEnd runs if the sound
// stops by itself (the mic is taken away); a station that drops out stops the deck itself (deck 'lost').
import { pickRecordType, RECORD_BITRATE, MIC_SETTINGS } from '../logic/recording.js';
import { lengthOf, soundRuns } from '../logic/stream-frames.js';
import { radioTape } from './radio-tape.js';

const notSupported = () => Object.assign(new Error('no recorder'), { name: 'NotSupportedError' });

// The mic's settings as the phone applied them (it may not honour every one asked for).
const SETTINGS = ['echoCancellation', 'noiseSuppression', 'autoGainControl', 'sampleRate', 'channelCount'];

function trackNotes(track) {
  if (!track) return { track: 'none' };
  const applied = typeof track.getSettings === 'function' ? track.getSettings() : {};
  const notes = { track: track.readyState, trackMuted: track.muted };
  SETTINGS.forEach((name) => {
    if (name in applied) notes[name] = applied[name];
  });
  return notes;
}

// Records a sound stream with MediaRecorder. release() runs once it has stopped (lets go of the mic).
function recordStream(stream, { onEnd, release }) {
  const mimeType = pickRecordType((t) => MediaRecorder.isTypeSupported(t));
  const options = { audioBitsPerSecond: RECORD_BITRATE };
  if (mimeType) options.mimeType = mimeType;
  const recorder = new MediaRecorder(stream, options);
  const chunks = [];
  const track = stream.getAudioTracks()[0];
  let stopping = false;
  let mutes = 0; // times the phone muted the sound while recording (a call, Siri, another app taking the mic)
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  });
  stream.getAudioTracks().forEach((t) => {
    t.addEventListener('ended', () => {
      if (!stopping) onEnd();
    });
    t.addEventListener('mute', () => {
      mutes += 1;
    });
  });
  recorder.start(1000);

  return {
    stop() {
      stopping = true;
      // Noted before letting go, while the track is still live.
      const notes = { recorder: recorder.mimeType || mimeType || '', mutes, ...trackNotes(track) };
      return new Promise((resolve) => {
        const finish = () => {
          release();
          notes.chunks = chunks.length;
          resolve({ blob: new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }), notes });
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

// The radio: the tape is cut from the very sound the app plays, from now (audio/radio.js, radio-feed.js). No recorder:
// the frames are the broadcast itself. Starts once the station's sound is arriving (Record pressed with the radio off
// waits for it), and throws SecurityError when the station doesn't let the app read its stream.
export async function startLine({ radio }) {
  const tap = radio.tap();
  await tap.ready;
  return {
    async stop() {
      const frames = tap.stop();
      const blob = await radioTape(frames);
      const heardSeconds = Number(lengthOf(frames).toFixed(2));
      return { blob, notes: { ...tap.notes(), frames: frames.length, runs: soundRuns(frames).length, heardSeconds } };
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
