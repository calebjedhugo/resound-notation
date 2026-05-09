/**
 * Square staff bracket renderer (ensemble grouping symbol).
 *
 * Renders Bravura's bracketTop (U+E003) and bracketBottom (U+E004) hook
 * glyphs joined by a thick rectangular trunk. The trunk thickness matches
 * the glyphs' native trunk width (125 fu × SMUFL_SCALE) so trunk and
 * hooks line up seamlessly.
 *
 * The hooks curl toward the staff (RIGHT in local coords); the trunk is
 * the LEFT vertical line of the bracket symbol. (This deviates from
 * typical engraving convention but matches the user's preferred visual.)
 */

import {
  BRACKET_TOP_GLYPH,
  BRACKET_BOTTOM_GLYPH,
  SMUFL_SCALE,
} from '../assets/glyphs.js';
import { createGroup, createPath, createSvgElement } from '../lib/svgHelpers.js';

const DEFAULT_HEIGHT = 200;

// Trunk thickness (px) — matches the native font-unit width of the
// bracketTop/bracketBottom hook bottom edge (125 fu) at SMUFL_SCALE.
const TRUNK_WIDTH = 125 * SMUFL_SCALE; // = 10

/**
 * Create an SVG group representing a square staff bracket.
 *
 * Local coords: trunk runs x = [0, TRUNK_WIDTH], y = [0, height]. Hooks
 * curl to the RIGHT (toward the staff), with tips at approximately
 * x ≈ 469 * SMUFL_SCALE ≈ 37.5 px and y = ±271 * SMUFL_SCALE ≈ ∓21.7 px
 * (above the top / below the bottom). Total local footprint: x=[0, ~37.5].
 *
 * @param {Object} options
 * @param {number} [options.height=200] - Total height of the trunk; hooks
 *   extend outside (above and below) this span.
 * @returns {SVGGElement}
 */
export function createBracket({ height = DEFAULT_HEIGHT } = {}) {
  const group = createGroup('bracket');

  // Trunk: filled rectangle running x = [0, TRUNK_WIDTH], y = [0, height].
  const trunk = createSvgElement('rect', {
    x: 0,
    y: 0,
    width: TRUNK_WIDTH,
    height,
    fill: 'currentColor',
    stroke: 'none',
  });
  group.appendChild(trunk);

  // Top hook: scale(SMUFL_SCALE, -SMUFL_SCALE) applies the SMuFL Y-flip
  // only; the native bracketTop curls UP-and-RIGHT, so after Y-flip the
  // hook tip ends up above and to the RIGHT (toward the staff).
  const topHook = createGroup('bracket-hook-top', {
    transform: `translate(0, 0) scale(${SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  topHook.appendChild(
    createPath(BRACKET_TOP_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(topHook);

  // Bottom hook: anchored at the trunk's bottom-LEFT corner (0, height).
  // After scaleY(-1) the hook extends DOWN-RIGHT below y=height.
  const bottomHook = createGroup('bracket-hook-bottom', {
    transform: `translate(0, ${height}) scale(${SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  bottomHook.appendChild(
    createPath(BRACKET_BOTTOM_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(bottomHook);

  return group;
}
