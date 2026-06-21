/** @jest-environment jsdom */
import {
  breakIntoSystems,
  breakIntoSystemsOptimal,
  justifySystem,
  justifySystemSpring,
  systemBadness,
} from './breakIntoSystems.js';

// The breakers now take a SHARED natural-width metric callback
// `systemNaturalWidth(start, end, systemIndex)` instead of an additive
// per-measure intrinsics array + prelude function (see breakIntoSystems.js —
// the additive model was the estimate-vs-actual bug source). For these
// abstract unit tests we reconstruct the OLD additive semantics as a metric:
// natural width of [start..end] = prelude(systemIndex) + Σ intrinsics, and a
// run fits iff that natural width ≤ availableWidth. This keeps every
// expected break-point identical to the pre-refactor contract while
// exercising the new metric-driven control flow.
const metricFor = (intrinsics, preludeFn) =>
  (start, end, systemIndex) => {
    let sum = 0;
    for (let i = start; i <= end; i += 1) sum += intrinsics[i];
    return preludeFn(systemIndex) + sum;
  };

describe('breakIntoSystems', () => {
  it('returns one system for a piece that fits within the width', () => {
    const intrinsics = [100, 100, 100];
    const plans = breakIntoSystems(intrinsics.length, 500, metricFor(intrinsics, () => 100));
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      startMeasure: 0,
      endMeasure: 2,
      isLast: true,
    });
    // intrinsicSum is now the system's natural width (prelude + Σ) = 100 + 300.
    expect(plans[0].intrinsicSum).toBeCloseTo(400);
  });

  it('greedily packs measures and breaks to a new system when next would overflow', () => {
    const intrinsics = [200, 200, 200, 200, 200, 200];
    // Width=500, prelude=100 → music budget=400 → 2 measures per system.
    const plans = breakIntoSystems(intrinsics.length, 500, metricFor(intrinsics, () => 100));
    expect(plans).toHaveLength(3);
    expect(plans[0]).toMatchObject({ startMeasure: 0, endMeasure: 1, isLast: false });
    expect(plans[1]).toMatchObject({ startMeasure: 2, endMeasure: 3, isLast: false });
    expect(plans[2]).toMatchObject({ startMeasure: 4, endMeasure: 5, isLast: true });
  });

  it('uses a smaller prelude on non-first systems (no time signature)', () => {
    const intrinsics = [200, 200, 200, 200];
    // First system: prelude 200 → music budget 300 → 1 measure.
    // Subsequent: prelude 80 → music budget 420 → 2 measures.
    const plans = breakIntoSystems(intrinsics.length, 500, metricFor(intrinsics, (i) => (i === 0 ? 200 : 80)));
    expect(plans).toHaveLength(3);
    expect(plans[0].endMeasure).toBe(0);
    expect(plans[1].endMeasure).toBe(2);
    expect(plans[2]).toMatchObject({ startMeasure: 3, endMeasure: 3, isLast: true });
  });

  it('warns and places a wide single measure solo when it exceeds available width', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const intrinsics = [1000, 100];
    const plans = breakIntoSystems(intrinsics.length, 500, metricFor(intrinsics, () => 100));
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

describe('systemBadness', () => {
  it('returns zero badness at a perfect fit on an intermediate system', () => {
    // stretch = 1.0 exactly → no cost.
    expect(systemBadness(400, 400, false)).toBeCloseTo(0);
  });

  it('grows as stretch increases above 1.0', () => {
    const b1 = systemBadness(400, 440, false); // stretch 1.10
    const b2 = systemBadness(400, 480, false); // stretch 1.20
    const b3 = systemBadness(400, 560, false); // stretch 1.40
    expect(b2).toBeGreaterThan(b1);
    expect(b3).toBeGreaterThan(b2);
  });

  it('penalizes overflow with a large finite cost (not Infinity)', () => {
    const b = systemBadness(800, 400, false);
    expect(b).toBeGreaterThan(100);
    expect(Number.isFinite(b)).toBe(true);
  });

  it('treats a last system as ragged-allowed: cost rises only mildly with underfill', () => {
    // Last system at half-fill: small cost, not zero, not huge.
    const b = systemBadness(200, 400, true);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(systemBadness(200, 400, false));
  });

  it('grows convexly (super-linearly) as stretch increases', () => {
    // Convexity: b(s+Δ) − b(s) is itself increasing in s. Without
    // convexity, Knuth-Plass degenerates into greedy.
    const b1 = systemBadness(400, 440, false); // stretch 1.10
    const b2 = systemBadness(400, 480, false); // stretch 1.20
    const b3 = systemBadness(400, 520, false); // stretch 1.30
    const delta12 = b2 - b1;
    const delta23 = b3 - b2;
    expect(delta23).toBeGreaterThan(delta12);
  });

  it('overflow penalty dwarfs the worst in-range stretch cost', () => {
    // The whole point of the 1000-base overflow is that the optimizer
    // never picks an overflowed system if any non-overflowed alternative
    // exists. Pin: overflow >> 10× the worst in-range stretch.
    const overflow = systemBadness(800, 400, false);
    const stretched = systemBadness(400, 480, false); // 1.20 stretch
    expect(overflow).toBeGreaterThan(stretched * 10);
  });

  // LAST-SYSTEM STRETCH PENALTY. The renderer now CAPS a last/only system's
  // inter-note stretch at LAST_SYSTEM_STRETCH_CAP = 1.5× and renders it
  // ragged-left past that. The cost model must reflect that: a sparse,
  // over-stretched last system is NOT free (the old `0.1 * underfill`-only
  // branch let the optimizer strand a pathologically sparse final). The cost
  // must rise monotonically as the last system gets sparser (more stretch /
  // more post-cap whitespace) so the Knuth-Plass DP will pull a measure down
  // from the previous system when that lowers total badness.
  it('penalizes a last system that over-stretches: cost rises monotonically as it gets sparser', () => {
    const naturalSum = 200;
    // Increasingly wide budgets → increasingly sparse last system.
    const b1 = systemBadness(naturalSum, 220, true); // stretch 1.10
    const b2 = systemBadness(naturalSum, 280, true); // stretch 1.40
    const b3 = systemBadness(naturalSum, 400, true); // stretch 2.00 (past cap)
    const b4 = systemBadness(naturalSum, 600, true); // stretch 3.00 (past cap)
    expect(b2).toBeGreaterThan(b1);
    expect(b3).toBeGreaterThan(b2);
    expect(b4).toBeGreaterThan(b3);
    // The PAST-cap region must grow at least as fast as the below-cap region
    // (the cap is a cliff, not a softening): a pure-linear `0.1 * underfill`
    // stub has a CONSTANT slope and fails this. Compare equal-budget steps.
    const belowStep = systemBadness(naturalSum, 280, true)
      - systemBadness(naturalSum, 240, true); // +40 budget, below cap (1.2→1.4)
    const aboveStep = systemBadness(naturalSum, 600, true)
      - systemBadness(naturalSum, 560, true); // +40 budget, past cap (2.8→3.0)
    expect(aboveStep).toBeGreaterThan(belowStep);
  });

  it('prices last-system over-stretch as a STRETCH cost (convex below the cap), not a flat per-unit underfill slope', () => {
    // The old `0.1 * underfill`-only branch is LINEAR in budget (constant
    // slope, no dependence on how stretched the music is). The new model
    // must price stretch convexly while the last system is still justified
    // (≤ 1.5× cap): the cost increment per equal stretch step must GROW.
    // This distinguishes the new shape from the old linear-underfill stub.
    const naturalSum = 200;
    const b10 = systemBadness(naturalSum, 220, true); // stretch 1.10
    const b125 = systemBadness(naturalSum, 250, true); // stretch 1.25
    const b140 = systemBadness(naturalSum, 280, true); // stretch 1.40
    const d1 = b125 - b10; // +0.15 stretch
    const d2 = b140 - b125; // +0.15 stretch
    expect(d2).toBeGreaterThan(d1);
  });

  it('prices a heavily over-stretched last system above a moderately-stretched interior system (the rebalance lever)', () => {
    // The rebalance lever: a pathologically sparse last system (small natural
    // content stretched far past the cap) must cost MORE than a moderately
    // stretched interior system the optimizer could trade against — otherwise
    // the DP never pulls a measure down. The old `0.1 * underfill`-only branch
    // priced a 2.5× last system (natural 40, budget 100) at just 0.1×60 = 6,
    // BELOW a 1.3× interior (100×0.3² = 9) — so it stranded sparse finals.
    // The new stretch+whitespace penalty must invert that.
    const sparseLast = systemBadness(40, 100, true); // 2.5× last, past cap
    const moderateInterior = systemBadness(40, 52, false); // 1.3× interior
    expect(sparseLast).toBeGreaterThan(moderateInterior);
  });

  it('keeps a last system cheaper than the same over-stretched interior system (ragged is still preferred to a justified blow-up)', () => {
    // A last system may go ragged; an interior one must justify. So at the
    // same stretch the last-system cost stays BELOW the interior cost — the
    // optimizer still prefers to ragged-out a final rather than cram an
    // interior. (Pins the engraving asymmetry while adding the new penalty.)
    expect(systemBadness(200, 400, true)).toBeLessThan(systemBadness(200, 400, false));
    expect(systemBadness(200, 320, true)).toBeLessThan(systemBadness(200, 320, false));
  });

  it('a perfectly-filled last system is essentially free (no spurious penalty at stretch 1.0)', () => {
    expect(systemBadness(400, 400, true)).toBeLessThanOrEqual(systemBadness(400, 440, true));
    expect(systemBadness(400, 400, true)).toBeLessThan(5);
  });
});

describe('breakIntoSystemsOptimal', () => {
  it('returns one system for a piece that fits within the width', () => {
    const intr = [100, 100, 100];
    const plans = breakIntoSystemsOptimal(intr.length, 500, metricFor(intr, () => 100));
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ startMeasure: 0, endMeasure: 2, isLast: true });
  });

  it('matches greedy on an even-distribution piece (no rebalance possible)', () => {
    // 6 identical measures; both algorithms have only one sensible split.
    const intrinsics = [200, 200, 200, 200, 200, 200];
    const greedy = breakIntoSystems(intrinsics.length, 500, metricFor(intrinsics, () => 100));
    const optimal = breakIntoSystemsOptimal(intrinsics.length, 500, metricFor(intrinsics, () => 100));
    expect(optimal).toHaveLength(greedy.length);
    for (let i = 0; i < greedy.length; i += 1) {
      expect(optimal[i].startMeasure).toBe(greedy[i].startMeasure);
      expect(optimal[i].endMeasure).toBe(greedy[i].endMeasure);
    }
  });

  it('rebalances 17 uniform measures away from greedy [5,5,5,2] toward a fuller final system', () => {
    // The textbook pathological case the user flagged: 17 measures,
    // budget fits ~5 per system. Greedy: [5,5,5,2] — a tiny straggler.
    // Optimal: rebalances (e.g. [4,4,4,5] or [5,4,4,4]) so the last
    // system is a larger fraction of the average system content.
    const intrinsics = Array(17).fill(100);
    const greedy = breakIntoSystems(intrinsics.length, 600, metricFor(intrinsics, () => 80));
    const optimal = breakIntoSystemsOptimal(intrinsics.length, 600, metricFor(intrinsics, () => 80));

    const greedyLastCount = greedy[greedy.length - 1].endMeasure
      - greedy[greedy.length - 1].startMeasure + 1;
    const optimalLastCount = optimal[optimal.length - 1].endMeasure
      - optimal[optimal.length - 1].startMeasure + 1;

    const greedyAvg = intrinsics.length / greedy.length;
    const optimalAvg = intrinsics.length / optimal.length;

    // Optimal's last-system measure count should be a much larger
    // fraction of its system average than greedy's was.
    expect(optimalLastCount / optimalAvg).toBeGreaterThan(greedyLastCount / greedyAvg);
    // Concretely: greedy's last system is 2 measures, optimal's >= 4.
    expect(greedyLastCount).toBe(2);
    expect(optimalLastCount).toBeGreaterThanOrEqual(4);
  });

  it('pulls a measure down from the previous system rather than strand a pathologically sparse 1-measure final', () => {
    // REBALANCE (the user's `pullMeasuresFromPrevSystem` branch). Eleven
    // uniform measures at a budget that fits 5 per system. WITHOUT a
    // last-system stretch penalty the DP packs [5,5,1] — the predecessors
    // sit at stretch 1.0 (perfectly full, cost 0) and the lone straggler is
    // "free" under the old `0.1 * underfill`-only branch, so the optimizer
    // has no incentive to rebalance. WITH the penalty, the sparse final is
    // priced, and pulling one measure down to [5,4,2] (predecessor relaxes
    // to a mild stretch, final doubles) lowers total badness. Pin: the final
    // system is no longer a lone measure.
    const intrinsics = Array(11).fill(100);
    const plans = breakIntoSystemsOptimal(
      intrinsics.length, 560, metricFor(intrinsics, () => 0),
    );
    const last = plans[plans.length - 1];
    const lastCount = last.endMeasure - last.startMeasure + 1;
    expect(lastCount).toBeGreaterThanOrEqual(2);
  });

  it('handles a single-measure-too-wide degenerate case without crashing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const intr = [1000, 100];
    const plans = breakIntoSystemsOptimal(intr.length, 500, metricFor(intr, () => 100));
    expect(plans.length).toBeGreaterThanOrEqual(1);
    // Wide measure is placed alone in some system.
    const solo = plans.find((p) => p.startMeasure === 0 && p.endMeasure === 0);
    expect(solo).toBeDefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns no systems for an empty piece', () => {
    expect(breakIntoSystemsOptimal(0, 500, metricFor([], () => 100))).toEqual([]);
  });

  it('covers all measures exactly once with monotonically increasing ranges', () => {
    const intrinsics = [120, 80, 100, 200, 90, 110, 130, 70, 150];
    const plans = breakIntoSystemsOptimal(intrinsics.length, 500, metricFor(intrinsics, () => 60));
    let expected = 0;
    for (const p of plans) {
      expect(p.startMeasure).toBe(expected);
      expect(p.endMeasure).toBeGreaterThanOrEqual(p.startMeasure);
      expected = p.endMeasure + 1;
    }
    expect(expected).toBe(intrinsics.length);
    expect(plans[plans.length - 1].isLast).toBe(true);
  });
});
