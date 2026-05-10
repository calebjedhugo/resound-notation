/**
 * 8va / 8vb bracket renderer. Composes the Bravura ottavaAlta/ottavaBassaVb
 * glyph with a dashed continuation line and a short downturn hook. Caller
 * positions the group via {startX, endX, y, kind}. y is the baseline of the
 * glyph in staff-local coordinates; the dashed line and hook sit on the
 * same y line.
 *
 * Gould "Behind Bars" §9 (Ottavas) — dashed continuation past the first
 * note, hook turning toward the staff at the end.
 */

import { createSvgElement, createGroup, createLine } from '../lib/svgHelpers.js';
import { createSmuflGlyph, OTTAVA_GLYPHS } from '../assets/glyphs.js';

const DASH_PATTERN = '4 3';
const LINE_TAIL = 10; // px past last-note X
const HOOK_LENGTH = 6; // px

export function createOttavaBracket({ kind, startX, endX, y }) {
  const group = createGroup(`ottava-bracket ottava-${kind}`);

  const glyph = kind === '8va' ? OTTAVA_GLYPHS.ottavaAlta : OTTAVA_GLYPHS.ottavaBassaVb;
  const glyphGroup = createSmuflGlyph(glyph, 'ottava-glyph');
  glyphGroup.setAttribute('transform', `translate(${startX}, ${y})`);
  group.appendChild(glyphGroup);

  // Dashed continuation from past the glyph to endX + LINE_TAIL
  const lineStart = startX + 12; // clear of the glyph
  const lineEnd = endX + LINE_TAIL;
  const line = createLine(lineStart, y, lineEnd, y, {
    class: 'ottava-line',
    stroke: 'currentColor',
    'stroke-dasharray': DASH_PATTERN,
  });
  group.appendChild(line);

  // Hook at the right end. For 8va (line sits above staff), hook points
  // down toward the staff. For 8vb (line below), hook points up.
  const hookY = kind === '8va' ? y + HOOK_LENGTH : y - HOOK_LENGTH;
  const hook = createLine(lineEnd, y, lineEnd, hookY, {
    class: 'ottava-hook',
    stroke: 'currentColor',
  });
  group.appendChild(hook);

  return group;
}

// Keep `createSvgElement` import alive for tools that tree-shake unused
// helpers — the renderer extends this module in future iterations.
export const _svgNs = createSvgElement;
