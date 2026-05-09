/**
 * Public-domain glyph data lifted from Wikimedia Commons SVGs.
 * Each entry stores: path d-string, the asset's inline matrix transform
 * (path-coords → asset-viewBox-coords), and the glyph's effective viewBox
 * extent. Consumers scale to a target pixel height in the staff coordinate
 * system (LINE_SPACING = 20px per staff space).
 *
 * Sources (all public domain):
 *   sharp   — Wikimedia Commons Dièse.svg
 *   flat    — Wikimedia Commons Bémol.svg
 *   natural — Wikimedia Commons Bécarre.svg
 *   notehead — Wikimedia Commons BlackNotehead.svg (rendered inline; included
 *             for documentation; the renderer uses an equivalent ellipse).
 */

import { createGroup, createPath } from '../lib/svgHelpers.js';

/* eslint-disable max-len */
export const SHARP_GLYPH = {
  d: 'm 216,-312 c 0,-10 -8,-19 -18,-19 -10,0 -19,9 -19,19 v 145 l -83,-31 v -158 c 0,-10 -9,-19 -19,-19 -10,0 -18,9 -18,19 v 145 l -32,-12 c -2,-1 -5,-1 -7,-1 -11,0 -20,9 -20,20 v 60 c 0,8 5,16 13,19 l 46,16 V 51 L 27,40 C 25,39 22,39 20,39 9,39 0,48 0,59 v 60 c 0,8 5,15 13,18 l 46,17 v 158 c 0,10 8,19 18,19 10,0 19,-9 19,-19 V 167 l 83,31 v 158 c 0,10 9,19 19,19 10,0 18,-9 18,-19 V 211 l 32,12 c 2,1 5,1 7,1 11,0 20,-9 20,-20 v -60 c 0,-8 -5,-16 -13,-19 L 216,109 V -51 l 32,11 c 2,1 5,1 7,1 11,0 20,-9 20,-20 v -60 c 0,-8 -5,-15 -13,-18 l -46,-17 V -312 z M 96,65 V -95 l 83,30 V 95 z',
  innerTransform: 'matrix(0.004, 0, 0, -0.004, 0, 1.5)',
  vbWidth: 1.12,
  vbHeight: 2.75,
};

export const FLAT_GLYPH = {
  d: 'm 27,41 -1,-66 v -11 c 0,-22 1,-44 4,-66 45,38 93,80 93,139 0,33 -14,67 -43,67 C 49,104 28,74 27,41 z m -42,-179 -12,595 c 8,5 18,8 27,8 9,0 19,-3 27,-8 L 20,112 c 25,21 58,34 91,34 52,0 89,-48 89,-102 0,-80 -86,-117 -147,-169 -15,-13 -24,-38 -45,-38 -13,0 -23,11 -23,25 z',
  innerTransform: 'matrix(0.004, 0, 0, -0.004, 0.108, 1.86)',
  vbWidth: 0.91,
  vbHeight: 2.5,
};

// Half-note head — outer outline + inner cutout, rendered with fill-rule
// evenodd. Path lifted from Wikimedia Commons Blanche.svg (PD); the original
// asset includes a stem rectangle which we drop here (we render stems
// separately). Inner transform combines the asset's wrapper translate with
// its inline matrix transform: matrix(0.004,0,0,-0.004,0,0.548). After this
// transform the notehead occupies viewBox x ∈ [0, 1.388], y ∈ [0, 1.10].
export const HALF_NOTEHEAD_GLYPH = {
  d: 'm 315,65 c 0,24 -21,41 -42,41 -4,0 -8,0 -12,-1 C 230,96 184,65 147,41 110,17 63,-12 43,-37 36,-45 32,-55 32,-65 c 0,-24 21,-41 42,-41 4,0 8,0 12,1 31,9 78,40 115,64 37,24 84,53 104,78 7,8 10,18 10,28 z m -51,72 c 47,0 83,-21 83,-72 0,-19 -4,-37 -10,-56 -12,-38 -32,-74 -65,-96 -54,-36 -113,-51 -188,-51 -47,0 -84,22 -84,73 0,19 5,37 11,56 12,38 31,74 64,96 54,36 114,50 189,50 z',
  innerTransform: 'matrix(0.004, 0, 0, -0.004, 0, 0.548)',
  vbWidth: 1.388,
  vbHeight: 1.10,
  fillRule: 'evenodd',
  // Stem attaches at the long-axis tip per engraving convention — the
  // top-right corner of path 2 (vertex (347, 65) in path coords) maps to
  // viewBox (1.388, 0.288). Bottom-left tip (vertex (0, -65)) maps to
  // viewBox (0, 0.808). Both are mirrored about the bbox center (0.694, 0.55).
  tipVbX: 1.388,
  tipVbY: 0.288,
};

export const NATURAL_GLYPH = {
  d: 'm -8,375 c 8,4 17,7 26,7 9,0 17,-3 25,-7 l -3,-183 106,20 h 3 c 10,0 18,-7 18,-17 l 7,-570 c -8,-4 -16,-7 -25,-7 -9,0 -17,3 -25,7 l 3,183 -106,-20 h -3 c -10,0 -18,7 -18,17 z M 131,112 39,95 l -3,-207 92,17 z',
  innerTransform: 'matrix(0.004, 0, 0, -0.004, 0.032, 1.528)',
  vbWidth: 0.73,
  vbHeight: 3.06,
};
/* eslint-enable max-len */

/**
 * Render a glyph as an SVG group, scaled to targetHeight (px) and centered
 * on the local origin (0, 0). Caller positions the group via translate().
 *
 * @param {{d:string, innerTransform:string, vbWidth:number, vbHeight:number}} glyph
 * @param {number} targetHeight  Desired rendered height in pixels (staff coords)
 * @param {string} className
 * @returns {SVGGElement}
 */
/**
 * For glyphs that declare `tipVbX`/`tipVbY`, return the local-coord
 * (x, y) of the head's long-axis tip (the right tip; left tip is the
 * negation). Stems attach here per standard engraving convention.
 * Returns null if the glyph doesn't declare a tip.
 */
export function glyphTip(glyph, targetHeight) {
  if (typeof glyph.tipVbX !== 'number' || typeof glyph.tipVbY !== 'number') return null;
  const scale = targetHeight / glyph.vbHeight;
  return {
    x: (glyph.tipVbX - glyph.vbWidth / 2) * scale,
    y: (glyph.tipVbY - glyph.vbHeight / 2) * scale,
  };
}

export function createGlyph(glyph, targetHeight, className) {
  const scale = targetHeight / glyph.vbHeight;
  const w = glyph.vbWidth * scale;
  const h = glyph.vbHeight * scale;
  // Outer group has NO transform — the caller positions it via translate().
  // Centering + scale lives on an inner group so caller-set transforms
  // don't clobber it.
  const wrapper = createGroup(className);
  const centerer = createGroup('', {
    transform: `translate(${-w / 2}, ${-h / 2}) scale(${scale})`,
  });
  const inner = createGroup('', { transform: glyph.innerTransform });
  const pathAttrs = { fill: 'currentColor' };
  if (glyph.fillRule) pathAttrs['fill-rule'] = glyph.fillRule;
  inner.appendChild(createPath(glyph.d, pathAttrs));
  centerer.appendChild(inner);
  wrapper.appendChild(centerer);
  return wrapper;
}
