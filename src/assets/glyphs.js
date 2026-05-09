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
// Stem anchor (tipFu) is pulled ~1px (12 font units at SMUFL_SCALE 0.08)
// toward the head's center along the long axis from the path's max-x
// vertex (295, 42). Without the pullback the stem butts up against the
// head outline; the inward shift gives the engraved overlap so the stem
// reads as joining the head cleanly.
export const NOTEHEAD_BLACK_GLYPH = {
  d: 'M97 -125C186 -125 295 -43 295 42C295 93 255 125 198 125C88 125 0 44 0 -42C0 -94 43 -125 97 -125Z',
  bbox: { xMin: 0, yMin: -125, xMax: 295, yMax: 125 },
  tipFu: { x: 283, y: 39 },
};

export const NOTEHEAD_HALF_GLYPH = {
  d: 'M97 -125C262 -125 295 9 295 42C295 93 254 125 196 125C47 125 0 10 0 -42C0 -95 42 -125 97 -125ZM75 -87C54 -87 42 -76 35 -64C32 -58 29 -51 29 -44C29 5 174 84 221 84C240 84 251 75 258 63C261 57 264 51 264 44C264 1 123 -87 75 -87Z',
  bbox: { xMin: 0, yMin: -125, xMax: 295, yMax: 125 },
  tipFu: { x: 283, y: 39 },
  fillRule: 'evenodd',
};

// SMuFL Bravura time-signature digits 0-9. Each digit is ~500 fu tall
// (2 staff spaces, fitting numerator-above-midline / denominator-below).
// Path data verbatim from ~/Desktop/smufl-glyphs/bravura/timeSig*.svg.
export const TIME_SIG_DIGITS = {
  '0': { d: 'M450 0C450 139 354 251 235 251C116 251 20 139 20 0C20 -138 116 -250 235 -250C354 -250 450 -138 450 0ZM235 220C276 220 310 125 310 7C310 -110 276 -205 235 -205C193 -205 160 -110 160 7C160 125 193 220 235 220Z', bbox: { xMin: 20, yMin: -250, xMax: 450, yMax: 251 }, fillRule: 'evenodd' },
  '1': { d: 'M24 13C24 13 20 7 20 0C20 -5 23 -11 31 -14C35 -15 39 -16 40 -16C50 -16 54 -7 54 -7C54 -7 97 62 108 81C112 88 116 91 118 91C122 91 124 83 124 77V-181C124 -204 101 -219 80 -219C73 -219 63 -222 63 -234C63 -245 72 -250 85 -250H298C314 -250 314 -234 314 -234C314 -234 314 -219 299 -219C285 -219 267 -201 267 -184V228C267 244 261 250 247 251C233 251 208 247 195 247C176 247 158 248 143 250C141 250 139 251 138 251C128 251 124 241 120 232Z', bbox: { xMin: 20, yMin: -250, xMax: 314, yMax: 251 } },
  '2': { d: 'M421 -91C421 -79 416 -77 409 -77C401 -77 398 -81 396 -88L395 -89C385 -114 377 -133 356 -133C351 -133 346 -132 339 -130C326 -125 319 -124 309 -119C289 -111 242 -95 201 -95C188 -95 175 -97 164 -101C186 -65 271 -35 293 -29C363 -10 426 19 426 102C426 208 322 254 229 254C159 254 97 248 48 191C31 170 20 145 20 118C20 104 23 90 29 75C44 44 75 20 111 20C172 20 181 83 181 108C181 168 112 171 112 191C114 205 132 229 191 229C280 229 281 162 281 133C281 42 206 -27 134 -71C79 -106 40 -155 23 -220L22 -223C22 -236 33 -257 48 -257C70 -257 82 -196 141 -196C181 -196 196 -250 285 -250C328 -250 405 -246 421 -91Z', bbox: { xMin: 20, yMin: -257, xMax: 426, yMax: 254 } },
  '3': { d: 'M213 248C212 248 211 248 209 248L202 249C201 249 199 249 198 249C112 249 26 192 26 139C26 106 45 62 107 58H112C156 58 178 90 178 123V131C175 168 150 170 145 172C140 174 125 172 125 186V190C127 207 158 215 167 215C252 215 260 162 260 138V131C260 57 201 28 138 25C128 24 114 19 114 8C114 -4 131 -4 139 -4C254 -4 263 -82 263 -95C263 -201 209 -213 187 -213C183 -213 179 -212 178 -212C170 -211 151 -211 150 -196V-191C150 -169 172 -154 173 -125C173 -83 144 -53 101 -53C97 -53 94 -53 90 -54C73 -57 54 -67 42 -80C25 -95 20 -119 20 -141C22 -219 93 -249 191 -251H200C299 -251 401 -200 401 -112V-105C399 -76 392 -57 373 -35C367 -27 359 -20 349 -14L328 -2L295 7C290 8 287 8 285 12C284 14 284 15 284 17C284 21 285 25 288 26C299 29 310 30 319 35C359 54 380 80 380 126C380 218 255 245 213 248Z', bbox: { xMin: 20, yMin: -251, xMax: 401, yMax: 249 } },
  '4': { d: 'M362 -74V140C362 148 361 157 350 157C341 157 336 155 330 148L235 33C231 28 226 22 226 10V-74H91C171 -6 331 221 334 233L335 236C335 245 328 251 320 251C311 251 270 249 252 249C234 249 189 251 181 251C172 251 158 248 158 232C158 108 60 -31 30 -73L24 -81C24 -81 24 -82 24 -82L23 -83C21 -88 20 -92 20 -95C20 -105 28 -112 40 -112H226V-175C226 -202 204 -210 186 -210C170 -210 163 -219 163 -229C163 -239 167 -250 182 -250H395C405 -250 415 -243 415 -229C415 -215 403 -209 393 -209C383 -209 362 -203 362 -171V-112H435C445 -112 450 -105 450 -93C450 -81 446 -74 435 -74Z', bbox: { xMin: 20, yMin: -250, xMax: 450, yMax: 251 } },
  '5': { d: 'M76 59C76 59 80 115 81 124C82 132 87 137 96 137H100C110 135 157 128 198 128C337 128 342 208 342 224C342 237 339 245 328 245C315 245 237 236 205 236C173 236 87 244 70 246C52 246 47 237 46 229L35 7V5C35 -8 45 -10 55 -10C65 -10 66 -1 77 10C87 20 111 43 145 43C179 43 248 24 248 -87C248 -197 189 -211 163 -211C155 -211 147 -211 140 -208C135 -205 129 -201 128 -194C128 -187 135 -183 140 -180C163 -166 178 -141 178 -113C178 -69 143 -35 100 -35C46 -35 24 -74 21 -109C20 -115 20 -121 20 -127C20 -210 74 -251 197 -251C317 -251 383 -177 383 -87C383 4 309 78 218 78C160 78 117 68 85 49C83 48 81 48 80 48C76 48 76 52 76 55Z', bbox: { xMin: 20, yMin: -251, xMax: 383, yMax: 246 } },
  '6': { d: 'M305 83C347 83 385 116 385 159C385 163 385 166 384 170C374 234 296 251 242 251C166 250 95 213 59 145C37 103 20 50 20 3V-1C21 -47 29 -99 51 -139C92 -213 141 -249 225 -249C270 -249 320 -242 356 -213C391 -185 414 -140 414 -95C414 -17 340 50 263 50C231 50 198 38 172 15C170 13 168 13 166 13C160 13 157 21 157 37C160 222 219 227 240 227C260 227 273 222 273 212C273 198 254 186 248 174C243 165 241 155 241 145C241 130 246 115 256 104C263 91 292 83 305 83ZM222 2C254 2 281 -48 281 -110C281 -172 254 -222 222 -222C190 -222 164 -172 164 -110C164 -48 190 2 222 2Z', bbox: { xMin: 20, yMin: -249, xMax: 414, yMax: 251 }, fillRule: 'evenodd' },
  '7': { d: 'M421 204C421 231 421 244 404 244C403 244 387 240 383 233C376 221 362 164 337 164C312 164 265 249 182 249C124 249 109 226 95 213C81 200 75 196 68 195C60 195 47 209 42 219C40 223 35 226 30 226C25 226 20 223 20 214V49C20 49 21 33 31 33C39 33 42 42 46 53C56 78 69 136 114 136C154 136 202 61 260 61C288 61 302 76 310 82C313 84 317 86 319 86C323 86 325 83 326 77C326 49 249 -7 189 -78C151 -122 120 -180 120 -219C120 -240 120 -250 139 -250C157 -250 179 -241 204 -241C229 -241 276 -250 286 -250C296 -250 302 -242 302 -213C302 -46 421 97 421 200Z', bbox: { xMin: 20, yMin: -250, xMax: 421, yMax: 249 } },
  '8': { d: 'M334 36C370 59 394 92 394 142C394 244 247 259 220 259C104 259 25 206 25 122C25 53 64 16 112 -11C60 -36 20 -69 20 -132C20 -219 110 -259 209 -259C309 -259 416 -216 416 -81C416 -21 381 12 334 36ZM282 59C202 87 117 104 117 167C117 209 174 230 218 230C250 230 335 214 335 144C335 104 315 78 282 59ZM205 -226C138 -226 77 -192 77 -127C77 -87 112 -50 156 -33C229 -65 303 -86 303 -152C303 -192 272 -226 205 -226Z', bbox: { xMin: 20, yMin: -259, xMax: 416, yMax: 259 }, fillRule: 'evenodd' },
  '9': { d: 'M129 -81C87 -81 49 -114 49 -157C49 -161 49 -164 50 -168C60 -232 138 -249 192 -249C268 -248 339 -211 375 -143C397 -101 414 -48 414 -1V3C413 49 405 101 383 141C342 215 293 251 209 251C164 251 114 244 78 215C43 187 20 142 20 97C20 19 94 -48 171 -48C203 -48 236 -36 262 -13C264 -11 266 -11 268 -11C274 -11 277 -19 277 -35C274 -220 215 -225 194 -225C174 -225 161 -220 161 -210C161 -196 180 -184 186 -172C191 -163 193 -153 193 -143C193 -128 188 -113 178 -102C171 -89 142 -81 129 -81ZM212 0C180 0 153 50 153 112C153 174 180 224 212 224C244 224 270 174 270 112C270 50 244 0 212 0Z', bbox: { xMin: 20, yMin: -249, xMax: 414, yMax: 251 }, fillRule: 'evenodd' },
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
