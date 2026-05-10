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
