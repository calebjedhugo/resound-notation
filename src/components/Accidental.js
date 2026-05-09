/**
 * Accidental symbol renderer.
 * Wraps public-domain glyph paths from src/assets/glyphs.js so the
 * accidentals look the same in every browser regardless of system fonts.
 * Sharps and naturals span ~3 staff spaces; flats span ~2.5.
 */

import { createGlyph, SHARP_GLYPH, FLAT_GLYPH, NATURAL_GLYPH } from '../assets/glyphs.js';

const GLYPHS = {
  sharp: { glyph: SHARP_GLYPH, height: 50 },
  flat: { glyph: FLAT_GLYPH, height: 44 },
  natural: { glyph: NATURAL_GLYPH, height: 50 },
};

/**
 * Create an SVG group representing an accidental symbol.
 * @param {string} type - "sharp", "flat", or "natural"
 * @returns {SVGGElement}
 */
export function createAccidental(type) {
  const entry = GLYPHS[type];
  if (!entry) {
    throw new Error(`Unknown accidental type: "${type}"`);
  }
  return createGlyph(entry.glyph, entry.height, `accidental ${type}`);
}
