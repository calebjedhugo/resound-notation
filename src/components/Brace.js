/**
 * Brace renderer — grand-staff curly brace.
 *
 * Uses Bravura U+E000 brace path, scaled vertically to span the requested
 * height. The brace path is in font units with +y up (SMuFL convention),
 * yMin = 0, yMax = 997. Y scales by `-height / 997` so the brace stretches
 * to the requested span and flips into SVG +y-down.
 *
 * X scales sub-linearly with height (sqrt) so the brace thickens visibly
 * for tall systems instead of looking like a thin spaghetti at grand-staff
 * heights. Real engraving uses bucketed brace sizes (Bravura ships ~7
 * variants); a sqrt fudge here approximates that visual growth from a
 * single path.
 *
 * At the native height (997 fu × SMUFL_SCALE ≈ 80 px) the X scale equals
 * SMUFL_SCALE, preserving the font designer's intended thickness. As the
 * brace stretches taller (e.g. 200 px for a 3-staff system) the X scale
 * grows by sqrt(height / native), so a 200 px brace ends up ~sqrt(2.5) ≈
 * 1.58× the native width.
 */

import { BRACE_GLYPH, SMUFL_SCALE } from '../assets/glyphs.js';
import { createGroup, createPath } from '../lib/svgHelpers.js';

const DEFAULT_HEIGHT = 200;
const BRACE_NATIVE_HEIGHT_FU = 997;
const BRACE_NATIVE_HEIGHT_PX = BRACE_NATIVE_HEIGHT_FU * SMUFL_SCALE; // ≈ 79.76
// BRACE_GLYPH bbox xMax in font units (xMin = 2, but path effectively starts
// at 0). Using xMax directly approximates the brace's right edge in local px.
const BRACE_GLYPH_XMAX_FU = 82;

/**
 * Compute the rendered pixel width of the brace at a given height. Mirrors
 * the X-scale formula used inside `createBrace` so callers (e.g. the
 * renderer positioning the brace outside the staff) can compute the
 * brace's local-x extent without rendering it.
 *
 * @param {number} height - Brace span in px
 * @returns {number} approximate brace width in px (local x range = [0, this])
 */
export function getBraceWidth(height = DEFAULT_HEIGHT) {
  const widthRatio = Math.max(1, Math.sqrt(height / BRACE_NATIVE_HEIGHT_PX));
  const xScale = SMUFL_SCALE * widthRatio;
  return BRACE_GLYPH_XMAX_FU * xScale;
}

/**
 * Create an SVG group representing a curly brace.
 * @param {Object} options
 * @param {number} [options.height=200] - Total height the brace should span
 * @returns {SVGGElement}
 */
export function createBrace({ height = DEFAULT_HEIGHT } = {}) {
  const group = createGroup('brace');

  const yScale = -height / BRACE_NATIVE_HEIGHT_FU;
  // X width grows with sqrt of height ratio. Floor at 1.0 so very short
  // braces don't shrink below native thickness.
  const widthRatio = Math.max(1, Math.sqrt(height / BRACE_NATIVE_HEIGHT_PX));
  const xScale = SMUFL_SCALE * widthRatio;

  const inner = createGroup('', {
    transform: `translate(0, ${height}) scale(${xScale}, ${yScale})`,
  });
  inner.appendChild(
    createPath(BRACE_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(inner);

  return group;
}
