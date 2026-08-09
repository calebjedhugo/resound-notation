/** @jest-environment jsdom */

/**
 * Two-voices-per-staff (close score) — SPEC-multi-voice-staff.md.
 *
 * A Level-3 voice may declare `staff`; voices sharing a staff value render
 * on ONE staff with forced stem directions (first voice up, second down),
 * shared staff furniture, collision offsets, rest dedupe/shift, and merged
 * per-staff accidental memory.
 */

import { createNotationContext } from './__tests__/helpers/testUtils.js';

const q = (pitch) => ({ pitch, length: '1/4' });
const r4 = () => ({ length: '1/4' });

/** Parse `translate(x, y)` from a transform attribute. */
function parseTranslate(el) {
  const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(
    el.getAttribute('transform') || ''
  );
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

function sharedStaffSong({ sop, alto, key = 'C', time = [4, 4] } = {}) {
  return {
    timeSignature: time,
    keySignature: key,
    voices: [
      { id: 's', staff: 'upper', clef: 'treble', notes: sop },
      { id: 'a', staff: 'upper', clef: 'treble', notes: alto },
    ],
  };
}

describe('NotationRenderer — two voices per staff (close score)', () => {
  let ctx;

  beforeEach(() => {
    ctx = createNotationContext();
  });

  afterEach(() => {
    ctx.destroy();
  });

  describe('shared staff rendering', () => {
    it('renders two voices with the same staff key on ONE staff (staff-line count halves)', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), q('C5'), q('C5'), q('C5')],
          alto: [q('F4'), q('F4'), q('F4'), q('F4')],
        })
      );
      expect(ctx.container.querySelectorAll('.staff-lines')).toHaveLength(1);
      expect(ctx.container.querySelectorAll('.clef')).toHaveLength(1);
      expect(ctx.container.querySelectorAll('.time-signature')).toHaveLength(1);
    });

    it('backward compat: without staff keys the same voices get one staff each', () => {
      ctx.render({
        timeSignature: [4, 4],
        voices: [
          { id: 's', clef: 'treble', notes: [q('C5'), q('C5'), q('C5'), q('C5')] },
          { id: 'a', clef: 'treble', notes: [q('F4'), q('F4'), q('F4'), q('F4')] },
        ],
      });
      expect(ctx.container.querySelectorAll('.staff-lines')).toHaveLength(2);
      expect(ctx.container.querySelectorAll('.clef')).toHaveLength(2);
    });

    it('draws interior barlines once per shared staff, not once per voice', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), q('C5'), q('C5'), q('C5'), q('D5'), q('D5'), q('D5'), q('D5')],
          alto: [q('F4'), q('F4'), q('F4'), q('F4'), q('G4'), q('G4'), q('G4'), q('G4')],
        })
      );
      // Two measures on one system: one interior auto-barline (.bar-line);
      // the closing barline is the `.barline-final` pair.
      expect(ctx.container.querySelectorAll('.bar-line')).toHaveLength(1);
    });
  });

  describe('forced stem directions', () => {
    it('forces first-declared voice stems UP and second voice stems DOWN', () => {
      // A5 is high on the treble staff — auto rule would stem it DOWN.
      // E4 is low — auto rule would stem it UP. Force overrides both.
      ctx.render(
        sharedStaffSong({
          sop: [q('A5'), q('A5'), q('A5'), q('A5')],
          alto: [q('E4'), q('E4'), q('E4'), q('E4')],
        })
      );
      const sopStems = ctx.container.querySelectorAll(
        '[data-voice-id="s"] .note-stem'
      );
      const altoStems = ctx.container.querySelectorAll(
        '[data-voice-id="a"] .note-stem'
      );
      expect(sopStems.length).toBeGreaterThan(0);
      expect(altoStems.length).toBeGreaterThan(0);
      for (const stem of sopStems) {
        // Stem up: tip (y2) above attach (y1).
        expect(parseFloat(stem.getAttribute('y2'))).toBeLessThan(
          parseFloat(stem.getAttribute('y1'))
        );
      }
      for (const stem of altoStems) {
        // Stem down: tip below attach.
        expect(parseFloat(stem.getAttribute('y2'))).toBeGreaterThan(
          parseFloat(stem.getAttribute('y1'))
        );
      }
    });

    it('forces beamed-group stems to the voice direction too', () => {
      const e8 = (pitch) => ({ pitch, length: '1/8' });
      ctx.render(
        sharedStaffSong({
          // High eighths: auto beam rule would stem these down.
          sop: [e8('B4'), e8('C5'), q('C5'), q('C5'), q('C5')],
          // Low eighths: auto beam rule would stem these up.
          alto: [e8('F4'), e8('E4'), q('E4'), q('E4'), q('E4')],
        })
      );
      const sopBeamStems = ctx.container.querySelectorAll(
        '[data-voice-id="s"] .beam-group .note-stem'
      );
      const altoBeamStems = ctx.container.querySelectorAll(
        '[data-voice-id="a"] .beam-group .note-stem'
      );
      expect(sopBeamStems.length).toBe(2);
      expect(altoBeamStems.length).toBe(2);
      for (const stem of sopBeamStems) {
        expect(parseFloat(stem.getAttribute('y2'))).toBeLessThan(
          parseFloat(stem.getAttribute('y1'))
        );
      }
      for (const stem of altoBeamStems) {
        expect(parseFloat(stem.getAttribute('y2'))).toBeGreaterThan(
          parseFloat(stem.getAttribute('y1'))
        );
      }
    });
  });

  describe('validation', () => {
    it('throws when more than 2 voices share a staff value', () => {
      expect(() =>
        ctx.render({
          timeSignature: [4, 4],
          voices: [
            { id: 'a', staff: 'x', clef: 'treble', notes: [q('C5')] },
            { id: 'b', staff: 'x', clef: 'treble', notes: [q('A4')] },
            { id: 'c', staff: 'x', clef: 'treble', notes: [q('F4')] },
          ],
        })
      ).toThrow(/at most 2/i);
    });

    it('throws when voices sharing a staff declare different clefs', () => {
      expect(() =>
        ctx.render({
          timeSignature: [4, 4],
          voices: [
            { id: 'a', staff: 'x', clef: 'treble', notes: [q('C5')] },
            { id: 'b', staff: 'x', clef: 'bass', notes: [q('C3')] },
          ],
        })
      ).toThrow(/clef/i);
    });

    it('throws when voices sharing a staff have unequal total durations', () => {
      expect(() =>
        ctx.render({
          timeSignature: [4, 4],
          voices: [
            { id: 'a', staff: 'x', clef: 'treble', notes: [q('C5'), q('C5')] },
            { id: 'b', staff: 'x', clef: 'treble', notes: [q('A4')] },
          ],
        })
      ).toThrow(/duration/i);
    });

    it('second voice may omit the clef (first voice resolved clef wins)', () => {
      expect(() =>
        ctx.render({
          timeSignature: [4, 4],
          voices: [
            { id: 'a', staff: 'x', clef: 'treble', notes: [q('C5')] },
            { id: 'b', staff: 'x', notes: [q('A4')] },
          ],
        })
      ).not.toThrow();
      expect(ctx.container.querySelectorAll('.clef-treble')).toHaveLength(1);
    });
  });

  describe('notehead collisions', () => {
    it('shifts the down-stem voice right on a unison or second; not on a third+', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), q('C5'), q('C5'), q('C5')],
          // B4 = a second below C5 (shift); C5 = unison (shift);
          // A4 = a third (no shift); G4 = a fourth (no shift).
          alto: [q('B4'), q('C5'), q('A4'), q('G4')],
        })
      );
      const sopNotes = [
        ...ctx.container.querySelectorAll('[data-voice-id="s"] .note'),
      ].map(parseTranslate);
      const altoNotes = [
        ...ctx.container.querySelectorAll('[data-voice-id="a"] .note'),
      ].map(parseTranslate);
      expect(sopNotes).toHaveLength(4);
      expect(altoNotes).toHaveLength(4);
      // Second and unison: alto head shifts right by ~one notehead width.
      expect(altoNotes[0].x).toBeCloseTo(sopNotes[0].x + 22, 0);
      expect(altoNotes[1].x).toBeCloseTo(sopNotes[1].x + 22, 0);
      // Third and wider: heads align on the same x.
      expect(altoNotes[2].x).toBeCloseTo(sopNotes[2].x, 5);
      expect(altoNotes[3].x).toBeCloseTo(sopNotes[3].x, 5);
    });

    it('shifts the down-stem voice right when the voices cross', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), q('C5'), q('C5'), q('C5')],
          // E5 is ABOVE the upper voice's C5 — voice crossing.
          alto: [q('E5'), q('A4'), q('A4'), q('A4')],
        })
      );
      const sop = parseTranslate(
        ctx.container.querySelector('[data-voice-id="s"] .note')
      );
      const alto = parseTranslate(
        ctx.container.querySelector('[data-voice-id="a"] .note')
      );
      expect(alto.x).toBeCloseTo(sop.x + 22, 0);
    });
  });

  describe('rests', () => {
    it('dedupes same-beat same-duration rests to ONE centered rest', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), r4(), q('C5'), q('C5')],
          alto: [q('F4'), r4(), q('F4'), q('F4')],
        })
      );
      const rests = ctx.container.querySelectorAll('.rest');
      expect(rests).toHaveLength(1);
      // Centered: no vertical shift.
      expect(parseTranslate(rests[0]).y).toBe(0);
    });

    it('shifts a lone up-voice rest up one space and a lone down-voice rest down one space', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), r4(), q('C5'), q('C5')],
          alto: [q('F4'), q('F4'), r4(), q('F4')],
        })
      );
      const sopRest = ctx.container.querySelector('[data-voice-id="s"] .rest');
      const altoRest = ctx.container.querySelector('[data-voice-id="a"] .rest');
      expect(sopRest).not.toBeNull();
      expect(altoRest).not.toBeNull();
      expect(parseTranslate(sopRest).y).toBe(-20);
      expect(parseTranslate(altoRest).y).toBe(20);
    });
  });

  describe('accidental memory', () => {
    it('merges in-measure accidental memory across the staff voices', () => {
      ctx.render(
        sharedStaffSong({
          // Soprano introduces F#5 at beat 0; alto's F#5 at beat 1 is
          // already in effect for the staff — no second accidental.
          sop: [q('F#5'), q('C5'), q('C5'), q('C5')],
          alto: [q('A4'), q('F#5'), q('A4'), q('A4')],
        })
      );
      expect(ctx.container.querySelectorAll('.accidental')).toHaveLength(1);
    });

    it('same input WITHOUT shared staff prints the accidental in each voice', () => {
      ctx.render({
        timeSignature: [4, 4],
        voices: [
          { id: 's', clef: 'treble', notes: [q('F#5'), q('C5'), q('C5'), q('C5')] },
          { id: 'a', clef: 'treble', notes: [q('A4'), q('F#5'), q('A4'), q('A4')] },
        ],
      });
      expect(ctx.container.querySelectorAll('.accidental')).toHaveLength(2);
    });

    it('resets the merged memory at the barline', () => {
      ctx.render(
        sharedStaffSong({
          // Measure 1: soprano F#5 (prints). Measure 2: alto F#5 — new
          // measure, memory reset, prints again.
          sop: [q('F#5'), q('C5'), q('C5'), q('C5'), q('C5'), q('C5'), q('C5'), q('C5')],
          alto: [q('A4'), q('A4'), q('A4'), q('A4'), q('F#5'), q('A4'), q('A4'), q('A4')],
        })
      );
      expect(ctx.container.querySelectorAll('.accidental')).toHaveLength(2);
    });
  });

  describe('DOM contract', () => {
    it('keeps a per-voice group with data-voice-id / data-system-index / measure range and data-beat notes', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), q('C5'), q('C5'), q('C5')],
          alto: [q('F4'), q('F4'), q('F4'), q('F4')],
        })
      );
      for (const id of ['s', 'a']) {
        const g = ctx.container.querySelector(`[data-voice-id="${id}"]`);
        expect(g).not.toBeNull();
        expect(g.getAttribute('data-system-index')).toBe('0');
        expect(g.getAttribute('data-start-measure')).toBe('0');
        expect(g.getAttribute('data-end-measure')).toBe('0');
        const beats = [...g.querySelectorAll('.note')].map((n) =>
          n.getAttribute('data-beat')
        );
        expect(beats).toEqual(['0', '1', '2', '3']);
      }
    });

    it('keeps staff furniture OUTSIDE the per-voice groups, in a data-staff-id group', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('C5'), q('C5'), q('C5'), q('C5'), q('D5'), q('D5'), q('D5'), q('D5')],
          alto: [q('F4'), q('F4'), q('F4'), q('F4'), q('G4'), q('G4'), q('G4'), q('G4')],
        })
      );
      // No furniture inside either voice group.
      expect(
        ctx.container.querySelectorAll('[data-voice-id] .staff-lines')
      ).toHaveLength(0);
      expect(ctx.container.querySelectorAll('[data-voice-id] .clef')).toHaveLength(0);
      expect(
        ctx.container.querySelectorAll('[data-voice-id] .bar-line')
      ).toHaveLength(0);
      expect(
        ctx.container.querySelectorAll('[data-voice-id] .time-signature')
      ).toHaveLength(0);
      // Furniture lives in its own per-staff group.
      const furniture = ctx.container.querySelector('[data-staff-id]');
      expect(furniture).not.toBeNull();
      expect(furniture.hasAttribute('data-voice-id')).toBe(false);
      expect(furniture.querySelector('.staff-lines')).not.toBeNull();
      expect(furniture.querySelector('.clef')).not.toBeNull();
    });
  });

  describe('full close score (SATB, two shared staves, brace)', () => {
    it('renders four voices on two staves with a brace', () => {
      ctx.render({
        timeSignature: [4, 4],
        keySignature: 'D',
        voices: [
          {
            id: 'soprano',
            staff: 'upper',
            clef: 'treble',
            notes: [q('D5'), q('D5'), q('E5'), q('D5')],
          },
          {
            id: 'alto',
            staff: 'upper',
            clef: 'treble',
            notes: [q('F#4'), q('A4'), q('A4'), q('F#4')],
          },
          {
            id: 'tenor',
            staff: 'lower',
            clef: 'bass',
            notes: [q('A3'), q('A3'), q('A3'), q('A3')],
          },
          {
            id: 'bass',
            staff: 'lower',
            clef: 'bass',
            notes: [q('D3'), q('F#3'), q('A2'), q('D3')],
          },
        ],
        staffGroups: [
          { type: 'brace', voiceIds: ['soprano', 'alto', 'tenor', 'bass'] },
        ],
      });
      expect(ctx.container.querySelectorAll('.staff-lines')).toHaveLength(2);
      expect(ctx.container.querySelectorAll('[data-voice-id]')).toHaveLength(4);
      expect(ctx.container.querySelector('.brace')).not.toBeNull();
      // One treble + one bass clef.
      expect(ctx.container.querySelectorAll('.clef-treble')).toHaveLength(1);
      expect(ctx.container.querySelectorAll('.clef-bass')).toHaveLength(1);
    });
  });

  describe('accidental staggering (Gould: within a sixth, no shared column)', () => {
    const accidentalX = (el) =>
      Number(/translate\(([-\d.]+)/.exec(el.getAttribute('transform'))[1]);

    it('staggers simultaneous accidentals a third apart across shared-staff voices', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('F#4'), q('C5'), q('C5'), q('C5')],
          alto: [q('D#4'), q('F4'), q('F4'), q('F4')],
        })
      );
      const sharps = [...ctx.container.querySelectorAll('.accidental.sharp')];
      expect(sharps).toHaveLength(2);
      const [x1, x2] = sharps.map(accidentalX);
      // The second (lower voice) accidental steps LEFT of the first.
      expect(x2).toBeLessThan(x1 - 10);
    });

    it('keeps distant simultaneous accidentals (an octave+) in one column', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('F#5'), q('C5'), q('C5'), q('C5')],
          alto: [q('F#4'), q('F4'), q('F4'), q('F4')],
        })
      );
      const sharps = [...ctx.container.querySelectorAll('.accidental.sharp')];
      expect(sharps).toHaveLength(2);
      const [x1, x2] = sharps.map(accidentalX);
      expect(Math.abs(x1 - x2)).toBeLessThan(1);
    });

    it('composes doubleFlat from two flat glyphs (the font dump outline is corrupt)', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('Bbb4'), q('C5'), q('C5'), q('C5')],
          alto: [q('F4'), q('F4'), q('F4'), q('F4')],
        })
      );
      const dbl = ctx.container.querySelector('.accidental.doubleFlat');
      expect(dbl).not.toBeNull();
      expect(dbl.querySelectorAll('path')).toHaveLength(2);
    });

    it('renders doubleSharp with its single intact glyph', () => {
      ctx.render(
        sharedStaffSong({
          sop: [q('F##4'), q('C5'), q('C5'), q('C5')],
          alto: [q('A4'), q('A4'), q('A4'), q('A4')],
        })
      );
      const dbl = ctx.container.querySelector('.accidental.doubleSharp');
      expect(dbl).not.toBeNull();
      expect(dbl.querySelectorAll('path')).toHaveLength(1);
    });
  });
});
