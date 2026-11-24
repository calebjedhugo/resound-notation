/**
 * Augmentation dots — one, or two for a double dot (`dotted: 2`), in a row
 * to the right of a notehead or rest. Gould ("Behind Bars", pp. 56-57):
 * each further dot follows the first at the same clear gap, on the same
 * space. The caller places the FIRST dot (its centre: x, y in the parent
 * group's coordinates); the rest step right by a dot's width plus that gap.
 */

import {
  createSmuflGlyph,
  SMUFL_SCALE,
  AUGMENTATION_DOT_GLYPH,
} from '../assets/glyphs.js';
import { LINE_SPACING } from '../lib/engravingDefaults.js';

/** A dot's diameter in layout units (Bravura augmentationDot). */
export const DOT_DIAMETER =
  (AUGMENTATION_DOT_GLYPH.bbox.xMax - AUGMENTATION_DOT_GLYPH.bbox.xMin) * SMUFL_SCALE;

/** Centre-to-centre distance between successive dots: a diameter + a quarter space. */
export const DOT_STEP = DOT_DIAMETER + LINE_SPACING / 4;

/**
 * Append `count` augmentation dots to `group`, the first centred at (x, y).
 * @param {SVGGElement} group
 * @param {number} count - 0, 1 or 2 (lib/durationSymbols dotCount)
 * @param {number} x - first dot's centre x
 * @param {number} y - the dots' centre y
 * @returns {SVGGElement} group
 */
export function appendAugmentationDots(group, count, x, y) {
  for (let i = 0; i < count; i += 1) {
    const dot = createSmuflGlyph(AUGMENTATION_DOT_GLYPH, 'augmentation-dot');
    dot.setAttribute('transform', `translate(${x + i * DOT_STEP}, ${y})`);
    group.appendChild(dot);
  }
  return group;
}
