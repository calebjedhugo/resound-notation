/**
 * Clef renderer.
 * Renders SMuFL Bravura clef glyphs anchored to the appropriate staff
 * reference line (treble: G line, bass: F line, alto/tenor: midline).
 * Percussion clef remains a hand-rolled pair of vertical bars.
 */

import { createGroup, createSvgElement } from '../lib/svgHelpers.js';
import { createSmuflGlyph, SMUFL_SCALE, CLEF_GLYPHS } from '../assets/glyphs.js';

const CLEF_KEY_FOR_TYPE = {
  treble: 'gClef',
  bass: 'fClef',
  alto: 'cClef',
  tenor: 'cClef',
};

/**
 * Create an SVG group representing a clef. Caller positions the group
 * via translate(x, 0); the glyph's left edge sits at x.
 * @param {string} type - "treble", "bass", "alto", "tenor", or "percussion"
 * @returns {SVGGElement}
 */
export function createClef(type) {
  const group = createGroup(`clef clef-${type}`);

  if (type === 'percussion') {
    group.appendChild(
      createSvgElement('rect', { x: 5, y: 0, width: 6, height: 80, fill: 'currentColor' })
    );
    group.appendChild(
      createSvgElement('rect', { x: 15, y: 0, width: 6, height: 80, fill: 'currentColor' })
    );
    return group;
  }

  const glyphKey = CLEF_KEY_FOR_TYPE[type];
  if (!glyphKey) throw new Error(`Unknown clef type: "${type}"`);
  const clef = CLEF_GLYPHS[glyphKey];

  // createSmuflGlyph centers the glyph on local x=0; shift by half-width
  // so visible left edge sits at x=0 (matching caller convention).
  const halfWidth = ((clef.bbox.xMax - clef.bbox.xMin) * SMUFL_SCALE) / 2;
  const symbol = createSmuflGlyph(clef, '');
  symbol.setAttribute('transform', `translate(${halfWidth}, ${clef.refY})`);
  group.appendChild(symbol);

  return group;
}
