// FM1 WORLD's stations from outside the US (HANDOFF "Bands", Starky 2026-11-14): internationally known stations,
// picked from Radio Browser by votes and clicks, each at its real home frequency and city. Where a US station already
// has that frequency (the US ones came first: saved presets point at them), the world station moves up 0.1 MHz;
// `home` is then its real frequency. Every one lets the app read its stream, so all can be taped.
// Checked live on 2026-11-14 (node tools/check-stations.mjs checks them again).
export const WORLD_LIST = [
  { freq: 90.0, home: 89.9, name: "TSF Jazz", place: "Paris France", url: "https://tsfjazz.ice.infomaniak.ch/tsfjazz-high.mp3" },
  { freq: 92.1, name: "Mouv'", place: "Paris France", url: "https://icecast.radiofrance.fr/mouv-midfi.mp3" },
  { freq: 93.6, home: 93.5, name: "France Culture", place: "Paris France", url: "https://icecast.radiofrance.fr/franceculture-midfi.mp3" },
  { freq: 94.0, home: 93.9, name: "DR P3", place: "Copenhagen Denmark", url: "https://live-icy.dr.dk/A/A05H.mp3" },
  { freq: 95.8, name: "radioeins", place: "Berlin Germany", url: "https://dispatcher.rndfnk.com/rbb/radioeins/live/mp3/mid" },
  { freq: 95.9, home: 95.8, name: "Capital", place: "London UK", url: "https://media-ssl.musicradio.com/CapitalMP3" },
  { freq: 96.6, name: "George FM", place: "Auckland New Zealand", url: "https://mediaworks.streamguys1.com/george_net_icy" },
  { freq: 97.4, home: 97.3, name: "Bayern 3", place: "Munich Germany", url: "https://dispatcher.rndfnk.com/br/br3/live/mp3/mid" },
  { freq: 97.8, home: 97.7, name: "Deutschlandfunk", place: "Berlin Germany", url: "https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3" },
  { freq: 101.5, name: "Radio Nova", place: "Paris France", url: "https://novazz.ice.infomaniak.ch/novazz-128.mp3" },
  { freq: 103.8, name: "FM4", place: "Vienna Austria", url: "https://orf-live.ors-shoutcast.at/fm4-q2a" },
  { freq: 105.0, home: 104.9, name: "Radio X", place: "London UK", url: "https://media-ssl.musicradio.com/RadioXUK" },
  { freq: 105.2, home: 105.1, name: "FIP", place: "Paris France", url: "https://icecast.radiofrance.fr/fip-midfi.mp3" },
  { freq: 105.8, home: 105.7, name: "triple j", place: "Sydney Australia", url: "https://abc.streamguys1.com/live/triplejnsw/icecast.audio" },
];
