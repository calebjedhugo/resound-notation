/**
 * Tie arc renderer.
 * Creates SVG path elements for tie arcs between noteheads.
 *
 * Engraver-quality ties — like slurs — are filled shapes formed from two
 * cubic Beziers joined into a closed region. Ties are typically flatter
 * than slurs (smaller arc, shorter span) and slightly thinner in the middle.
 */

import { createPath } from '../lib/svgHelpers.js';
import { TIE_MIDPOINT_THICKNESS } from '../lib/engravingDefaults.js';

// Distance (px) from notehead CENTER to tie endpoint. Notehead
// half-height is ~10 px; 13 puts the tie 3 px clear of the head edge so
// it hovers just outside instead of biting into the notehead.
const NOTEHEAD_OFFSET = 13;
// Long-tie flattening (SPEC-lyric-spacing.md JOB 3). Engraving practice
// keeps long ties SHALLOW — arc height grows sub-linearly with span and
// caps out, instead of the old linear max(8, 0.2 * span) whose
// cross-barline ties ballooned (a 300px tie got a 60px arc):
//   arcHeight = clamp(MIN_ARC_HEIGHT, K * span^ARC_EXPONENT, MAX_ARC_HEIGHT)
// Constants are chosen so SHORT ties render EXACTLY as before: the old
// formula sat at the 8px floor for every span <= 40px (~1.7 notehead
// widths — "a couple of noteheads apart"), and K = 8 / 40^0.6 puts the
// power branch below the floor over that whole region, with C0 continuity
// at 40px. The cap engages at (14/K)^(1/0.6) ≈ 102px.
const MIN_ARC_HEIGHT = 8;
const MAX_ARC_HEIGHT = 14;
const ARC_EXPONENT = 0.6;
const SHORT_SPAN_REF = 40; // px — end of the old formula's floor region
const ARC_K = MIN_ARC_HEIGHT / Math.pow(SHORT_SPAN_REF, ARC_EXPONENT);
// Control-point offset between outer and inner Bezier curves. Rendered apex
// thickness is ~3/4 of this (Bezier apex sits at 0.75 × control-Y offset),
// so THICKNESS = MIDPOINT / 0.75. Bravura tieMidpointThickness = 0.22
// spaces = 4.4 px → 4.4 / 0.75 ≈ 5.87.
const THICKNESS = TIE_MIDPOINT_THICKNESS / 0.75;

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
  const arcHeight = Math.min(
    MAX_ARC_HEIGHT,
    Math.max(MIN_ARC_HEIGHT, ARC_K * Math.pow(horizontalDistance, ARC_EXPONENT))
  );

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
