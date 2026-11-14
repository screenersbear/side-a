// What the phone's lock screen and Control Center show while SIDE A plays: the station or tape, the song, and
// what their skip buttons do (change station on the radio, jump 10 seconds on a tape). Pure, so it can be tested;
// audio/lock-screen.js puts it on the phone.
import { freqText } from './stations.js';
import { stationOf } from './bands.js';
import { KINDS } from './shelf.js';
import { songAt } from './songs.js';
import { SEARCHING } from './dial.js';

const BRAND = 'SIDE A';

function radioInfo(s) {
  if (s.between !== null) return { title: SEARCHING, artist: `${freqText(s.between)} FM`, album: BRAND };
  const station = stationOf(s);
  const where = station.place ? `${station.name}, ${station.place}` : station.name;
  const heard = s.playing && s.heard && s.heard.station === s.station ? s.heard.song : null;
  if (heard) return { title: heard.title, artist: heard.artist || where, album: where };
  return { title: station.name, artist: `${freqText(station.freq)} FM${station.place ? `, ${station.place}` : ''}`, album: BRAND };
}

function tapeInfo(s) {
  if (!s.tape) return { title: 'Blank tape', artist: BRAND, album: BRAND };
  const kind = KINDS[s.tape.kind] || KINDS.voice;
  const name = s.tape.title || kind.name;
  const song = songAt(s.tape.songs, s.pos);
  if (song) return { title: song.title, artist: song.artist || kind.name, album: name };
  return { title: name, artist: kind.name, album: BRAND };
}

function recordingInfo(s) {
  const station = stationOf(s);
  const from = s.source === 'mic' ? 'Mic to side A' : `Taping ${freqText(station.freq)} FM`;
  return { title: 'Recording', artist: from, album: BRAND };
}

// { title, artist, album, playing, skip: 'station' | 'seek' | '' }
export function lockScreen(s) {
  if (s.recording) return { ...recordingInfo(s), playing: true, skip: '' };
  if (s.mode === 'tape') return { ...tapeInfo(s), playing: s.playing, skip: s.tape ? 'seek' : '' };
  return { ...radioInfo(s), playing: s.playing, skip: 'station' };
}
