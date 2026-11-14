import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareFile } from '../../data/share.js';

const blob = () => new Blob(['abc'], { type: 'audio/mpeg' });

// A phone that can share files. how: what share() does.
function phone(how = async () => {}, can = true) {
  const shared = [];
  return {
    shared,
    canShare: vi.fn(() => can),
    share: vi.fn(async (data) => {
      shared.push(data);
      return how();
    }),
  };
}

const named = (name) => Object.assign(new Error(name), { name });
// jsdom can't follow a download link: stop it trying.
const stay = (e) => e.preventDefault();

beforeEach(() => {
  document.addEventListener('click', stay);
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  document.removeEventListener('click', stay);
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('shareFile', () => {
  it('hands the file to the share sheet, named and typed', async () => {
    const nav = phone();
    expect(await shareFile(blob(), 'Late Night Drive.mp3', { nav, doc: document })).toBe('shared');
    const { files } = nav.shared[0];
    expect(Object.keys(nav.shared[0])).toEqual(['files']);
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0].name).toBe('Late Night Drive.mp3');
    expect(files[0].type).toBe('audio/mpeg');
    expect(nav.canShare).toHaveBeenCalledWith({ files });
  });

  it('closing the share sheet is cancelled; needing a fresh tap is again', async () => {
    expect(await shareFile(blob(), 'a.mp3', { nav: phone(() => { throw named('AbortError'); }), doc: document })).toBe('cancelled');
    expect(await shareFile(blob(), 'a.mp3', { nav: phone(() => { throw named('NotAllowedError'); }), doc: document })).toBe('again');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('any other refusal downloads it instead', async () => {
    const clicks = [];
    document.addEventListener('click', (e) => clicks.push(e.target), { once: true });
    expect(await shareFile(blob(), 'a.mp3', { nav: phone(() => { throw named('DataError'); }), doc: document })).toBe('saved');
    expect(clicks[0].download).toBe('a.mp3');
  });

  it('a refusal with no name downloads it too', async () => {
    expect(await shareFile(blob(), 'a.mp3', { nav: phone(() => { throw null; }), doc: document })).toBe('saved');
  });

  it('downloads when the browser can\'t share this file, or can\'t share at all', async () => {
    const cant = phone(undefined, false);
    expect(await shareFile(blob(), 'a.wav', { nav: cant, doc: document })).toBe('saved');
    expect(cant.share).not.toHaveBeenCalled();
    expect(await shareFile(blob(), 'a.wav', { nav: {}, doc: document })).toBe('saved');
    expect(await shareFile(blob(), 'a.wav', { nav: { share: () => {} }, doc: document })).toBe('saved');
    expect(await shareFile(blob(), 'a.wav', { nav: { canShare: () => true }, doc: document })).toBe('saved');
    expect(await shareFile(blob(), 'a.wav', { nav: undefined, doc: document })).toBe('saved');
  });

  it('the download is a hidden link to the file, clicked once and removed; the file is let go a minute later', async () => {
    const seen = [];
    document.addEventListener('click', (e) => {
      seen.push({ href: e.target.getAttribute('href'), download: e.target.download, hidden: e.target.hidden, inPage: document.body.contains(e.target) });
    });
    await shareFile(blob(), 'Late Night Drive.wav', { nav: {}, doc: document });
    expect(seen).toEqual([{ href: 'blob:fake', download: 'Late Night Drive.wav', hidden: true, inPage: true }]);
    expect(document.body.querySelector('a')).toBeNull();
    expect(URL.createObjectURL.mock.calls[0][0].name).toBe('Late Night Drive.wav');
    vi.advanceTimersByTime(59_999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('uses the page and browser it runs in by default', async () => {
    expect(await shareFile(blob(), 'a.mp3')).toBe('saved');
  });
});
