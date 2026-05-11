/** @jest-environment jsdom */
import {
  measureIntrinsicWidths,
  MIN_NOTE_GAP,
  BARLINE_GAP,
  __TESTING__,
} from './measureIntrinsicWidths.js';

const {
  ACCIDENTAL_WIDTH,
  DOT_WIDTH,
  noteheadWidthFor,
  springNatLength,
} = __TESTING__;

describe('measureIntrinsicWidths', () => {
  test('single quarter-note measure', () => {
    const song = {
      timeSignature: [1, 4],
      notes: [{ pitch: 'C4', length: '1/4' }],
    };
    const out = measureIntrinsicWidths(song);
    expect(out.perVoice).toHaveLength(1);
    expect(out.perVoice[0].measures).toHaveLength(1);
    const m = out.perVoice[0].measures[0];
    expect(m.measureIndex).toBe(0);
    expect(m.contentNoteCount).toBe(1);
    expect(m.intrinsicWidth).toBe(noteheadWidthFor('1/4') + MIN_NOTE_GAP + BARLINE_GAP);
    expect(out.combined[0].intrinsicWidth).toBe(m.intrinsicWidth);
  });

  test('measure with 4 quarter notes', () => {
    const song = {
      timeSignature: [4, 4],
      notes: [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'F4', length: '1/4' },
      ],
    };
    const out = measureIntrinsicWidths(song);
    const m = out.perVoice[0].measures[0];
    expect(m.contentNoteCount).toBe(4);
    expect(m.intrinsicWidth).toBe(
      4 * (noteheadWidthFor('1/4') + MIN_NOTE_GAP) + BARLINE_GAP,
    );
  });

  test('accidentals add accidental_width per event', () => {
    const plain = measureIntrinsicWidths({
      timeSignature: [2, 4],
      notes: [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
      ],
    });
    const withAcc = measureIntrinsicWidths({
      timeSignature: [2, 4],
      notes: [
        { pitch: 'C#4', length: '1/4' },
        { pitch: 'Db4', length: '1/4' },
      ],
    });
    const dPlain = plain.perVoice[0].measures[0].intrinsicWidth;
    const dAcc = withAcc.perVoice[0].measures[0].intrinsicWidth;
    expect(dAcc - dPlain).toBe(2 * ACCIDENTAL_WIDTH);
  });

  test('dotted notes add dot_width per dotted event', () => {
    const plain = measureIntrinsicWidths({
      timeSignature: [3, 4],
      notes: [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ],
    });
    const dotted = measureIntrinsicWidths({
      timeSignature: [3, 4],
      notes: [{ pitch: 'C4', length: '1/2', dotted: true }],
    });
    const dPlain = plain.perVoice[0].measures[0].intrinsicWidth;
    const dDotted = dotted.perVoice[0].measures[0].intrinsicWidth;
    // Spring model: dotted half = fixedWidth (notehead + dot) + dotted gap
    // (= springNatLength(2) * 1.5) + trailing barline gap.
    const expectedDotted =
      noteheadWidthFor('1/2') + DOT_WIDTH + springNatLength(2) * 1.5 + BARLINE_GAP;
    expect(dDotted).toBeCloseTo(expectedDotted);
    // Three quarters (each ~30) substantially exceed one dotted half (~73 →
    // 18 + 45 + 10). The quarter-note pile-up still wins on raw width.
    expect(dPlain).toBeGreaterThan(dDotted);
  });

  test('combined takes the per-measure max when different voices win different measures', () => {
    // Two-measure piece: voice 0 wins measure 0 (many 8ths), voice 1
    // wins measure 1 (many 16ths). combined[i] must equal the max of
    // per-voice widths at each measure i — not always voice 0.
    const song = {
      timeSignature: [4, 4],
      voices: [
        {
          id: 'a',
          notes: [
            // Measure 0: dense (8 eighths)
            { pitch: 'C5', length: '1/8' }, { pitch: 'D5', length: '1/8' },
            { pitch: 'E5', length: '1/8' }, { pitch: 'F5', length: '1/8' },
            { pitch: 'G5', length: '1/8' }, { pitch: 'A5', length: '1/8' },
            { pitch: 'B5', length: '1/8' }, { pitch: 'C6', length: '1/8' },
            // Measure 1: sparse (1 whole)
            { pitch: 'C5', length: '1/1' },
          ],
        },
        {
          id: 'b',
          notes: [
            // Measure 0: sparse
            { pitch: 'C3', length: '1/1' },
            // Measure 1: very dense (16 sixteenths)
            ...Array.from({ length: 16 }, () => ({ pitch: 'C3', length: '1/16' })),
          ],
        },
      ],
    };
    const out = measureIntrinsicWidths(song);
    const aWidths = out.perVoice[0].measures.map((m) => m.intrinsicWidth);
    const bWidths = out.perVoice[1].measures.map((m) => m.intrinsicWidth);
    expect(aWidths.length).toBeGreaterThanOrEqual(2);
    expect(bWidths.length).toBeGreaterThanOrEqual(2);
    // Voice a wins measure 0; voice b wins measure 1.
    expect(aWidths[0]).toBeGreaterThan(bWidths[0]);
    expect(bWidths[1]).toBeGreaterThan(aWidths[1]);
    // combined[i] = max(perVoice[*][i]) for every i.
    for (let i = 0; i < out.combined.length; i += 1) {
      expect(out.combined[i].intrinsicWidth).toBe(Math.max(aWidths[i], bWidths[i]));
    }
  });

  test('rests contribute to intrinsic width like notes of the same duration', () => {
    const allNotes = measureIntrinsicWidths({
      timeSignature: [4, 4],
      notes: [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'C4', length: '1/4' },
        { pitch: 'C4', length: '1/4' },
        { pitch: 'C4', length: '1/4' },
      ],
    });
    const withRests = measureIntrinsicWidths({
      timeSignature: [4, 4],
      notes: [
        { pitch: 'C4', length: '1/4' },
        { rest: true, length: '1/4' },
        { pitch: 'C4', length: '1/4' },
        { rest: true, length: '1/4' },
      ],
    });
    const wAll = allNotes.combined[0].intrinsicWidth;
    const wWith = withRests.combined[0].intrinsicWidth;
    // Rests participate at all — width must be positive and on the
    // same order of magnitude. (Catches a bug where rests get 0 width.)
    expect(wWith).toBeGreaterThan(wAll * 0.5);
  });

  test('combined takes the max across voices', () => {
    const song = {
      timeSignature: [4, 4],
      voices: [
        {
          id: 'top',
          notes: [
            { pitch: 'C5', length: '1/8' },
            { pitch: 'D5', length: '1/8' },
            { pitch: 'E5', length: '1/8' },
            { pitch: 'F5', length: '1/8' },
            { pitch: 'G5', length: '1/8' },
            { pitch: 'A5', length: '1/8' },
            { pitch: 'B5', length: '1/8' },
            { pitch: 'C6', length: '1/8' },
          ],
        },
        {
          id: 'bot',
          notes: [{ pitch: 'C3', length: '1/1' }],
        },
      ],
    };
    const out = measureIntrinsicWidths(song);
    const top = out.perVoice[0].measures[0].intrinsicWidth;
    const bot = out.perVoice[1].measures[0].intrinsicWidth;
    expect(top).toBeGreaterThan(bot);
    expect(out.combined[0].intrinsicWidth).toBe(top);
  });

  test('chord width is max of per-note notehead+accidental contributions', () => {
    // Chord with one accidental note and one non-accidental note.
    const song = {
      timeSignature: [1, 4],
      notes: [[
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E#4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]],
    };
    const out = measureIntrinsicWidths(song);
    const m = out.perVoice[0].measures[0];
    // Max per-note contribution = notehead + accidental for the sharpened one.
    const expected = noteheadWidthFor('1/4') + ACCIDENTAL_WIDTH + MIN_NOTE_GAP + BARLINE_GAP;
    expect(m.intrinsicWidth).toBe(expected);
    // Counted as a single sounding event, not three.
    expect(m.contentNoteCount).toBe(1);
  });

  test('multi-measure splitting via time signature', () => {
    const song = {
      timeSignature: [2, 4],
      notes: [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'F4', length: '1/4' },
      ],
    };
    const out = measureIntrinsicWidths(song);
    expect(out.perVoice[0].measures).toHaveLength(2);
    expect(out.combined).toHaveLength(2);
    expect(out.combined[0].measureIndex).toBe(0);
    expect(out.combined[1].measureIndex).toBe(1);
  });
});
