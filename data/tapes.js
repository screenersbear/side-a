// The tape shelf's storage: recordings are kept on the phone in IndexedDB (room for long recordings, unlike localStorage).
// A tape: { id, kind: 'voice' | 'radio' | 'mix', title, duration (seconds), created (ms), mime, blob }.
// Stored with the sound as bytes (sound) instead of blob.

const DB_NAME = 'side-a';
const STORE = 'tapes';
let opening = null;

function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openShelf(idb = globalThis.indexedDB) {
  if (!idb) return Promise.reject(new Error('This browser has no storage for tapes.'));
  if (!opening) {
    const request = idb.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    opening = done(request).catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

// For tests: forget the open connection.
export function closeShelf() {
  if (opening) opening.then((db) => db.close()).catch(() => {});
  opening = null;
}

async function store(mode) {
  const db = await openShelf();
  return db.transaction(STORE, mode).objectStore(STORE);
}

// The sound is stored as plain bytes, not as a Blob: Safari in private browsing can't store Blobs.
export async function saveTape(tape) {
  if (!tape || !tape.blob) throw new Error('A tape needs a recording.');
  const record = {
    kind: tape.kind,
    title: tape.title,
    duration: tape.duration,
    created: tape.created,
    mime: tape.mime || tape.blob.type || '',
    sound: await tape.blob.arrayBuffer(),
  };
  const id = await done((await store('readwrite')).add(record));
  return toTape({ ...record, id });
}

// A stored record back as a tape the deck can play: the bytes become a Blob again.
function toTape({ sound, ...rest }) {
  return { ...rest, blob: new Blob([sound], { type: rest.mime }) };
}

export async function listTapes() {
  const records = await done((await store('readonly')).getAll());
  return records.map(toTape);
}

// The newest tape on the shelf, or null when it's empty.
export async function newestTape() {
  const tapes = await listTapes();
  return tapes.reduce((best, t) => (!best || (t.created || 0) > (best.created || 0) ? t : best), null);
}
