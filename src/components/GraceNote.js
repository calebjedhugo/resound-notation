/**
 * Grace note renderer.
 * Creates SVG elements for grace notes (acciaccatura and appoggiatura).
 */

import { createGroup, createLine, createPath } from '../lib/svgHelpers.js';
import { pitchToStaffY, parsePitch } from '../lib/notePositions.js';
import { createAccidental } from './Accidental.js';
import { createSmuflGlyph, smuflTip, NOTEHEAD_BLACK_GLYPH } from '../assets/glyphs.js';

const GRACE_SCALE = 0.6;
const GRACE_SPACING = 15;
// Grace notes use SMuFL black notehead at GRACE_SCALE. Stem attach point
// follows the engraved tip vertex (the GRACE_SCALE outer transform on the
// graceGroup scales the same tip values to grace size).
const BLACK_TIP = smuflTip(NOTEHEAD_BLACK_GLYPH);
const HEAD_TIP_X = BLACK_TIP.x;
const HEAD_TIP_Y = BLACK_TIP.y;
// Black notehead bbox is 295 × 250 fu → 23.6 × 20 px at SMUFL_SCALE.
const HEAD_HALF_WIDTH = 11.8;
const HEAD_HALF_HEIGHT = 10;
const STEM_LENGTH = 60;
const MIDDLE_LINE_Y = 50;
const ACCIDENTAL_OFFSET = 18;

const ACCIDENTAL_TYPE_MAP = {
  '#': 'sharp',
  b: 'flat',
};

/**
 * Normalize grace input to an array.
 * @param {Object|Array} grace
 * @returns {Array}
 */
function normalizeGrace(grace) {
  if (Array.isArray(grace)) return grace;
  return [grace];
}

/**
 * Render grace notes before a main note.
 * @param {Object} params
 * @param {Object|Array} params.grace - Grace note(s)
 * @param {number} params.mainX - Main note x position
 * @param {number} params.mainY - Main note y position
 * @param {string} params.clef - Clef for Y positioning
 * @returns {{ element: SVGGElement, width: number }}
 */
export function renderGraceNotes({ grace, mainX, mainY, clef }) {
  const notes = normalizeGrace(grace);
  const isRun = notes.length > 1;

  const containerClass = isRun ? 'grace-note-group' : 'grace-notes';
  const container = createGroup(containerClass);

  const graceNoteData = [];

  for (let i = 0; i < notes.length; i += 1) {
    const gn = notes[i];
    const type = gn.type || 'acciaccatura';
    const noteY = pitchToStaffY(gn.pitch, clef);
    const noteX = mainX - (notes.length - i) * GRACE_SPACING;

    const graceGroup = createGroup(`grace-note grace-note-${type}`, {
      transform: `translate(${noteX}, ${noteY}) scale(${GRACE_SCALE})`,
    });

    // Note head — SMuFL Bravura black notehead, scaled by GRACE_SCALE on
    // the parent group.
    graceGroup.appendChild(createSmuflGlyph(NOTEHEAD_BLACK_GLYPH, 'note-head'));

    // Stem — anchored at the head's long-axis tip.
    // Engraving convention: grace notes are always stem-up regardless of pitch.
    const stemDown = false;
    const stemX = stemDown ? -HEAD_TIP_X : HEAD_TIP_X;
    const stemY1 = stemDown ? -HEAD_TIP_Y : HEAD_TIP_Y;
    const stemY2 = stemDown ? -HEAD_TIP_Y + STEM_LENGTH : HEAD_TIP_Y - STEM_LENGTH;
    graceGroup.appendChild(
      createLine(stemX, stemY1, stemX, stemY2, {
        class: 'note-stem',
        stroke: 'currentColor',
      })
    );

    // 8th-note flag at the stem tip — same hand-rolled curve as Note.js
    // so grace flags match principal-note flag shapes. Curls outward
    // from the stem tip (right for stem-up, left for stem-down... but
    // engraving convention curls the same direction; flag-down mirrors
    // the curl across the stem tip in y).
    const flagPath = stemDown
      ? `M ${stemX} ${stemY2} c 8 4 12 12 8 20`
      : `M ${stemX} ${stemY2} c 8 -4 12 -12 8 -20`;
    graceGroup.appendChild(
      createPath(flagPath, { class: 'note-flag', fill: 'currentColor' })
    );

    // Slash for acciaccatura — crosses both stem and flag at ~30°.
    // Span: from below the head toward / beyond the flag tip so the
    // slash visibly intersects the flag curl, not just the bare stem.
    if (type === 'acciaccatura') {
      const slashY1 = stemDown ? STEM_LENGTH * 0.85 : -STEM_LENGTH * 0.85;
      const slashY2 = stemDown ? STEM_LENGTH * 0.25 : -STEM_LENGTH * 0.25;
      graceGroup.appendChild(
        createLine(stemX - 8, slashY1, stemX + 12, slashY2, {
          class: 'grace-slash',
          stroke: 'currentColor',
          'stroke-width': '2',
        })
      );
    }

    // Accidental
    const { accidental } = parsePitch(gn.pitch);
    const accType = ACCIDENTAL_TYPE_MAP[accidental];
    if (accType) {
      const accGroup = createAccidental(accType);
      accGroup.setAttribute('transform', `translate(${-ACCIDENTAL_OFFSET}, 0)`);
      graceGroup.appendChild(accGroup);
    }

    container.appendChild(graceGroup);
    graceNoteData.push({ x: noteX, y: noteY });
  }

  // Slur from last grace note to main note.
  // Grace notes are always stem-up, so the slur arcs ABOVE the heads.
  // Both endpoints sit at a common height above whichever of the grace/main
  // head is highest, so the curve reads as a clean, nearly-symmetric arc
  // rather than a diagonal smear when grace and principal pitches differ.
  const lastGrace = graceNoteData[graceNoteData.length - 1];
  const slurStartX = lastGrace.x + HEAD_HALF_WIDTH * GRACE_SCALE;
  const slurEndX = mainX - HEAD_HALF_WIDTH;
  const topY = Math.min(lastGrace.y, mainY) - HEAD_HALF_HEIGHT - 4;
  const slurStartY = topY;
  const slurEndY = topY;
  const cpX = (slurStartX + slurEndX) / 2;
  const cpY = topY - 8;

  container.appendChild(
    createPath(`M ${slurStartX} ${slurStartY} Q ${cpX} ${cpY} ${slurEndX} ${slurEndY}`, {
      class: 'grace-slur',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
    })
  );

  return {
    element: container,
    width: notes.length * GRACE_SPACING,
  };
}
