// Everything the deck screen shows, worked out from the deck's state: words, numbers and which keys are down.
import { freqText, dialPercent, stationAt } from './stations.js';
import { mmss } from './tape-names.js';
import { songAt, songLine } from './songs.js';
import { dialFreq, SEARCHING, STATIC_LINE } from './dial.js';
import { BANDS, listOf, stationOf } from './bands.js';
import { LOCAL_PREFIX, LOCAL_INTRO } from './local-stations.js';

// On FM2 the status line starts "Local · ", so it's clear which dial this is.
function radioStatus(s) {
  if (s.between !== null) return s.playing ? (s.band === 'local' ? `${LOCAL_PREFIX}searching` : SEARCHING) : 'FM, off';
  if (s.tuning) return 'Tuning in';
  // The station and where it is ("KEXP, Seattle WA"); the lit preset key already shows which preset it is.
  const station = stationOf(s);
  const where = station.place ? `${station.name}, ${station.place}` : station.name;
  const text = s.playing ? where : `${where}, off`;
  return s.band === 'local' ? LOCAL_PREFIX + text : text;
}

function statusText(s, isTape) {
  if (s.notice) return s.notice;
  if (isTape) {
    if (s.recording) return 'Recording';
    return s.playing ? 'Tape, playing' : 'Tape, stopped';
  }
  return radioStatus(s);
}

// The song the station says it's playing, while it plays. Empty when it sends nothing.
function nowPlaying(s) {
  const heard = s.heard;
  if (!s.playing || !heard || heard.station !== s.station || !heard.song) return '';
  return songLine(heard.song);
}

function lineText(s, isTape, station) {
  if (!isTape) {
    if (s.between !== null && s.playing) return STATIC_LINE;
    // The first time FM2 opens, until the user tunes.
    return s.intro ? LOCAL_INTRO : nowPlaying(s);
  }
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
  const list = listOf(s);
  const station = list[s.station];
  const isTape = s.mode === 'tape';
  const counter = mmss(s.pos);
  const dial = dialFreq(s, list);
  return {
    isRadio: !isTape,
    isTape,
    recording: s.recording,
    playOn: s.playing && !s.recording,
    stopped: !s.playing,
    isMic: s.source === 'mic',
    isLine: s.source === 'line',
    reelOn: s.playing && isTape,
    // The look's moving part: while there's sound (not between stations).
    sounding: s.playing && (isTape || s.between === null),
    big: isTape ? counter : freqText(dial),
    unit: isTape ? '' : 'MHz',
    counter: isTape ? counter : '',
    status: statusText(s, isTape),
    line: lineText(s, isTape, station),
    tapeTitle: cassetteTitle(s),
    tapeLength: cassetteLength(s),
    needle: dialPercent(dial),
    dialLabel: `Tuned to ${freqText(dial)} FM`,
    // The tuning wheel: where it is, and what a screen reader says about it.
    dial,
    dialText: `${freqText(dial)} FM, ${s.between === null ? station.name : 'between stations'}`,
    rewLabel: isTape ? 'Rewind' : 'Previous station',
    ffLabel: isTape ? 'Fast forward' : 'Next station',
    presets: s.presets.map((f, i) => {
      const at = stationAt(f, list);
      return { n: i + 1, on: !isTape && s.between === null && at === s.station, label: `Preset ${i + 1}: ${freqText(f)} ${list[at].name}` };
    }),
    // The BAND key: { big: 'FM1', small: 'WORLD', label } (logic/bands.js).
    band: BANDS[s.band],
  };
}
