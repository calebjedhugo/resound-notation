/**
 * Glyph data sourced from two libraries:
 *   - Bravura (SIL OFL) — SMuFL reference font; used for noteheads.
 *     Path data lifted directly from ~/Desktop/smufl-glyphs/bravura/*.svg.
 *   - Wikimedia Commons (public domain) — used for accidentals and clefs
 *     pending Bravura migration of those glyphs.
 *
 * SMuFL coordinate system: paths are in font units (upem=1000); 1 staff
 * space = upem/4 = 250 units; y=0 is the staff midline. Bravura SVG assets
 * apply `transform="scale(1,-1)"` to flip into screen coords; we replicate
 * that flip via `scale(SMUFL_SCALE, -SMUFL_SCALE)` at render time, with
 * SMUFL_SCALE = LINE_SPACING/250 = 20/250 = 0.08 px/font-unit.
 */

import { createGroup, createPath } from '../lib/svgHelpers.js';

// SMuFL → staff-coord pixel scale. LINE_SPACING (20px) / fu-per-space (250).
export const SMUFL_SCALE = 0.08;

/* eslint-disable max-len */

// SMuFL Bravura noteheads. Path data verbatim from
// ~/Desktop/smufl-glyphs/bravura/notehead{Black,Half,Whole}.svg.
// `bbox` is the SMuFL spec bounding box in font units; `tipFu` is the
// stem-up tip vertex (max-x outline point). Half and Black share the
// same tip; Whole has no stem.
export const NOTEHEAD_BLACK_GLYPH = {
  d: 'M97 -125C186 -125 295 -43 295 42C295 93 255 125 198 125C88 125 0 44 0 -42C0 -94 43 -125 97 -125Z',
  bbox: { xMin: 0, yMin: -125, xMax: 295, yMax: 125 },
  tipFu: { x: 295, y: 42 },
};

export const NOTEHEAD_HALF_GLYPH = {
  d: 'M97 -125C262 -125 295 9 295 42C295 93 254 125 196 125C47 125 0 10 0 -42C0 -95 42 -125 97 -125ZM75 -87C54 -87 42 -76 35 -64C32 -58 29 -51 29 -44C29 5 174 84 221 84C240 84 251 75 258 63C261 57 264 51 264 44C264 1 123 -87 75 -87Z',
  bbox: { xMin: 0, yMin: -125, xMax: 295, yMax: 125 },
  tipFu: { x: 295, y: 42 },
  fillRule: 'evenodd',
};

export const NOTEHEAD_WHOLE_GLYPH = {
  d: 'M216 125C83 125 0 70 0 2C0 -65 57 -125 206 -125C370 -125 422 -68 422 2C422 73 309 125 216 125ZM111 63C122 98 159 103 190 103C259 103 314 29 314 -31C314 -62 301 -90 268 -98C258 -101 247 -102 237 -102C201 -102 164 -78 143 -50C123 -27 108 7 108 39C108 47 109 55 111 63Z',
  bbox: { xMin: 0, yMin: -125, xMax: 422, yMax: 125 },
  fillRule: 'evenodd',
};

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
  // Stem attaches at the long-axis tip per engraving convention. The path's
  // max-x vertex is (347, 65) → vb (1.388, 0.288), but visually the outline
  // curls in slightly before that vertex; pulling the tip 1px toward center
  // (vb-x 1.388 → 1.333 = ~1px in local coords at scale 18.18) lands the
  // stem flush with the visible curve.
  tipVbX: 1.333,
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

/**
 * Render a SMuFL glyph at engraving scale (SMUFL_SCALE px/font-unit).
 * Glyph path is in SMuFL font coords (y=0 = staff midline, y positive =
 * above midline). The inner transform applies SMUFL_SCALE in x and
 * -SMUFL_SCALE in y to scale + flip Y into SVG screen coords. Outer
 * transform centers the glyph horizontally on local x=0; vertical anchor
 * stays at the SMuFL origin (midline). Caller positions via translate().
 *
 * @param {{d:string, bbox:{xMin:number,xMax:number,yMin:number,yMax:number}, fillRule?:string}} glyph
 * @param {string} className
 * @returns {SVGGElement}
 */
export function createSmuflGlyph(glyph, className) {
  const cx = (glyph.bbox.xMin + glyph.bbox.xMax) / 2;
  const wrapper = createGroup(className);
  const inner = createGroup('', {
    transform: `translate(${-cx * SMUFL_SCALE}, 0) scale(${SMUFL_SCALE}, ${-SMUFL_SCALE})`,
  });
  const pathAttrs = { fill: 'currentColor' };
  if (glyph.fillRule) pathAttrs['fill-rule'] = glyph.fillRule;
  inner.appendChild(createPath(glyph.d, pathAttrs));
  wrapper.appendChild(inner);
  return wrapper;
}

/**
 * Stem-up tip in local pixel coords for a SMuFL glyph that declares
 * `tipFu` (path-coord max-x outline vertex). Stem-down tip is the
 * reflection (-x, -y). Returns null if not declared.
 */
export function smuflTip(glyph) {
  if (!glyph.tipFu) return null;
  const cx = (glyph.bbox.xMin + glyph.bbox.xMax) / 2;
  return {
    x: (glyph.tipFu.x - cx) * SMUFL_SCALE,
    y: -glyph.tipFu.y * SMUFL_SCALE,
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
