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
