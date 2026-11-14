// The two mix screens (pages/mix.js, pages/clip.js) and what they share: the mix being made, the tapes it's cut
// from, playing it to hear where to cut, and saving it to the shelf as one mixtape. New mix starts it afresh.
import { emptyMix, addClip, selectClip, removeSelected, toggleJoin, setLine, cutAtLine, mixPlan, mixLength, dropTape } from '../logic/mix.js';
import { startTrim, setEdge, moveEdge, peaks } from '../logic/trim.js';
import { filterTapes, tapeCard } from '../logic/shelf.js';
import { tapeTitle } from '../logic/tape-names.js';
import { tapeSeconds } from '../logic/recording.js';
import { listTapes, saveTape } from '../data/tapes.js';
import { decodeTape, playMix, renderMix } from '../audio/mixdown.js';
import { createMixPage } from './mix.js';
import { createClipPage } from './clip.js';

// onSaved(tape): the mixtape is on the shelf. quiet(): stop the deck, so the mix can be heard alone.
export function createMixing({ onSaved, quiet }) {
  let mix = emptyMix();
  let tapes = [];
  let preview = null;
  let saving = false;
  let note = '';
  let part = { tape: null, trim: startTrim(0), levels: null, reading: false, failed: false };

  const drawMix = () => mixPage.show(mix, { playing: Boolean(preview), saving, note });
  const drawPart = () => clipPage.show({ tapeId: part.tape ? part.tape.id : null, ...part });

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
      const { blob, seconds } = await renderMix(mixPlan(mix), tapes);
      const now = Date.now();
      const tape = await saveTape({ kind: 'mix', title: tapeTitle('mix', null, now), duration: tapeSeconds(seconds), created: now, mime: 'audio/wav', blob });
      mix = emptyMix();
      saving = false;
      drawMix();
      onSaved(tape);
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

  const clipPage = createClipPage({
    pickTape,
    drag: (edge, t) => { part = { ...part, trim: setEdge(part.trim, edge, t) }; drawPart(); },
    step: (edge, steps) => { part = { ...part, trim: moveEdge(part.trim, edge, steps) }; drawPart(); },
    add: () => {
      const { tape, trim } = part;
      change(addClip(mix, { tapeId: tape.id, title: tapeCard(tape).title, kind: tape.kind, from: trim.start, to: trim.end }));
      location.hash = '#/mix';
    },
  });

  return {
    nodes: [mixPage.node, clipPage.node],
    mixNode: mixPage.node,
    clipNode: clipPage.node,
    // A tape was deleted from the shelf: it leaves the mix, and the clip screen if it was picked there.
    forget(id) {
      const next = dropTape(mix, id);
      if (next !== mix) change(next);
      tapes = tapes.filter((t) => t.id !== id);
      if (part.tape && part.tape.id === id) part = { tape: null, trim: startTrim(0), levels: null, reading: false, failed: false };
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
    showClip() {
      listTapes().then(
        (list) => {
          tapes = list;
          const shown = filterTapes(list, 'all');
          clipPage.showTapes(shown);
          const keep = part.tape && shown.find((t) => t.id === part.tape.id);
          if (keep) drawPart();
          else if (shown.length) pickTape(shown[0]);
          else drawPart();
        },
        () => clipPage.showTapes([]),
      );
    },
    // Leaving the mix screens stops the sound.
    leave: stopPlay,
  };
}
