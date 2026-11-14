// Song titles on radio tapes. While the radio is taped, the station's now-playing text ("Artist - Title") is read
// now and then, and each new song is kept with the second it started on the tape.

// What stations send between songs instead of a title.
const NOT_A_SONG = /continue after this break|be right back|after this message|commercial break|^non-music/i;

// Most stations send "Artist - Title". Anything else is kept whole as the title. Break messages are no song.
export function parseNowPlaying(text) {
  // Spaces tidied, and stray dashes at either end dropped ("Just Words - " is just "Just Words").
  const clean = String(text ?? '').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '');
  if (!/[\p{L}\p{N}]/u.test(clean) || NOT_A_SONG.test(clean)) return null;
  const cut = clean.indexOf(' - ');
  if (cut < 0) return { artist: '', title: clean };
  return { artist: clean.slice(0, cut), title: clean.slice(cut + 3) };
}

// The song list with this now-playing text added at second `at`, unless it's the song already playing.
export function addSong(songs, at, text) {
  const list = Array.isArray(songs) ? songs : [];
  const song = parseNowPlaying(text);
  if (!song) return list;
  const last = list[list.length - 1];
  if (last && last.artist === song.artist && last.title === song.title) return list;
  return [...list, { at: Math.max(0, Math.round(Number(at) || 0)), ...song }];
}

// One song in words: "Night Swim, The Paper Lanterns", or just the title.
export function songLine(song) {
  return song.artist ? `${song.title}, ${song.artist}` : song.title;
}

// The song playing at second `at` of a tape, or null.
export function songAt(songs, at) {
  const list = Array.isArray(songs) ? songs : [];
  let now = null;
  for (const song of list) {
    if (song.at <= at) now = song;
  }
  return now;
}
