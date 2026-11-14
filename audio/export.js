// Makes a tape into a file to share: MP3 (made on the phone with LAME, 192 kbps) or WAV. A mixtape already is a
// WAV file, so WAV shares it as it is. The work pauses while the app is hidden and carries on when it's back.
import { decodeTape } from './mixdown.js';
import { encodeWav } from '../logic/wav.js';
import { encodeMp3 } from '../logic/mp3.js';
import { formatFor, fileName, isWav } from '../logic/export.js';

const stopped = () => Object.assign(new Error('stopped'), { name: 'AbortError' });

// Resolves once the app is on screen.
function whenVisible() {
  if (!document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const back = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', back);
      resolve();
    };
    document.addEventListener('visibilitychange', back);
  });
}

// tape: from the shelf. formatId: 'mp3' or 'wav'. onProgress(fraction or null while reading).
// job.cancelled: set it to true to stop (the promise then rejects with an AbortError).
// Resolves to { blob, name }.
export async function makeFile(tape, formatId, onProgress = () => {}, job = {}) {
  const format = formatFor(formatId);
  const name = fileName(tape.title, format.ext);
  if (format.id === 'wav' && isWav(tape)) return { blob: tape.blob, name };

  // Lets the screen draw, waits while the app is hidden, and stops if asked.
  const breathe = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await whenVisible();
    if (job.cancelled) throw stopped();
  };

  onProgress(null);
  const sound = await decodeTape(tape);
  await breathe();
  const channels = Array.from({ length: Math.min(2, sound.numberOfChannels) }, (_, i) => sound.getChannelData(i));
  if (format.id === 'wav') {
    const blob = new Blob([encodeWav(channels, sound.sampleRate)], { type: format.type });
    onProgress(1);
    return { blob, name };
  }
  // The encoder is only loaded when an MP3 is made.
  const { Mp3Encoder } = await import('../vendor/lamejs.js');
  const blob = await encodeMp3(channels, sound.sampleRate, Mp3Encoder, { onProgress, pause: breathe });
  return { blob, name };
}
