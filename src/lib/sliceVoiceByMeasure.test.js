/** @jest-environment jsdom */
import { sliceVoiceByMeasure, MARKER_KEYS, isMarker } from './sliceVoiceByMeasure.js';

describe('sliceVoiceByMeasure', () => {
  test('returns an empty array for an empty voice', () => {
    expect(sliceVoiceByMeasure([], 4, 0, 5)).toEqual([]);
  });

  test('returns all notes for a single-measure voice when the range covers it', () => {
    const voice = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
    ];
    expect(sliceVoiceByMeasure(voice, 4, 0, 0)).toEqual(voice);
  });

  test('slices exactly at a measure boundary', () => {
    // 8 quarters in 4/4 = 2 measures. Slice [1,1] returns measure 2 only.
    const voice = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      // Measure 2
      { pitch: 'G4', length: '1/4' },
      { pitch: 'A4', length: '1/4' },
      { pitch: 'B4', length: '1/4' },
      { pitch: 'C5', length: '1/4' },
    ];
    const m0 = sliceVoiceByMeasure(voice, 4, 0, 0);
    const m1 = sliceVoiceByMeasure(voice, 4, 1, 1);
    expect(m0).toHaveLength(4);
    expect(m1).toHaveLength(4);
    expect(m0[0].pitch).toBe('C4');
    expect(m1[0].pitch).toBe('G4');
    expect(m1[3].pitch).toBe('C5');
  });

  test('slices across multiple measures', () => {
    const voice = [
      { pitch: 'C4', length: '1/4' }, { pitch: 'C4', length: '1/4' },
      { pitch: 'C4', length: '1/4' }, { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' }, { pitch: 'D4', length: '1/4' },
      { pitch: 'D4', length: '1/4' }, { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4' }, { pitch: 'E4', length: '1/4' },
      { pitch: 'E4', length: '1/4' }, { pitch: 'E4', length: '1/4' },
    ];
    // [0..1] covers measures 0 and 1.
    const slice = sliceVoiceByMeasure(voice, 4, 0, 1);
    expect(slice).toHaveLength(8);
    expect(slice[0].pitch).toBe('C4');
    expect(slice[7].pitch).toBe('D4');
  });

  test('endMeasure beyond voice length is harmless (no overflow)', () => {
    const voice = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
    ];
    const slice = sliceVoiceByMeasure(voice, 4, 0, 99);
    expect(slice).toHaveLength(4);
  });

  test('attaches a marker to the NEXT sounding note\'s measure', () => {
    // Marker placed in measure 0 attaches to the next sounding note.
    // Place a dynamic before the first sounding note of measure 1.
    const dynamic = { dynamic: 'mf' };
    const voice = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      dynamic, // sits between measure boundary and the next note
      { pitch: 'G4', length: '1/4' },
      { pitch: 'A4', length: '1/4' },
      { pitch: 'B4', length: '1/4' },
      { pitch: 'C5', length: '1/4' },
    ];
    const m0 = sliceVoiceByMeasure(voice, 4, 0, 0);
    const m1 = sliceVoiceByMeasure(voice, 4, 1, 1);
    // Dynamic should attach to measure 1 (the next sounding note's
    // measure), NOT measure 0.
    expect(m0).not.toContain(dynamic);
    expect(m1).toContain(dynamic);
    // The note at the start of m1 must be present too.
    expect(m1[0]).toBe(dynamic); // marker comes first
    expect(m1[1].pitch).toBe('G4');
  });

  test('handles a tuplet element inside the slice range', () => {
    // A triplet of eighths (3 in the space of 2) = one beat total.
    const triplet = {
      tuplet: [3, 2],
      notes: [
        { pitch: 'C4', length: '1/8' },
        { pitch: 'D4', length: '1/8' },
        { pitch: 'E4', length: '1/8' },
      ],
    };
    const voice = [
      triplet,                                  // 1 beat
      { pitch: 'F4', length: '1/4' },           // 1 beat
      { pitch: 'G4', length: '1/4' },           // 1 beat
      { pitch: 'A4', length: '1/4' },           // 1 beat → end of measure 0
      { pitch: 'B4', length: '1/4' },           // measure 1
    ];
    const m0 = sliceVoiceByMeasure(voice, 4, 0, 0);
    const m1 = sliceVoiceByMeasure(voice, 4, 1, 1);
    expect(m0).toContain(triplet);
    expect(m0).not.toContain(voice[4]);
    expect(m1).toContain(voice[4]);
  });

  test('voice shorter than endMeasure: returns what exists, no error', () => {
    const voice = [{ pitch: 'C4', length: '1/4' }];
    const out = sliceVoiceByMeasure(voice, 4, 0, 5);
    expect(out).toEqual(voice);
  });

  test('trailing marker (no following sounding note) attaches to the last live measure', () => {
    const trailing = { dynamic: 'p' };
    const voice = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      trailing,
    ];
    const slice = sliceVoiceByMeasure(voice, 4, 0, 0);
    expect(slice).toContain(trailing);
  });
});

// MARKER_KEYS is the single source of truth for "which element keys are
// non-sounding inline markers". It used to be copy-pasted into three modules
// and had already drifted (the renderer's copy grew a `tuplet` case the lib
// copies never got). These pin the contract the other modules rely on.
describe('MARKER_KEYS / isMarker', () => {
  test('lists exactly the non-sounding inline marker keys, in dispatch order', () => {
    expect([...MARKER_KEYS]).toEqual([
      'barline',
      'ending',
      'navigation',
      'tempo',
      'tempoChange',
      'expression',
      'rehearsal',
      'dynamic',
      'hairpin',
    ]);
  });

  test('is frozen so a consumer cannot mutate the shared list', () => {
    expect(Object.isFrozen(MARKER_KEYS)).toBe(true);
  });

  test.each(MARKER_KEYS)('treats an element carrying `%s` as a marker', (key) => {
    expect(isMarker({ [key]: 'x' })).toBe(true);
  });

  test('does NOT treat a tuplet as a marker — it occupies time', () => {
    // The renderer's getMarkerType returns 'tuplet' because a tuplet needs
    // its own render branch, but every beat-walker must count its duration.
    expect(isMarker({ tuplet: [3, 2], notes: [] })).toBe(false);
  });

  test('does not treat notes, rests, chords, null or undefined as markers', () => {
    expect(isMarker({ pitch: 'C4', length: '1/4' })).toBe(false);
    expect(isMarker({ length: '1/4' })).toBe(false);
    expect(isMarker([{ pitch: 'C4', length: '1/4' }])).toBe(false);
    expect(isMarker(null)).toBe(false);
    expect(isMarker(undefined)).toBe(false);
  });

  test('a marker key set to undefined does not count (parity with `!== undefined`)', () => {
    expect(isMarker({ barline: undefined })).toBe(false);
  });
});
