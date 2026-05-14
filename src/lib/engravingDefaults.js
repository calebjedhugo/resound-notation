/**
 * Bravura/SMuFL `engravingDefaults` translated to pixel values at our
 * canonical staff scale (LINE_SPACING = 20px, i.e. 1 staff space = 20px).
 *
 * Gould "Behind Bars" defers to these for barline weights — the Bravura
 * font metadata is the modern authority.
 */

// Staff space → pixels.
export const LINE_SPACING = 20;

// thinBarlineThickness = 0.16 spaces — regular barlines, system-start
// barlines, and the thin stroke of final/repeat barlines. Without an
// explicit thickness, SVG defaults to 1px which blends into the staff lines.
export const THIN_BARLINE_THICKNESS = 0.16 * LINE_SPACING; // 3.2

// thickBarlineThickness = 0.5 spaces — the heavy stroke at the end of a
// piece and around repeat barlines.
export const THICK_BARLINE_THICKNESS = 0.5 * LINE_SPACING; // 10

// barlineSeparation = 0.4 spaces — distance between the centers of the
// thin and thick lines in a final/repeat barline. Without this, the two
// strokes mash into one chunky bar.
export const BARLINE_SEPARATION = 0.4 * LINE_SPACING; // 8
