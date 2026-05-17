/**
 * Bravura/SMuFL `engravingDefaults` translated to pixel values at our
 * canonical staff scale (LINE_SPACING = 20px, i.e. 1 staff space = 20px).
 *
 * Gould "Behind Bars" defers to these for barline weights — the Bravura
 * font metadata is the modern authority.
 */

// Staff space → pixels.
export const LINE_SPACING = 20;

// staffLineThickness = 0.13 spaces — the five horizontal lines of the
// staff. Without an explicit thickness, SVG defaults to 1px and the
// staff lines read as anemic next to the Bravura-weighted stems (2.4),
// ledger lines (3.2), and barlines (3.2/10).
export const STAFF_LINE_THICKNESS = 0.13 * LINE_SPACING; // 2.6

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

// hairpinThickness = 0.16 spaces — the two diverging lines of a
// crescendo/decrescendo wedge. Matches thinBarlineThickness per Bravura;
// Gould groups these as "line on staff" elements at the same weight.
export const HAIRPIN_THICKNESS = 0.16 * LINE_SPACING; // 3.2

// repeatEndingLineThickness = 0.16 spaces — the bracket of a volta
// (1./2. ending). Same Bravura weight as a thin barline.
export const VOLTA_LINE_THICKNESS = 0.16 * LINE_SPACING; // 3.2

// slurMidpointThickness = 0.22 spaces — the rendered apex weight of a
// slur arc. With LINE_SPACING = 20 px that's 4.4 px, which sits clearly
// heavier than the 2.6 px staff lines and gives the curve a visible
// teardrop instead of a uniform-looking stroke. Slurs are filled
// closed shapes whose apex sits at 0.75 × the control-point offset
// between the outer and inner Beziers, so consumers should derive
// the control offset as MIDPOINT_THICKNESS / 0.75.
export const SLUR_MIDPOINT_THICKNESS = 0.22 * LINE_SPACING; // 4.4

// tieMidpointThickness = 0.22 spaces — Bravura assigns ties the same
// midpoint weight as slurs. Same closed-shape / apex-0.75× rule.
export const TIE_MIDPOINT_THICKNESS = 0.22 * LINE_SPACING; // 4.4

// Repeat-barline dot edge offset from the heavy stroke's x — derived
// from RepeatBarline.js geometry: barlineSeparation (8) + dot gap (5) +
// dot radius (2.5). The dots sit on the INSIDE of the barline, so this
// is the visible extent past the group's transform x toward the music.
export const REPEAT_BARLINE_DOT_EDGE_OFFSET =
  BARLINE_SEPARATION + 5 + 2.5; // 15.5

// Gould "Behind Bars" (Repeats) sets a 0.5-staff-space minimum gap
// between repeat-barline dots and any adjacent notehead. Finale,
// Sibelius and Lilypond defaults land closer to 1 full staff space —
// the dots read as clearly separated from the music rather than
// jammed against it. Pick the looser convention; still applied past
// the dot's right edge (start-repeat) and before the dot's left edge
// (end-repeat).
export const REPEAT_BARLINE_INNER_PAD = 1.0 * LINE_SPACING; // 20
