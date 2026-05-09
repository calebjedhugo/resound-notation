/**
 * Note renderer.
 * Creates SVG group for a single note with head, stem, and flags.
 */

import { createGroup, createEllipse, createLine, createPath } from '../lib/svgHelpers.js';
import { pitchToStaffY } from '../lib/notePositions.js';
import { getDurationInfo } from '../lib/durationSymbols.js';

const MIDDLE_LINE_Y = 50;
const HEAD_RX = 15;
const HEAD_RY = 10;
const HEAD_TILT_DEG = -33.33;
// Stem attaches at the rotated head's actual edge at y=0 (head center row),
// not at ±HEAD_RX — the tilt pulls the boundary inward. Derived from
// solving the rotated ellipse for new_y=0 on the right side.
const STEM_X_OFFSET = (() => {
  const t = (HEAD_TILT_DEG * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const x2 =
    (HEAD_RX * HEAD_RX * HEAD_RY * HEAD_RY * c * c) /
    (HEAD_RY * HEAD_RY * c * c + HEAD_RX * HEAD_RX * s * s);
  return Math.abs(Math.sqrt(x2) / c);
})();
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

  // Note head
  const fill = info.filledHead ? 'currentColor' : 'none';
  const head = createEllipse(0, 0, HEAD_RX, HEAD_RY, {
    class: 'note-head',
    fill,
    stroke: 'currentColor',
    transform: `rotate(${HEAD_TILT_DEG})`,
  });
  group.appendChild(head);

  // Stem
  if (info.hasStem) {
    const stemDown = stemDownOverride !== undefined ? stemDownOverride : y <= MIDDLE_LINE_Y;
    const stemX = stemDown ? -STEM_X_OFFSET : STEM_X_OFFSET;
    const stemY1 = 0;
    const stemY2 = stemDown ? STEM_LENGTH : -STEM_LENGTH;

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
