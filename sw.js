// Service worker: keeps a copy of the app on the phone, so the deck and the tape shelf open without the internet.
// Radio streams are never kept (they come from other sites and are live).
// tools/stamp-sw.mjs fills in the cache name and the file list (npm run stamp). Don't edit those two lines by hand.
const CACHE_NAME = 'side-a-5270b70ecf';
const FILES = ["./","app.js","audio/engine.js","audio/export.js","audio/lock-screen.js","audio/mixdown.js","audio/now-playing.js","audio/radio-feed.js","audio/radio-tape.js","audio/radio.js","audio/recorder.js","audio/sound-check.js","audio/stay-awake.js","audio/tape-player.js","components/cassette.js","components/controls.js","components/deck-parts.js","components/el.js","components/eq.js","components/hold.js","components/icons.js","components/level-bars.js","components/meters.js","components/speaker.js","components/tape-menu.js","components/tape-picker.js","components/tuner.js","components/waveform.js","data/settings.js","data/share.js","data/stations.js","data/tapes.js","fonts/archivo-latin-wdth-italic.woff2","fonts/archivo-latin-wdth-normal.woff2","images/icon-180.png","images/icon-192.png","images/icon-512.png","images/icon-maskable-512.png","index.html","logic/deck-view.js","logic/deck.js","logic/export.js","logic/lock-screen.js","logic/looks.js","logic/mix-layout.js","logic/mix.js","logic/mp3.js","logic/now-playing.js","logic/recording.js","logic/routes.js","logic/shelf.js","logic/songs.js","logic/sound-check.js","logic/sound-plan.js","logic/stations.js","logic/stream-frames.js","logic/tape-names.js","logic/trim.js","logic/wav.js","manifest.webmanifest","pages/clip.js","pages/deck.js","pages/looks/boombox.js","pages/looks/deck.js","pages/looks/pocket.js","pages/looks/sport.js","pages/mix.js","pages/mixing.js","pages/settings.js","pages/shelf.js","styles/base.css","styles/cassette.css","styles/deck-common.css","styles/look-boombox.css","styles/look-deck.css","styles/look-pocket.css","styles/look-sport.css","styles/mix.css","styles/rotate.css","styles/settings.css","styles/shelf.css","styles/tape-menu.css","styles/tape-picker.css","vendor/lamejs.js"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Fresh from the site, not the browser's own cache: GitHub Pages lets browsers keep files for 10 minutes,
      // so a copy made just after a release could otherwise keep some of the old files under the new name.
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// A new version: throw away the old copies.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The saved copy first, the internet only for anything not saved.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches
      .match(request, { ignoreSearch: true })
      .then((hit) => hit || (request.mode === 'navigate' ? caches.match('./') : null))
      .then((hit) => hit || fetch(request)),
  );
});
