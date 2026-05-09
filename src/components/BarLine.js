/**
 * Bar line renderer.
 * Creates a vertical line spanning the staff.
 */

import { createGroup, createLine } from '../lib/svgHelpers.js';

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
      // Engraving convention: barlines are slightly thicker than staff
      // lines so they read as section breaks rather than blending in.
      'stroke-width': '1.5',
    })
  );
  return group;
}
