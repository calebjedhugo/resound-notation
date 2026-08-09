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
// widths are ESTIMATED. ~0.5 em is the average advance across mixed-case
// Latin text — the fallback for any character missing from the table below.
export const LYRIC_CHAR_WIDTH_RATIO = 0.5;

// Per-character advance as a fraction of font size, measured in a browser at
// font-size 100 against the renderer's default sans stack. A flat 0.5 per
// character is wrong by up to 25% on real syllables ("dimmed" runs 0.57/ch,
// "ful" 0.35/ch), and the barline-clearance floors that consume it
// (lib/lyricSpacing.js) then let a barline strike through the wide ones.
// Summing this table lands within ~1% of the true advance. Whatever font a
// consumer's CSS picks will differ in absolute terms; the RATIOS between
// glyphs ('m' is 4x 'i') are what the spacing math needs, and those hold
// across the text faces hymn lyrics get set in.
export const LYRIC_CHAR_WIDTHS = {
  a: 0.502, b: 0.554, c: 0.501, d: 0.554, e: 0.512, f: 0.304, g: 0.549,
  h: 0.539, i: 0.206, j: 0.205, k: 0.485, l: 0.204, m: 0.803, n: 0.527,
  o: 0.531, p: 0.549, q: 0.549, r: 0.308, s: 0.465, t: 0.301, u: 0.527,
  v: 0.483, w: 0.715, x: 0.468, y: 0.486, z: 0.468,
  A: 0.635, B: 0.604, C: 0.686, D: 0.679, E: 0.552, F: 0.528, G: 0.707,
  H: 0.699, I: 0.225, J: 0.495, K: 0.601, L: 0.524, M: 0.831, N: 0.699,
  O: 0.731, P: 0.578, Q: 0.731, R: 0.599, S: 0.593, T: 0.581, U: 0.696,
  V: 0.631, W: 0.924, X: 0.635, Y: 0.612, Z: 0.617,
  0: 0.606, 1: 0.443, 2: 0.566, 3: 0.592, 4: 0.604, 5: 0.585, 6: 0.617,
  7: 0.547, 8: 0.6, 9: 0.617,
  ' ': 0.205, '-': 0.429, '.': 0.215, ',': 0.215, ':': 0.215, ';': 0.215,
  "'": 0.254, '’': 0.215, '"': 0.403, '!': 0.267, '?': 0.489,
};

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
  // Hot path: the spring layout asks for every syllable's width once per
  // candidate system run. A piece's syllable vocabulary is a few hundred
  // strings, so memoize the per-em sum and scale by font size on the way out.
  const key = String(text);
  let ems = lyricEmsCache.get(key);
  if (ems === undefined) {
    ems = 0;
    for (const ch of key) {
      const w = LYRIC_CHAR_WIDTHS[ch];
      ems += w === undefined ? LYRIC_CHAR_WIDTH_RATIO : w;
    }
    lyricEmsCache.set(key, ems);
  }
  return ems * fontSize;
}

const lyricEmsCache = new Map();

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
