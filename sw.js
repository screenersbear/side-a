// Service worker: keeps a copy of the app on the phone, so the deck and the tape shelf open without the internet.
// Radio streams are never kept (they come from other sites and are live).
// tools/stamp-sw.mjs fills in the cache name and the file list (npm run stamp). Don't edit those two lines by hand.
const CACHE_NAME = 'side-a-506237df36';
const FILES = ["./","app.js","audio/engine.js","audio/radio.js","audio/recorder.js","audio/tape-player.js","components/cassette.js","components/controls.js","components/el.js","components/icons.js","components/level-bars.js","components/tuner.js","data/settings.js","data/tapes.js","fonts/archivo-latin-wdth-italic.woff2","fonts/archivo-latin-wdth-normal.woff2","images/icon-180.png","images/icon-192.png","images/icon-512.png","images/icon-maskable-512.png","index.html","logic/deck-view.js","logic/deck.js","logic/recording.js","logic/routes.js","logic/shelf.js","logic/sound-plan.js","logic/stations.js","logic/tape-names.js","manifest.webmanifest","pages/deck.js","pages/shelf.js","styles/base.css","styles/cassette.css","styles/pocket.css","styles/rotate.css","styles/shelf.css"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES))
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
