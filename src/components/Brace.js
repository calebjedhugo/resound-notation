/**
 * Brace renderer — grand-staff curly brace.
 *
 * Uses Bravura U+E000 brace path, scaled vertically to span the requested
 * height. The brace path is in font units with +y up (SMuFL convention),
 * yMin = 0, yMax = 997. We non-uniformly scale: X stays at SMUFL_SCALE
 * to keep the native brace thickness, Y scales by `-height / 997` so the
 * brace stretches to the requested span and flips into SVG +y-down.
 *
 * (Real engraving uses multiple discrete brace sizes rather than linear
 * stretch, since linear stretch makes the central pinch look distorted
 * at extreme heights. Acceptable for now; can swap to a size-bucketed
 * approach later.)
 */

import { BRACE_GLYPH, SMUFL_SCALE } from '../assets/glyphs.js';
import { createGroup, createPath } from '../lib/svgHelpers.js';

const DEFAULT_HEIGHT = 200;
const BRACE_NATIVE_HEIGHT_FU = 997;

/**
 * Create an SVG group representing a curly brace.
 * @param {Object} options
 * @param {number} [options.height=200] - Total height the brace should span
 * @returns {SVGGElement}
 */
export function createBrace({ height = DEFAULT_HEIGHT } = {}) {
  const group = createGroup('brace');

  const yScale = -height / BRACE_NATIVE_HEIGHT_FU;
  const inner = createGroup('', {
    transform: `translate(0, ${height}) scale(${SMUFL_SCALE}, ${yScale})`,
  });
  inner.appendChild(
    createPath(BRACE_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(inner);

  return group;
}
