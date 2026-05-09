/**
 * Square staff bracket renderer.
 *
 * Used to group staves of an instrument family (orchestral / ensemble
 * scoring), distinct from the curly Brace used for a single instrument's
 * grand staff. SMuFL bracket glyphs (U+E003 + serifs) aren't in our 83-glyph
 * extraction; this is a hand-rolled rendering that follows engraving
 * convention: a thick vertical trunk with hooked serifs curling outward
 * from the top and bottom.
 *
 * The trunk stretches with `height` while the hooks remain a fixed visual
 * size (engraving convention — the hook is sized to the staff, not the
 * group).
 */

import { createGroup, createPath, createSvgElement } from '../lib/svgHelpers.js';

const DEFAULT_HEIGHT = 200;

// Trunk: ~0.4 staff space wide (LINE_SPACING = 20, so ~8px). Sits flush
// against the left edge of the staff lines.
const TRUNK_WIDTH = 8;

// Hook geometry — fixed pixel size regardless of group height. The hook
// is a comma-shaped serif that flares outward (up-and-left at top,
// down-and-left at bottom) from the trunk corner, ending in a sharp
// point. Width spans ~1.0 staff space, height ~0.8 staff space.
const HOOK_WIDTH = 26;
const HOOK_HEIGHT = 22;

// Top hook path. Origin (0, 0) = top-left corner of the trunk.
// The serif sweeps UP from the trunk corner, then curls LEFT to a
// tapered tip — an engraved bracket "claw". The outer edge follows a
// tall arc; the inner edge cuts back more directly, giving the curl
// visible body.
const TOP_HOOK_PATH =
  `M 0,0 ` +
  // Outer edge: trunk top-left → up first, then over and out to the tip.
  `C 0,${-HOOK_HEIGHT * 0.55} ${-HOOK_WIDTH * 0.35},${-HOOK_HEIGHT} ${-HOOK_WIDTH},${-HOOK_HEIGHT} ` +
  // Tip: short flat segment so the point has finite width.
  `L ${-HOOK_WIDTH + 5},${-HOOK_HEIGHT + 4} ` +
  // Inner edge: tip → curls back down to the trunk's top-right corner,
  // staying above and to the right of the outer arc to define the body.
  `C ${-HOOK_WIDTH * 0.45},${-HOOK_HEIGHT * 0.35} ${TRUNK_WIDTH},${-HOOK_HEIGHT * 0.15} ${TRUNK_WIDTH},0 ` +
  `Z`;

/**
 * Create an SVG group representing a square staff bracket.
 * @param {Object} options
 * @param {number} [options.height=200] - Total height the bracket spans
 * @returns {SVGGElement}
 */
export function createBracket({ height = DEFAULT_HEIGHT } = {}) {
  const group = createGroup('bracket');

  // Trunk: filled rectangle.
  const trunk = createSvgElement('rect', {
    x: 0,
    y: 0,
    width: TRUNK_WIDTH,
    height,
    fill: 'currentColor',
    stroke: 'none',
  });
  group.appendChild(trunk);

  // Top hook.
  const topHook = createPath(TOP_HOOK_PATH, {
    fill: 'currentColor',
    stroke: 'none',
    'fill-rule': 'evenodd',
  });
  group.appendChild(topHook);

  // Bottom hook: same path mirrored vertically and translated to bracket bottom.
  const bottomHook = createPath(TOP_HOOK_PATH, {
    fill: 'currentColor',
    stroke: 'none',
    'fill-rule': 'evenodd',
  });
  bottomHook.setAttribute('transform', `translate(0, ${height}) scale(1, -1)`);
  group.appendChild(bottomHook);

  return group;
}
