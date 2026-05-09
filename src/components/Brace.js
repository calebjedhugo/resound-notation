/**
 * Brace renderer.
 * SMuFL/Bravura ships brace as glyph U+E000 but it's not in our 83-glyph
 * extraction; this is a hand-rolled approximation that draws a closed
 * filled outline of an engraved curly brace, tapering from thin at top
 * and bottom to wider at the middle pinch.
 */

import { createGroup, createPath } from '../lib/svgHelpers.js';

const DEFAULT_HEIGHT = 200;

// Brace outline at unit height 100, ~12 wide. Two stacked C-curves that
// meet at a central pinch (to the right) and end thin at top and bottom.
// Outer curve: top-right tip → bulge left at top quarter → pinch right
// at middle → bulge left at bottom quarter → bottom-right tip. Inner
// curve mirrors back, slightly inset, creating a filled body that
// thickens through the curve and tapers at the ends.
const BRACE_PATH =
  // Outer (right) edge, top to bottom.
  'M 11,0 ' +
  'C 4,8 1,18 3,30 ' +
  'C 5,40 9,46 11,50 ' +
  'C 9,54 5,60 3,70 ' +
  'C 1,82 4,92 11,100 ' +
  // Inner (left) edge, bottom to top — slightly inset, creating body width.
  'L 9,100 ' +
  'C 3,93 0,83 2,71 ' +
  'C 4,62 7,55 9,50 ' +
  'C 7,45 4,38 2,29 ' +
  'C 0,17 3,7 9,0 Z';

const PATH_HEIGHT = 100;
const PATH_WIDTH = 11;

/**
 * Create an SVG group representing a curly brace.
 * @param {Object} options
 * @param {number} [options.height=200] - Total height the brace should span
 * @returns {SVGGElement}
 */
export function createBrace({ height = DEFAULT_HEIGHT } = {}) {
  const group = createGroup('brace');

  // Brace width scales with height but stays narrow (engraving convention:
  // brace is ~1 staff space wide regardless of staff count).
  const scaleY = height / PATH_HEIGHT;
  const scaleX = Math.max(1, scaleY * 0.18);

  const path = createPath(BRACE_PATH, {
    fill: 'currentColor',
    stroke: 'none',
    'fill-rule': 'evenodd',
  });

  path.setAttribute('transform', `scale(${scaleX}, ${scaleY})`);

  group.appendChild(path);
  return group;
}
