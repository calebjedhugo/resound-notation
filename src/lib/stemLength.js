/**
 * Stem-length lower bound for ledger-line notes.
 *
 * Default stem length is one octave / 3.5 staff spaces (STEM_LENGTH = 70px
 * at LINE_SPACING = 20). Per Gould "Behind Bars" (Stems) and Ross "The Art
 * of Music Engraving": for notes that sit far enough out on ledger lines
 * the stem must be LENGTHENED so its tip reaches AT LEAST the middle line
 * of the staff. It is a lower bound only — a note close to the staff keeps
 * the normal 3.5-space stem; only notes whose normal tip would fall short
 * of the middle line get the extension.
 *
 * Up-stems on low ledger notes reach up to the middle line; down-stems on
 * high ledger notes reach down to the middle line.
 *
 * Coordinate system: staff-y in local pixels where the MIDDLE line sits at
 * MIDDLE_LINE_Y (50) and 1 staff space = 20px. The stem attaches at the
 * notehead's long-axis tip (`attachY`) and runs outward by the returned
 * length — toward smaller y for stem-up, larger y for stem-down.
 *
 * @param {Object} params
 * @param {number} params.attachY - The y of the stem's head end (the tip
 *   vertex of the governing notehead — highest head for stem-up, lowest
 *   for stem-down).
 * @param {boolean} params.stemDown
 * @param {number} params.baseLength - The default stem length (STEM_LENGTH).
 * @param {number} [params.middleLineY] - Staff middle-line y. Default 50.
 * @returns {number} The effective stem length (≥ baseLength).
 */
export function effectiveStemLength({ attachY, stemDown, baseLength, middleLineY = 50 }) {
  // Length required for the tip to just reach the middle line. For stem-up
  // (tip at attachY − L) the tip reaches middleLineY when L = attachY −
  // middleLineY; for stem-down (tip at attachY + L) when L = middleLineY −
  // attachY. Notes near/above the middle line yield a value ≤ baseLength,
  // so the default length dominates and nothing is shortened.
  const toMiddle = stemDown ? middleLineY - attachY : attachY - middleLineY;
  return Math.max(baseLength, toMiddle);
}
