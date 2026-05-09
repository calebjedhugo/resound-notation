/**
 * Square staff bracket renderer (ensemble grouping symbol).
 *
 * Renders Bravura's bracketTop (U+E003) and bracketBottom (U+E004) hook
 * glyphs joined by a thick rectangular trunk. The trunk thickness matches
 * the glyphs' native trunk width (125 fu × SMUFL_SCALE) so trunk and
 * hooks line up seamlessly.
 *
 * Engraving convention for a left-of-staff bracket "[": the trunk is the
 * vertical line CLOSEST to the staff (on the right side of the symbol),
 * and the hook tips curl AWAY from the staff (to the LEFT). The native
 * Bravura bracketTop curls UP-and-RIGHT in font coords — so we apply BOTH
 * an X-mirror and the SMuFL Y-flip (scale(-SMUFL_SCALE, -SMUFL_SCALE)),
 * then translate by (TRUNK_WIDTH, 0) so the mirrored hook's bottom edge
 * snaps back onto the trunk's top edge x = [0, TRUNK_WIDTH].
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
 * curl outward to the LEFT (negative x), with tips at approximately
 * x = TRUNK_WIDTH - 469 * SMUFL_SCALE ≈ -27.5 px and y = ±271 * SMUFL_SCALE
 * ≈ ∓21.7 px (above the top / below the bottom). Bracket opening faces
 * LEFT; trunk's RIGHT edge (x = TRUNK_WIDTH) sits flush with the staff.
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

  // Top hook: scale(-SMUFL_SCALE, -SMUFL_SCALE) applies an X-mirror plus
  // the SMuFL Y-flip so the native UP-RIGHT hook becomes UP-LEFT. The
  // mirrored hook's bottom edge runs from x=0 back to x=-TRUNK_WIDTH, so
  // we translate by (TRUNK_WIDTH, 0) to land the bottom edge on the
  // trunk's top edge x=[0, TRUNK_WIDTH]. Hook tip ends up at x ≈ -27.5.
  const topHook = createGroup('bracket-hook-top', {
    transform: `translate(${TRUNK_WIDTH}, 0) scale(${-SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  topHook.appendChild(
    createPath(BRACKET_TOP_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(topHook);

  // Bottom hook: same X-mirror + Y-flip, anchored at the trunk's
  // bottom-RIGHT corner (TRUNK_WIDTH, height). After scaleY(-1) the hook
  // extends DOWN-LEFT below y=height.
  const bottomHook = createGroup('bracket-hook-bottom', {
    transform: `translate(${TRUNK_WIDTH}, ${height}) scale(${-SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  bottomHook.appendChild(
    createPath(BRACKET_BOTTOM_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(bottomHook);

  return group;
}
