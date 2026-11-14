// What the speakers and the recorder have to do when the deck changes from one state to the next.
// Returns a list of steps, in order, for audio/engine.js to carry out. Pure, so it can be tested.
import { canTape } from './stations.js';
import { radioOn, tapeOn } from './deck.js';
import { stationOf } from './bands.js';

function blobOf(s) {
  return (s.tape && s.tape.blob) || null;
}

function radioSteps(prev, next) {
  const on = radioOn(next);
  const was = radioOn(prev);
  const station = stationOf(next);
  // A new station: another number on the dial, or the same number on the other band.
  if (on && (!was || stationOf(prev) !== station)) {
    // tapeable: ask the station to share its sound with the app (CORS), so Record can tape what plays.
    // station: which one, and titles: where its song titles come from, so the engine can read them.
    return [{ do: 'radio.play', url: station.url, tapeable: canTape(station), station: next.station, titles: station.titles }];
  }
  if (!on && was) return [{ do: 'radio.stop' }];
  return [];
}

function tapeSteps(prev, next, actionType) {
  const steps = [];
  const blob = blobOf(next);
  const changed = blob !== blobOf(prev);
  if (changed) steps.push({ do: 'tape.load', blob });
  const on = tapeOn(next);
  const was = tapeOn(prev);
  if (on && (!was || changed)) steps.push({ do: 'tape.play', pos: next.pos });
  else if (!on && was) steps.push({ do: 'tape.pause' });
  else if ((actionType === 'rew' || actionType === 'ff') && next.pos !== prev.pos) steps.push({ do: 'tape.seek', pos: next.pos });
  return steps;
}

function recordSteps(prev, next) {
  if (next.recording && !prev.recording) {
    return [{ do: 'rec.start', source: next.source, draft: next.draft }];
  }
  if (!next.recording && prev.recording) return [{ do: 'rec.stop' }];
  return [];
}

const isStop = (st) => /\.(stop|pause)$/.test(st.do);

export function soundPlan(prev, next, actionType = '') {
  if (prev === next) return [];
  const rec = recordSteps(prev, next);
  const radio = radioSteps(prev, next);
  const tape = tapeSteps(prev, next, actionType);
  // Stop what's ending before starting anything new, so two sounds never overlap: the recording first, so a radio
  // tape is cut before the station goes. Then the radio starts before the recorder, so Record pressed with the
  // radio off tapes it from its first sound.
  return [...[...rec, ...radio, ...tape].filter(isStop), ...[...radio, ...rec, ...tape].filter((st) => !isStop(st))];
}
