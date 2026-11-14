import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openShelf, closeShelf, saveTape, listTapes, getTape, newestTape, renameTape, deleteTape } from '../../data/tapes.js';

const sound = (text = 'abc', type = 'audio/mp4') => new Blob([text], { type });
const tape = (extra = {}) => ({ kind: 'voice', title: 'Nov 14, 9:41 PM', duration: 9, created: 1000, blob: sound(), ...extra });

beforeEach(async () => {
  closeShelf();
  await new Promise((resolve) => {
    const r = indexedDB.deleteDatabase('side-a');
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
});

describe('saveTape', () => {
  it('saves a tape and gives it a number', async () => {
    const saved = await saveTape(tape());
    expect(saved.id).toBe(1);
    expect(saved).toMatchObject({ kind: 'voice', title: 'Nov 14, 9:41 PM', duration: 9, created: 1000, mime: 'audio/mp4' });
    expect((await saveTape(tape())).id).toBe(2);
  });
  it('keeps the sound itself', async () => {
    const saved = await saveTape(tape({ blob: sound('hello') }));
    expect(saved.blob.size).toBe(5);
    const [back] = await listTapes();
    expect(back.blob.size).toBe(5);
  });
  it('uses the given format first, then the recording\'s own, then none', async () => {
    expect((await saveTape(tape({ mime: 'audio/mpeg' }))).mime).toBe('audio/mpeg');
    expect((await saveTape(tape({ blob: sound('x', 'audio/webm') }))).mime).toBe('audio/webm');
    expect((await saveTape(tape({ blob: sound('x', '') }))).mime).toBe('');
  });
  it('saves only the known fields', async () => {
    await saveTape(tape({ playing: true, extra: 'x' }));
    const [back] = await listTapes();
    expect(Object.keys(back).sort()).toEqual(['blob', 'created', 'duration', 'id', 'kind', 'mime', 'title']);
  });
  it('a radio tape keeps its station and its songs, and nothing else from them', async () => {
    const songs = [{ at: 0, artist: 'A', title: 'One', extra: 1 }, { at: 60, artist: '', title: 'Two' }];
    await saveTape(tape({ kind: 'radio', freq: 90.3, station: 'KEXP', songs }));
    const [back] = await listTapes();
    expect(back).toMatchObject({ freq: 90.3, station: 'KEXP', songs: [{ at: 0, artist: 'A', title: 'One' }, { at: 60, artist: '', title: 'Two' }] });
    expect(back.songs[0]).not.toHaveProperty('extra');
  });
  it('a radio tape with no station name or songs saves what it has', async () => {
    await saveTape(tape({ kind: 'radio', freq: 98.9, songs: [] }));
    const [back] = await listTapes();
    expect(back).toMatchObject({ freq: 98.9, station: '', songs: [] });
  });
  it('stores the sound as bytes and gives it back as a recording of the same format', async () => {
    await saveTape(tape({ blob: sound('hello', 'audio/webm') }));
    const raw = await new Promise((resolve) => {
      const q = indexedDB.open('side-a');
      q.onsuccess = () => {
        const get = q.result.transaction('tapes').objectStore('tapes').get(1);
        get.onsuccess = () => {
          q.result.close();
          resolve(get.result);
        };
      };
    });
    expect(raw.blob).toBeUndefined();
    expect(raw.sound.byteLength).toBe(5);
    const [back] = await listTapes();
    expect(back.blob.type).toBe('audio/webm');
    expect(await back.blob.text()).toBe('hello');
  });
  it('refuses a tape with no recording', async () => {
    await expect(saveTape(tape({ blob: null }))).rejects.toThrow('A tape needs a recording.');
    await expect(saveTape(null)).rejects.toThrow('A tape needs a recording.');
  });
});

describe('listTapes', () => {
  it('is empty on a new phone', async () => {
    expect(await listTapes()).toEqual([]);
  });
  it('lists every saved tape', async () => {
    await saveTape(tape({ title: 'a' }));
    await saveTape(tape({ title: 'b', kind: 'radio' }));
    const list = await listTapes();
    expect(list.map((t) => t.title)).toEqual(['a', 'b']);
    expect(list[1].kind).toBe('radio');
  });
  it('still finds tapes after the shelf is closed and opened again', async () => {
    await saveTape(tape());
    closeShelf();
    expect(await listTapes()).toHaveLength(1);
  });
});

describe('newestTape', () => {
  it('is null on an empty shelf', async () => {
    expect(await newestTape()).toBe(null);
  });
  it('finds the most recently made tape, whatever order they were saved in', async () => {
    await saveTape(tape({ title: 'old', created: 100 }));
    await saveTape(tape({ title: 'new', created: 300 }));
    await saveTape(tape({ title: 'middle', created: 200 }));
    expect((await newestTape()).title).toBe('new');
  });
  it('prefers a dated tape over one with no date', async () => {
    await saveTape(tape({ title: 'undated', created: undefined }));
    await saveTape(tape({ title: 'dated', created: 5 }));
    expect((await newestTape()).title).toBe('dated');
  });
  it('keeps the first of two equally new tapes, and copes with no dates at all', async () => {
    await saveTape(tape({ title: 'first', created: undefined }));
    await saveTape(tape({ title: 'second', created: undefined }));
    expect((await newestTape()).title).toBe('first');
  });
});

describe('openShelf', () => {
  it('opens the same shelf every time', async () => {
    const a = await openShelf();
    const b = await openShelf();
    expect(a).toBe(b);
  });
  it('fails clearly when the browser has no storage', async () => {
    await expect(openShelf(null)).rejects.toThrow('This browser has no storage for tapes.');
  });
  it('tries again after a failed open', async () => {
    const broken = {
      open() {
        const request = {};
        setTimeout(() => {
          request.error = new Error('disk');
          request.onerror();
        });
        return request;
      },
    };
    await expect(openShelf(broken)).rejects.toThrow('disk');
    await expect(openShelf()).resolves.toBeTruthy();
  });
  it('closing while an open is failing does no harm', async () => {
    const broken = {
      open() {
        const request = {};
        setTimeout(() => {
          request.error = new Error('disk');
          request.onerror();
        });
        return request;
      },
    };
    const opening = openShelf(broken);
    closeShelf();
    await expect(opening).rejects.toThrow('disk');
  });
  it('closing when nothing is open does no harm', () => {
    closeShelf();
    expect(() => closeShelf()).not.toThrow();
  });
});

describe('renameTape', () => {
  it('gives the tape a new name, marked as named, and keeps the rest', async () => {
    const saved = await saveTape(tape({ kind: 'radio', freq: 90.3, station: 'KEXP', songs: [{ at: 0, artist: 'A', title: 'One' }] }));
    const renamed = await renameTape(saved.id, 'Late Night Drive');
    expect(renamed).toMatchObject({ id: saved.id, title: 'Late Night Drive', named: true, kind: 'radio', freq: 90.3, duration: 9 });
    expect(renamed.blob.size).toBe(3);
    const [back] = await listTapes();
    expect(back).toMatchObject({ id: saved.id, title: 'Late Night Drive', named: true, songs: [{ at: 0, artist: 'A', title: 'One' }] });
  });
  it('a tape that is gone can\'t be renamed', async () => {
    await expect(renameTape(99, 'X')).rejects.toThrow('That tape is no longer on the shelf.');
  });
});

describe('deleteTape', () => {
  it('takes the tape off the shelf, and only that one', async () => {
    const one = await saveTape(tape({ title: 'One' }));
    const two = await saveTape(tape({ title: 'Two' }));
    await deleteTape(one.id);
    expect((await listTapes()).map((t) => t.id)).toEqual([two.id]);
    await deleteTape(99);
    expect(await listTapes()).toHaveLength(1);
  });
});

describe('getTape', () => {
  it('reads one tape back as the phone stored it, sound and all', async () => {
    await saveTape(tape({ blob: sound('first') }));
    const saved = await saveTape(tape({ title: 'Second', blob: sound('second take') }));
    const back = await getTape(saved.id);
    expect(back).toMatchObject({ id: 2, title: 'Second', mime: 'audio/mp4' });
    expect(back.blob.size).toBe(11);
    expect(await back.blob.text()).toBe('second take');
  });
  it('is null for a tape that isn\'t on the shelf', async () => {
    expect(await getTape(7)).toBeNull();
  });
});
