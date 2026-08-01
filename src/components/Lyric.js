/**
 * Lyric renderer.
 * Creates SVG elements for per-note lyrics, including melisma underscores,
 * stacked verse lines, and verse numbers (SPEC-multi-verse-lyrics.md).
 */

import { createGroup, createText, createLine } from '../lib/svgHelpers.js';

const LYRIC_Y = 115;
const MELISMA_Y = 120;

// Engraving defaults for lyric text (SPEC-lyric-spacing.md JOB 2 raises
// these; every width heuristic must READ them, never hardcode).
export const LYRIC_FONT_SIZE = 11;
export const VERSE_NUMBER_FONT_SIZE = 10;

// Width-estimation heuristic (SPEC-lyric-spacing.md JOB 1). jsdom offers no
// text metrics (getComputedTextLength / getBBox return 0), so syllable
// widths are ESTIMATED from character count: the average advance of the
// default serif at lyric sizes is ~0.5 em per character (mixed-case Latin
// text; digits and '.' in verse numbers land close to the same average).
export const LYRIC_CHAR_WIDTH_RATIO = 0.5;

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
export const VERSE_LINE_HEIGHT = 26;
// Verse-1 lyric baseline, exported so the renderer's spacing skyline can
// reserve room for the whole verse block below a staff.
export const LYRIC_BASE_Y = LYRIC_Y;

/**
 * Render a single lyric syllable below a note.
 * @param {Object} params
 * @param {string} params.text - Lyric text
 * @param {number} params.x - Horizontal position (note center)
 * @param {number} [params.verseIndex=0] - 0-based verse line (0 = legacy y)
 * @returns {SVGGElement}
 */
export function renderLyric({ text, x, verseIndex = 0 }) {
  const group = createGroup('lyric', {
    transform: `translate(${x}, ${LYRIC_Y + verseIndex * VERSE_LINE_HEIGHT})`,
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
 * @returns {SVGLineElement}
 */
export function renderMelisma({ startX, endX, verseIndex = 0 }) {
  const y = MELISMA_Y + verseIndex * VERSE_LINE_HEIGHT;
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
 * @returns {SVGGElement}
 */
export function renderVerseNumber({ number, x, verseIndex = 0 }) {
  const group = createGroup('lyric-verse-number', {
    transform: `translate(${x}, ${LYRIC_Y + verseIndex * VERSE_LINE_HEIGHT})`,
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
