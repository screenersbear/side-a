// The mix's sound: reads tapes into memory, plays the mix (to hear where to cut) and renders it into one file.
// The plan comes from logic/mix.js (mixPlan): which part of which tape, when it starts, how long it fades in.
import { encodeWav } from '../logic/wav.js';

const RATE = 44100;
const decoded = new Map();

// The tape's sound, decoded once and kept while the app is open.
export function decodeTape(tape) {
  if (!decoded.has(tape.id)) {
    const reading = tape.blob
      .arrayBuffer()
      .then((bytes) => new OfflineAudioContext(1, 1, RATE).decodeAudioData(bytes))
      .catch((error) => {
        decoded.delete(tape.id);
        throw error;
      });
    decoded.set(tape.id, reading);
  }
  return decoded.get(tape.id);
}

// Lets go of a tape's decoded sound (it was deleted).
export function forgetTape(id) {
  decoded.delete(id);
}

// The decoded sound of every tape in the plan, by tape id.
export async function decodePlan(plan, tapes) {
  const ids = [...new Set(plan.map((p) => p.tapeId))];
  const sounds = await Promise.all(ids.map((id) => decodeTape(tapes.find((t) => t.id === id))));
  return new Map(ids.map((id, i) => [id, sounds[i]]));
}

// Starts each clip at its time, from `offset` seconds into the mix. A clip with a fade rises from silence.
function schedule(context, plan, sounds, offset) {
  const now = context.currentTime;
  for (const part of plan) {
    const length = part.to - part.from;
    const skip = Math.max(0, offset - part.at);
    if (skip >= length) continue;
    const source = context.createBufferSource();
    source.buffer = sounds.get(part.tapeId);
    const gain = context.createGain();
    source.connect(gain).connect(context.destination);
    const when = now + Math.max(0, part.at - offset);
    if (part.fade > skip) {
      gain.gain.setValueAtTime(skip / part.fade, when);
      gain.gain.linearRampToValueAtTime(1, when + part.fade - skip);
    }
    source.start(when, part.from + skip, length - skip);
  }
}

// Plays the mix from `from` seconds. Call it from the tap (phones need that); the sound may still be loading.
// onTime(seconds) follows the play line; onEnd() when it stops by itself. Returns { stop() }.
export function playMix(plan, tapes, from, { onTime, onEnd, onFail }) {
  const context = new AudioContext();
  context.resume().catch(() => {});
  const total = plan.reduce((sum, p) => sum + p.to - p.from, 0);
  let stopped = false;
  let frame = 0;

  function stop() {
    stopped = true;
    cancelAnimationFrame(frame);
    context.close().catch(() => {});
  }

  decodePlan(plan, tapes).then(
    (sounds) => {
      if (stopped) return;
      const start = context.currentTime;
      schedule(context, plan, sounds, from);
      const tick = () => {
        if (stopped) return;
        const at = from + context.currentTime - start;
        if (at >= total) {
          stop();
          onEnd();
          return;
        }
        onTime(at);
        frame = requestAnimationFrame(tick);
      };
      tick();
    },
    () => {
      if (!stopped) onFail();
      stop();
    },
  );
  return { stop };
}

// The whole mix as one WAV file (a Blob), and its length in seconds.
export async function renderMix(plan, tapes) {
  const total = plan.reduce((sum, p) => sum + p.to - p.from, 0);
  const sounds = await decodePlan(plan, tapes);
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * RATE)), RATE);
  schedule(context, plan, sounds, 0);
  const rendered = await context.startRendering();
  const bytes = encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], RATE);
  return { blob: new Blob([bytes], { type: 'audio/wav' }), seconds: total };
}
