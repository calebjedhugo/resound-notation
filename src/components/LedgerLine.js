/**
 * Ledger line renderer.
 * Creates ledger lines for notes above or below the staff.
 */

import { createGroup, createLine } from '../lib/svgHelpers.js';

// Staff lines in absolute coords: y = 10, 30, 50, 70, 90
const TOP_LINE_Y = 10;
const BOTTOM_LINE_Y = 90;
const LINE_STEP = 20;

// First ledger line positions extending the staff pattern
const FIRST_LEDGER_ABOVE = TOP_LINE_Y - LINE_STEP; // y = -10
const FIRST_LEDGER_BELOW = BOTTOM_LINE_Y + LINE_STEP; // y = 110

// Bravura engravingDefaults at LINE_SPACING=20px:
//   legerLineExtension = 0.4 spaces = 8px past each notehead edge
//   legerLineThickness = 0.16 spaces = 3.2px
// noteheadBlack is ~23.6px wide → half-width 11.8px; add 8px extension
// each side ⇒ half-width 19.8px, total span ~39.6px.
const NOTEHEAD_HALF_WIDTH = 11.8;
const LEGER_EXTENSION = 8;
const LEDGER_HALF_WIDTH = NOTEHEAD_HALF_WIDTH + LEGER_EXTENSION;
const LEDGER_THICKNESS = 3.2;

/**
 * Create ledger lines for a note at the given position.
 * Returns null if no ledger lines are needed.
 *
 * @param {Object} params
 * @param {number} params.x - Note horizontal center position
 * @param {number} params.y - Note absolute Y coordinate
 * @returns {SVGGElement|null}
 */
export function createLedgerLines({ x, y }) {
  const lines = [];

  if (y <= FIRST_LEDGER_ABOVE) {
    // Notes above the staff
    for (let lineY = FIRST_LEDGER_ABOVE; lineY >= y; lineY -= LINE_STEP) {
      lines.push(lineY);
    }
  } else if (y >= FIRST_LEDGER_BELOW) {
    // Notes below the staff
    for (let lineY = FIRST_LEDGER_BELOW; lineY <= y; lineY += LINE_STEP) {
      lines.push(lineY);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  const group = createGroup('ledger-lines');

  for (const lineY of lines) {
    group.appendChild(
      createLine(x - LEDGER_HALF_WIDTH, lineY, x + LEDGER_HALF_WIDTH, lineY, {
        class: 'ledger-line',
        stroke: 'currentColor',
        'stroke-width': LEDGER_THICKNESS,
      })
    );
  }

  return group;
}
