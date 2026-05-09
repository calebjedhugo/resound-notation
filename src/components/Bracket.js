/**
 * Square staff bracket renderer (ensemble grouping symbol).
 *
 * Renders Bravura's bracketTop (U+E003) and bracketBottom (U+E004) hook
 * glyphs joined by a thick rectangular trunk. The trunk thickness matches
 * the glyphs' native trunk width (125 fu × SMUFL_SCALE) so trunk and
 * hooks line up seamlessly.
 *
 * The native Bravura bracketTop hook is drawn pre-oriented for engraving
 * use: registration (0, 0) is the trunk's top-LEFT corner, the trunk-base
 * runs (0,0) → (125,0), and the hook curls outward (UP-and-RIGHT in font
 * coords, i.e. UP-and-RIGHT visually after the standard scale(1,-1) flip).
 * The opening of the bracket faces RIGHT toward the staff — matching the
 * "[" shape. We apply only the SMuFL Y-flip (font +y-up → SVG +y-down);
 * no X-mirror is needed.
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
 * curl outward to the RIGHT (positive x), with tips at approximately
 * x = 469 * SMUFL_SCALE ≈ 37.5 px and y = ±271 * SMUFL_SCALE ≈ ∓21.7 px
 * (above the top / below the bottom).
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
  // (font +y-up → SVG +y-down) so the hook extends ABOVE y=0. Registration
  // (0,0) is the trunk's top-left corner; the hook curls UP-and-RIGHT.
  const topHook = createGroup('bracket-hook-top', {
    transform: `translate(0, 0) scale(${SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  topHook.appendChild(
    createPath(BRACKET_TOP_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(topHook);

  // Bottom hook: anchored at the trunk's bottom-left corner (0, height).
  // bracketBottom path uses negative-y for the hook in font coords; after
  // scaleY(-1) the hook extends to positive SVG y (downward) below height.
  const bottomHook = createGroup('bracket-hook-bottom', {
    transform: `translate(0, ${height}) scale(${SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  bottomHook.appendChild(
    createPath(BRACKET_BOTTOM_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(bottomHook);

  return group;
}
