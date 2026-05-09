/**
 * Time signature renderer.
 * Renders numerator and denominator as Bravura SMuFL digit glyphs.
 */

import { createGroup } from '../lib/svgHelpers.js';
import { createSmuflGlyph, SMUFL_SCALE, TIME_SIG_DIGITS } from '../assets/glyphs.js';

// SMuFL digits' y=0 is the staff midline. Numerator centers in the upper
// staff half (y=30 = midpoint of top line and middle line); denominator
// in the lower half (y=70).
const NUMERATOR_Y = 30;
const DENOMINATOR_Y = 70;

function digitWidthPx(glyph) {
  return (glyph.bbox.xMax - glyph.bbox.xMin) * SMUFL_SCALE;
}

function renderDigitsGroup(numStr, y, className) {
  const group = createGroup(className);
  const widths = [...numStr].map((d) => digitWidthPx(TIME_SIG_DIGITS[d]));
  const totalW = widths.reduce((a, b) => a + b, 0);
  let cursor = -totalW / 2;
  for (let i = 0; i < numStr.length; i += 1) {
    const w = widths[i];
    const digit = createSmuflGlyph(TIME_SIG_DIGITS[numStr[i]], '');
    digit.setAttribute('transform', `translate(${cursor + w / 2}, ${y})`);
    group.appendChild(digit);
    cursor += w;
  }
  return { element: group, width: totalW };
}

/**
 * Create a time-signature group. The group's local x=0 is the horizontal
 * center of the signature; caller positions via translate(centerX, 0).
 *
 * @param {[number, number]} timeSignature - [beats, beatValue]
 * @returns {{ element: SVGGElement, width: number }}
 */
export function createTimeSignature(timeSignature) {
  const [beats, beatValue] = timeSignature;
  const group = createGroup('time-signature', {
    'data-beats': String(beats),
    'data-beat-value': String(beatValue),
  });

  const num = renderDigitsGroup(String(beats), NUMERATOR_Y, 'time-numerator');
  const denom = renderDigitsGroup(String(beatValue), DENOMINATOR_Y, 'time-denominator');

  group.appendChild(num.element);
  group.appendChild(denom.element);

  return { element: group, width: Math.max(num.width, denom.width) };
}
