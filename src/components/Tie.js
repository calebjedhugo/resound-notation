/**
 * Tie arc renderer.
 * Creates SVG path elements for tie arcs between noteheads.
 *
 * Engraver-quality ties — like slurs — are filled shapes formed from two
 * cubic Beziers joined into a closed region. Ties are typically flatter
 * than slurs (smaller arc, shorter span) and slightly thinner in the middle.
 */

import { createPath } from '../lib/svgHelpers.js';

// Distance (px) from notehead CENTER to tie endpoint. Notehead
// half-height is ~10 px; 13 puts the tie 3 px clear of the head edge so
// it hovers just outside instead of biting into the notehead.
const NOTEHEAD_OFFSET = 13;
const MIN_ARC_HEIGHT = 8;
const ARC_HEIGHT_RATIO = 0.2;
// Control-point offset between outer and inner Bezier curves. Rendered apex
// thickness is ~3/4 of this, so THICKNESS = 2.0 yields ~1.5 px middle
// thickness — slightly thinner than slurs, as engravers conventionally render.
const THICKNESS = 2.0;

/**
 * Create an SVG path element for a tie arc.
 * @param {Object} params
 * @param {number} params.x1 - Start notehead X
 * @param {number} params.y1 - Start notehead Y
 * @param {number} params.x2 - End notehead X
 * @param {number} params.y2 - End notehead Y
 * @param {string} params.direction - "above" or "below"
 * @returns {SVGPathElement}
 */
export function createTieArc({ x1, y1, x2, y2, direction }) {
  const dir = direction === 'below' ? 1 : -1;
  const startY = y1 + NOTEHEAD_OFFSET * dir;
  const endY = y2 + NOTEHEAD_OFFSET * dir;

  const horizontalDistance = Math.abs(x2 - x1);
  const arcHeight = Math.max(MIN_ARC_HEIGHT, horizontalDistance * ARC_HEIGHT_RATIO);

  const midX1 = x1 + (x2 - x1) * 0.33;
  const midX2 = x1 + (x2 - x1) * 0.67;

  const outerCp1Y = startY + arcHeight * dir;
  const outerCp2Y = endY + arcHeight * dir;
  const innerCp1Y = startY + (arcHeight - THICKNESS) * dir;
  const innerCp2Y = endY + (arcHeight - THICKNESS) * dir;

  const d =
    `M ${x1} ${startY} ` +
    `C ${midX1} ${outerCp1Y} ${midX2} ${outerCp2Y} ${x2} ${endY} ` +
    `C ${midX2} ${innerCp2Y} ${midX1} ${innerCp1Y} ${x1} ${startY} Z`;

  return createPath(d, {
    class: 'tie',
    fill: 'currentColor',
    stroke: 'none',
  });
}
