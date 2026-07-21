/** @jest-environment jsdom */

/**
 * Final-system overflow regression.
 *
 * Repro from the singHarmony2 consumer: hymns ending on a long note
 * (o-holy-night, crown-him-with-many-crowns, …) rendered their LAST system
 * WIDER than every other system (e.g. 2287 units in a 1971-unit page — 16%
 * overfull). Root cause: a last system that goes RAGGED renders its closing
 * barline at `naturalRenderRightX` (the last note's duration-PROPORTIONAL
 * trailing), but the breaker only reserved the MIN_BARLINE_PADDING floor —
 * so a final long note (whole/dotted-whole) pushed the render extent past
 * the container. Slightly-narrow final systems are fine (ragged-right is
 * traditional); WIDER than the page is the bug.
 */

import { NotationRenderer } from './NotationRenderer.js';

const HEAD_HALF_WIDTH = 11.8; // ≈ HEAD_TIP_X
const MIN_TRAILING = 40; // MIN_BARLINE_PADDING

const e8 = (p) => ({ pitch: p, length: '1/8' });
const eighthBar = () => ['C4', 'D4', 'E4', 'F4', 'G4', 'F4', 'E4', 'D4'].map(e8);

// Five dense eighth-note bars, then a two-half-note bar and a whole-note
// final bar — the o-holy-night shape: the last system ends on a long note
// whose proportional trailing exceeds the page at width 800.
function longEndingSong() {
  return {
    timeSignature: [4, 4],
    clef: 'treble',
    notes: [
      ...eighthBar(),
      ...eighthBar(),
      ...eighthBar(),
      ...eighthBar(),
      ...eighthBar(),
      { pitch: 'C5', length: '1/2' },
      { pitch: 'C4', length: '1/2' },
      { pitch: 'C4', length: '1/1' },
    ],
  };
}

function renderAt(width, song) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = new NotationRenderer({ container, width });
  renderer.render(song);
  return { container, renderer };
}

/** Max staff-line x2 per data-system-index. */
function systemWidths(container) {
  const per = new Map();
  for (const g of container.querySelectorAll('[data-system-index]')) {
    const si = parseInt(g.getAttribute('data-system-index'), 10);
    for (const l of g.querySelectorAll('.staff-line')) {
      const x2 = parseFloat(l.getAttribute('x2'));
      per.set(si, Math.max(per.get(si) || 0, x2));
    }
  }
  return per;
}

describe('final-system width', () => {
  it('never renders any system wider than the container', () => {
    const width = 800;
    const { container, renderer } = renderAt(width, longEndingSong());
    const per = systemWidths(container);
    expect(per.size).toBeGreaterThan(1);
    for (const [si, w] of per) {
      expect({ system: si, width: w }).toEqual({
        system: si,
        width: expect.any(Number),
      });
      expect(w).toBeLessThanOrEqual(width + 0.5);
    }
    renderer.clear();
    container.remove();
  });

  it('keeps at least the minimum trailing gap after the page clamp', () => {
    const width = 800;
    const { container, renderer } = renderAt(width, longEndingSong());
    const per = systemWidths(container);
    const lastSystem = Math.max(...per.keys());
    const lastGroup = container.querySelector(
      `[data-system-index="${lastSystem}"]`
    );
    let lastNoteX = -Infinity;
    for (const n of lastGroup.querySelectorAll('.note')) {
      const m = /translate\(\s*([-\d.]+)/.exec(n.getAttribute('transform'));
      if (m) lastNoteX = Math.max(lastNoteX, parseFloat(m[1]));
    }
    expect(lastNoteX).toBeGreaterThan(0);
    // Closing barline (staff right edge) clears the last head's right edge
    // by at least the minimum barline padding — the clamp never crams.
    expect(per.get(lastSystem) - (lastNoteX + HEAD_HALF_WIDTH)).toBeGreaterThanOrEqual(
      MIN_TRAILING - 0.5
    );
    renderer.clear();
    container.remove();
  });

  it('still lets a single measure that cannot fit overflow (degenerate case unchanged)', () => {
    // At width 600 the first system's lone eighth-bar (plus first-system
    // prelude) has a natural width past the container; the breaker warns
    // and renders it solo at natural extent. The page clamp must NOT
    // compress it — compressing below natural is the cram-bug class.
    const width = 600;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { container, renderer } = renderAt(width, longEndingSong());
    warn.mockRestore();
    const per = systemWidths(container);
    expect(Math.max(...per.values())).toBeGreaterThan(width);
    renderer.clear();
    container.remove();
  });
});
