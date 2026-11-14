// Where a station's now-playing text comes from, and how to read it. Each station in data/stations.js may name
// one source in `titles` (checked by tools/check-stations.mjs); stations without one keep just their name.
//   icy:  the song titles inside the stream itself (ICY "StreamTitle"), asked for with an Icy-MetaData header
//   json: the Icecast server's now-playing file, status-json.xsl
//   kexp: KEXP's own feed
export const KEXP_FEED = 'https://api.kexp.org/v2/plays/?limit=1';
export const TITLE_SOURCES = ['icy', 'json', 'kexp'];

// What to fetch for a station's titles: { kind, url }, or null when it has no source.
export function titleSource(station) {
  if (!station || !TITLE_SOURCES.includes(station.titles)) return null;
  if (station.titles === 'kexp') return { kind: 'kexp', url: KEXP_FEED };
  if (station.titles === 'json') return { kind: 'json', url: `${new URL(station.url).origin}/status-json.xsl` };
  return { kind: 'icy', url: station.url };
}

// The StreamTitle in a piece of an ICY stream, or null if this piece doesn't hold one yet.
export function icyTitle(bytes) {
  const text = new TextDecoder('utf-8').decode(bytes);
  const start = text.indexOf("StreamTitle='");
  if (start < 0) return null;
  const end = text.indexOf("';", start + 13);
  if (end < 0) return null;
  return text.slice(start + 13, end);
}

// The title for this station's stream in an Icecast status-json.xsl answer.
export function icecastTitle(data, streamUrl) {
  let sources = data && data.icestats && data.icestats.source;
  if (!sources) return null;
  if (!Array.isArray(sources)) sources = [sources];
  const path = new URL(streamUrl).pathname;
  const mine = sources.find((s) => s && s.listenurl && new URL(s.listenurl, streamUrl).pathname === path);
  if (!mine) return null;
  if (mine.artist && mine.title) return `${mine.artist} - ${mine.title}`;
  return mine.title ? String(mine.title) : null;
}

// The song in KEXP's feed, or null during a break.
export function kexpTitle(data) {
  const play = data && Array.isArray(data.results) ? data.results[0] : null;
  if (!play || play.play_type !== 'trackplay' || !play.song) return null;
  return play.artist ? `${play.artist} - ${play.song}` : play.song;
}
