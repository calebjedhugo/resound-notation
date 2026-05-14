/**
 * Point dynamic renderer.
 * Renders SMuFL Bravura dynamic letter glyphs (p, m, f, r, s, z, n)
 * laid out side-by-side for compound markings (pp, mf, ff, sfz, etc.).
 */

import { createGroup } from '../lib/svgHelpers.js';
import { createSmuflGlyph, SMUFL_SCALE, DYNAMIC_LETTERS } from '../assets/glyphs.js';

function letterAdvancePx(letter) {
  // Use bbox xMax (advance width approx for SMuFL dynamic letters);
  // most descenders extend to negative xMin and shouldn't add to spacing.
  const g = DYNAMIC_LETTERS[letter];
  return g.bbox.xMax * SMUFL_SCALE;
}

/**
 * Visual left offset (in px) of a rendered dynamic group, relative to its
 * anchor x. Returns a negative value when the first letter has a descender
 * extending left of its advance box (e.g. "p"). Used by hairpin layout to
 * pad the closing tip away from the letter glyph (Gould: ≥0.5 staff space
 * between hairpin tip and adjacent dynamic letter).
 */
export function dynamicLeftVisualOffset(dynamic) {
  const letters = [...dynamic.toLowerCase()].filter((c) => DYNAMIC_LETTERS[c]);
  if (letters.length === 0) return 0;
  const advances = letters.map(letterAdvancePx);
  const totalAdvance = advances.reduce((a, b) => a + b, 0);
  const first = DYNAMIC_LETTERS[letters[0]];
  const cx = (first.bbox.xMin + first.bbox.xMax) / 2;
  // First letter's anchor sits at -totalAdvance/2 + advances[0]/2.
  const firstAnchor = -totalAdvance / 2 + advances[0] / 2;
  // Visual left of the first letter, in dynamic-group local x.
  return firstAnchor + (first.bbox.xMin - cx) * SMUFL_SCALE;
}

/**
 * Visual vertical center (in px) of a rendered dynamic group, relative to
 * its anchor y (the glyph baseline). Negative = above baseline. Used by
 * hairpin layout so the wedge's center line aligns with the letter's
 * visual centerline.
 */
export function dynamicCenterYOffset(dynamic) {
  const letters = [...dynamic.toLowerCase()].filter((c) => DYNAMIC_LETTERS[c]);
  if (letters.length === 0) return 0;
  // SMuFL glyphs flip via scale(_, -SMUFL_SCALE): visual top = -yMax*scale,
  // visual bottom = -yMin*scale. Take the union across letters.
  let topVisual = Infinity;
  let bottomVisual = -Infinity;
  for (const l of letters) {
    const g = DYNAMIC_LETTERS[l];
    const t = -g.bbox.yMax * SMUFL_SCALE;
    const b = -g.bbox.yMin * SMUFL_SCALE;
    if (t < topVisual) topVisual = t;
    if (b > bottomVisual) bottomVisual = b;
  }
  return (topVisual + bottomVisual) / 2;
}

/**
 * Render a point dynamic marking. Letters lay out left-to-right and
 * the whole stack centers horizontally on local x=0.
 *
 * @param {Object} params
 * @param {string} params.dynamic - Dynamic value (e.g. "f", "mf", "pp")
 * @param {number} params.x - Horizontal position (centered on this x)
 * @param {number} params.y - Vertical position
 * @returns {SVGGElement}
 */
export function renderDynamic({ dynamic, x, y }) {
  const group = createGroup('dynamic', {
    'data-dynamic': dynamic,
    transform: `translate(${x}, ${y})`,
  });

  const letters = [...dynamic.toLowerCase()].filter((c) => DYNAMIC_LETTERS[c]);
  if (letters.length === 0) return group;

  const advances = letters.map(letterAdvancePx);
  const totalAdvance = advances.reduce((a, b) => a + b, 0);
  let cursor = -totalAdvance / 2;
  for (let i = 0; i < letters.length; i += 1) {
    const w = advances[i];
    const symbol = createSmuflGlyph(DYNAMIC_LETTERS[letters[i]], '');
    // Place each letter at cursor + w/2 (the bbox visual center) so
    // overlap from negative-xMin descenders looks intentional, like
    // engraved italic ff/pp markings.
    symbol.setAttribute('transform', `translate(${cursor + w / 2}, 0)`);
    group.appendChild(symbol);
    cursor += w;
  }

  return group;
}
