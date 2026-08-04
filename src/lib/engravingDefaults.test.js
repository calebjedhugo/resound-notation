import * as defaults from './engravingDefaults.js';

// These constants set the geometry of EVERY rendered score, and several are
// shared across modules that used to hold private duplicates. A drifting
// value here is a silent, global visual regression — so pin both the exact
// numbers and the staff-space derivations they claim to encode.
describe('engravingDefaults', () => {
  it('anchors one staff space at 20px', () => {
    expect(defaults.LINE_SPACING).toBe(20);
  });

  describe('Bravura engravingDefaults, in px at LINE_SPACING = 20', () => {
    it.each([
      ['STAFF_LINE_THICKNESS', 0.13, 2.6],
      ['THIN_BARLINE_THICKNESS', 0.16, 3.2],
      ['THICK_BARLINE_THICKNESS', 0.5, 10],
      ['BARLINE_SEPARATION', 0.4, 8],
      ['HAIRPIN_THICKNESS', 0.16, 3.2],
      ['VOLTA_LINE_THICKNESS', 0.16, 3.2],
      ['SLUR_MIDPOINT_THICKNESS', 0.22, 4.4],
      ['TIE_MIDPOINT_THICKNESS', 0.22, 4.4],
      ['STEM_THICKNESS', 0.12, 2.4],
    ])('%s = %f staff spaces = %fpx', (name, spaces, px) => {
      expect(defaults[name]).toBeCloseTo(spaces * defaults.LINE_SPACING, 10);
      expect(defaults[name]).toBe(px);
    });
  });

  describe('shared staff geometry', () => {
    // Duplicated privately in NotationRenderer.js, components/Note.js,
    // components/Beam.js and lib/beaming.js before centralisation; these
    // are the values those copies held.
    it('puts the middle staff line at y = 50 in the pitchToStaffY frame', () => {
      expect(defaults.MIDDLE_LINE_Y).toBe(50);
    });

    it('sets the default stem at 3.5 staff spaces', () => {
      expect(defaults.STEM_LENGTH).toBe(70);
      expect(defaults.STEM_LENGTH).toBe(3.5 * defaults.LINE_SPACING);
    });
  });

  describe('repeat-barline clearances', () => {
    it('derives the dot edge offset from the RepeatBarline geometry', () => {
      // barlineSeparation + dot gap (5) + dot radius (2.5)
      expect(defaults.REPEAT_BARLINE_DOT_EDGE_OFFSET).toBe(
        defaults.BARLINE_SEPARATION + 5 + 2.5
      );
      expect(defaults.REPEAT_BARLINE_DOT_EDGE_OFFSET).toBe(15.5);
    });

    it('keeps a full staff space between repeat dots and a notehead', () => {
      expect(defaults.REPEAT_BARLINE_INNER_PAD).toBe(defaults.LINE_SPACING);
      expect(defaults.REPEAT_BARLINE_INNER_PAD).toBe(20);
    });
  });

  it('exposes every constant as a finite number', () => {
    for (const [name, value] of Object.entries(defaults)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
