/**
 * Accidental renderer.
 * Wraps SMuFL Bravura accidental glyphs (sharp, flat, natural,
 * doubleSharp, doubleFlat). The glyph's y=0 is the staff line/space
 * the accidental modifies; caller positions via translate(x, pitchY).
 */

import { createSmuflGlyph, ACCIDENTAL_GLYPHS, SMUFL_SCALE } from '../assets/glyphs.js';
import { createGroup } from '../lib/svgHelpers.js';

/**
 * Create an SVG group representing an accidental symbol.
 * @param {string} type - "sharp", "flat", "natural", "doubleSharp", "doubleFlat"
 * @returns {SVGGElement}
 */
export function createAccidental(type) {
  if (type === 'doubleFlat') {
    // The doubleFlat outline in our asset dump is corrupt (truncated path —
    // the right flat's descender and bowl sweep are missing, which rendered
    // as a chopped-off artifact). Engraving-wise the glyph IS two flats set
    // side by side at the font's 411-unit advance, so compose it from the
    // intact flat glyph; the declared bbox stays authoritative for width.
    const wrapper = createGroup('accidental doubleFlat');
    const flat = ACCIDENTAL_GLYPHS.flat;
    const bb = ACCIDENTAL_GLYPHS.doubleFlat.bbox;
    const flatW = flat.bbox.xMax - flat.bbox.xMin;
    const shift = (((bb.xMax - bb.xMin) - flatW) / 2) * SMUFL_SCALE;
    const left = createSmuflGlyph(flat, '');
    left.setAttribute('transform', `translate(${-shift}, 0)`);
    const right = createSmuflGlyph(flat, '');
    right.setAttribute('transform', `translate(${shift}, 0)`);
    wrapper.appendChild(left);
    wrapper.appendChild(right);
    return wrapper;
  }
  const glyph = ACCIDENTAL_GLYPHS[type];
  if (!glyph) throw new Error(`Unknown accidental type: "${type}"`);
  return createSmuflGlyph(glyph, `accidental ${type}`);
}

/** Rendered width (px) of an accidental glyph, from its font bbox. */
export function accidentalWidth(type) {
  const glyph = ACCIDENTAL_GLYPHS[type];
  if (!glyph) return 0;
  return (glyph.bbox.xMax - glyph.bbox.xMin) * SMUFL_SCALE;
}
