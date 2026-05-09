/**
 * Note renderer.
 * Creates SVG group for a single note with head, stem, and flags.
 */

import { createGroup, createEllipse, createLine, createPath } from '../lib/svgHelpers.js';
import { pitchToStaffY } from '../lib/notePositions.js';
import { getDurationInfo } from '../lib/durationSymbols.js';
import { createGlyph, glyphTip, HALF_NOTEHEAD_GLYPH } from '../assets/glyphs.js';

const MIDDLE_LINE_Y = 50;
const HEAD_RX = 15;
const HEAD_RY = 10;
const HEAD_TILT_DEG = -33.33;
// Stems attach at the rotated head's long-axis tip (top-right corner for
// stem-up, bottom-left for stem-down). For an unrotated ellipse the right
// tip is at (rx, 0); after rotating by HEAD_TILT_DEG it lands at
// (rx·cos t, rx·sin t). With the heavy -33° tilt the tip is well above
// center, so anchoring stems at y=0 makes them clip through the head.
const HEAD_TIP_X = HEAD_RX * Math.cos((HEAD_TILT_DEG * Math.PI) / 180);
const HEAD_TIP_Y = HEAD_RX * Math.sin((HEAD_TILT_DEG * Math.PI) / 180);
const STEM_LENGTH = 70;

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

  // Note head — half notes use the public-domain Blanche.svg glyph (proper
  // hollow shape with even-odd cutout). Other durations remain a tilted
  // ellipse. Each shape declares its own long-axis tip so the stem connects
  // at the proper engraved corner (top-right for stem-up).
  let head;
  let tipX = HEAD_TIP_X;
  let tipY = HEAD_TIP_Y;
  if (info.name === 'half') {
    head = createGlyph(HALF_NOTEHEAD_GLYPH, HEAD_RY * 2, 'note-head');
    const tip = glyphTip(HALF_NOTEHEAD_GLYPH, HEAD_RY * 2);
    tipX = tip.x;
    tipY = tip.y;
  } else {
    const fill = info.filledHead ? 'currentColor' : 'none';
    head = createEllipse(0, 0, HEAD_RX, HEAD_RY, {
      class: 'note-head',
      fill,
      stroke: 'currentColor',
      transform: `rotate(${HEAD_TILT_DEG})`,
    });
  }
  group.appendChild(head);

  // Stem — attaches at the long-axis tip; opposite tip for stem-down.
  if (info.hasStem) {
    const stemDown = stemDownOverride !== undefined ? stemDownOverride : y <= MIDDLE_LINE_Y;
    const stemX = stemDown ? -tipX : tipX;
    const stemY1 = stemDown ? -tipY : tipY;
    const stemY2 = stemDown ? -tipY + STEM_LENGTH : tipY - STEM_LENGTH;

    group.appendChild(
      createLine(stemX, stemY1, stemX, stemY2, { class: 'note-stem', stroke: 'currentColor' })
    );

    // Flags (suppressed when beamed — beams replace flags)
    if (beamed) return group;
    for (let i = 0; i < info.flags; i++) {
      const flagOffset = i * 8;
      const flagPath = stemDown
        ? `M ${stemX} ${stemY2 - flagOffset} c 8 4 12 12 8 20`
        : `M ${stemX} ${stemY2 + flagOffset} c 8 -4 12 -12 8 -20`;

      group.appendChild(createPath(flagPath, { class: 'note-flag', fill: 'currentColor' }));
    }
  }

  return group;
}
