// The radio: plays a station's live stream through an audio element.
export function createRadio({ onLive, onLost }) {
  const audio = new Audio();
  audio.preload = 'none';
  let tuned = false;

  audio.addEventListener('playing', () => onLive());
  // A live stream only errors or ends when the signal drops.
  audio.addEventListener('error', () => {
    if (tuned) onLost('');
  });
  audio.addEventListener('ended', () => {
    if (tuned) onLost('');
  });

  return {
    play(url) {
      tuned = true;
      audio.src = url;
      audio.play().catch((error) => {
        // AbortError: a newer station or Stop came first, which is fine.
        if (tuned && error.name !== 'AbortError') onLost(error.name);
      });
    },
    stop() {
      tuned = false;
      audio.pause();
      // Drop the stream so the phone stops downloading it.
      audio.removeAttribute('src');
      audio.load();
    },
  };
}
