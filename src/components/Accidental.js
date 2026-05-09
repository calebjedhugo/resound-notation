/**
 * Accidental renderer.
 * Wraps SMuFL Bravura accidental glyphs (sharp, flat, natural,
 * doubleSharp, doubleFlat). The glyph's y=0 is the staff line/space
 * the accidental modifies; caller positions via translate(x, pitchY).
 */

import { createSmuflGlyph, ACCIDENTAL_GLYPHS } from '../assets/glyphs.js';

/**
 * Create an SVG group representing an accidental symbol.
 * @param {string} type - "sharp", "flat", "natural", "doubleSharp", "doubleFlat"
 * @returns {SVGGElement}
 */
export function createAccidental(type) {
  const glyph = ACCIDENTAL_GLYPHS[type];
  if (!glyph) throw new Error(`Unknown accidental type: "${type}"`);
  return createSmuflGlyph(glyph, `accidental ${type}`);
}
