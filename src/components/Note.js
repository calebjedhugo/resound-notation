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
  SMUFL_SCALE,
  AUGMENTATION_DOT_GLYPH,
  NOTEHEAD_BLACK_GLYPH,
  NOTEHEAD_HALF_GLYPH,
  NOTEHEAD_WHOLE_GLYPH,
  FLAG_GLYPHS,
} from '../assets/glyphs.js';
import { beamStemExtension } from './Beam.js';
import { effectiveStemLength } from '../lib/stemLength.js';
import {
  LINE_SPACING,
  MIDDLE_LINE_Y,
  STEM_LENGTH,
  STEM_THICKNESS,
} from '../lib/engravingDefaults.js';

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
 * @param {boolean} [params.dotted] - Draw an augmentation dot right of the head
 * @param {boolean} [params.dotBelow] - On-line dots take the space BELOW the
 *   line instead of above. Set for the down-stem voice of a shared
 *   (two-voice) staff so the two voices' dots cannot collide (Gould,
 *   "Behind Bars" pp. 56-57). NOT tied to stem direction: a single voice
 *   keeps the above-bias even on stem-down notes.
 * @returns {SVGGElement}
 */
export function createNote({
  pitch, length, x, clef, beamed, stemDown: stemDownOverride, dotted, dotBelow,
}) {
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

  // Augmentation dot (Gould pp. 56-57): to the RIGHT of the head with a
  // clear gap of a quarter staff space, inside the DOT_WIDTH slot the
  // spring spacing already reserves. Vertically the dot sits in a SPACE,
  // never on a line: an on-line head takes the space above (below for the
  // shared-staff down-stem voice via dotBelow); an in-space head keeps its
  // own space. The modulo also handles ledger-line notes, whose y values
  // continue the same 10px line/space alternation beyond the staff.
  if (dotted) {
    const headHalfWidth = ((glyph.bbox.xMax - glyph.bbox.xMin) / 2) * SMUFL_SCALE;
    const dotRadius =
      ((AUGMENTATION_DOT_GLYPH.bbox.xMax - AUGMENTATION_DOT_GLYPH.bbox.xMin) / 2)
      * SMUFL_SCALE;
    const dotGap = LINE_SPACING / 4; // clear gap between head edge and dot edge
    const dotX = headHalfWidth + dotGap + dotRadius;
    const halfSpace = LINE_SPACING / 2;
    // Staff lines sit at odd multiples of a half space (y=10, 30, ..).
    const onLine = ((y % LINE_SPACING) + LINE_SPACING) % LINE_SPACING === halfSpace;
    const dotDy = onLine ? (dotBelow ? halfSpace : -halfSpace) : 0;
    const dot = createSmuflGlyph(AUGMENTATION_DOT_GLYPH, 'augmentation-dot');
    dot.setAttribute('transform', `translate(${dotX}, ${dotDy})`);
    group.appendChild(dot);
  }

  if (info.hasStem) {
    const tip = smuflTip(glyph);
    const stemDown = stemDownOverride !== undefined ? stemDownOverride : y <= MIDDLE_LINE_Y;
    // Beamed stems terminate at the outer edge of the PRIMARY beam, which
    // sits at the natural stem tip; secondary beam levels stack inside
    // (toward the head), so no extra length is needed (see Beam.js).
    const beamExt = beamed ? beamStemExtension(info.flags) : 0;
    const stemX = stemDown ? -tip.x : tip.x;
    const stemY1 = stemDown ? -tip.y : tip.y;
    // Ledger-line stem lengthening: extend the stem so its tip reaches at
    // least the middle staff line (lower bound; never shortens). attachY is
    // the stem's head end in absolute staff coords (group is translated to
    // y), so the helper measures the reach to MIDDLE_LINE_Y correctly.
    const baseLen = effectiveStemLength({
      attachY: y + stemY1,
      stemDown,
      baseLength: STEM_LENGTH,
      middleLineY: MIDDLE_LINE_Y,
    });
    const stemY2 = stemDown
      ? stemY1 + baseLen + beamExt
      : stemY1 - baseLen - beamExt;

    group.appendChild(
      createLine(stemX, stemY1, stemX, stemY2, {
        class: 'note-stem',
        stroke: 'currentColor',
        'stroke-width': STEM_THICKNESS,
      })
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
