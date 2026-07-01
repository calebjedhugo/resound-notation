/**
 * In-measure accidental memory (engraving correctness).
 *
 * An accidental is drawn only when a note's alteration differs from what is
 * currently in effect for that letter+octave — the key signature, updated by
 * any earlier accidental in the same measure. Repeats within a measure are
 * suppressed; the memory resets at each barline. Unmetered voices reset per
 * note. Note accidentals are counted excluding the key-signature glyphs.
 */

import { NotationRenderer } from './NotationRenderer.js';

function noteAccidentalCount(song) {
  const container = document.createElement('div');
  const r = new NotationRenderer({ container, scale: 2.5 });
  const svg = r.render(song);
  return [...svg.querySelectorAll('.accidental')].filter((a) => !a.closest('.key-signature')).length;
}

const q = (pitch) => ({ pitch, length: '1/4' });

describe('in-measure accidental memory', () => {
  it('suppresses a repeated accidental within the same measure', () => {
    const count = noteAccidentalCount({
      keySignature: 'C',
      timeSignature: [4, 4],
      voices: [{ id: 'v0', clef: 'treble', notes: [q('C#4'), q('C#4')] }],
    });
    expect(count).toBe(1);
  });

  it('re-shows the accidental after a barline', () => {
    const count = noteAccidentalCount({
      keySignature: 'C',
      timeSignature: [4, 4],
      voices: [
        { id: 'v0', clef: 'treble', notes: [q('C#4'), q('C#4'), q('D4'), q('E4'), q('C#4')] },
      ],
    });
    expect(count).toBe(2);
  });

  it('treats different octaves independently', () => {
    const count = noteAccidentalCount({
      keySignature: 'C',
      timeSignature: [4, 4],
      voices: [{ id: 'v0', clef: 'treble', notes: [q('C#4'), q('C#5')] }],
    });
    expect(count).toBe(2);
  });

  it('draws a natural to cancel an earlier accidental in the measure', () => {
    const count = noteAccidentalCount({
      keySignature: 'C',
      timeSignature: [4, 4],
      voices: [{ id: 'v0', clef: 'treble', notes: [q('C#4'), q('C4')] }],
    });
    expect(count).toBe(2); // sharp, then natural
  });

  it('hides accidentals implied by the key signature', () => {
    const count = noteAccidentalCount({
      keySignature: 'G', // F#
      timeSignature: [4, 4],
      voices: [{ id: 'v0', clef: 'treble', notes: [q('F#4'), q('F4')] }],
    });
    expect(count).toBe(1); // F# implied (hidden), F natural shown
  });

  it('resets accidentals per note when unmetered', () => {
    const count = noteAccidentalCount({
      keySignature: 'C',
      timeSignature: null,
      voices: [{ id: 'v0', clef: 'treble', notes: [q('C#4'), q('C#4')] }],
    });
    expect(count).toBe(2);
  });

  it('suppresses a repeat within a chord-bearing measure', () => {
    const count = noteAccidentalCount({
      keySignature: 'C',
      timeSignature: [4, 4],
      voices: [
        { id: 'v0', clef: 'treble', notes: [[q('C#4'), q('E4')], q('C#4')] },
      ],
    });
    expect(count).toBe(1); // chord's C#4 shows; the following C#4 is suppressed
  });
});
