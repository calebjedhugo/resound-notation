/**
 * Key signature renderer.
 * Creates SVG group with accidental symbols at standard staff positions.
 */

import { createGroup } from '../lib/svgHelpers.js';
import { createAccidental } from './Accidental.js';
import { getKeySignature } from '../lib/keySignatures.js';
import { pitchToStaffY } from '../lib/notePositions.js';

/**
 * Standard pitch placements for key signature accidentals per clef.
 * Each array has 7 entries matching SHARP_ORDER or FLAT_ORDER.
 */
export const KEY_SIG_POSITIONS = {
  treble: {
    sharp: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'],
    flat: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'],
  },
  bass: {
    sharp: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'],
    flat: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'],
  },
  alto: {
    sharp: ['F4', 'C4', 'G4', 'D4', 'A3', 'E4', 'B3'],
    flat: ['B3', 'E4', 'A3', 'D4', 'G3', 'C4', 'F3'],
  },
  tenor: {
    sharp: ['F3', 'C4', 'G3', 'D4', 'A3', 'E4', 'B3'],
    flat: ['B3', 'E3', 'A3', 'D3', 'G3', 'C3', 'F3'],
  },
};

// Bravura accidentalSharp/Flat are ~20px wide. Gould (Behind Bars pp.
// 90-95) calls for ~1 staff space (20px here) center-to-center for
// non-interlocking accidental pairs; 18 (~0.9 staff space) is the
// safe-across-the-board value since sharps/flats are designed to nest
// vertically. 14 was too tight — flat bodies visually touched.
const ACCIDENTAL_SPACING = 18;
// SMuFL accidentals are centered on their x=0; offset the first glyph by
// half its width so the key-sig group's left edge sits at parent x=0
// (i.e. the accidental doesn't extend left of the caller's translate).
const ACCIDENTAL_LEAD = 10;
// Half-width of a Bravura sharp/flat glyph, used so the cursor advance
// past the key signature covers the right edge of the last glyph (whose
// center sits at the last ACCIDENTAL_SPACING step), not just its center.
const ACCIDENTAL_HALF_WIDTH = 10;
// Trailing pad (px) after the last key-sig accidental before the next
// glyph (time-sig or first note). The cursor advance lands at the next
// glyph's CENTER, but downstream glyphs (noteheads especially) extend
// ~12px to the left of that center, so a 14px pad collapses to ~2px of
// visible gap. Use 32 = ~12 (notehead half-width) + 20 (≈1 staff space)
// so the visible gap between the last accidental's right edge and the
// next glyph's left edge is roughly one staff space.
const KEY_SIG_TRAILING_PAD = 32;

/**
 * Total horizontal advance (px) for a key signature of `count`
 * accidentals, measured from the caller's cursor to where the next
 * glyph (time-sig or first note) should be placed.
 *
 * Geometry: ACCIDENTAL_LEAD positions the first glyph's center;
 * each additional glyph adds ACCIDENTAL_SPACING; the last glyph's
 * right edge sits ACCIDENTAL_HALF_WIDTH beyond its center; then a
 * KEY_SIG_TRAILING_PAD of breathing room.
 *
 * @param {number} count
 * @returns {number}
 */
export function keySignatureAdvance(count) {
  if (count <= 0) return 0;
  return (
    ACCIDENTAL_LEAD +
    (count - 1) * ACCIDENTAL_SPACING +
    ACCIDENTAL_HALF_WIDTH +
    KEY_SIG_TRAILING_PAD
  );
}

/**
 * Create an SVG group representing a key signature.
 * Returns null if the key has no accidentals (key of C).
 *
 * @param {string} key - Key name (e.g. "G", "Bb", "C")
 * @param {string} clef - Clef type for positioning
 * @returns {SVGGElement|null}
 */
export function createKeySignature(key, clef) {
  const keyInfo = getKeySignature(key);

  if (keyInfo.count === 0) {
    return null;
  }

  const positions = KEY_SIG_POSITIONS[clef];
  if (!positions) {
    throw new Error(`Unsupported clef for key signature: "${clef}"`);
  }

  const pitchList = positions[keyInfo.type];
  const group = createGroup('key-signature');

  for (let i = 0; i < keyInfo.count; i++) {
    const x = ACCIDENTAL_LEAD + i * ACCIDENTAL_SPACING;
    const y = pitchToStaffY(pitchList[i], clef);

    const accGroup = createAccidental(keyInfo.type);
    accGroup.setAttribute('transform', `translate(${x}, ${y})`);
    group.appendChild(accGroup);
  }

  return group;
}
