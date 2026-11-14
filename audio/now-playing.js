// Reads a station's now-playing text every 20 seconds while it's being taped. The source for each station is
// in data/stations.js (`titles`); logic/now-playing.js says where to look and how to read the answer.
import { titleSource, icyTitle, icecastTitle, kexpTitle } from '../logic/now-playing.js';

const EVERY_MS = 20000;
const WAIT_MS = 8000;
const ICY_MAX_BYTES = 256000;

// The stream with its song titles mixed in: read just until one arrives (usually within 16 KB), then hang up.
async function readIcy(url, signal) {
  const res = await fetch(url, { headers: { 'Icy-MetaData': '1' }, cache: 'no-store', signal });
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  let tail = new Uint8Array(0);
  let size = 0;
  try {
    while (size < ICY_MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) return null;
      size += value.length;
      const seen = new Uint8Array(tail.length + value.length);
      seen.set(tail);
      seen.set(value, tail.length);
      const title = icyTitle(seen);
      if (title !== null) return title;
      tail = seen.slice(-4096); // a title can straddle two pieces
    }
    return null;
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function readJson(url, signal) {
  const res = await fetch(url, { cache: 'no-store', signal });
  return res.ok ? res.json() : null;
}

const READERS = {
  icy: (source) => readIcy(source.url, source.signal),
  json: async (source, station) => icecastTitle(await readJson(source.url, source.signal), station.url),
  kexp: async (source) => kexpTitle(await readJson(source.url, source.signal)),
};

// Calls onText(text) with each reading until stop(). Stations without a source never call it.
export function watchTitles(station, onText) {
  const source = titleSource(station);
  let stopped = false;
  let timer = 0;
  let control = null;

  async function read() {
    control = new AbortController();
    const wait = setTimeout(() => control.abort(), WAIT_MS);
    try {
      const text = await READERS[source.kind]({ ...source, signal: control.signal }, station);
      if (!stopped && text !== null && text !== undefined) onText(text);
    } catch {
      // No title this time (offline, a break, the station said no). Try again next time.
    }
    clearTimeout(wait);
    if (!stopped) timer = setTimeout(read, EVERY_MS);
  }

  if (source) read();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (control) control.abort();
    },
  };
}
