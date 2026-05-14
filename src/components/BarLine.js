/**
 * Bar line renderer.
 * Creates a vertical line spanning the staff.
 */

import { createGroup, createLine } from '../lib/svgHelpers.js';
import { THIN_BARLINE_THICKNESS } from '../lib/engravingDefaults.js';

// Staff line positions in staff-group coordinates
const TOP_LINE_Y = 10;
const BOTTOM_LINE_Y = 90;

/**
 * Create an SVG group representing a bar line.
 * @param {number} x - Horizontal position
 * @returns {SVGGElement}
 */
export function createBarLine(x) {
  const group = createGroup('bar-line');
  group.appendChild(
    createLine(x, TOP_LINE_Y, x, BOTTOM_LINE_Y, {
      stroke: 'currentColor',
      // Bravura engravingDefaults.thinBarlineThickness = 0.16 spaces
      // (= 3.2px at LINE_SPACING=20). The SVG default of 1px reads as
      // a staff-line lookalike and the section break disappears.
      'stroke-width': THIN_BARLINE_THICKNESS,
    })
  );
  return group;
}
