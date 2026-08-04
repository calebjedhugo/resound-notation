import { effectiveStemLength } from './stemLength.js';
import { MIDDLE_LINE_Y, STEM_LENGTH } from './engravingDefaults.js';

// Gould "Behind Bars" (Stems) / Ross: a stem is normally 3.5 staff spaces,
// but on a note far enough out on ledger lines it is LENGTHENED so the tip
// reaches at least the middle staff line. It is a lower bound — never a
// shortening. These pin that contract; without them a regression would
// silently re-shape every ledgered stem in a score.
describe('effectiveStemLength', () => {
  const call = (attachY, stemDown) =>
    effectiveStemLength({
      attachY,
      stemDown,
      baseLength: STEM_LENGTH,
      middleLineY: MIDDLE_LINE_Y,
    });

  describe('inside the staff (no lengthening)', () => {
    it.each([
      ['stem-up on the bottom line', 90, false],
      ['stem-up on the middle line', MIDDLE_LINE_Y, false],
      ['stem-down on the top line', 10, true],
      ['stem-down on the middle line', MIDDLE_LINE_Y, true],
    ])('%s keeps the base length', (_label, attachY, stemDown) => {
      expect(call(attachY, stemDown)).toBe(STEM_LENGTH);
    });

    it('never shortens a stem whose tip already passes the middle line', () => {
      // Stem-up from y=60: reach-to-middle is only 10px, far under the base.
      expect(call(60, false)).toBe(STEM_LENGTH);
    });
  });

  describe('far out on ledger lines (lengthened to the middle line)', () => {
    it('lengthens an up-stem below the staff so the tip reaches the middle line', () => {
      // attachY 150 is 100px below the middle line — 30px past the base reach.
      expect(call(150, false)).toBe(100);
      expect(150 - call(150, false)).toBe(MIDDLE_LINE_Y);
    });

    it('lengthens a down-stem above the staff so the tip reaches the middle line', () => {
      // attachY -50 is 100px above the middle line.
      expect(call(-50, true)).toBe(100);
      expect(-50 + call(-50, true)).toBe(MIDDLE_LINE_Y);
    });

    it('kicks in exactly where the base length stops reaching', () => {
      const boundary = MIDDLE_LINE_Y + STEM_LENGTH; // 120
      expect(call(boundary, false)).toBe(STEM_LENGTH);
      expect(call(boundary + 20, false)).toBe(STEM_LENGTH + 20);
    });
  });

  it('defaults middleLineY to the shared staff geometry', () => {
    const withDefault = effectiveStemLength({
      attachY: 150,
      stemDown: false,
      baseLength: STEM_LENGTH,
    });
    expect(withDefault).toBe(call(150, false));
  });
});
