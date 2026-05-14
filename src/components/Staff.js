/**
 * Staff line renderer.
 * Creates 5 horizontal staff lines with 20px spacing (80px total height).
 */

import { createGroup, createLine } from '../lib/svgHelpers.js';
import { STAFF_LINE_THICKNESS, THIN_BARLINE_THICKNESS } from '../lib/engravingDefaults.js';

const LINE_COUNT = 5;
const LINE_SPACING = 20;

/**
 * Create a group of 5 staff lines.
 * Lines are at y = 0, 20, 40, 60, 80 within the group.
 * @param {number} width - Width of staff lines in pixels
 * @returns {SVGGElement}
 */
export function createStaffLines(width) {
  const group = createGroup('staff-lines');

  for (let i = 0; i < LINE_COUNT; i++) {
    const y = i * LINE_SPACING;
    group.appendChild(
      createLine(0, y, width, y, {
        class: 'staff-line',
        stroke: 'currentColor',
        // Bravura engravingDefaults.staffLineThickness = 0.13 spaces = 2.6px.
        'stroke-width': STAFF_LINE_THICKNESS,
      })
    );
  }

  // System-start (initial) barline: thin vertical at x=0 spanning the
  // staff lines (top to bottom). For grouped staves (brace/bracket), a
  // taller shared line is drawn on top and visually merges with this one.
  const bottomY = (LINE_COUNT - 1) * LINE_SPACING;
  group.appendChild(
    createLine(0, 0, 0, bottomY, {
      class: 'system-start-bar-line',
      stroke: 'currentColor',
      // Bravura engravingDefaults.thinBarlineThickness = 0.16 spaces = 3.2px.
      'stroke-width': THIN_BARLINE_THICKNESS,
    })
  );

  return group;
}
