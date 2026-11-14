// Checks every FM1 station (data/stations.js and data/world-stations.js): is it streaming, and does it still allow taping in a browser?
// Stations come and go; run this now and then: npm run check-stations
// Node trusts fewer certificates than browsers, so a "certificate" problem may still play fine in Safari and Chrome.
import { STATION_LIST } from '../data/stations.js';
import { WORLD_LIST } from '../data/world-stations.js';

async function check(station) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 8000);
  try {
    const res = await fetch(station.url, { signal: control.signal, headers: { Origin: 'https://example.test' } });
    const cors = res.headers.get('access-control-allow-origin') || '';
    const reader = res.body.getReader();
    let bytes = 0;
    while (bytes < 20000) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
    }
    control.abort();
    const live = res.ok && bytes >= 20000;
    const tapes = cors === '*' || cors === 'https://example.test';
    return { station, live, tapes, why: live ? '' : `status ${res.status}` };
  } catch (error) {
    const code = error.cause?.code || error.name;
    return { station, live: false, tapes: false, why: /CERT|SIGNATURE|ISSUER/.test(code) ? `certificate (${code})` : code };
  } finally {
    clearTimeout(timer);
  }
}

// A few at a time: 87 streams opened at once share the connection and the far ones time out.
const AT_ONCE = 12;
const queue = [...STATION_LIST, ...WORLD_LIST];
const results = [];
await Promise.all(Array.from({ length: AT_ONCE }, async () => {
  while (queue.length) results.push(await check(queue.shift()));
}));
const dead = results.filter((r) => !r.live);
const wrongFlag = results.filter((r) => r.live && r.tapes !== (r.station.tape !== false));
for (const r of dead) console.log(`not streaming: ${r.station.freq} ${r.station.name}, ${r.why}  ${r.station.url}`);
for (const r of wrongFlag) console.log(`taping changed: ${r.station.freq} ${r.station.name} now ${r.tapes ? 'allows' : 'blocks'} recording`);
console.log(`${results.length} stations: ${results.length - dead.length} streaming, ${dead.length} not, ${wrongFlag.length} taping flags to fix`);
process.exitCode = dead.length || wrongFlag.length ? 1 : 0;
