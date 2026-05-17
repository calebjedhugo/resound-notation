/**
 * Volta ending (bracket) renderer.
 * Creates SVG elements for volta brackets with ending numbers.
 */

import { createGroup, createPath, createText } from '../lib/svgHelpers.js';
import { VOLTA_LINE_THICKNESS } from '../lib/engravingDefaults.js';

// Default bracket Y when nothing in the ending's span rises above the
// staff. Per Gould "Behind Bars" (Voltas): the bracket reads as "above
// the staff" — so park it ≥1.25 staff space above the top staff line
// (staff top sits at y=10 in the staff's local coords; bracket at -15
// = 1.25 spaces above). Callers may pass a lower (more-negative) value
// to clear high notes; renderEnding never moves the bracket DOWN.
const BRACKET_DEFAULT_Y = -15;
const TICK_HEIGHT = 10;
const TEXT_OFFSET_X = 5;
// "1." / "2." labels sit a small gap above the bracket's horizontal
// line so they read as clearly separated from the line. The labels
// rise/fall with the bracket as a unit.
const TEXT_GAP_ABOVE_BRACKET = 6;

/**
 * Render a volta ending bracket.
 * @param {Object} params
 * @param {number} params.number - Ending number (1, 2, etc.)
 * @param {number} params.startX - Start X position
 * @param {number} params.endX - End X position
 * @param {boolean} params.open - True for open bracket (no end tick)
 * @param {number} [params.bracketY] - Y of the bracket's horizontal
 *   line in the staff's local coords (negative = above staff top).
 *   Defaults to BRACKET_DEFAULT_Y. Callers compute a lower value when
 *   notes/stems/ledgers in the span rise above the staff (Gould
 *   "Behind Bars", Voltas: ≥1 staff space clearance above the topmost
 *   visual element).
 * @returns {SVGGElement}
 */
export function renderEnding({ number, startX, endX, open, bracketY }) {
  const BRACKET_Y = bracketY !== undefined
    ? Math.min(BRACKET_DEFAULT_Y, bracketY)
    : BRACKET_DEFAULT_Y;
  const TEXT_Y = BRACKET_Y - TEXT_GAP_ABOVE_BRACKET;
  const group = createGroup(`ending ending-${number}`, {
    'data-ending-number': String(number),
  });

  const tickBottom = BRACKET_Y + TICK_HEIGHT;
  let d;

  if (open) {
    // Open bracket: tick at start, horizontal line, no end tick
    d = `M${startX},${tickBottom} L${startX},${BRACKET_Y} L${endX},${BRACKET_Y}`;
  } else {
    // Closed bracket: tick at start, horizontal line, tick at end
    d = `M${startX},${tickBottom} L${startX},${BRACKET_Y} L${endX},${BRACKET_Y} L${endX},${tickBottom}`;
  }

  const bracketClass = open ? 'ending-bracket ending-bracket-open' : 'ending-bracket';
  group.appendChild(
    createPath(d, {
      class: bracketClass,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(VOLTA_LINE_THICKNESS),
    })
  );

  group.appendChild(
    createText(`${number}.`, startX + TEXT_OFFSET_X, TEXT_Y, {
      class: 'ending-number',
      'font-size': '12',
      'font-style': 'italic',
      fill: 'currentColor',
    })
  );

  return group;
}
