// Finding FM2 LOCAL's stations: where the user is (the phone's location, or a US ZIP code), then Radio Browser's
// stations near there (logic/local-stations.js turns them into a dial). Errors carry a name logic/local-stations.js
// has words for: NotFound (no such ZIP), NoStations, Denied (location is off), Unavailable; anything else is offline.
import { searchUrl, zipUrl, zipPlace, localStations, roundPlace } from '../logic/local-stations.js';

function named(name) {
  return Object.assign(new Error(name), { name });
}

async function getJson(url, fetcher) {
  const res = await fetcher(url);
  if (res.status === 404) throw named('NotFound');
  if (!res.ok) throw named('NetworkError');
  return res.json();
}

// The phone's location, kept to about 10 km: { lat, lon, label: '' }.
export function whereAmI(geo = globalThis.navigator && navigator.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geo) return reject(named('Unavailable'));
    geo.getCurrentPosition(
      (pos) => {
        const place = roundPlace(pos.coords.latitude, pos.coords.longitude);
        if (place) resolve({ ...place, label: '' });
        else reject(named('Unavailable'));
      },
      (error) => reject(named(error && error.code === 1 ? 'Denied' : 'Unavailable')),
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 15000 },
    );
  });
}

// Where a US ZIP code is: { lat, lon, label: 'Beverly Hills CA' }.
export async function placeOfZip(zip, fetcher = globalThis.fetch) {
  const url = zipUrl(zip);
  if (!url) throw named('NotFound');
  const place = zipPlace(await getJson(url, fetcher));
  if (!place) throw named('NotFound');
  return place;
}

// FM2's dial near a place: its stations, low to high.
export async function stationsNear(place, fetcher = globalThis.fetch) {
  const stations = localStations(await getJson(searchUrl(place), fetcher));
  if (!stations.length) throw named('NoStations');
  return stations;
}
