/** @jest-environment jsdom */

/**
 * BYTE-EXACT path pins for tie and slur arcs.
 *
 * Why this file exists: `components/Tie.js` and `components/Slur.js` are
 * near-duplicates — same clamp family (SPEC-lyric-spacing.md JOB 3), same
 * 0.33/0.67 control-point fractions, same closed two-Bezier construction,
 * same `MIDPOINT_THICKNESS / 0.75` apex derivation — differing only in four
 * constants and the slur's nesting tighten. That duplication is a standing
 * drift hazard (a JOB 3-style change has to be made twice), and the obvious
 * cleanup is to factor the shared geometry into one helper.
 *
 * The existing Tie/Slur tests assert arc HEIGHTS and path STRUCTURE, but
 * nothing pinned the emitted `d` string, so such a refactor could shift
 * every tie and slur in every score by a rounding step with a green suite.
 * These pins close that hole: they are the safety net that makes the
 * dedup safe to perform later.
 *
 * If one of these fails, you changed engraved output. That is a behavior
 * change, not a refactor — do not "update the expected string" unless the
 * change was the intent.
 */

import { createTieArc } from './Tie.js';
import { createSlurArc } from './Slur.js';

describe('tie/slur arc path pins (byte-exact)', () => {
  describe('createTieArc', () => {
    it.each([
      [
        'short span, above (floor region)',
        { x1: 100, y1: 50, x2: 130, y2: 50, direction: 'above' },
        'M 100 37 C 109.9 29 120.1 29 130 37 C 120.1 34.86666666666667 109.9 34.86666666666667 100 37 Z',
      ],
      [
        'mid span, below, sloped',
        { x1: 100, y1: 50, x2: 160, y2: 70, direction: 'below' },
        'M 100 63 C 119.8 73.20339600500633 140.2 93.20339600500633 160 83 C 140.2 87.33672933833967 119.8 67.33672933833967 100 63 Z',
      ],
      [
        'long span, above (capped)',
        { x1: 0, y1: 30, x2: 400, y2: 30, direction: 'above' },
        'M 0 17 C 132 3 268 3 400 17 C 268 8.866666666666667 132 8.866666666666667 0 17 Z',
      ],
    ])('%s', (_label, params, expected) => {
      expect(createTieArc(params).getAttribute('d')).toBe(expected);
    });
  });

  describe('createSlurArc', () => {
    it.each([
      [
        'short span, above (floor region)',
        { x1: 100, y1: 50, x2: 130, y2: 50, direction: 'above' },
        'M 100 36 C 109.9 21 120.1 21 130 36 C 120.1 26.866666666666667 109.9 26.866666666666667 100 36 Z',
      ],
      [
        'mid span, below, sloped',
        { x1: 100, y1: 50, x2: 160, y2: 70, direction: 'below' },
        'M 100 64 C 119.8 82 140.2 102 160 84 C 140.2 96.13333333333333 119.8 76.13333333333333 100 64 Z',
      ],
      [
        'long span, above (capped)',
        { x1: 0, y1: 30, x2: 400, y2: 30, direction: 'above' },
        'M 0 16 C 132 -2 268 -2 400 16 C 268 3.866666666666667 132 3.866666666666667 0 16 Z',
      ],
      [
        'long span, nested (depth 1 tightens the arc)',
        { x1: 0, y1: 30, x2: 400, y2: 30, direction: 'above', depth: 1 },
        'M 0 16 C 132 5.200000000000001 268 5.200000000000001 400 16 C 268 11.066666666666668 132 11.066666666666668 0 16 Z',
      ],
    ])('%s', (_label, params, expected) => {
      expect(createSlurArc(params).getAttribute('d')).toBe(expected);
    });
  });

  it('ties sit closer to the notehead than slurs at the same span', () => {
    // NOTEHEAD_OFFSET is 13 for ties, 14 for slurs — the one geometric
    // difference a naive dedup is most likely to flatten.
    const p = { x1: 0, y1: 50, x2: 60, y2: 50, direction: 'above' };
    const startY = (el) => Number(el.getAttribute('d').split(' ')[2]);
    expect(startY(createTieArc(p))).toBe(37);
    expect(startY(createSlurArc(p))).toBe(36);
  });
});
