/**
 * @jest-environment node
 *
 * Ottava segmentation tests — one test per worked example in
 * OTTAVA-DESIGN.md §4, plus 8vb mirrors, edge cases, and multi-voice.
 */

import { segmentOttava, reconcileOttava, analyzeOttava } from './segmentOttava.js';

const MIDI = {
  C1: 24, D1: 26, E1: 28, F1: 29, G1: 31, A1: 33, B1: 35,
  C2: 36, D2: 38, E2: 40, F2: 41, G2: 43,
  C3: 48, D3: 50, E3: 52,
  B2: 47, A2: 45,
  C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83,
  C6: 84, D6: 86, E6: 88, F6: 89, G6: 91, A6: 93, B6: 95,
  C7: 96, D7: 98,
};

function notes(midis) {
  // Helper: turn array of MIDI ints (with `'|'` for barline, `'R'` for rest)
  // into an event array.
  let idx = 0;
  return midis.map((m) => {
    if (m === '|') return { kind: 'barline', index: idx++ };
    if (m === 'R') return { kind: 'rest', index: idx++ };
    return { kind: 'note', midi: m, index: idx++ };
  });
}

function voice(events, opts = {}) {
  return { voiceId: opts.voiceId ?? 0, clef: opts.clef ?? 'treble', events };
}

describe('segmentOttava — Pass A + B (single voice)', () => {
  test('Fragment 1: clean high run yields a single segment', () => {
    const ev = notes([MIDI.G6, MIDI.A6, MIDI.B6, MIDI.C7, MIDI.D7, '|', MIDI.C7, MIDI.B6, MIDI.A6, MIDI.G6]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe('8va');
    expect(segs[0].startIndex).toBe(0);
    // 5 notes + barline + 4 notes → last note index is 9
    expect(segs[0].endIndex).toBe(9);
  });

  test('Fragment 2: rule-of-three dip (stay) — 2-note dip does not exit', () => {
    const ev = notes([MIDI.G6, MIDI.A6, MIDI.F6, MIDI.E6, MIDI.G6, MIDI.A6, MIDI.B6]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(1);
    expect(segs[0].startIndex).toBe(0);
    expect(segs[0].endIndex).toBe(6);
  });

  test('Fragment 3: rule-of-three exit produces two segments (CP-3 precedence)', () => {
    const ev = notes([MIDI.G6, MIDI.A6, MIDI.B6, MIDI.F6, MIDI.E6, MIDI.D6, MIDI.G6, MIDI.A6]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ startIndex: 0, endIndex: 2, kind: '8va' });
    expect(segs[1]).toMatchObject({ startIndex: 6, endIndex: 7, kind: '8va' });
  });

  test('Fragment 4: isolated high note is suppressed', () => {
    const ev = notes([MIDI.C5, MIDI.D5, MIDI.G6, MIDI.D5, MIDI.C5]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toEqual([]);
  });

  test('Fragment 5: context-pull merges across in-range gap (CP-1(a))', () => {
    // C6 G6 B5 C6 G6 → MIDI 84 91 83 84 91
    // Raw: open at index 1 (G6), dip at 2 & 3 (2 in-range notes, no close),
    // reset at 4. Segment [1..4]. CP-2 absorbs leading C6 (84 ≥ 79).
    const ev = notes([MIDI.C6, MIDI.G6, MIDI.B5, MIDI.C6, MIDI.G6]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ startIndex: 0, endIndex: 4, kind: '8va' });
  });

  test('Fragment 6: rests are spanned silently inside a segment', () => {
    const ev = notes([MIDI.G6, MIDI.A6, 'R', 'R', MIDI.B6, MIDI.C7]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(1);
    expect(segs[0].startIndex).toBe(0);
    expect(segs[0].endIndex).toBe(5);
  });

  test('Fragment 7: 8vb mirror — clean low run yields a single segment', () => {
    const ev = notes([MIDI.D3, MIDI.C3, MIDI.B2, MIDI.A2, '|', MIDI.B2, MIDI.C3, MIDI.D3, MIDI.E3]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe('8vb');
    expect(segs[0].startIndex).toBe(0);
    // E3 (index 8) is in-range but the exit-dip only counts E3 once, then voice ends
    expect(segs[0].endIndex).toBe(8);
  });

  test('Fragment 8 (alt): segment opens cleanly at a barline match', () => {
    // E6 F6 | G6 A6 B6 C7 — segment opens at index 2 (G6)
    const ev = notes([MIDI.E6, MIDI.F6, '|', MIDI.G6, MIDI.A6, MIDI.B6, MIDI.C7]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toHaveLength(1);
    expect(segs[0].startIndex).toBe(3);
    expect(segs[0].endIndex).toBe(6);
  });

  test('OQ-7: empty input returns []', () => {
    expect(segmentOttava(voice([]))).toEqual([]);
  });

  test('OQ-8: bass clef suppresses 8va even for very high pitches', () => {
    // High pitches on a bass voice must NOT trigger 8va (Gould §9.4
    // anti-pattern). Bass voices skip the 8va direction entirely.
    const ev = notes([MIDI.G6, MIDI.A6, MIDI.B6, MIDI.C7]);
    expect(segmentOttava(voice(ev, { clef: 'bass' }))).toEqual([]);
  });

  test('OQ-8: alto clef short-circuits to []', () => {
    const ev = notes([MIDI.G6, MIDI.A6, MIDI.B6, MIDI.C7]);
    expect(segmentOttava(voice(ev, { clef: 'alto' }))).toEqual([]);
  });

  test('bass-clef 8vb: clean low run (F1 and lower) yields a single 8vb segment', () => {
    // F1 (29) is the trigger; everything here is at or below it.
    const ev = notes([MIDI.F1, MIDI.E1, MIDI.D1, MIDI.C1]);
    const segs = segmentOttava(voice(ev, { clef: 'bass' }));
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: '8vb', startIndex: 0, endIndex: 3 });
  });

  test('bass-clef 8vb: G1 (in-range edge) does NOT trigger an ottava', () => {
    // G1 = MIDI 31 is the last clean in-range pitch above the trigger.
    // A ramp that bottoms at G1 must produce zero segments.
    const ev = notes([MIDI.G2, MIDI.E2, MIDI.C2, MIDI.A1, MIDI.G1]);
    expect(segmentOttava(voice(ev, { clef: 'bass' }))).toEqual([]);
  });

  test('bass-clef 8vb: treble thresholds do NOT apply to bass voice', () => {
    // E3 / D3 are above bass's in-range zone (≥ G1=31), so on a *bass*
    // voice they must not trigger 8vb the way they would on treble.
    const ev = notes([MIDI.E3, MIDI.D3, MIDI.C3, MIDI.B2, MIDI.A2]);
    expect(segmentOttava(voice(ev, { clef: 'bass' }))).toEqual([]);
  });

  test('bass-clef 8vb: same notes on treble vs bass yield different segments', () => {
    const ev = notes([MIDI.D3, MIDI.C3, MIDI.B2, MIDI.A2]);
    const onTreble = segmentOttava(voice(ev, { clef: 'treble' }));
    const onBass = segmentOttava(voice(ev, { clef: 'bass' }));
    expect(onTreble).toHaveLength(1);
    expect(onTreble[0].kind).toBe('8vb');
    expect(onBass).toEqual([]);
  });

  test('bass-clef 8vb: rule-of-three exit on bass thresholds', () => {
    // F1 F1 F1 G1 A1 B1 F1 E1 — three in-range notes (G1 A1 B1) should
    // close the first segment at index 2 (last F1 before the dip).
    const ev = notes([MIDI.F1, MIDI.F1, MIDI.F1, MIDI.G1, MIDI.A1, MIDI.B1, MIDI.F1, MIDI.E1]);
    const segs = segmentOttava(voice(ev, { clef: 'bass' }));
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ startIndex: 0, endIndex: 2, kind: '8vb' });
    expect(segs[1].kind).toBe('8vb');
    expect(segs[1].startIndex).toBe(6);
  });

  test('8vb mirror of Fragment 4: isolated low note is suppressed', () => {
    const ev = notes([MIDI.C5, MIDI.A5, MIDI.C3, MIDI.A5, MIDI.C5]);
    const segs = segmentOttava(voice(ev));
    expect(segs).toEqual([]);
  });
});

describe('reconcileOttava — Pass C (multi-voice)', () => {
  test('agreeing voices keep their segments and merge voiceIds', () => {
    const v0 = [{ kind: '8va', startIndex: 0, endIndex: 4, voiceIds: [0], closureReason: 'voice_ended' }];
    const v1 = [{ kind: '8va', startIndex: 0, endIndex: 4, voiceIds: [1], closureReason: 'voice_ended' }];
    const out = reconcileOttava([v0, v1]);
    expect(out[0]).toHaveLength(1);
    expect(out[1]).toHaveLength(1);
    expect(out[0][0].voiceIds.sort()).toEqual([0, 1]);
  });

  test('conflicting voices drop the segment and emit a warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const v0 = [{ kind: '8va', startIndex: 0, endIndex: 4, voiceIds: [0], closureReason: 'voice_ended' }];
    const v1 = [{ kind: '8vb', startIndex: 0, endIndex: 4, voiceIds: [1], closureReason: 'voice_ended' }];
    const out = reconcileOttava([v0, v1]);
    expect(out[0]).toHaveLength(0);
    expect(out[1]).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/disagree on 8va/);
    warnSpy.mockRestore();
  });
});

describe('analyzeOttava — top-level entry', () => {
  test('handles empty voice list', () => {
    expect(analyzeOttava([])).toEqual([]);
  });

  test('routes per-voice and returns a parallel array', () => {
    const ev = notes([MIDI.G6, MIDI.A6, MIDI.B6, MIDI.C7]);
    const out = analyzeOttava([voice(ev, { voiceId: 0 })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(1);
    expect(out[0][0].kind).toBe('8va');
  });
});
