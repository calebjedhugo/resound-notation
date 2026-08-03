/**
 * Lyric renderer.
 * Creates SVG elements for per-note lyrics, including melisma underscores,
 * stacked verse lines, and verse numbers (SPEC-multi-verse-lyrics.md).
 */

import { createGroup, createText, createLine } from '../lib/svgHelpers.js';

// JOB 5 (SPEC-lyric-engraving-scale.md): LYRIC_BASE_Y raised from the
// legacy 115 to clear a 39px lyric font's ascenders. Derived as
// STAFF_BOTTOM (90, from NotationRenderer's STAFF_TOP_OFFSET +
// STAFF_HEIGHT) + LYRIC_BASELINE_CLEARANCE (36, see NotationRenderer.js) =
// 126. Lyric.js can't import NotationRenderer's private staff constants
// (NotationRenderer already imports FROM here — a cycle), so this is a
// literal kept in sync with that derivation; if either staff geometry or
// the clearance formula changes, recompute this by hand.
const LYRIC_Y = 126;
// Melisma underscores hang this far below their verse line's baseline —
// a fixed 5px drop, unchanged since JOB 4 (not scaled with font size;
// only the baseline it hangs from moved for JOB 5).
const MELISMA_DROP = 5;
const MELISMA_Y = LYRIC_Y + MELISMA_DROP;

// Engraving defaults for lyric text (SPEC-lyric-engraving-scale.md JOB 5
// measures these off real hymnal scans — Amazing Grace and Holy, Holy,
// Holy print pages, cross-checked via cap-height and x-height — rather
// than assuming them; every width heuristic must READ them, never
// hardcode).
//
// fontSize/staffSpace measured 1.93-2.01 across 4 pages (avg 1.97); at
// this renderer's LINE_SPACING = 20px/staff-space, 1.97 x 20 = 39.
export const LYRIC_FONT_SIZE = 39;
// 0.85 x LYRIC_FONT_SIZE, matching the JOB 2 verse-number/lyric ratio.
export const VERSE_NUMBER_FONT_SIZE = 33;

// Width-estimation heuristic (SPEC-lyric-spacing.md JOB 1). jsdom offers no
// text metrics (getComputedTextLength / getBBox return 0), so syllable
// widths are ESTIMATED from character count: the average advance of the
// default serif at lyric sizes is ~0.5 em per character (mixed-case Latin
// text; digits and '.' in verse numbers land close to the same average).
export const LYRIC_CHAR_WIDTH_RATIO = 0.5;

// Ascender reach as a fraction of nominal font size (SPEC-lyric-engraving-
// scale.md JOB 5): measured 16px ascender height ("h"/"d"/"A") against a
// 22.4px nominal font size on the same hymnal pages used for
// LYRIC_FONT_SIZE, i.e. 16/22.43 = 0.71. Used by NotationRenderer's
// staff-clearance math so a verse-1 baseline leaves room for the actual
// glyphs, not just an arbitrary flat pad.
export const LYRIC_ASCENDER_RATIO = 0.71;

/**
 * Estimated rendered width (px) of a lyric string at a given font size.
 * @param {string} text
 * @param {number} [fontSize=LYRIC_FONT_SIZE]
 * @returns {number}
 */
export function estimateLyricWidth(text, fontSize = LYRIC_FONT_SIZE) {
  return String(text).length * LYRIC_CHAR_WIDTH_RATIO * fontSize;
}

// Vertical distance between stacked verse lines (SPEC-multi-verse-lyrics.md
// rule 1: verse 1 at the legacy position, each additional verse one
// line-height lower).
//
// JOB 5: measured baseline-to-baseline pitch between stacked verse rows on
// the same hymnal pages, using identical-glyph cross-checks ("to"/"to" on
// one page, "my"/"my" and "God"/"God" on others) rather than font-derived
// assumptions. pitch/fontSize measured 0.947 (Amazing Grace, 2 pages,
// baseline-span/gap-count) and 1.057 (Holy, Holy, Holy) - avg 1.00, i.e.
// hymnal verse stacks pack at roughly ONE nominal font size per line, not
// the 2x a naive line-height guess would use. 1.00 x 39 = 39.
export const VERSE_LINE_HEIGHT = 39;
// Verse-1 lyric baseline, exported so the renderer's spacing skyline can
// reserve room for the whole verse block below a staff.
export const LYRIC_BASE_Y = LYRIC_Y;

/**
 * Render a single lyric syllable below a note.
 * @param {Object} params
 * @param {string} params.text - Lyric text
 * @param {number} params.x - Horizontal position (note center)
 * @param {number} [params.verseIndex=0] - 0-based verse line (0 = legacy y)
 * @param {number} [params.baseY=126] - verse-1 baseline; raised past the
 *   legacy y when staff content descends into the lyric band (JOB 4)
 * @returns {SVGGElement}
 */
export function renderLyric({ text, x, verseIndex = 0, baseY = LYRIC_Y }) {
  const group = createGroup('lyric', {
    transform: `translate(${x}, ${baseY + verseIndex * VERSE_LINE_HEIGHT})`,
  });

  group.appendChild(
    createText(text, 0, 0, {
      'text-anchor': 'middle',
      'font-size': String(LYRIC_FONT_SIZE),
      fill: 'currentColor',
    })
  );

  return group;
}

/**
 * Render a melisma underscore line spanning multiple notes.
 * @param {Object} params
 * @param {number} params.startX - Start X position
 * @param {number} params.endX - End X position
 * @param {number} [params.verseIndex=0] - 0-based verse line (0 = legacy y)
 * @param {number} [params.baseY=126] - verse-1 baseline (see renderLyric)
 * @returns {SVGLineElement}
 */
export function renderMelisma({ startX, endX, verseIndex = 0, baseY = LYRIC_Y }) {
  const y = baseY + MELISMA_DROP + verseIndex * VERSE_LINE_HEIGHT;
  return createLine(startX, y, endX, y, {
    class: 'lyric-melisma',
    stroke: 'currentColor',
    'stroke-width': '1',
  });
}

/**
 * Render a verse number ("1.", "2.", …) left of a verse's first syllable
 * on a system. End-anchored so the digits grow leftward, never shifting
 * note spacing (SPEC-multi-verse-lyrics.md rule 2).
 * @param {Object} params
 * @param {number} params.number - 1-based verse number
 * @param {number} params.x - Right edge of the number text
 * @param {number} [params.verseIndex=0] - 0-based verse line
 * @param {number} [params.baseY=126] - verse-1 baseline (see renderLyric)
 * @returns {SVGGElement}
 */
export function renderVerseNumber({ number, x, verseIndex = 0, baseY = LYRIC_Y }) {
  const group = createGroup('lyric-verse-number', {
    transform: `translate(${x}, ${baseY + verseIndex * VERSE_LINE_HEIGHT})`,
  });
  group.appendChild(
    createText(`${number}.`, 0, 0, {
      'text-anchor': 'end',
      'font-size': String(VERSE_NUMBER_FONT_SIZE),
      fill: 'currentColor',
    })
  );
  return group;
}
