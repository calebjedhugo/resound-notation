/** @jest-environment jsdom */
import { breakIntoSystems, justifySystem } from './breakIntoSystems.js';

describe('breakIntoSystems', () => {
  it('returns one system for a piece that fits within the width', () => {
    const intrinsics = [100, 100, 100];
    const plans = breakIntoSystems(intrinsics, 500, () => 100);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      startMeasure: 0,
      endMeasure: 2,
      isLast: true,
    });
    expect(plans[0].intrinsicSum).toBeCloseTo(300);
  });

  it('greedily packs measures and breaks to a new system when next would overflow', () => {
    const intrinsics = [200, 200, 200, 200, 200, 200];
    // Width=500, prelude=100 → music budget=400 → 2 measures per system.
    const plans = breakIntoSystems(intrinsics, 500, () => 100);
    expect(plans).toHaveLength(3);
    expect(plans[0]).toMatchObject({ startMeasure: 0, endMeasure: 1, isLast: false });
    expect(plans[1]).toMatchObject({ startMeasure: 2, endMeasure: 3, isLast: false });
    expect(plans[2]).toMatchObject({ startMeasure: 4, endMeasure: 5, isLast: true });
  });

  it('uses a smaller prelude on non-first systems (no time signature)', () => {
    const intrinsics = [200, 200, 200, 200];
    // First system: prelude 200 → music budget 300 → 1 measure.
    // Subsequent: prelude 80 → music budget 420 → 2 measures.
    const plans = breakIntoSystems(intrinsics, 500, (i) => (i === 0 ? 200 : 80));
    expect(plans).toHaveLength(3);
    expect(plans[0].endMeasure).toBe(0);
    expect(plans[1].endMeasure).toBe(2);
    expect(plans[2]).toMatchObject({ startMeasure: 3, endMeasure: 3, isLast: true });
  });

  it('warns and places a wide single measure solo when it exceeds available width', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const intrinsics = [1000, 100];
    const plans = breakIntoSystems(intrinsics, 500, () => 100);
    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({ startMeasure: 0, endMeasure: 0 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('justifySystem', () => {
  it('stretches intrinsic widths to fill the available music width', () => {
    const plan = { startMeasure: 0, endMeasure: 2, intrinsicSum: 300, isLast: false };
    const intrinsics = [100, 100, 100];
    const targets = justifySystem(plan, intrinsics, 450);
    expect(targets).toHaveLength(3);
    const total = targets.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(450);
    // All measures stretch by the same uniform factor (linear justification).
    expect(targets[0]).toBeCloseTo(150);
    expect(targets[1]).toBeCloseTo(150);
    expect(targets[2]).toBeCloseTo(150);
  });

  it('leaves a last system unjustified when it has only one measure', () => {
    const plan = { startMeasure: 5, endMeasure: 5, intrinsicSum: 100, isLast: true };
    const targets = justifySystem(plan, [0, 0, 0, 0, 0, 100], 400);
    expect(targets).toEqual([100]);
  });

  it('leaves a last system unjustified when stretch would exceed 1.5×', () => {
    const plan = { startMeasure: 0, endMeasure: 1, intrinsicSum: 200, isLast: true };
    // availableMusicWidth=400 → stretch=2.0 → too much.
    const targets = justifySystem(plan, [100, 100], 400);
    expect(targets).toEqual([100, 100]);
  });

  it('justifies a last system when stretch stays ≤ 1.5×', () => {
    const plan = { startMeasure: 0, endMeasure: 1, intrinsicSum: 200, isLast: true };
    const targets = justifySystem(plan, [100, 100], 280);
    expect(targets[0] + targets[1]).toBeCloseTo(280);
    expect(targets[0]).toBeCloseTo(140);
  });

  it('justifies intermediate systems regardless of stretch ratio', () => {
    const plan = { startMeasure: 0, endMeasure: 0, intrinsicSum: 100, isLast: false };
    const targets = justifySystem(plan, [100], 500);
    // Non-last single-measure system DOES justify.
    expect(targets[0]).toBeCloseTo(500);
  });
});
