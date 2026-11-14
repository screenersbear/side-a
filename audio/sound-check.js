// Checks a new tape the way it will be played: read back from the phone's storage, its size compared with what was
// recorded, and its sound decoded to find the loudest level (logic/sound-check.js says what counts as silent).
// Each check leaves one line in the console ("SIDE A tape check: {...}"), to read in Safari's Web Inspector.
import { getTape } from '../data/tapes.js';
import { peakOf, canMeasure, verdict, checkText, dbText } from '../logic/sound-check.js';

// Plenty to tell sound from silence, with half the memory of 44.1 kHz.
const RATE = 22050;

// The loudest level in a file, or null when it can't be read (too big to decode on a phone, or not decodable).
async function loudest(blob) {
  if (!canMeasure(blob.size) || typeof OfflineAudioContext === 'undefined') return null;
  try {
    const sound = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await blob.arrayBuffer());
    return peakOf(Array.from({ length: sound.numberOfChannels }, (_, i) => sound.getChannelData(i)));
  } catch {
    return null;
  }
}

async function readBack(id) {
  try {
    return await getTape(id);
  } catch {
    return null;
  }
}

// tape: just saved. bytes: the size recorded. peak: its level when already known (a mix has it from its render).
// notes: what the recorder saw, for the log. Resolves to the text to show ('' when the tape is fine); never throws.
export async function checkTape(tape, { bytes, peak, notes = {} } = {}) {
  const stored = await readBack(tape.id);
  const size = stored ? stored.blob.size : 0;
  const level = typeof peak === 'number' ? peak : stored ? await loudest(stored.blob) : null;
  const result = verdict({ bytes, stored: size, peak: level });
  const line = { result, kind: tape.kind, mime: tape.mime, bytes, stored: size, seconds: tape.duration, loudest: dbText(level), ...notes };
  console.info('SIDE A tape check:', JSON.stringify(line));
  return checkText(result);
}
