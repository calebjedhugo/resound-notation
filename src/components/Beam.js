/**
 * Beam renderer.
 * Creates SVG beam paths connecting stems of grouped notes.
 */

import { createGroup, createPath } from '../lib/svgHelpers.js';
import { smuflTip, NOTEHEAD_BLACK_GLYPH } from '../assets/glyphs.js';

// Beamed notes are always 8th or shorter → black notehead. Stem attaches
// at the SMuFL black notehead's stem-up tip vertex.
const BLACK_TIP = smuflTip(NOTEHEAD_BLACK_GLYPH);
const HEAD_TIP_X = BLACK_TIP.x;
const HEAD_TIP_Y = BLACK_TIP.y;
const STEM_LENGTH = 70;
// Standard engraving (Gould, Bravura defaults): beam thickness ~0.5 staff
// space; gap between adjacent beam levels ~0.25 staff space. With
// LINE_SPACING=20px that's 10px and 5px respectively.
export const BEAM_THICKNESS = 10;
export const BEAM_GAP = 5;

/**
 * Extra stem length needed for a beamed note so the stem terminates at
 * the outer edge of the outermost beam. The beam stack is shifted one
 * beam-thickness toward the head (see beamPath offset), so the primary
 * beam's far edge sits at the un-beamed stem tip — extension is 0 for a
 * single 8th beam, BT+BG for 16ths, 2*(BT+BG) for 32nds.
 */
export function beamStemExtension(numBeams) {
  if (numBeams <= 0) return 0;
  return (numBeams - 1) * (BEAM_THICKNESS + BEAM_GAP);
}

// Maximum beam-line rise (px) across an entire beam group. Standard
// engraving (Gould "Behind Bars") caps slope at ~1 staff space — steep
// note-contour groups should still produce a near-flat beam, with stems
// lengthening on whichever side the contour falls short of the line.
const MAX_BEAM_RISE = 20;

/**
 * Compute the stem end Y for a note. Beam connects at the far end of the
 * stem; stems start at the head's tip (noteY ± HEAD_TIP_Y) and extend
 * STEM_LENGTH outward.
 */
function stemEndY(noteY, stemDown) {
  return stemDown ? noteY - HEAD_TIP_Y + STEM_LENGTH : noteY + HEAD_TIP_Y - STEM_LENGTH;
}

/**
 * Slope-capped beam line endpoints for a group of beamed notes. Each
 * note's stemEndY (computed from STEM_LENGTH) is used as the *minimum*
 * extension; the beam line is shifted outward (away from heads) if any
 * note's natural stem would fall short of the capped line. Caller can
 * interpolate this line at each note's x to set stem y2.
 *
 * @returns {{x1:number, y1:number, x2:number, y2:number}}
 */
export function computeBeamLine(notes, stemDown) {
  const first = notes[0];
  const last = notes[notes.length - 1];
  const x1 = stemX(first.x, stemDown);
  const x2 = stemX(last.x, stemDown);
  let y1 = stemEndY(first.y, stemDown);
  let y2 = stemEndY(last.y, stemDown);

  // Cap slope at MAX_BEAM_RISE.
  const rise = y2 - y1;
  if (Math.abs(rise) > MAX_BEAM_RISE) {
    const sign = Math.sign(rise);
    const avg = (y1 + y2) / 2;
    y1 = avg - (sign * MAX_BEAM_RISE) / 2;
    y2 = avg + (sign * MAX_BEAM_RISE) / 2;
  }

  // Ensure no note's stem ends up too short. For stem-up (dir=-1), the
  // beam y must be ≤ each note's natural stemEndY; for stem-down (dir=+1),
  // ≥. If any note violates, shift the whole line outward (away from head).
  for (const note of notes) {
    const t = x2 === x1 ? 0 : (stemX(note.x, stemDown) - x1) / (x2 - x1);
    const targetY = y1 + t * (y2 - y1);
    const minY = stemEndY(note.y, stemDown);
    if (stemDown && targetY < minY) {
      const shift = minY - targetY;
      y1 += shift;
      y2 += shift;
    } else if (!stemDown && targetY > minY) {
      const shift = targetY - minY;
      y1 -= shift;
      y2 -= shift;
    }
  }

  return { x1, y1, x2, y2 };
}

/**
 * Interpolate the slope-capped beam line at a stem x.
 */
export function beamLineYAt(line, x) {
  const { x1, y1, x2, y2 } = line;
  if (x2 === x1) return y1;
  const t = (x - x1) / (x2 - x1);
  return y1 + t * (y2 - y1);
}

/**
 * Compute the stem X for a note.
 */
function stemX(noteX, stemDown) {
  return stemDown ? noteX - HEAD_TIP_X : noteX + HEAD_TIP_X;
}

/**
 * Draw a beam path (filled trapezoid) between two stem endpoints at a given level.
 * @param {number} x1 - First stem X
 * @param {number} y1 - First stem end Y
 * @param {number} x2 - Last stem X
 * @param {number} y2 - Last stem end Y
 * @param {number} level - Beam level (0 = primary)
 * @param {boolean} stemDown
 */
function beamPath(x1, y1, x2, y2, level, stemDown) {
  const dir = stemDown ? 1 : -1;
  // Shift the entire beam stack one beam-thickness toward the head so the
  // primary beam's far edge sits at the un-beamed stem tip (y1, y2). This
  // tightens the visual spacing between beam and noteheads — without the
  // shift the stack appears stuck onto the end of the stem.
  const offset = (level * (BEAM_THICKNESS + BEAM_GAP) - BEAM_THICKNESS) * dir;
  const topY1 = y1 + offset;
  const topY2 = y2 + offset;
  const botY1 = topY1 + BEAM_THICKNESS * dir;
  const botY2 = topY2 + BEAM_THICKNESS * dir;

  return `M ${x1} ${topY1} L ${x2} ${topY2} L ${x2} ${botY2} L ${x1} ${botY1} Z`;
}

/**
 * Create SVG beam elements for a group of notes.
 *
 * @param {Object} params
 * @param {Array<{x: number, y: number, beams: number}>} params.notes
 * @param {boolean} params.stemDown
 * @returns {SVGGElement} Group containing beam path elements
 */
export function createBeams({ notes, stemDown }) {
  const group = createGroup('beams');

  if (notes.length < 2) return group;

  // Slope-capped beam line shared by all beam levels.
  const line = computeBeamLine(notes, stemDown);
  const { x1, y1, x2, y2 } = line;

  // Determine how many full beam levels span all notes
  const minBeams = Math.min(...notes.map((n) => n.beams));

  // Draw full beams (levels 0 to minBeams-1)
  for (let level = 0; level < minBeams; level++) {
    group.appendChild(
      createPath(beamPath(x1, y1, x2, y2, level, stemDown), {
        class: 'beam',
        fill: 'currentColor',
      })
    );
  }

  // Draw partial beams for higher levels — sub-segments still ride on
  // the same slope-capped beam line (interpolated at the run's stem-Xs).
  for (let level = minBeams; level < Math.max(...notes.map((n) => n.beams)); level++) {
    let runStart = -1;
    for (let i = 0; i <= notes.length; i++) {
      const hasBeam = i < notes.length && notes[i].beams > level;
      if (hasBeam && runStart < 0) {
        runStart = i;
      } else if (!hasBeam && runStart >= 0) {
        if (i - runStart >= 2) {
          const sx1 = stemX(notes[runStart].x, stemDown);
          const sx2 = stemX(notes[i - 1].x, stemDown);
          const sy1 = beamLineYAt(line, sx1);
          const sy2 = beamLineYAt(line, sx2);
          group.appendChild(
            createPath(beamPath(sx1, sy1, sx2, sy2, level, stemDown), {
              class: 'beam',
              fill: 'currentColor',
            })
          );
        } else {
          // Single-note stub.
          const noteIdx = runStart;
          const nx = stemX(notes[noteIdx].x, stemDown);
          const ny = beamLineYAt(line, nx);
          const neighborIdx = noteIdx > 0 ? noteIdx - 1 : noteIdx + 1;
          const neighborX = stemX(notes[neighborIdx].x, stemDown);
          const stubX = nx + (neighborX - nx) * 0.4;
          const stubY = beamLineYAt(line, stubX);
          group.appendChild(
            createPath(beamPath(nx, ny, stubX, stubY, level, stemDown), {
              class: 'beam',
              fill: 'currentColor',
            })
          );
        }
        runStart = -1;
      }
    }
  }

  return group;
}
