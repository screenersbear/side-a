// The tape shelf: label colour and name for each kind of tape, the filters, and which tapes a filter shows.
import { mmss } from './tape-names.js';
import { freqText } from './stations.js';

export const KINDS = {
  voice: { label: '#FFD100', name: 'Voice note' },
  radio: { label: '#1FC8F0', name: 'Taped from radio' },
  mix: { label: '#FF8A3D', name: 'Mixtape' },
};

export const FILTERS = [
  { id: 'all', name: 'All', empty: 'No tapes yet.' },
  { id: 'voice', name: 'Voice', empty: 'No voice notes yet.' },
  { id: 'radio', name: 'Radio', empty: 'Nothing taped from the radio yet.' },
  { id: 'mix', name: 'Mixes', empty: 'No mixtapes yet.' },
];

export function isFilter(id) {
  return FILTERS.some((f) => f.id === id);
}

// The tapes a filter shows, newest first. Unknown filters show everything.
export function filterTapes(tapes, filterId) {
  const list = Array.isArray(tapes) ? tapes.filter((t) => t && KINDS[t.kind]) : [];
  const shown = filterId && filterId !== 'all' && isFilter(filterId) ? list.filter((t) => t.kind === filterId) : list;
  return [...shown].sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
}

// A radio tape with song titles: the station number and the first song on the label ("101.9 · NIGHT SWIM"),
// the artist and how many more songs underneath ("Radio · The Paper Lanterns, +5 more").
function songCard(tape, kind, len) {
  const first = tape.songs[0];
  const more = tape.songs.length - 1;
  const freq = freqText(tape.freq);
  const title = `${freq} · ${first.title}`;
  const meta = `Radio · ${first.artist || tape.station || 'Radio'}${more ? `, +${more} more` : ''}`;
  const by = first.artist ? ` by ${first.artist}` : '';
  const others = more ? ` and ${more} more ${more === 1 ? 'song' : 'songs'}` : '';
  return { title, len, meta, label: kind.label, aria: `${freq}, ${first.title}${by}${others}: ${kind.name}, ${len}` };
}

// What the shelf writes on and under one tape. The kind is written out too, so colour is never the only sign.
// aria: what a screen reader says for the tape (tapping it opens its menu: Play, Share, Rename, Delete).
export function tapeCard(tape) {
  const kind = KINDS[tape.kind] || KINDS.voice;
  const len = mmss(tape.duration);
  // A radio tape is labelled with its station and first song, until it's given a name of its own.
  if (tape.kind === 'radio' && !tape.named && tape.freq && Array.isArray(tape.songs) && tape.songs.length) return songCard(tape, kind, len);
  const title = tape.title || kind.name;
  const meta = `${kind.name}, ${len}`;
  return { title, len, meta, label: kind.label, aria: `${title}: ${meta}` };
}

// The line shown when a filter has no tapes.
export function emptyText(filterId) {
  const f = FILTERS.find((x) => x.id === filterId) || FILTERS[0];
  return f.empty;
}
