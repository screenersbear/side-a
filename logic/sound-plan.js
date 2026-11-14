// What the speakers and the recorder have to do when the deck changes from one state to the next.
// Returns a list of steps, in order, for audio/engine.js to carry out. Pure, so it can be tested.
import { STATIONS, canTape } from './stations.js';
import { radioOn, tapeOn } from './deck.js';

function blobOf(s) {
  return (s.tape && s.tape.blob) || null;
}

function radioSteps(prev, next) {
  const on = radioOn(next);
  const was = radioOn(prev);
  if (on && (!was || next.station !== prev.station)) {
    // tapeable: ask the station to share its sound with the app (CORS), so Record can tape what plays.
    // station: which one, so the engine can read the song titles it sends.
    const station = STATIONS[next.station];
    return [{ do: 'radio.play', url: station.url, tapeable: canTape(station), station: next.station }];
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

export function soundPlan(prev, next, actionType = '') {
  if (prev === next) return [];
  // Stop what's ending before starting anything new, so two sounds never overlap.
  const steps = [...recordSteps(prev, next), ...radioSteps(prev, next), ...tapeSteps(prev, next, actionType)];
  const stops = steps.filter((st) => /\.(stop|pause)$/.test(st.do));
  const rest = steps.filter((st) => !/\.(stop|pause)$/.test(st.do));
  return [...stops, ...rest];
}
