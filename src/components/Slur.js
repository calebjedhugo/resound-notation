/**
 * Slur arc renderer.
 * Creates SVG path elements for slur arcs between note groups.
 *
 * Engraver-quality slurs are filled shapes — two cubic Beziers joined into a
 * closed region. The outer curve defines the arc, the inner curve runs back
 * with control points pushed slightly toward the endpoints so the gap between
 * the two curves is widest at the apex (the "middle thickness") and tapers
 * smoothly to zero at the endpoints.
 */

import { createPath } from '../lib/svgHelpers.js';

const NOTEHEAD_OFFSET = 6;
const BASE_HEIGHT = 15;
const SPAN_FACTOR = 0.15;
const MAX_ARC_HEIGHT = 40;
// Control-point offset between outer and inner Bezier curves. The actual
// rendered apex thickness is ~3/4 of this value (Bezier apex sits at 3h/4 for
// a symmetric curve), so THICKNESS = 2.6 yields ~1.95 px middle thickness —
// roughly 0.10 staff space, squarely in the engravers' 0.08–0.11 range.
const THICKNESS = 2.6;

/**
 * Create an SVG path element for a slur arc.
 * @param {Object} params
 * @param {number} params.x1 - Start note X
 * @param {number} params.y1 - Start note Y
 * @param {number} params.x2 - End note X
 * @param {number} params.y2 - End note Y
 * @param {string} params.direction - "above" or "below"
 * @param {number} [params.depth] - Nesting depth (0 = outer, 1 = inner)
 * @returns {SVGPathElement}
 */
export function createSlurArc({ x1, y1, x2, y2, direction, depth = 0 }) {
  const dir = direction === 'below' ? 1 : -1;
  const startY = y1 + NOTEHEAD_OFFSET * dir;
  const endY = y2 + NOTEHEAD_OFFSET * dir;

  const horizontalDistance = Math.abs(x2 - x1);
  let arcHeight = Math.min(BASE_HEIGHT + horizontalDistance * SPAN_FACTOR, MAX_ARC_HEIGHT);

  // Inner slurs get a tighter curve
  if (depth > 0) {
    arcHeight *= 0.6;
  }

  const cp1x = x1 + (x2 - x1) * 0.33;
  const cp2x = x1 + (x2 - x1) * 0.67;

  // Outer Bezier control points — full arcHeight away from the chord line.
  const outerCp1Y = startY + arcHeight * dir;
  const outerCp2Y = endY + arcHeight * dir;

  // Inner Bezier control points — pushed back toward the chord line by
  // THICKNESS, giving the slur its tapered middle thickness.
  const innerCp1Y = startY + (arcHeight - THICKNESS) * dir;
  const innerCp2Y = endY + (arcHeight - THICKNESS) * dir;

  // Closed filled path: outer curve forward, inner curve reversed back.
  const d =
    `M ${x1} ${startY} ` +
    `C ${cp1x} ${outerCp1Y} ${cp2x} ${outerCp2Y} ${x2} ${endY} ` +
    `C ${cp2x} ${innerCp2Y} ${cp1x} ${innerCp1Y} ${x1} ${startY} Z`;

  const classes = ['slur'];
  if (depth === 0) classes.push('slur-outer');
  if (depth > 0) classes.push('slur-inner');

  return createPath(d, {
    class: classes.join(' '),
    fill: 'currentColor',
    stroke: 'none',
  });
}
