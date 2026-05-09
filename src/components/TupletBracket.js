/**
 * Tuplet bracket and number renderer.
 * Bracket is a horizontal line with end ticks; number is one or more
 * Bravura tuplet digit glyphs centered on the bracket midpoint.
 */

import { createGroup, createLine } from '../lib/svgHelpers.js';
import { createSmuflGlyph, SMUFL_SCALE, TUPLET_DIGITS } from '../assets/glyphs.js';

const TICK_HEIGHT = 4;
const NUMBER_OFFSET = 6;

function digitWidthPx(d) {
  const g = TUPLET_DIGITS[d];
  return (g.bbox.xMax - g.bbox.xMin) * SMUFL_SCALE;
}

function digitYCenterShift(d) {
  // createSmuflGlyph already centers x on local 0; the visible vertical
  // center sits at -((yMin+yMax)/2)*SMUFL_SCALE in local coords. Add this
  // shift to put the digit's visual center at the caller's y.
  const g = TUPLET_DIGITS[d];
  return ((g.bbox.yMin + g.bbox.yMax) / 2) * SMUFL_SCALE;
}

function renderTupletNumber(actual, midX, numberY) {
  const numStr = String(actual);
  const widths = [...numStr].map(digitWidthPx);
  const totalW = widths.reduce((a, b) => a + b, 0);
  const group = createGroup('tuplet-number', { 'data-actual': numStr });
  let cursor = midX - totalW / 2;
  for (let i = 0; i < numStr.length; i += 1) {
    const d = numStr[i];
    const w = widths[i];
    const symbol = createSmuflGlyph(TUPLET_DIGITS[d], '');
    symbol.setAttribute('transform', `translate(${cursor + w / 2}, ${numberY + digitYCenterShift(d)})`);
    group.appendChild(symbol);
    cursor += w;
  }
  return group;
}

/**
 * Render a tuplet bracket and number.
 * @param {Object} params
 * @param {number} params.actual - The actual count (displayed number)
 * @param {number} params.startX - Left edge x position
 * @param {number} params.endX - Right edge x position
 * @param {number} params.y - Y position (above or below notes)
 * @param {boolean} params.above - If true, render above; false, below
 * @param {boolean} params.showBracket - If true, show bracket lines
 * @returns {SVGGElement}
 */
export function renderTupletBracket({ actual, startX, endX, y, above, showBracket }) {
  const group = createGroup('tuplet-bracket-container');

  const midX = (startX + endX) / 2;
  const tickDir = above ? 1 : -1;
  const numberY = above ? y - NUMBER_OFFSET : y + NUMBER_OFFSET + 4;

  if (showBracket) {
    const bracketGroup = createGroup('tuplet-bracket');

    bracketGroup.appendChild(
      createLine(startX, y, endX, y, {
        class: 'tuplet-bracket-line',
        stroke: 'currentColor',
        'stroke-width': '1',
      })
    );

    bracketGroup.appendChild(
      createLine(startX, y, startX, y + TICK_HEIGHT * tickDir, {
        class: 'tuplet-bracket-tick-left',
        stroke: 'currentColor',
        'stroke-width': '1',
      })
    );

    bracketGroup.appendChild(
      createLine(endX, y, endX, y + TICK_HEIGHT * tickDir, {
        class: 'tuplet-bracket-tick-right',
        stroke: 'currentColor',
        'stroke-width': '1',
      })
    );

    group.appendChild(bracketGroup);
  }

  group.appendChild(renderTupletNumber(actual, midX, numberY));

  return group;
}
