// Everything the deck screen shows, worked out from the deck's state: words, numbers and which keys are down.
import { STATIONS, freqText, dialPercent, presetNumber, PRESET_FREQS, stationAt } from './stations.js';
import { mmss } from './tape-names.js';
import { songAt, songLine } from './songs.js';

function statusText(s, isTape) {
  if (s.notice) return s.notice;
  if (isTape) {
    if (s.recording) return 'Recording';
    return s.playing ? 'Tape, playing' : 'Tape, stopped';
  }
  if (s.tuning) return 'Tuning in';
  const preset = presetNumber(s.station);
  const where = preset ? `FM, preset ${preset}` : 'FM';
  return s.playing ? where : `${where}, off`;
}

function lineText(s, isTape, station) {
  if (!isTape) return station.place ? `${station.name}, ${station.place}` : station.name;
  if (s.recording) return s.source === 'mic' ? 'Mic to side A' : `Taping ${freqText(station.freq)} FM`;
  if (s.draft) return 'Saving the tape';
  if (!s.tape) return 'Blank tape';
  // A radio tape with song titles names the song at the counter.
  const song = songAt(s.tape.songs, s.pos);
  return song ? songLine(song) : s.tape.title;
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
    presets: PRESET_FREQS.map((f, i) => {
      const at = stationAt(f);
      return { n: i + 1, on: !isTape && at === s.station, label: `Preset ${i + 1}: ${freqText(f)} ${STATIONS[at].name}` };
    }),
  };
}
