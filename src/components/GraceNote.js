/**
 * Grace note renderer.
 * Creates SVG elements for grace notes (acciaccatura and appoggiatura).
 *
 * Two rendering modes:
 *   - Single grace: Bravura's dedicated grace-note glyphs (SMuFL U+E560..E563)
 *     which bake the notehead, stem, 8th-note flag, and acciaccatura slash
 *     at the engraver's intended grace size.
 *   - Run of 2+ graces: BEAMED. Small noteheads + thin stems share a single
 *     beam (no per-note flags). For acciaccatura runs, a single diagonal
 *     slash (SMuFL U+E564 graceNoteSlashStemUp) crosses the beam group near
 *     the first stem instead of per-note slashes.
 *
 * Per engraving convention grace notes are stem-up regardless of pitch.
 *
 * Coordinate system: glyphs are rendered at SMUFL_SCALE (0.08 px/fu) with
 * the notehead horizontally centered on local x=0 (via the glyph's
 * `headCx`) and the notehead vertical center at local y=0. Translating to
 * (graceX, pitchY) lands the head on the correct staff line.
 */

import { createGroup, createPath, createSvgElement } from '../lib/svgHelpers.js';
import { pitchToStaffY, parsePitch } from '../lib/notePositions.js';
import { createAccidental } from './Accidental.js';
import {
  createSmuflGlyph,
  SMUFL_SCALE,
  GRACE_NOTE_ACCIACCATURA_STEM_UP_GLYPH,
  GRACE_NOTE_APPOGGIATURA_STEM_UP_GLYPH,
  GRACE_NOTE_SLASH_STEM_UP_GLYPH,
  NOTEHEAD_BLACK_GLYPH,
} from '../assets/glyphs.js';

// Spacing between successive grace notes (single case). Beamed runs use a
// tighter spacing because there are no per-note flags fighting for room.
const GRACE_SPACING = 30;
const GRACE_RUN_SPACING = 20;

// Lead-in pad reserved before the first grace note so the cluster
// doesn't kiss the previous element (time signature, barline, etc.).
const GRACE_LEAD_IN_PAD = 12;

// Notehead half-width in screen px (195 fu × SMUFL_SCALE / 2) — single case.
const GRACE_HEAD_HALF_WIDTH = 7.8;
// Notehead half-height in screen px (~165 fu × SMUFL_SCALE / 2).
const GRACE_HEAD_HALF_HEIGHT = 6.6;
// Accidental scale relative to principal — engraver's convention is
// roughly notehead size (which here is ~0.6 of principal).
const GRACE_ACCIDENTAL_SCALE = 0.6;
// Accidental offset to the left of the grace notehead center.
const GRACE_ACCIDENTAL_OFFSET = 16;

// Beamed-run rendering parameters. We render a `noteheadBlack` glyph at
// 0.66× SMUFL_SCALE so its visual size matches the dedicated single-grace
// notehead (195 fu wide vs 295 fu native = ~0.66×). Stem thickness, beam
// thickness, and stem length are scaled to grace proportions.
const RUN_HEAD_SCALE = 0.66;
const RUN_HEAD_HALF_WIDTH = 295 * SMUFL_SCALE * RUN_HEAD_SCALE / 2; // ~7.8 px
const RUN_HEAD_HALF_HEIGHT = 250 * SMUFL_SCALE * RUN_HEAD_SCALE / 2; // ~6.6 px
const RUN_STEM_LENGTH = 26; // shorter than principal stems (70) — grace proportions
const RUN_STEM_THICKNESS = 1.2;
const RUN_BEAM_THICKNESS = 4; // grace beams are thinner than principal (10)
// Vertical gap between the two cross-beams of a beamed grace run. Standard
// practice (Gould p. 125, mirroring principal 16th beams) sets the gap at
// ~one beam thickness; we use a slightly tighter 3px so the doubled stack
// reads as grace-proportioned rather than principal-weight.
const RUN_BEAM_GAP = 3;
// Stem attaches at the notehead's stem-up tip (font-unit (283, 0) for
// noteheadBlack — right edge, vertical center) scaled to grace size.
// Pinning y to 0 puts the stem's lower end inside the head body, matching
// principal-note stems and avoiding a perched-on-top gap (Gould, Stems).
const RUN_HEAD_TIP_X = (283 - 295 / 2) * SMUFL_SCALE * RUN_HEAD_SCALE; // px right of head center
const RUN_HEAD_TIP_Y = 0; // px from head center along long axis (stem-up)

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

function appendAccidental(parent, pitch, offset, scale) {
  const { accidental } = parsePitch(pitch);
  const accType = ACCIDENTAL_TYPE_MAP[accidental];
  if (!accType) return;
  const accGroup = createAccidental(accType);
  accGroup.setAttribute(
    'transform',
    `translate(${-offset}, 0) scale(${scale})`
  );
  parent.appendChild(accGroup);
}

function appendSlur(container, startX, startY, endX, endY, headHalfH) {
  const topHeadY = Math.min(startY, endY);
  const slurY = topHeadY - headHalfH - 5;
  const span = endX - startX;
  const arcDepth = Math.max(8, Math.min(14, span * 0.35));
  const cpX = (startX + endX) / 2;
  const cpY = slurY - arcDepth;
  container.appendChild(
    createPath(
      `M ${startX} ${slurY} Q ${cpX} ${cpY} ${endX} ${slurY}`,
      {
        class: 'grace-slur',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.8',
        'stroke-linecap': 'round',
      }
    )
  );
}

/**
 * Single grace renderer (head + stem + flag + optional slash all baked
 * into one Bravura glyph). Renders one or more grace heads, each with its
 * own glyph — used for the single-grace case.
 */
function renderSingleGraces({ container, notes, mainX, mainY, clef }) {
  const data = [];
  for (let i = 0; i < notes.length; i += 1) {
    const gn = notes[i];
    const type = gn.type || 'acciaccatura';
    const noteY = pitchToStaffY(gn.pitch, clef);
    const noteX = mainX - (notes.length - i) * GRACE_SPACING;

    const graceGroup = createGroup(`grace-note grace-note-${type}`, {
      transform: `translate(${noteX}, ${noteY})`,
    });

    const glyph = GLYPH_FOR_TYPE[type] || GLYPH_FOR_TYPE.acciaccatura;
    graceGroup.appendChild(createSmuflGlyph(glyph, 'grace-note-glyph'));

    // Acciaccatura slash is baked into the glyph; expose a marker element
    // so callers (and tests) can confirm the slash is present without
    // inspecting path geometry.
    if (type === 'acciaccatura') {
      graceGroup.appendChild(createGroup('grace-slash'));
    }

    appendAccidental(graceGroup, gn.pitch, GRACE_ACCIDENTAL_OFFSET, GRACE_ACCIDENTAL_SCALE);

    container.appendChild(graceGroup);
    data.push({ x: noteX, y: noteY });
  }

  // Slur from last grace head to the principal head.
  const last = data[data.length - 1];
  const slurStartX = last.x + GRACE_HEAD_HALF_WIDTH + 1;
  const slurEndX = mainX - 11;
  appendSlur(container, slurStartX, last.y, slurEndX, mainY, GRACE_HEAD_HALF_HEIGHT);

  return notes.length * GRACE_SPACING;
}

/**
 * Beamed-run renderer for 2+ grace notes. Small noteheads + thin stems
 * connected by a single beam (no per-note flags); a single diagonal slash
 * crosses the beam group for acciaccatura runs.
 */
function renderRunGraces({ container, notes, mainX, mainY, clef }) {
  const heads = [];
  for (let i = 0; i < notes.length; i += 1) {
    const gn = notes[i];
    const noteY = pitchToStaffY(gn.pitch, clef);
    const noteX = mainX - (notes.length - i) * GRACE_RUN_SPACING;
    heads.push({ x: noteX, y: noteY, gn });
  }

  // Beam Y: above the highest head by a fixed engraver's stem length, so
  // every stem is at least RUN_STEM_LENGTH long. Heads are stem-up so the
  // beam is ABOVE — pick the smallest y among heads (highest visually).
  const minHeadY = Math.min(...heads.map(h => h.y));
  const beamY = minHeadY - RUN_STEM_LENGTH;

  // Render each head + stem.
  for (let i = 0; i < heads.length; i += 1) {
    const { x, y, gn } = heads[i];
    const type = gn.type || 'acciaccatura';
    const graceGroup = createGroup(`grace-note grace-note-${type}`, {
      transform: `translate(${x}, ${y})`,
    });

    // Small notehead — scaled noteheadBlack centered on local origin.
    const headWrapper = createGroup('grace-note-glyph');
    const headInner = createGroup('', {
      transform: `scale(${SMUFL_SCALE * RUN_HEAD_SCALE}, ${-SMUFL_SCALE * RUN_HEAD_SCALE}) translate(${-295 / 2}, 0)`,
    });
    headInner.appendChild(
      createPath(NOTEHEAD_BLACK_GLYPH.d, { fill: 'currentColor' })
    );
    headWrapper.appendChild(headInner);
    graceGroup.appendChild(headWrapper);

    // Stem — from head's stem-up tip (right side, slightly above center)
    // to the beam line. Drawn in the parent container so absolute y
    // coordinates work cleanly.
    const stemX = x + RUN_HEAD_TIP_X;
    const stemTopY = beamY;
    const stemBottomY = y + RUN_HEAD_TIP_Y;
    container.appendChild(
      createSvgElement('rect', {
        x: stemX - RUN_STEM_THICKNESS / 2,
        y: stemTopY,
        width: RUN_STEM_THICKNESS,
        height: stemBottomY - stemTopY,
        fill: 'currentColor',
        class: 'grace-stem',
      })
    );

    appendAccidental(graceGroup, gn.pitch, GRACE_ACCIDENTAL_OFFSET, GRACE_ACCIDENTAL_SCALE);
    container.appendChild(graceGroup);
  }

  // Beams — two parallel horizontal bars (sixteenth-note value) spanning
  // first to last stem. Per Gould "Behind Bars" p. 125, beamed grace notes
  // are conventionally drawn as sixteenths regardless of how a single
  // (unbeamed) grace is rendered. The second beam sits one beam-thickness
  // plus a small gap below the first, toward the heads, mirroring the
  // principal-beam stack ordering (outer beam on the stem-far side).
  const firstStemX = heads[0].x + RUN_HEAD_TIP_X;
  const lastStemX = heads[heads.length - 1].x + RUN_HEAD_TIP_X;
  const beamX = firstStemX - RUN_STEM_THICKNESS / 2;
  const beamWidth = lastStemX - firstStemX + RUN_STEM_THICKNESS;
  for (let level = 0; level < 2; level += 1) {
    container.appendChild(
      createSvgElement('rect', {
        x: beamX,
        y: beamY + level * (RUN_BEAM_THICKNESS + RUN_BEAM_GAP),
        width: beamWidth,
        height: RUN_BEAM_THICKNESS,
        fill: 'currentColor',
        class: 'grace-beam',
      })
    );
  }

  // Acciaccatura slash — a single diagonal line crossing the beam group.
  // Render if ANY grace in the run is an acciaccatura (engraver's
  // convention treats the slash as a property of the whole beamed group).
  const hasAcciaccatura = notes.some(n => (n.type || 'acciaccatura') === 'acciaccatura');
  if (hasAcciaccatura) {
    // Anchor the slash so it crosses the beam diagonally near the first
    // stem. Native slash glyph extends from (0, 0) up-and-right to
    // (505, 401) fu. We size it so the slash spans about half the stem
    // length vertically and crosses one full stem-spacing horizontally.
    // Two-grace runs have only one stem-gap so we keep the slash compact.
    const stemSpacing = lastStemX - firstStemX;
    // Slash horizontal span ~= the stem spacing (so it visibly bridges
    // across one full beam segment). For 2-note runs minimum 18 px.
    const targetWidth = Math.max(18, stemSpacing * 0.95);
    const slashScale = targetWidth / 505;
    // Position lower-left of slash below the beam at first stem; the
    // diagonal ascends through the beam to above-right of the next stem.
    // We anchor a few px below the beam and let the diagonal cross it.
    const slashX = firstStemX - 5;
    // Anchor below the outer (lower) beam so the diagonal ascends through
    // both cross-beams. Outer beam bottom edge sits at
    //   beamY + 2*RUN_BEAM_THICKNESS + RUN_BEAM_GAP
    // and we pad a few px further down for a visible bridge.
    const slashY = beamY + 2 * RUN_BEAM_THICKNESS + RUN_BEAM_GAP + 4;
    const slashGroup = createGroup('grace-slash', {
      transform: `translate(${slashX}, ${slashY}) scale(${slashScale}, ${-slashScale})`,
    });
    slashGroup.appendChild(
      createPath(GRACE_NOTE_SLASH_STEM_UP_GLYPH.d, { fill: 'currentColor' })
    );
    container.appendChild(slashGroup);
  }

  // Slur arcs from the FIRST grace head over all heads + the principal.
  const first = heads[0];
  const slurStartX = first.x - RUN_HEAD_HALF_WIDTH;
  const slurEndX = mainX - 11;
  // Use the lowest beam-y as the upper-bound for the arc origin so the
  // slur clears the beam comfortably. Practically the beam sits well
  // above the heads, and our slur already pads above the highest head.
  const topAnchorY = Math.min(beamY - 2, mainY);
  appendSlur(container, slurStartX, topAnchorY, slurEndX, mainY, RUN_HEAD_HALF_HEIGHT);

  return notes.length * GRACE_RUN_SPACING;
}

export { GRACE_LEAD_IN_PAD, GRACE_SPACING };

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

  const container = createGroup(isRun ? 'grace-note-group' : 'grace-notes');

  const width = isRun
    ? renderRunGraces({ container, notes, mainX, mainY, clef })
    : renderSingleGraces({ container, notes, mainX, mainY, clef });

  return { element: container, width };
}
