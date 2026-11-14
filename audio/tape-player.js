// The tape player: plays a saved recording and reports where it is.
export function createTapePlayer({ onTime, onEnded, onFail }) {
  const audio = new Audio();
  audio.preload = 'auto';
  let url = null;

  audio.addEventListener('timeupdate', () => onTime(audio.currentTime));
  audio.addEventListener('ended', () => onEnded());

  function seek(pos) {
    try {
      audio.currentTime = Math.max(0, Number(pos) || 0);
    } catch {
      // Not ready to seek yet; it starts from the top instead.
    }
  }

  return {
    load(blob) {
      audio.pause();
      if (url) URL.revokeObjectURL(url);
      url = blob ? URL.createObjectURL(blob) : null;
      if (url) audio.src = url;
      else {
        audio.removeAttribute('src');
        audio.load();
      }
    },
    play(pos) {
      if (!url) return;
      seek(pos);
      audio.play().catch((error) => {
        if (error.name === 'NotSupportedError') onFail("This tape won't play here.");
        else if (error.name === 'NotAllowedError') onFail('Press play again.');
      });
    },
    pause() {
      audio.pause();
    },
    seek,
  };
}
