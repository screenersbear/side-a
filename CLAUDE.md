# SIDE A: notes for Claude

A cassette Walkman for the phone, as a web app (landscape only). Plays internet radio, records voice notes and tapes
the radio, keeps recordings on a tape shelf. Built 2026-11-14 from `../SIDE A mockup handoff/` (read its HANDOFF.md and
DESIGN.md before any visual change; also `../Claude Brain/taste.md`). Look: **Pocket** only (Starky's pick).

## How it's put together

- `logic/`: pure rules, 100% unit tested. `deck.js` is the deck's state and what every button does; `sound-plan.js`
  turns a state change into steps for the speakers and recorder; `deck-view.js` is what the screen shows;
  `stations.js` the dial (Next/Previous seek station to station, no manual tuning) and the four presets;
  `shelf.js` filters and labels; `recording.js` formats and error words.
- `data/stations.js`: every station on the dial, one real US station per FM frequency (73, from Radio Browser,
  checked 2026-11-14). `tape: false` = the stream doesn't allow recording; Record then says "Recording isn't allowed
  on this station." (WFMU 91.1). A station that blocks it at the moment of recording gets the same message.
- `data/`: `tapes.js` (IndexedDB; the sound is stored as bytes, not a Blob, so Safari private mode works) and
  `settings.js` (last station and record source).
- `audio/`: `radio.js` (audio element on the stream), `tape-player.js`, `recorder.js` (mic via MediaRecorder; radio by
  keeping the station's own MP3 bytes from fetch, which needs the station to allow CORS), `engine.js` runs the steps.
- `pages/` deck and shelf; `components/` cassette (true 1004 x 638 geometry), keys, tuner, level bars; `styles/`.
- `app.js` wires it: dispatch(action) -> new state -> sound steps -> screen update, all in the same tap (iPhones need that).
- After changing any app file: `npm run stamp` (offline copy list in sw.js). `npm run build` also redraws the icons.
- `npm run check-stations` checks every station is streaming and whether it allows taping (needs the station to send
  `Access-Control-Allow-Origin`). Node rejects some certificates browsers accept (98.5 today): check those in a browser.

## Testing SIDE A

- **Mute while testing the radio** (Starky, 2026-11-14). In the browser pane, run this before pressing anything, after
  every reload: `const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { this.muted = true; return p.call(this); }`.
  The browser tests already mute themselves and use a stand-in station and mic (`tests/e2e/side-a.spec.mjs`).
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
