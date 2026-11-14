import { describe, it, expect } from 'vitest';
import { titleSource, icyTitle, icecastTitle, kexpTitle, KEXP_FEED, TITLE_SOURCES } from '../../logic/now-playing.js';

const bytes = (s) => new TextEncoder().encode(s);

describe('titleSource', () => {
  const url = 'https://ice8.example.net/WXYZ';
  it('the stream itself for icy', () => {
    expect(titleSource({ url, titles: 'icy' })).toEqual({ kind: 'icy', url });
  });
  it("the server's now-playing file for json", () => {
    expect(titleSource({ url: 'https://ice8.example.net:8443/WXYZ', titles: 'json' })).toEqual({ kind: 'json', url: 'https://ice8.example.net:8443/status-json.xsl' });
  });
  it("KEXP's feed for kexp", () => {
    expect(titleSource({ url, titles: 'kexp' })).toEqual({ kind: 'kexp', url: KEXP_FEED });
    expect(KEXP_FEED).toBe('https://api.kexp.org/v2/plays/?limit=1');
  });
  it('none for stations without a source', () => {
    expect(TITLE_SOURCES).toEqual(['icy', 'json', 'kexp']);
    expect(titleSource({ url })).toBeNull();
    expect(titleSource({ url, titles: 'rss' })).toBeNull();
    expect(titleSource(null)).toBeNull();
  });
});

describe('icyTitle', () => {
  it('reads the StreamTitle out of the stream', () => {
    expect(icyTitle(bytes("\u0000\u0001abcStreamTitle='Tesla - Little Suzi';StreamUrl='';"))).toBe('Tesla - Little Suzi');
  });
  it('reads UTF-8 titles', () => {
    expect(icyTitle(bytes("StreamTitle='Björk - Jóga';"))).toBe('Björk - Jóga');
  });
  it('keeps an empty title as empty', () => {
    expect(icyTitle(bytes("StreamTitle='';"))).toBe('');
  });
  it('is null until a whole title has arrived', () => {
    expect(icyTitle(bytes('just sound'))).toBeNull();
    expect(icyTitle(bytes("StreamTitle='Tesla - Lit"))).toBeNull();
  });
});

describe('icecastTitle', () => {
  const stream = 'https://ice8.example.net/WXYZ';
  const source = (listenurl, extra) => ({ listenurl, ...extra });
  it("finds this stream's title among the server's streams", () => {
    const data = { icestats: { source: [source('http://ice8.example.net:80/OTHER', { title: 'No' }), source('http://ice8.example.net:80/WXYZ', { title: 'Buffalo Traffic Jam - Luckiest Man Alive' })] } };
    expect(icecastTitle(data, stream)).toBe('Buffalo Traffic Jam - Luckiest Man Alive');
  });
  it('reads a server with a single stream', () => {
    expect(icecastTitle({ icestats: { source: source('/WXYZ', { title: 'A - B' }) } }, stream)).toBe('A - B');
  });
  it('joins a separate artist and title', () => {
    expect(icecastTitle({ icestats: { source: source('/WXYZ', { artist: 'A', title: 'B' }) } }, stream)).toBe('A - B');
  });
  it('is null when the stream or its title is missing', () => {
    expect(icecastTitle({ icestats: { source: source('/OTHER', { title: 'A - B' }) } }, stream)).toBeNull();
    expect(icecastTitle({ icestats: { source: [source('/WXYZ', {}), null, {}] } }, stream)).toBeNull();
    expect(icecastTitle({ icestats: {} }, stream)).toBeNull();
    expect(icecastTitle(null, stream)).toBeNull();
  });
});

describe('kexpTitle', () => {
  it('reads the song playing', () => {
    expect(kexpTitle({ results: [{ play_type: 'trackplay', artist: 'Kurupt', song: 'We Can Freak It' }] })).toBe('Kurupt - We Can Freak It');
    expect(kexpTitle({ results: [{ play_type: 'trackplay', song: 'Untitled' }] })).toBe('Untitled');
  });
  it('is null during a break or without a song', () => {
    expect(kexpTitle({ results: [{ play_type: 'airbreak' }] })).toBeNull();
    expect(kexpTitle({ results: [{ play_type: 'trackplay', artist: 'X' }] })).toBeNull();
    expect(kexpTitle({ results: [] })).toBeNull();
    expect(kexpTitle({})).toBeNull();
    expect(kexpTitle(null)).toBeNull();
  });
});
