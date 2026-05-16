/**
 * Repeat barline renderer.
 * Creates SVG elements for repeat-start, repeat-end, repeat-both, and final barlines.
 */

import { createGroup, createLine, createSvgElement } from '../lib/svgHelpers.js';
import {
  THIN_BARLINE_THICKNESS,
  THICK_BARLINE_THICKNESS,
  BARLINE_SEPARATION,
} from '../lib/engravingDefaults.js';

const TOP_LINE_Y = 10;
const BOTTOM_LINE_Y = 90;
const DOT_Y_UPPER = 40;
const DOT_Y_LOWER = 60;
const DOT_RADIUS = 2.5;
// Bravura engravingDefaults:
//   barlineSeparation     = 0.4 spaces = 8px (center-to-center)
//   thinBarlineThickness  = 0.16 spaces = 3.2px
//   thickBarlineThickness = 0.5 spaces = 10px
// Old values (5/1/3) read as a single chunky stroke; the thin line blended
// into the staff lines and the separation was visually swallowed.
const LINE_GAP = BARLINE_SEPARATION;
const DOT_GAP = 5;
const THICK_WIDTH = THICK_BARLINE_THICKNESS;
const THIN_WIDTH = THIN_BARLINE_THICKNESS;

function createDot(cx, cy) {
  return createSvgElement('circle', {
    class: 'barline-dot',
    cx,
    cy,
    r: DOT_RADIUS,
    fill: 'currentColor',
  });
}

/**
 * Render a repeat barline.
 * @param {Object} params
 * @param {string} params.type - "repeat-start", "repeat-end", "repeat-both", or "final"
 * @param {number} params.x - Horizontal position
 * @param {number} [params.topY] - Optional override for the top y of the vertical lines.
 *   Used when bridging across multiple staves of a braced group; the barline group's
 *   `transform` only translates x (lines carry their absolute y), so callers should
 *   pass absolute coordinates here.
 * @param {number} [params.bottomY] - Optional override for the bottom y.
 * @returns {SVGGElement}
 */
export function renderRepeatBarline({ type, x, topY, bottomY }) {
  const top = topY !== undefined ? topY : TOP_LINE_Y;
  const bot = bottomY !== undefined ? bottomY : BOTTOM_LINE_Y;
  const group = createGroup(`barline barline-${type}`, {
    transform: `translate(${x}, 0)`,
  });

  if (type === 'repeat-start') {
    // thick-thin + dots on right
    group.appendChild(
      createLine(0, top, 0, bot, {
        class: 'barline-thick',
        stroke: 'currentColor',
        'stroke-width': THICK_WIDTH,
      })
    );
    group.appendChild(
      createLine(LINE_GAP, top, LINE_GAP, bot, {
        class: 'barline-thin',
        stroke: 'currentColor',
        'stroke-width': THIN_WIDTH,
      })
    );
    group.appendChild(createDot(LINE_GAP + DOT_GAP, DOT_Y_UPPER));
    group.appendChild(createDot(LINE_GAP + DOT_GAP, DOT_Y_LOWER));
  } else if (type === 'repeat-end') {
    // dots on left, thin-thick
    group.appendChild(createDot(-LINE_GAP - DOT_GAP, DOT_Y_UPPER));
    group.appendChild(createDot(-LINE_GAP - DOT_GAP, DOT_Y_LOWER));
    group.appendChild(
      createLine(-LINE_GAP, top, -LINE_GAP, bot, {
        class: 'barline-thin',
        stroke: 'currentColor',
        'stroke-width': THIN_WIDTH,
      })
    );
    group.appendChild(
      createLine(0, top, 0, bot, {
        class: 'barline-thick',
        stroke: 'currentColor',
        'stroke-width': THICK_WIDTH,
      })
    );
  } else if (type === 'repeat-both') {
    // dots-thin-thick-thin-dots
    group.appendChild(createDot(-LINE_GAP - DOT_GAP, DOT_Y_UPPER));
    group.appendChild(createDot(-LINE_GAP - DOT_GAP, DOT_Y_LOWER));
    group.appendChild(
      createLine(-LINE_GAP, top, -LINE_GAP, bot, {
        class: 'barline-thin',
        stroke: 'currentColor',
        'stroke-width': THIN_WIDTH,
      })
    );
    group.appendChild(
      createLine(0, top, 0, bot, {
        class: 'barline-thick',
        stroke: 'currentColor',
        'stroke-width': THICK_WIDTH,
      })
    );
    group.appendChild(
      createLine(LINE_GAP, top, LINE_GAP, bot, {
        class: 'barline-thin',
        stroke: 'currentColor',
        'stroke-width': THIN_WIDTH,
      })
    );
    group.appendChild(createDot(LINE_GAP + DOT_GAP, DOT_Y_UPPER));
    group.appendChild(createDot(LINE_GAP + DOT_GAP, DOT_Y_LOWER));
  } else if (type === 'final') {
    // thin-thick (no dots)
    group.appendChild(
      createLine(-LINE_GAP, top, -LINE_GAP, bot, {
        class: 'barline-thin',
        stroke: 'currentColor',
        'stroke-width': THIN_WIDTH,
      })
    );
    group.appendChild(
      createLine(0, top, 0, bot, {
        class: 'barline-thick',
        stroke: 'currentColor',
        'stroke-width': THICK_WIDTH,
      })
    );
  }

  return group;
}
