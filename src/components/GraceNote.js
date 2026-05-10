/**
 * Grace note renderer.
 * Creates SVG elements for grace notes (acciaccatura and appoggiatura).
 *
 * Uses Bravura's dedicated grace-note glyphs (SMuFL U+E560..E563) which
 * bake the notehead, stem, 8th-note flag, and acciaccatura slash at the
 * engraver's intended grace size. Per engraving convention grace notes
 * are stem-up regardless of pitch, so we always reach for the stem-up
 * variant.
 *
 * Coordinate system: glyphs are rendered at SMUFL_SCALE (0.08 px/fu)
 * with the notehead horizontally centered on local x=0 (via the glyph's
 * `headCx`) and the notehead vertical center at local y=0. Translating
 * to (graceX, pitchY) lands the head on the correct staff line.
 */

import { createGroup, createPath } from '../lib/svgHelpers.js';
import { pitchToStaffY, parsePitch } from '../lib/notePositions.js';
import { createAccidental } from './Accidental.js';
import {
  createSmuflGlyph,
  SMUFL_SCALE,
  GRACE_NOTE_ACCIACCATURA_STEM_UP_GLYPH,
  GRACE_NOTE_APPOGGIATURA_STEM_UP_GLYPH,
} from '../assets/glyphs.js';

// Spacing between successive grace notes, and between the last grace and
// the principal notehead. With Bravura's intrinsic glyph dimensions the
// grace head is ~15.6px wide; 22px gives ~1 staff space of breathing
// room from the last grace to the principal head.
const GRACE_SPACING = 22;

// Lead-in pad reserved before the first grace note so the cluster
// doesn't kiss the previous element (time signature, barline, etc.).
const GRACE_LEAD_IN_PAD = 8;

// Notehead half-width in screen px (195 fu × SMUFL_SCALE / 2).
const GRACE_HEAD_HALF_WIDTH = 7.8;
// Notehead half-height in screen px (~165 fu × SMUFL_SCALE / 2).
const GRACE_HEAD_HALF_HEIGHT = 6.6;
// Accidental scale relative to principal — engraver's convention is
// roughly notehead size (which here is ~0.6 of principal).
const GRACE_ACCIDENTAL_SCALE = 0.6;
// Accidental offset to the left of the grace notehead center. Needs to
// clear the grace head half-width (~7.8 px) plus ~6–8 px breathing room.
const GRACE_ACCIDENTAL_OFFSET = 16;

const ACCIDENTAL_TYPE_MAP = {
  '#': 'sharp',
  b: 'flat',
};

const GLYPH_FOR_TYPE = {
  acciaccatura: GRACE_NOTE_ACCIACCATURA_STEM_UP_GLYPH,
  appoggiatura: GRACE_NOTE_APPOGGIATURA_STEM_UP_GLYPH,
};

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
export { GRACE_LEAD_IN_PAD, GRACE_SPACING };

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
      transform: `translate(${noteX}, ${noteY})`,
    });

    // SMuFL grace-note glyph — head + stem + flag + (slash for
    // acciaccatura) baked in at engraver's grace size.
    const glyph = GLYPH_FOR_TYPE[type] || GLYPH_FOR_TYPE.acciaccatura;
    graceGroup.appendChild(createSmuflGlyph(glyph, 'grace-note-glyph'));

    // Acciaccatura slash is baked into the glyph; expose a marker
    // element so callers (and tests) can confirm the slash is present
    // without inspecting path geometry.
    if (type === 'acciaccatura') {
      const marker = createGroup('grace-slash');
      graceGroup.appendChild(marker);
    }

    // Accidental — positioned to the left of the grace head and
    // shrunk to grace-note proportions.
    const { accidental } = parsePitch(gn.pitch);
    const accType = ACCIDENTAL_TYPE_MAP[accidental];
    if (accType) {
      const accGroup = createAccidental(accType);
      accGroup.setAttribute(
        'transform',
        `translate(${-GRACE_ACCIDENTAL_OFFSET}, 0) scale(${GRACE_ACCIDENTAL_SCALE})`
      );
      graceGroup.appendChild(accGroup);
    }

    container.appendChild(graceGroup);
    graceNoteData.push({ x: noteX, y: noteY });
  }

  // Slur from last grace head to the principal head. Grace notes are
  // stem-up, so the slur arcs ABOVE the heads. Endpoints sit at the
  // outer edge of each notehead vertically just above the higher head;
  // the arc depth gives a clearly visible curve rather than a flat line.
  const lastGrace = graceNoteData[graceNoteData.length - 1];
  // Endpoints sit just outside each notehead so the slur visibly springs
  // from the head edge rather than overlapping the head. Both endpoints
  // are pinned at the same y (just above the higher of the two heads)
  // so the curve reads as a clean symmetric arc regardless of pitch
  // difference between grace and principal.
  const slurStartX = lastGrace.x + GRACE_HEAD_HALF_WIDTH + 1;
  const slurEndX = mainX - 11; // principal head half-width ≈ 11.8
  const topHeadY = Math.min(lastGrace.y, mainY);
  const slurY = topHeadY - GRACE_HEAD_HALF_HEIGHT - 5;
  // Arc depth scales with span so longer slurs (multi-grace runs) get
  // a deeper, more obviously curved arc.
  const span = slurEndX - slurStartX;
  const arcDepth = Math.max(8, Math.min(14, span * 0.35));
  const cpX = (slurStartX + slurEndX) / 2;
  const cpY = slurY - arcDepth;

  container.appendChild(
    createPath(
      `M ${slurStartX} ${slurY} Q ${cpX} ${cpY} ${slurEndX} ${slurY}`,
      {
        class: 'grace-slur',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linecap': 'round',
      }
    )
  );

  return {
    element: container,
    width: notes.length * GRACE_SPACING,
  };
}
