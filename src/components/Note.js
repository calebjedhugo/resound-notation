/**
 * Note renderer.
 * Creates SVG group for a single note with head, stem, and flags.
 */

import { createGroup, createLine } from '../lib/svgHelpers.js';
import { pitchToStaffY } from '../lib/notePositions.js';
import { getDurationInfo } from '../lib/durationSymbols.js';
import {
  createSmuflGlyph,
  smuflTip,
  NOTEHEAD_BLACK_GLYPH,
  NOTEHEAD_HALF_GLYPH,
  NOTEHEAD_WHOLE_GLYPH,
  FLAG_GLYPHS,
} from '../assets/glyphs.js';
import { beamStemExtension } from './Beam.js';

const MIDDLE_LINE_Y = 50;
const STEM_LENGTH = 70;

function glyphForDuration(info) {
  if (info.name === 'whole') return NOTEHEAD_WHOLE_GLYPH;
  if (info.name === 'half') return NOTEHEAD_HALF_GLYPH;
  return NOTEHEAD_BLACK_GLYPH;
}

function pickFlagGlyph(flagCount, stemDown) {
  const dir = stemDown ? 'Down' : 'Up';
  if (flagCount === 1) return FLAG_GLYPHS[`flag8th${dir}`];
  if (flagCount === 2) return FLAG_GLYPHS[`flag16th${dir}`];
  if (flagCount >= 3) return FLAG_GLYPHS[`flag32nd${dir}`];
  return null;
}

/**
 * Create an SVG group representing a single note.
 * @param {Object} params
 * @param {string} params.pitch - Scientific pitch notation (e.g. "C4")
 * @param {string} params.length - Fraction string (e.g. "1/4")
 * @param {number} params.x - Horizontal position
 * @param {string} params.clef - Clef for Y positioning
 * @param {boolean} [params.beamed] - If true, suppress flags (note is beamed)
 * @param {boolean} [params.stemDown] - Override auto stem direction
 * @returns {SVGGElement}
 */
export function createNote({ pitch, length, x, clef, beamed, stemDown: stemDownOverride }) {
  const y = pitchToStaffY(pitch, clef);
  const info = getDurationInfo(length);

  const group = createGroup(`note ${info.cssClass}`, {
    transform: `translate(${x}, ${y})`,
  });

  // SMuFL Bravura notehead path glyph (whole / half / black). Each glyph
  // declares its own stem-up tip vertex so stems attach at the engraved
  // long-axis corner per standard notation convention.
  const glyph = glyphForDuration(info);
  group.appendChild(createSmuflGlyph(glyph, 'note-head'));

  if (info.hasStem) {
    const tip = smuflTip(glyph);
    const stemDown = stemDownOverride !== undefined ? stemDownOverride : y <= MIDDLE_LINE_Y;
    // Beamed stems extend past the standard tip so they terminate at the
    // outer edge of the outermost beam.
    const beamExt = beamed ? beamStemExtension(info.flags) : 0;
    const stemX = stemDown ? -tip.x : tip.x;
    const stemY1 = stemDown ? -tip.y : tip.y;
    const stemY2 = stemDown
      ? -tip.y + STEM_LENGTH + beamExt
      : tip.y - STEM_LENGTH - beamExt;

    group.appendChild(
      createLine(stemX, stemY1, stemX, stemY2, { class: 'note-stem', stroke: 'currentColor', 'stroke-width': 2.4 })
    );

    // Flags (suppressed when beamed — beams replace flags). Multi-flag
    // durations (16th, 32nd) ship as a single SMuFL glyph with secondary
    // flags already stacked, so the dispatch is one glyph keyed on
    // info.flags, not a per-flag loop.
    if (beamed) return group;
    if (info.flags > 0) {
      const flagGlyph = pickFlagGlyph(info.flags, stemDown);
      if (flagGlyph) {
        const flag = createSmuflGlyph(flagGlyph, 'note-flag');
        // Anchor the flag at the stem tip. The SMuFL flag origin (0, 0)
        // sits at the stem-tip end; createSmuflGlyph honors headCx: 0
        // so the glyph translates to local (stemX, stemY2) directly.
        // Scale 0.85 trims Bravura's chunky default flag thickness to a
        // more elegant proportion against our LINE_SPACING=20 staff
        // (Bravura is drawn for ~24-26 LS, hence the slight over-weight).
        flag.setAttribute('transform', `translate(${stemX}, ${stemY2}) scale(0.85)`);
        group.appendChild(flag);
      }
    }
  }

  return group;
}
