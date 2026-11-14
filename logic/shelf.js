// The tape shelf: label colour and name for each kind of tape, the filters, and which tapes a filter shows.
import { mmss } from './tape-names.js';

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

// What the shelf writes on and under one tape. The kind is written out too, so colour is never the only sign.
export function tapeCard(tape) {
  const kind = KINDS[tape.kind] || KINDS.voice;
  const len = mmss(tape.duration);
  const title = tape.title || kind.name;
  const meta = `${kind.name}, ${len}`;
  return { title, len, meta, label: kind.label, aria: `Play ${title}: ${meta}` };
}

// The line shown when a filter has no tapes.
export function emptyText(filterId) {
  const f = FILTERS.find((x) => x.id === filterId) || FILTERS[0];
  return f.empty;
}
