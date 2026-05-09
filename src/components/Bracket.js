/**
 * Square staff bracket renderer (ensemble grouping symbol).
 *
 * Renders Bravura's bracketTop (U+E003) and bracketBottom (U+E004) hook
 * glyphs joined by a thick rectangular trunk. The trunk thickness matches
 * the glyphs' native trunk width (125 fu × SMUFL_SCALE) so trunk and
 * hooks line up seamlessly.
 *
 * SMuFL's native bracketTop hook curls UP and to the RIGHT from
 * registration (0, 0); we mirror it in X at draw time so the hook curls
 * outward (LEFT) as engraving convention dictates for a bracket placed
 * at the LEFT edge of a staff system.
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

  // Top hook: scale(-SMUFL_SCALE, -SMUFL_SCALE) flips both axes —
  //  - X flip: hook curls LEFT instead of RIGHT (engraving convention)
  //  - Y flip: SMuFL +y-up → SVG +y-down so the hook extends ABOVE y=0
  // Translate by TRUNK_WIDTH so the hook's mirrored bottom edge lines up
  // with the trunk's top edge (x = [0, TRUNK_WIDTH]).
  const topHook = createGroup('bracket-hook-top', {
    transform: `translate(${TRUNK_WIDTH}, 0) scale(${-SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  topHook.appendChild(
    createPath(BRACKET_TOP_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(topHook);

  // Bottom hook: same scaling, anchored at the trunk's bottom-right corner.
  // bracketBottom path uses negative-y for the hook in font coords; after
  // scaleY(-1) the hook extends to positive SVG y (downward) — exactly what
  // we want below the trunk.
  const bottomHook = createGroup('bracket-hook-bottom', {
    transform: `translate(${TRUNK_WIDTH}, ${height}) scale(${-SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  bottomHook.appendChild(
    createPath(BRACKET_BOTTOM_GLYPH.d, { fill: 'currentColor', stroke: 'none' }),
  );
  group.appendChild(bottomHook);

  return group;
}
