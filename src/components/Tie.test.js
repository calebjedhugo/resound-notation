/** @jest-environment jsdom */

import { createNotationContext } from '../__tests__/helpers/testUtils.js';
import { createTieArc } from './Tie.js';

describe('tie rendering', () => {
  let ctx;

  beforeEach(() => {
    ctx = createNotationContext();
  });

  afterEach(() => {
    ctx.destroy();
  });

  it('renders a tie arc between two tied notes', () => {
    ctx.render([
      { pitch: 'C4', length: '1/4', tie: 'start' },
      { pitch: 'C4', length: '1/4', tie: 'stop' },
    ]);

    const ties = ctx.getTies();
    expect(ties).toHaveLength(1);
    expect(ties[0].tagName).toBe('path');
  });

  it('renders tie as a filled closed path (engraver-quality variable thickness)', () => {
    ctx.render([
      { pitch: 'C4', length: '1/4', tie: 'start' },
      { pitch: 'C4', length: '1/4', tie: 'stop' },
    ]);

    const tie = ctx.getTies()[0];
    expect(tie.getAttribute('fill')).toBe('currentColor');
    expect(tie.getAttribute('stroke')).toBe('none');
    const d = tie.getAttribute('d');
    expect(d).toMatch(/^M\s/);
    // Two cubic Beziers joined and closed -> two C commands and a Z
    expect((d.match(/C/g) || []).length).toBe(2);
    expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('does not render ties when no tie properties are present', () => {
    ctx.render([
      { pitch: 'C4', length: '1/4' },
      { pitch: 'C4', length: '1/4' },
    ]);
    expect(ctx.getTies()).toHaveLength(0);
  });

  it('flattens a cross-barline tie to the arc-height cap (JOB 3)', () => {
    // Two tied whole notes span a barline — a long tie. Engraving practice
    // (SPEC-lyric-spacing.md JOB 3) keeps long ties SHALLOW: arc height
    // grows sub-linearly and caps at 14.
    ctx.render({
      timeSignature: [4, 4],
      notes: [
        { pitch: 'C4', length: '1/1', tie: 'start' },
        { pitch: 'C4', length: '1/1', tie: 'stop' },
      ],
    });
    const tie = ctx.getTies()[0];
    const nums = tie.getAttribute('d').match(/-?[\d.]+/g).map(Number);
    const startX = nums[0];
    const startY = nums[1];
    const endX = nums[6];
    const span = Math.abs(endX - startX);
    expect(span).toBeGreaterThan(102); // past the cap onset — a LONG tie
    const arcHeight = Math.abs(nums[3] - startY);
    expect(arcHeight).toBeLessThanOrEqual(14 + 1e-9);
    expect(arcHeight).toBeCloseTo(14, 6);
  });
});

describe('createTieArc (geometry)', () => {
  it('returns an SVG path element with class "tie"', () => {
    const path = createTieArc({ x1: 100, y1: 50, x2: 180, y2: 50, direction: 'below' });
    expect(path.tagName).toBe('path');
    expect(path.getAttribute('class')).toBe('tie');
  });

  it('curves downward when direction is "below"', () => {
    const path = createTieArc({ x1: 100, y1: 50, x2: 180, y2: 50, direction: 'below' });
    const d = path.getAttribute('d');
    // First cubic Bezier control points should have Y > startY (50 + offset)
    // Format: M x1 y1 C cpx1 cpy1 cpx2 cpy2 x2 y2 C ...
    const nums = d.match(/-?[\d.]+/g).map(Number);
    expect(nums[3]).toBeGreaterThan(50); // outer cp1 y, below
    expect(nums[5]).toBeGreaterThan(50); // outer cp2 y, below
  });

  it('curves upward when direction is "above"', () => {
    const path = createTieArc({ x1: 100, y1: 50, x2: 180, y2: 50, direction: 'above' });
    const nums = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
    expect(nums[3]).toBeLessThan(50);
    expect(nums[5]).toBeLessThan(50);
  });

  it('scales arc height with horizontal distance', () => {
    const short = createTieArc({ x1: 100, y1: 50, x2: 130, y2: 50, direction: 'below' });
    const long = createTieArc({ x1: 100, y1: 50, x2: 300, y2: 50, direction: 'below' });
    const shortNums = short.getAttribute('d').match(/-?[\d.]+/g).map(Number);
    const longNums = long.getAttribute('d').match(/-?[\d.]+/g).map(Number);
    expect(longNums[3] - 50).toBeGreaterThan(shortNums[3] - 50);
  });
});

describe('long-tie flattening (SPEC-lyric-spacing.md JOB 3)', () => {
  const arcHeightAt = (span) => {
    const path = createTieArc({
      x1: 100,
      y1: 50,
      x2: 100 + span,
      y2: 50,
      direction: 'below',
    });
    const nums = path.getAttribute('d').match(/-?[\d.]+/g).map(Number);
    return nums[3] - 63; // outer cp1 y minus startY (below => positive)
  };

  it('short ties render byte-identical to the pre-change output (pinned paths)', () => {
    // Exact 'd' strings captured from commit 13957b7 (pre-JOB-3 Tie.js).
    // Spans <= 40px — "a couple of noteheads apart" (~1.7 notehead widths)
    // — sit in the 8px floor region of both the old and new formulas, so
    // the constants are chosen to reproduce them exactly.
    const pin = (span, expected) => {
      const path = createTieArc({
        x1: 100,
        y1: 50,
        x2: 100 + span,
        y2: 50,
        direction: 'below',
      });
      expect(path.getAttribute('d')).toBe(expected);
    };
    pin(
      20,
      'M 100 63 C 106.6 71 113.4 71 120 63 C 113.4 65.13333333333333 106.6 65.13333333333333 100 63 Z'
    );
    pin(
      30,
      'M 100 63 C 109.9 71 120.1 71 130 63 C 120.1 65.13333333333333 109.9 65.13333333333333 100 63 Z'
    );
    pin(
      40,
      'M 100 63 C 113.2 71 126.8 71 140 63 C 126.8 65.13333333333333 113.2 65.13333333333333 100 63 Z'
    );
  });

  it('caps long-tie arc height at 14', () => {
    expect(arcHeightAt(150)).toBeCloseTo(14, 9);
    expect(arcHeightAt(300)).toBeCloseTo(14, 9);
    expect(arcHeightAt(1000)).toBeCloseTo(14, 9);
  });

  it('grows monotonically but sub-linearly between floor and cap', () => {
    const spans = [40, 50, 60, 70, 80, 90, 100];
    const heights = spans.map(arcHeightAt);
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - 1e-9);
    }
    // Sub-linear: doubling the span from the floor edge grows the height
    // by ~2^0.6 (≈1.52), well under 2x — and under the old linear 0.2*span.
    expect(arcHeightAt(80)).toBeLessThan(2 * arcHeightAt(40) - 1);
    expect(arcHeightAt(80)).toBeCloseTo(8 * Math.pow(2, 0.6), 6);
    expect(arcHeightAt(80)).toBeLessThan(0.2 * 80); // flatter than before
  });
});
