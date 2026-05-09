/**
 * Rest renderer.
 * Renders SMuFL Bravura rest glyphs at the standard staff position
 * for each duration.
 */

import { createGroup } from '../lib/svgHelpers.js';
import { getDurationInfo } from '../lib/durationSymbols.js';
import { createSmuflGlyph, REST_GLYPHS } from '../assets/glyphs.js';

// Per SMuFL convention each rest glyph has a different y=0 anchor
// relative to the staff. Whole rest hangs from line 2; half rest sits
// on line 3; the rest center on the staff midline.
const STAFF_LINE_2 = 30;
const STAFF_MIDLINE = 50;

const REST_PLACEMENT = {
  whole: { glyph: REST_GLYPHS.whole, y: STAFF_LINE_2 },
  half: { glyph: REST_GLYPHS.half, y: STAFF_MIDLINE },
  quarter: { glyph: REST_GLYPHS.quarter, y: STAFF_MIDLINE },
  eighth: { glyph: REST_GLYPHS['8th'], y: STAFF_MIDLINE },
  '16th': { glyph: REST_GLYPHS['16th'], y: STAFF_MIDLINE },
  '32nd': { glyph: REST_GLYPHS['32nd'], y: STAFF_MIDLINE },
};

/**
 * Create an SVG group representing a rest symbol.
 * @param {Object} params
 * @param {string} params.length - Fraction string (e.g. "1/4")
 * @param {number} params.x - Horizontal position
 * @returns {SVGGElement}
 */
export function createRest({ length, x }) {
  const info = getDurationInfo(length);
  const placement = REST_PLACEMENT[info.name] || REST_PLACEMENT.quarter;

  const group = createGroup(`rest rest-${info.name}`, {
    transform: `translate(${x}, 0)`,
  });

  const symbol = createSmuflGlyph(placement.glyph, 'rest-symbol');
  symbol.setAttribute('transform', `translate(0, ${placement.y})`);
  group.appendChild(symbol);

  return group;
}
