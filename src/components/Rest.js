/**
 * Rest renderer.
 * Renders SMuFL Bravura rest glyphs at the standard staff position
 * for each duration.
 */

import { createGroup } from '../lib/svgHelpers.js';
import { getDurationInfo } from '../lib/durationSymbols.js';
import {
  createSmuflGlyph,
  SMUFL_SCALE,
  AUGMENTATION_DOT_GLYPH,
  REST_GLYPHS,
} from '../assets/glyphs.js';
import { LINE_SPACING, MIDDLE_LINE_Y } from '../lib/engravingDefaults.js';

// Per SMuFL convention each rest glyph has a different y=0 anchor
// relative to the staff. Whole rest hangs from line 2; half rest sits
// on line 3; the rest center on the staff midline.
const STAFF_LINE_2 = 30;
const STAFF_MIDLINE = MIDDLE_LINE_Y;

const REST_PLACEMENT = {
  whole: { glyph: REST_GLYPHS.whole, y: STAFF_LINE_2 },
  half: { glyph: REST_GLYPHS.half, y: STAFF_MIDLINE },
  quarter: { glyph: REST_GLYPHS.quarter, y: STAFF_MIDLINE },
  eighth: { glyph: REST_GLYPHS['8th'], y: STAFF_MIDLINE },
  // 16th/32nd rests have long downward tails. Lift the anchor by half a
  // staff space so the topmost dot sits near line 2 instead of midline,
  // letting the tail terminate at the bottom line rather than below it.
  '16th': { glyph: REST_GLYPHS['16th'], y: STAFF_MIDLINE - 10 },
  '32nd': { glyph: REST_GLYPHS['32nd'], y: STAFF_MIDLINE - 10 },
};

/**
 * Create an SVG group representing a rest symbol.
 * @param {Object} params
 * @param {string} params.length - Fraction string (e.g. "1/4")
 * @param {number} params.x - Horizontal position
 * @param {boolean} [params.dotted] - Draw an augmentation dot right of the glyph
 * @returns {SVGGElement}
 */
export function createRest({ length, x, dotted }) {
  const info = getDurationInfo(length);
  const placement = REST_PLACEMENT[info.name] || REST_PLACEMENT.quarter;

  const group = createGroup(`rest rest-${info.name}`, {
    transform: `translate(${x}, 0)`,
  });

  const symbol = createSmuflGlyph(placement.glyph, 'rest-symbol');
  symbol.setAttribute('transform', `translate(0, ${placement.y})`);
  group.appendChild(symbol);

  // Augmentation dot (Gould pp. 56-57): right of the rest glyph with a
  // clear quarter-space gap, placed in the space above the staff midline —
  // the standard vertical position for dotted rests. Rests repositioned on
  // a shared staff shift by whole staff spaces (the group transform), so
  // the dot stays in a space there too.
  if (dotted) {
    const glyphHalfWidth =
      ((placement.glyph.bbox.xMax - placement.glyph.bbox.xMin) / 2) * SMUFL_SCALE;
    const dotRadius =
      ((AUGMENTATION_DOT_GLYPH.bbox.xMax - AUGMENTATION_DOT_GLYPH.bbox.xMin) / 2)
      * SMUFL_SCALE;
    const dotGap = LINE_SPACING / 4;
    const dotX = glyphHalfWidth + dotGap + dotRadius;
    const dotY = MIDDLE_LINE_Y - LINE_SPACING / 2; // space above the midline
    const dot = createSmuflGlyph(AUGMENTATION_DOT_GLYPH, 'augmentation-dot');
    dot.setAttribute('transform', `translate(${dotX}, ${dotY})`);
    group.appendChild(dot);
  }

  return group;
}
