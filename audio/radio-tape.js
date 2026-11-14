// A radio tape from the frames that played (audio/radio-feed.js). One sound all through: the frames as they came,
// so the tape is the broadcast itself, bit for bit. If the sample rate changes part way (an ad at another rate),
// each run is decoded on its own and the tape is made again as one MP3 at one rate, so nothing plays back slower.
import { MIME, soundRuns } from '../logic/stream-frames.js';
import { encodeMp3 } from '../logic/mp3.js';

const RATE = 44100;

async function decodeRun(run) {
  const bytes = await new Blob(run.map((f) => f.bytes)).arrayBuffer();
  return new OfflineAudioContext(2, 1, RATE).decodeAudioData(bytes);
}

export async function radioTape(frames) {
  const runs = soundRuns(frames);
  if (runs.length <= 1) return new Blob(frames.map((f) => f.bytes), { type: frames.length ? MIME[frames[0].format] : MIME.mp3 });
  const sounds = [];
  for (const run of runs) sounds.push(await decodeRun(run));
  const length = sounds.reduce((n, s) => n + s.length, 0);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let at = 0;
  for (const s of sounds) {
    left.set(s.getChannelData(0), at);
    right.set(s.getChannelData(s.numberOfChannels > 1 ? 1 : 0), at);
    at += s.length;
  }
  const { Mp3Encoder } = await import('../vendor/lamejs.js');
  return encodeMp3([left, right], RATE, Mp3Encoder);
}
