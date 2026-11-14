# SIDE A: notes for Claude

A cassette Walkman for the phone, as a web app (landscape only). Plays internet radio, records voice notes and tapes
the radio, keeps recordings on a tape shelf. Built 2026-11-14 from `../SIDE A mockup handoff/` (read its HANDOFF.md and
DESIGN.md before any visual change; also `../Claude Brain/taste.md`). Looks: Pocket (the default), Deck, Sport and Boombox,
picked in Settings and remembered on the device (Starky, 2026-11-14).

## How it's put together

- `logic/`: pure rules, 100% unit tested. `deck.js` is the deck's state and what every button does; `sound-plan.js`
  turns a state change into steps for the speakers and recorder; `deck-view.js` is what the screen shows;
  `stations.js` the dial (Next/Previous seek station to station, no manual tuning) and the four presets
  (defaults WBGO, The Current, KEXP, KUTX; `cleanPresets` checks saved ones against the dial);
  `shelf.js` filters and labels; `recording.js` formats and error words; `songs.js` and `now-playing.js` the song
  titles shown while a station plays and kept on radio tapes; `looks.js` the four looks and their colours; `routes.js` which screen (#/shelf, #/settings).
- `data/stations.js`: every station on the dial, one real US station per FM frequency (73, from Radio Browser,
  checked 2026-11-14). `tape: false` = the stream doesn't allow recording; Record then says "Recording isn't allowed
  on this station." (WFMU 91.1). A station that blocks it at the moment of recording gets the same message.
- `data/`: `tapes.js` (IndexedDB; the sound is stored as bytes, not a Blob, so Safari private mode works) and
  `settings.js` (last station and record source; the look and the presets, each under its own key).
- `audio/`: `radio.js` (audio element on the stream; tapeable stations are asked to share their sound, crossOrigin,
  and fall back to playing plain if they refuse), `tape-player.js`, `recorder.js` (MediaRecorder at 192 kbps: the mic
  with call clean-up off, or the radio as it plays, element -> Web Audio -> MediaStreamDestination, from the moment REC
  is pressed; Starky 2026-11-14: never a second connection), `now-playing.js` (while the radio plays, reads the station's
  song title every 20 s; one reading feeds both the deck's second line and a radio tape's songs: `titles` in data/stations.js says from where: "icy" = the stream itself, "json" = the
  Icecast server's status-json.xsl, "kexp" = KEXP's feed; 14 of 73 stations have one), `engine.js` runs the steps.
- `pages/`: `deck.js` builds the deck in the picked look: the parts are the same in every look
  (`components/deck-parts.js`), each look in `pages/looks/` only arranges them and adds its moving part (Pocket level
  bars, Deck meters, Sport EQ, Boombox speaker; all CSS, off with reduce motion). `shelf.js`, `settings.js`.
  Changing the look rebuilds the deck screen; the deck's state and the sound carry on.
  On the radio every look shows "<station>, <place>" ("KEXP, Seattle WA"; ", off" when the radio is off; Starky,
  2026-11-14: where it is, not the preset number, which the lit key already shows) and, when the station names it, "<song> · <artist>"
  (Boombox: under the speaker, with a note). Record pressed again while recording stops it, the same as Stop.
  Stopping a radio recording saves the tape and the radio plays on, back in radio mode (Starky, 2026-11-14:
  like a boombox); Stop again turns it off. Mic recordings stop everything, as before.
  Presets work like a car radio (Starky, 2026-11-14): a tap tunes; holding a key for a second
  (`components/hold.js`: finger, mouse, or Enter/Space held) saves the station on the dial there and shows
  "Saved to preset N" for 2 s. On tape a hold is just a tap.
- Mixes (Starky, 2026-11-14: "keep it this simple"): New mix on the shelf -> `#/mix` (`pages/mix.js`, the
  timeline) and `#/clip` (`pages/clip.js`, a tape and its start/end handles); `pages/mixing.js` holds the mix in
  progress. Rules in `logic/mix.js` (cut at the red line, remove, None / Fade in 1.5 s), `logic/trim.js`,
  `logic/mix-layout.js` (pixels <-> seconds). `audio/mixdown.js` decodes tapes, plays the mix (Web Audio) and
  renders it (OfflineAudioContext) into one WAV (`logic/wav.js`, 44.1 kHz stereo, about 10 MB a minute).
- `components/`: cassette (true 1004 x 638 geometry; `bandBig` for the Deck look), keys, tuner, the moving parts.
- `styles/`: `deck-common.css` (what every look shares), one `look-*.css` per look (colours and sizes from the
  mockup's `Skin*.dc.html` at 844 x 390, scaling with the phone), `shelf.css`, `settings.css`, `mix.css`.
- `app.js` wires it: dispatch(action) -> new state -> sound steps -> screen update, all in the same tap (iPhones need that).
- After changing any app file: `npm run stamp` (offline copy list in sw.js). `npm run build` also redraws the icons.
- `npm run check-stations` checks every station is streaming and whether it allows taping (needs the station to send
  `Access-Control-Allow-Origin`). Node rejects some certificates browsers accept (98.5 today): check those in a browser.

## Testing SIDE A

- **Mute while testing the radio** (Starky, 2026-11-14). In the browser pane, run this before pressing anything, after
  every reload: `const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { this.muted = true; return p.call(this); }`.
  The mix plays through Web Audio, so mute that too: route every live context's `destination` through a zero gain
  (the `fakeSources` stand-in in `tests/e2e/side-a.spec.mjs` has the snippet).
  The browser tests already mute themselves and use a stand-in station and mic (`tests/e2e/side-a.spec.mjs`). They
  block the service worker: in WebKit, Playwright's stand-ins can't answer a page a service worker controls.
- The service worker only registers on https and on 127.0.0.1 (the test server), so a preview on localhost shows edits.

## Testing rules (from app-safety-kit)

These rules apply to every change in this repo. Where they run changed on 2026-11-14, to save time and tokens: the checks
themselves and every number in safety.config.json stay as they are.

1. Every function gets several unit tests: the normal case, the edge cases (empty, zero, one item, very large, dates across midnight/months), and bad input. Three tests per function is the floor, not the goal.
2. Keep logic (calculations, data shaping, storage, parsing) in exported functions inside the folders listed under "logic" in safety.config.json. Keep DOM wiring thin. Logic is unit tested; the DOM is covered by the browser tests.
3. Never lower a number in safety.config.json, never add `.skip` / `.only`, never delete or weaken a test to make things pass, and never add files to "ignore" to dodge coverage. If a threshold seems wrong, stop and ask Starky.
4. While working, run only the unit tests for the files you changed (`npx vitest run --config vitest.config.mjs <test file>`). Then run `npm run test:quick` once, before committing, and fix anything it reports. (The pre-push check runs it again on push.)
5. Don't run the mutation tests, Lighthouse or the speed checks on this computer (`test:mutation`, `test:lighthouse`, `test:perf`, `test:all`). GitHub Actions runs them, with the unit and browser tests and an npm audit, on every push and every night (`.github/workflows/safety-checks.yml`).
6. If a GitHub run fails, fix that first. `node tools/ci-status.mjs` shows the latest runs and, for a failed job, the step and the notes it left (failing tests, mutants not caught, Lighthouse scores), without a login. A bug still gets its failing test first; mutants not caught in code you changed get tests that catch them.
7. Don't split work across parallel agents or worktrees unless Starky asks.
8. Any new button, link or control must survive tests/e2e/click-everything. Only add `data-test-skip` to a control that would destroy real data or call a paid/external service, and leave an HTML comment saying why.
9. Save tokens: run tests through the npm scripts (they print short summaries). Read only the failing test's output, e.g. `npm run test:quick 2>&1 | tail -60`. Do not open the HTML reports or paste full logs.
10. When fixing a bug, first write a test that fails because of the bug, then fix it.
