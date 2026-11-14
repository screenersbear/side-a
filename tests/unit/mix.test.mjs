import { describe, it, expect } from 'vitest';
import {
  FADE_SECONDS, MIN_PIECE, emptyMix, mixLength, addClip, selectClip, removeSelected, toggleJoin, setLine, clipAt,
  canCut, cutAtLine, mixPlan, clock, timeline, rulerMarks, mixHint,
} from '../../logic/mix.js';

const clip = (title, from, to, extra = {}) => ({ tapeId: title.length, title, kind: 'voice', from, to, ...extra });
const A = clip('A', 0, 10);
const B = clip('BB', 5, 25, { kind: 'radio' });
const C = clip('CCC', 2, 6);
const three = () => [A, B, C].reduce(addClip, emptyMix());

describe('a new mix', () => {
  it('is empty, nothing selected, the line at the start', () => {
    expect(emptyMix()).toEqual({ clips: [], joins: [], sel: -1, line: 0 });
    expect(mixLength(emptyMix())).toBe(0);
  });
  it('fades take a second and a half; a cut leaves half a second', () => {
    expect(FADE_SECONDS).toBe(1.5);
    expect(MIN_PIECE).toBe(0.5);
  });
});

describe('addClip', () => {
  it('adds clips one after another, joined straight on', () => {
    const mix = three();
    expect(mix.clips).toEqual([A, B, C]);
    expect(mix.joins).toEqual(['none', 'none']);
    expect(mixLength(mix)).toBe(34);
  });
  it('the first clip has no join', () => {
    expect(addClip(emptyMix(), A).joins).toEqual([]);
  });
  it('lets go of the selected clip', () => {
    const mix = selectClip(three(), 1);
    expect(addClip(mix, A).sel).toBe(-1);
  });
  it('ignores an empty or missing clip', () => {
    const mix = three();
    expect(addClip(mix, clip('Z', 4, 4))).toBe(mix);
    expect(addClip(mix, clip('Z', 4, 3))).toBe(mix);
    expect(addClip(mix, null)).toBe(mix);
  });
});

describe('selectClip', () => {
  it('selects a clip, and a second tap lets go', () => {
    const mix = selectClip(three(), 2);
    expect(mix.sel).toBe(2);
    expect(selectClip(mix, 2).sel).toBe(-1);
    expect(selectClip(mix, 0).sel).toBe(0);
  });
  it('ignores clips that are not there', () => {
    const mix = three();
    expect(selectClip(mix, 3)).toBe(mix);
    expect(selectClip(mix, -1)).toBe(mix);
  });
});

describe('removeSelected', () => {
  it('removes a middle clip and the join into it', () => {
    const mix = removeSelected(selectClip(toggleJoin(three(), 1), 1));
    expect(mix.clips).toEqual([A, C]);
    expect(mix.joins).toEqual(['fade']);
    expect(mix.sel).toBe(-1);
  });
  it('removes the first clip and the join after it', () => {
    const mix = removeSelected(selectClip(toggleJoin(three(), 1), 0));
    expect(mix.clips).toEqual([B, C]);
    expect(mix.joins).toEqual(['fade']);
  });
  it('removes the last clip and the join into it', () => {
    const mix = removeSelected(selectClip(toggleJoin(three(), 0), 2));
    expect(mix.clips).toEqual([A, B]);
    expect(mix.joins).toEqual(['fade']);
  });
  it('removes the only clip', () => {
    const mix = removeSelected(selectClip(addClip(emptyMix(), A), 0));
    expect(mix).toEqual(emptyMix());
  });
  it('keeps the line inside the shorter mix', () => {
    const mix = removeSelected(selectClip(setLine(three(), 33), 1));
    expect(mix.line).toBe(14);
    expect(removeSelected(selectClip(setLine(three(), 3), 1)).line).toBe(3);
  });
  it('does nothing without a selection', () => {
    const mix = three();
    expect(removeSelected(mix)).toBe(mix);
  });
});

describe('toggleJoin', () => {
  it('switches a join between none and fade', () => {
    const mix = toggleJoin(three(), 1);
    expect(mix.joins).toEqual(['none', 'fade']);
    expect(toggleJoin(mix, 1).joins).toEqual(['none', 'none']);
  });
  it('ignores joins that are not there', () => {
    const mix = three();
    expect(toggleJoin(mix, 2)).toBe(mix);
    expect(toggleJoin(mix, -1)).toBe(mix);
  });
});

describe('setLine', () => {
  it('moves the line, in tenths of a second', () => {
    expect(setLine(three(), 12.345).line).toBe(12.3);
    expect(setLine(three(), 12.36).line).toBe(12.4);
  });
  it('keeps it inside the mix', () => {
    expect(setLine(three(), -5).line).toBe(0);
    expect(setLine(three(), 99).line).toBe(34);
    expect(setLine(emptyMix(), 5).line).toBe(0);
  });
  it('reads nonsense as the start', () => {
    expect(setLine(setLine(three(), 8), 'soon').line).toBe(0);
  });
  it('returns the same mix when the line does not move', () => {
    const mix = setLine(three(), 8);
    expect(setLine(mix, 8.01)).toBe(mix);
  });
});

describe('clipAt', () => {
  it('finds the clip at a time and how far into it', () => {
    const mix = three();
    expect(clipAt(mix, 0)).toEqual({ index: 0, offset: 0 });
    expect(clipAt(mix, 9.5)).toEqual({ index: 0, offset: 9.5 });
    expect(clipAt(mix, 10)).toEqual({ index: 1, offset: 0 });
    expect(clipAt(mix, 31)).toEqual({ index: 2, offset: 1 });
  });
  it('is null at the very end and in an empty mix', () => {
    expect(clipAt(three(), 34)).toBeNull();
    expect(clipAt(three(), -1)).toBeNull();
    expect(clipAt(emptyMix(), 0)).toBeNull();
  });
});

describe('canCut and cutAtLine', () => {
  it('cuts the clip under the line in two, at the line', () => {
    const mix = cutAtLine(setLine(three(), 14));
    expect(mix.clips).toEqual([A, { ...B, to: 9 }, { ...B, from: 9 }, C]);
    expect(mix.joins).toEqual(['none', 'none', 'none']);
    expect(mixLength(mix)).toBe(34);
    expect(mix.sel).toBe(2);
  });
  it('keeps the joins on either side where they were', () => {
    const mix = cutAtLine(setLine(toggleJoin(toggleJoin(three(), 0), 1), 14));
    expect(mix.joins).toEqual(['fade', 'none', 'fade']);
  });
  it('cuts the first clip', () => {
    const mix = cutAtLine(setLine(toggleJoin(three(), 0), 4));
    expect(mix.clips.slice(0, 2)).toEqual([{ ...A, to: 4 }, { ...A, from: 4 }]);
    expect(mix.joins).toEqual(['none', 'fade', 'none']);
    expect(mix.sel).toBe(1);
  });
  it('needs half a second on both sides', () => {
    expect(canCut(setLine(three(), 0.5))).toBe(true);
    expect(canCut(setLine(three(), 0.4))).toBe(false);
    expect(canCut(setLine(three(), 9.5))).toBe(true);
    expect(canCut(setLine(three(), 9.6))).toBe(false);
    expect(canCut(setLine(three(), 10))).toBe(false);
    expect(canCut(setLine(three(), 34))).toBe(false);
    expect(canCut(emptyMix())).toBe(false);
  });
  it('does nothing when it cannot cut', () => {
    const mix = setLine(three(), 10);
    expect(cutAtLine(mix)).toBe(mix);
  });
});

describe('mixPlan', () => {
  it('lists each clip with its start in the mix and its fade in', () => {
    const mix = toggleJoin(three(), 1);
    expect(mixPlan(mix)).toEqual([
      { tapeId: 1, from: 0, to: 10, at: 0, fade: 0 },
      { tapeId: 2, from: 5, to: 25, at: 10, fade: 0 },
      { tapeId: 3, from: 2, to: 6, at: 30, fade: 1.5 },
    ]);
  });
  it('a fade is never longer than half the clip', () => {
    const mix = toggleJoin([A, clip('S', 0, 2)].reduce(addClip, emptyMix()), 0);
    expect(mixPlan(mix)[1].fade).toBe(1);
  });
  it('is empty for an empty mix', () => {
    expect(mixPlan(emptyMix())).toEqual([]);
  });
});

describe('clock', () => {
  it('writes m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(5)).toBe('0:05');
    expect(clock(65.4)).toBe('1:05');
    expect(clock(59.6)).toBe('1:00');
    expect(clock(600)).toBe('10:00');
  });
  it('reads nonsense and negatives as 0:00', () => {
    expect(clock(-3)).toBe('0:00');
    expect(clock('x')).toBe('0:00');
    expect(clock(undefined)).toBe('0:00');
  });
});

describe('timeline', () => {
  it('shows clips with a join between each two', () => {
    const items = timeline(selectClip(toggleJoin(three(), 0), 2));
    expect(items.map((i) => i.type)).toEqual(['clip', 'join', 'clip', 'join', 'clip']);
    expect(items[0]).toEqual({ type: 'clip', index: 0, title: 'A', kind: 'voice', src: 'Voice', len: '0:10', seconds: 10, fade: false, selected: false, aria: 'A, 0:10' });
    expect(items[1]).toEqual({ type: 'join', index: 0, fade: true, text: 'Fade in', aria: 'Into BB: fade in. Tap to change.' });
    expect(items[2]).toMatchObject({ index: 1, kind: 'radio', src: 'Radio', len: '0:20', seconds: 20, fade: true, selected: false });
    expect(items[3]).toEqual({ type: 'join', index: 1, fade: false, text: 'None', aria: 'Into CCC: none. Tap to change.' });
    expect(items[4]).toMatchObject({ index: 2, fade: false, selected: true, aria: 'CCC, 0:04, selected' });
  });
  it('names where each clip came from', () => {
    const mix = [clip('M', 0, 5, { kind: 'mix' }), clip('Q', 0, 5, { kind: 'odd' })].reduce(addClip, emptyMix());
    expect(timeline(mix).filter((i) => i.type === 'clip').map((i) => i.src)).toEqual(['Mix', 'Voice']);
  });
  it('is empty for an empty mix', () => {
    expect(timeline(emptyMix())).toEqual([]);
  });
});

describe('rulerMarks', () => {
  it('gives seven evenly spaced times', () => {
    expect(rulerMarks(60)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(rulerMarks(0)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('mixHint', () => {
  it('says what a tap does now', () => {
    expect(mixHint(emptyMix())).toBe('Add a clip from any tape to start.');
    expect(mixHint(selectClip(three(), 0))).toBe('Remove the selected piece, or tap it again to let go.');
    expect(mixHint(setLine(three(), 4))).toBe('Cut splits the clip at the red line.');
    expect(mixHint(three())).toBe('Tap a clip to select it. Tap a gap to switch None and Fade in.');
  });
});
