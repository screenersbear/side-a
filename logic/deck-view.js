// Everything the deck screen shows, worked out from the deck's state: words, numbers and which keys are down.
import { STATIONS, freqText, dialPercent } from './stations.js';
import { mmss } from './tape-names.js';

function statusText(s, isTape) {
  if (s.notice) return s.notice;
  if (isTape) {
    if (s.recording) return 'Recording';
    return s.playing ? 'Tape, playing' : 'Tape, stopped';
  }
  if (s.tuning) return 'Tuning in';
  return s.playing ? `FM, preset ${s.station + 1}` : `FM, preset ${s.station + 1}, off`;
}

function lineText(s, isTape, station) {
  if (!isTape) return `${station.name}, ${station.place}`;
  if (s.recording) return s.source === 'mic' ? 'Mic to side A' : `Taping ${freqText(station.freq)} FM`;
  if (s.draft) return 'Saving the tape';
  return s.tape ? s.tape.title : 'Blank tape';
}

function cassetteTitle(s) {
  if (s.draft) return s.draft.title;
  return s.tape ? s.tape.title : 'Blank';
}

function cassetteLength(s) {
  if (s.recording || s.draft || !s.tape) return 'C90';
  return mmss(s.tape.duration);
}

export function deckView(s) {
  const station = STATIONS[s.station];
  const isTape = s.mode === 'tape';
  const counter = mmss(s.pos);
  return {
    isRadio: !isTape,
    isTape,
    recording: s.recording,
    playOn: s.playing && !s.recording,
    stopped: !s.playing,
    isMic: s.source === 'mic',
    isLine: s.source === 'line',
    reelOn: s.playing && isTape,
    sounding: s.playing,
    big: isTape ? counter : freqText(station.freq),
    unit: isTape ? '' : 'MHz',
    counter: isTape ? counter : '',
    status: statusText(s, isTape),
    line: lineText(s, isTape, station),
    tapeTitle: cassetteTitle(s),
    tapeLength: cassetteLength(s),
    needle: dialPercent(station.freq),
    dialLabel: `Tuned to ${freqText(station.freq)} FM`,
    rewLabel: isTape ? 'Rewind' : 'Previous station',
    ffLabel: isTape ? 'Fast forward' : 'Next station',
    presets: STATIONS.map((st, i) => ({
      n: i + 1,
      on: !isTape && i === s.station,
      label: `Preset ${i + 1}: ${freqText(st.freq)} ${st.name}`,
    })),
  };
}
