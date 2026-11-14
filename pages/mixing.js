// The two mix screens (pages/mix.js, pages/clip.js) and what they share: the mix being made, the tapes it's cut
// from, the shelf popup a clip's tape is chosen in (and heard first), playing the mix to hear where to cut, and
// saving it to the shelf as one mixtape. New mix starts it afresh.
import { emptyMix, addClip, selectClip, removeSelected, toggleJoin, setLine, cutAtLine, mixPlan, mixLength, dropTape } from '../logic/mix.js';
import { startTrim, setEdge, moveEdge, peaks } from '../logic/trim.js';
import { tapeCard } from '../logic/shelf.js';
import { tapeTitle } from '../logic/tape-names.js';
import { tapeSeconds } from '../logic/recording.js';
import { listTapes, saveTape } from '../data/tapes.js';
import { decodeTape, playMix, renderMix } from '../audio/mixdown.js';
import { checkTape } from '../audio/sound-check.js';
import { createTapePlayer } from '../audio/tape-player.js';
import { createTapePicker } from '../components/tape-picker.js';
import { createMixPage } from './mix.js';
import { createClipPage } from './clip.js';

const noPart = () => ({ tape: null, trim: startTrim(0), levels: null, reading: false, failed: false });

// onSaved(tape, warning): the mixtape is on the shelf (warning: '' or what the tape check found, audio/sound-check.js). quiet(): stop the deck, so the mix can be heard alone.
export function createMixing({ onSaved, quiet }) {
  let mix = emptyMix();
  let tapes = [];
  let preview = null;
  let saving = false;
  let note = '';
  let part = noPart();

  const drawMix = () => mixPage.show(mix, { playing: Boolean(preview), saving, note });
  const drawPart = () => clipPage.show(part);

  function stopPlay() {
    if (!preview) return;
    preview.stop();
    preview = null;
    drawMix();
  }

  // Any change but a selection stops the sound first.
  function change(next, { keepPlaying = false } = {}) {
    if (!keepPlaying) stopPlay();
    note = '';
    mix = next;
    drawMix();
  }

  function togglePlay() {
    if (preview) return stopPlay();
    quiet();
    const from = mix.line < mixLength(mix) ? mix.line : 0;
    preview = playMix(mixPlan(mix), tapes, from, {
      onTime: (t) => mixPage.moveLine((mix = setLine(mix, t))),
      onEnd: () => { preview = null; drawMix(); },
      onFail: () => { preview = null; note = "Couldn't play the mix."; drawMix(); },
    });
    drawMix();
  }

  async function save() {
    stopPlay();
    saving = true;
    drawMix();
    try {
      const { blob, seconds, peak } = await renderMix(mixPlan(mix), tapes);
      const now = Date.now();
      const tape = await saveTape({ kind: 'mix', title: tapeTitle('mix', null, now), duration: tapeSeconds(seconds), created: now, mime: 'audio/wav', blob });
      const warning = await checkTape(tape, { bytes: blob.size, peak, notes: { clips: mix.clips.length } });
      mix = emptyMix();
      saving = false;
      drawMix();
      onSaved(tape, warning);
    } catch {
      saving = false;
      note = "Couldn't make the mixtape. Try again.";
      drawMix();
    }
  }

  const mixPage = createMixPage({
    pick: (i) => change(selectClip(mix, i), { keepPlaying: true }),
    join: (i) => change(toggleJoin(mix, i)),
    line: (t) => {
      stopPlay();
      mixPage.moveLine((mix = setLine(mix, t)));
    },
    cut: () => change(cutAtLine(mix)),
    remove: () => change(removeSelected(mix)),
    play: togglePlay,
    save,
    addClip: () => openPicker(),
  });

  // Reads the picked tape's sound for the waveform; the whole tape is selected to start with.
  function pickTape(tape) {
    part = { tape, trim: startTrim(tape.duration), levels: null, reading: true, failed: false };
    drawPart();
    decodeTape(tape).then(
      (sound) => {
        if (part.tape !== tape) return;
        part = { ...part, trim: startTrim(sound.duration), levels: peaks(sound.getChannelData(0)), reading: false };
        drawPart();
      },
      () => {
        if (part.tape !== tape) return;
        part = { ...part, reading: false, failed: true };
        drawPart();
      },
    );
  }

  // Listening to a tape in the shelf popup: one at a time, with the deck and the mix quiet.
  let hearing = null;
  const ear = createTapePlayer({
    onTime: (t) => hearing && hearing.onTime(t),
    onEnded: () => hearing && hearing.onEnd(),
    onFail: () => hearing && hearing.onEnd(),
  });
  const picker = createTapePicker({
    player: {
      listen(tape, onTime, onEnd) {
        stopPlay();
        quiet();
        hearing = { onTime, onEnd };
        ear.load(tape.blob);
        ear.play(0);
      },
      hush() {
        hearing = null;
        ear.pause();
      },
    },
    onPick: (tape) => {
      pickTape(tape);
      location.hash = '#/clip';
    },
    // Closed on the clip screen with no tape chosen yet: back to the mix.
    onClose: (picked) => {
      if (!picked && location.hash === '#/clip' && !part.tape) location.hash = '#/mix';
    },
  });

  function openPicker() {
    stopPlay();
    listTapes().then(
      (list) => {
        tapes = list;
        picker.open(list);
      },
      () => picker.open([]),
    );
  }

  const clipPage = createClipPage({
    change: openPicker,
    drag: (edge, t) => { part = { ...part, trim: setEdge(part.trim, edge, t) }; drawPart(); },
    step: (edge, steps) => { part = { ...part, trim: moveEdge(part.trim, edge, steps) }; drawPart(); },
    add: () => {
      const { tape, trim } = part;
      change(addClip(mix, { tapeId: tape.id, title: tapeCard(tape).title, kind: tape.kind, from: trim.start, to: trim.end }));
      location.hash = '#/mix';
    },
  });

  return {
    nodes: [mixPage.node, clipPage.node, picker.node],
    mixNode: mixPage.node,
    clipNode: clipPage.node,
    // A tape was deleted from the shelf: it leaves the mix, and the clip screen if it was picked there.
    forget(id) {
      const next = dropTape(mix, id);
      if (next !== mix) change(next);
      tapes = tapes.filter((t) => t.id !== id);
      if (part.tape && part.tape.id === id) part = noPart();
    },
    // New mix (from the shelf): an empty mix.
    fresh() {
      stopPlay();
      mix = emptyMix();
      note = '';
    },
    showMix() {
      drawMix();
      listTapes().then((list) => { tapes = list; }, () => {});
    },
    // The clip screen: the tape chosen, or the shelf popup to choose one.
    showClip() {
      listTapes().then(
        (list) => {
          tapes = list;
          if (part.tape && list.some((t) => t.id === part.tape.id)) return drawPart();
          part = noPart();
          drawPart();
          picker.open(list);
        },
        () => {
          drawPart();
          picker.open([]);
        },
      );
    },
    // Leaving the mix screen stops the sound; leaving both closes the shelf popup.
    leave() {
      stopPlay();
      if (location.hash !== '#/clip') picker.close();
    },
  };
}
