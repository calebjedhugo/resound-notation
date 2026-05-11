/** @jest-environment jsdom */
import {
  breakIntoSystems,
  justifySystem,
  justifySystemSpring,
} from './breakIntoSystems.js';

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

  it('justifies a multi-measure last system regardless of stretch ratio', () => {
    // Optimal break-point selection avoids producing pathological tiny
    // final systems, so the workaround ">1.5 stretch → leave ragged"
    // rule is gone. Multi-measure final systems justify to width.
    const plan = { startMeasure: 0, endMeasure: 1, intrinsicSum: 200, isLast: true };
    const targets = justifySystem(plan, [100, 100], 400);
    expect(targets[0] + targets[1]).toBeCloseTo(400);
    expect(targets[0]).toBeCloseTo(200);
  });

  it('justifies a last system at moderate stretch', () => {
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

describe('justifySystemSpring', () => {
  it('solves spring equilibrium so all springs fill the available width', () => {
    // Two springs: K=10 (very stretchable) and K=1 (barely stretches).
    const springs = [
      { natLength: 20, K: 10 },
      { natLength: 10, K: 1 },
    ];
    // sumFixed = 0, available = 50 → sumNat = 30 → slack = 20 → F = 20/11.
    const out = justifySystemSpring(springs, 0, 50);
    const F = 20 / 11;
    expect(out[0]).toBeCloseTo(20 + F * 10);
    expect(out[1]).toBeCloseTo(10 + F * 1);
    expect(out[0] + out[1]).toBeCloseTo(50);
  });

  it('returns natural lengths when slack is non-positive', () => {
    const springs = [
      { natLength: 30, K: 10 },
      { natLength: 30, K: 10 },
    ];
    // available = 60 (exactly nat) → slack = 0 → no stretch.
    expect(justifySystemSpring(springs, 0, 60)).toEqual([30, 30]);
    // available = 50 (less than nat) → slack < 0 → no stretch.
    expect(justifySystemSpring(springs, 0, 50)).toEqual([30, 30]);
  });

  it('unjustifies a last system with a single measure', () => {
    const springs = [
      { natLength: 20, K: 5 },
      { natLength: 20, K: 5 },
    ];
    const out = justifySystemSpring(springs, 0, 200, { isLast: true, measureCount: 1 });
    expect(out).toEqual([20, 20]);
  });

  it('justifies a multi-measure last system even at large stretch ratios', () => {
    // Optimal break-point selection prevents pathological tiny finals
    // at the breaking stage, so the spring justifier no longer needs
    // a stretch-ratio escape hatch on final systems.
    const springs = [
      { natLength: 20, K: 5 },
      { natLength: 20, K: 5 },
    ];
    const out = justifySystemSpring(springs, 0, 80, { isLast: true, measureCount: 3 });
    expect(out[0] + out[1]).toBeCloseTo(80);
  });

  it('justifies a last system when stretch stays ≤ 1.5×', () => {
    const springs = [
      { natLength: 20, K: 5 },
      { natLength: 20, K: 5 },
    ];
    // available=50 → stretchRatio = 50/40 = 1.25 → OK.
    const out = justifySystemSpring(springs, 0, 50, { isLast: true, measureCount: 3 });
    expect(out[0] + out[1]).toBeCloseTo(50);
  });

  it('quarter-note gap is larger than eighth-note gap, both at rest and under stretch', () => {
    // Use the canonical formula values: L_nat(1)=18,K=8; L_nat(0.5)=10,K=1.
    const quarter = { natLength: 18, K: 8 };
    const eighth = { natLength: 10, K: 1 };

    // At rest: quarter > eighth.
    expect(quarter.natLength).toBeGreaterThan(eighth.natLength);

    // Under stretch: gap with a quarter still wins by a larger margin.
    const springs = [quarter, eighth, eighth, eighth];
    const naturalSum = 18 + 10 + 10 + 10; // 48
    const out = justifySystemSpring(springs, 0, 100); // big stretch
    const stretchedQuarter = out[0];
    const stretchedEighth = out[1];
    expect(stretchedQuarter).toBeGreaterThan(stretchedEighth);
    // Margin should grow under stretch (spring soaks slack proportional to K).
    const restMargin = quarter.natLength - eighth.natLength; // 8
    const stretchedMargin = stretchedQuarter - stretchedEighth;
    expect(stretchedMargin).toBeGreaterThan(restMargin);
    // Sanity: total sums to available.
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    void naturalSum;
  });
});
