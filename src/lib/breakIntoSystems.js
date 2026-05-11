/**
 * Pure system-breaking and justification helpers.
 *
 * Gould "Behind Bars" — Systems (p. 595) and Spacing (Ch. on spacing &
 * justification): pack measures left-to-right; when adding the next would
 * exceed the available music width, break to a new system. Per-system,
 * distribute slack so each measure's target width is `intrinsic * stretch`
 * — uniform stretch (linear) of the music portion only.
 *
 * Last-system rule (Gould): don't justify a final system that's nearly
 * empty (1 measure) or that would stretch the music beyond ~1.5× its
 * natural width. Leave it ragged at intrinsic.
 */

/**
 * @typedef {Object} SystemPlan
 * @property {number} startMeasure
 * @property {number} endMeasure   inclusive
 * @property {number} intrinsicSum sum of intrinsic widths for [start, end]
 * @property {boolean} isLast
 */

/**
 * Greedy system-breaking.
 *
 * @param {Array<number>} combinedIntrinsics  per-measure intrinsic widths
 *   (combined across voices — the max).
 * @param {number} availableWidth  total SVG music-area width.
 * @param {(systemIndex:number) => number} preludeWidthFn  px reserved at
 *   left for clef + key sig (every system) + time sig (system 0 only).
 * @returns {Array<SystemPlan>}
 */
export function breakIntoSystems(combinedIntrinsics, availableWidth, preludeWidthFn) {
  const plans = [];
  const n = combinedIntrinsics.length;
  if (n === 0) return plans;

  let cursor = 0;
  let systemIndex = 0;
  while (cursor < n) {
    const prelude = preludeWidthFn(systemIndex);
    const musicBudget = availableWidth - prelude;

    let end = cursor;
    let acc = combinedIntrinsics[cursor];
    if (acc > musicBudget) {
      // Degenerate: single measure can't fit. Place it solo and warn.
      // eslint-disable-next-line no-console
      console.warn(
        `breakIntoSystems: measure ${cursor} intrinsic width ${acc.toFixed(1)}px exceeds available music width ${musicBudget.toFixed(1)}px; placing solo and overflowing`
      );
    } else {
      while (end + 1 < n && acc + combinedIntrinsics[end + 1] <= musicBudget) {
        end += 1;
        acc += combinedIntrinsics[end];
      }
    }

    plans.push({
      startMeasure: cursor,
      endMeasure: end,
      intrinsicSum: acc,
      isLast: false,
    });

    cursor = end + 1;
    systemIndex += 1;
  }

  if (plans.length > 0) plans[plans.length - 1].isLast = true;
  return plans;
}

/**
 * Per-system justification (uniform stretch of music portion).
 *
 * Returns the target width for each measure in the system.
 *
 * Last-system rule: if `isLast` AND the system has a single measure, do
 * not justify — leave intrinsic widths unchanged. The earlier ">1.5
 * stretch" guard was a band-aid for greedy breaking's pathological tiny
 * finals; with optimal break-point selection (Knuth-Plass) the optimizer
 * picks balanced finals on its own, so the guard is no longer needed.
 *
 * @param {SystemPlan} systemPlan
 * @param {Array<number>} combinedIntrinsics  full piece's per-measure
 *   intrinsic widths (we'll slice by start/end).
 * @param {number} availableMusicWidth  width - preludeWidth(thisSystemIdx)
 * @returns {Array<number>}
 */
export function justifySystem(systemPlan, combinedIntrinsics, availableMusicWidth) {
  const intrinsics = combinedIntrinsics.slice(
    systemPlan.startMeasure,
    systemPlan.endMeasure + 1
  );
  const sum = intrinsics.reduce((a, b) => a + b, 0);
  if (sum <= 0) return intrinsics;

  const stretch = availableMusicWidth / sum;

  if (systemPlan.isLast && intrinsics.length === 1) {
    // Don't justify a final system that's a solo trailing measure.
    return intrinsics.slice();
  }

  return intrinsics.map((w) => w * stretch);
}

/**
 * Spring-equilibrium justification.
 *
 * Each inter-event gap is a spring with a natural length `natLength` and
 * a stretchability `K`. Notes (noteheads, accidentals, dots) have fixed
 * widths and don't stretch. We solve for a single force `F` that applies
 * to every spring such that:
 *   sum(natLength + F * K) + sum(fixed) = availableMusicWidth
 * → F = (availableMusicWidth - sum(fixed) - sum(natLength)) / sum(K)
 *
 * Longer-duration gaps have larger K (more slack above MIN_GAP), so they
 * absorb more of the available stretch — matching Gould "Behind Bars"
 * (Spacing) and Lilypond's log-proportional natural-length + floor model.
 *
 * Last-system rule: if `isLast` AND the system has exactly 1 measure,
 * return natural lengths unchanged (real engraving convention — a solo
 * trailing measure doesn't justify). The earlier ">1.5 stretch" guard
 * was a band-aid for greedy breaking's pathological tiny finals; with
 * optimal break-point selection the optimizer picks balanced finals on
 * its own, so the guard is no longer needed.
 *
 * @param {Array<{ natLength: number, K: number }>} springs
 * @param {number} sumFixed  sum of fixed (non-stretching) widths across the system
 * @param {number} availableMusicWidth
 * @param {{ isLast: boolean, measureCount: number }} options
 * @returns {Array<number>} per-spring stretched lengths
 */
export function justifySystemSpring(springs, sumFixed, availableMusicWidth, options = {}) {
  const { isLast = false, measureCount = 1 } = options;
  if (springs.length === 0) return [];

  const sumNat = springs.reduce((a, s) => a + s.natLength, 0);
  const sumK = springs.reduce((a, s) => a + s.K, 0);
  const stretchBudget = availableMusicWidth - sumFixed;
  const slack = stretchBudget - sumNat;

  if (slack <= 0 || sumK <= 0) {
    return springs.map((s) => s.natLength);
  }

  const F = slack / sumK;

  if (isLast && measureCount === 1) {
    return springs.map((s) => s.natLength);
  }

  return springs.map((s) => s.natLength + F * s.K);
}

/**
 * Per-system "badness" — Knuth-Plass 1981 style. Lower is better. Inputs
 * are total natural width of the system's measures vs. the music budget
 * (availableWidth - prelude for whichever system this lands on).
 *
 * Shape:
 *   - Overflow:   1000 + (natural - music)        // very bad but finite
 *   - Final ragged: 0.1 * underfill               // soft preference for full finals
 *   - Stretch 1.0..1.5: 100 * (s-1)^2             // mild, quadratic near optimum
 *   - Stretch > 1.5:    100 * (s-1)^3             // sharp, cubic past the cliff
 *
 * The 1000-base overflow penalty is finite so the optimizer can still
 * choose an overflowed plan when a single measure literally can't fit.
 *
 * Tuning constants picked by snap-eyeball on Bach Invention 1 and the
 * ottava-showcase preset; the SHAPE (quadratic near 1.0, cubic past 1.5)
 * is the load-bearing part — exact coefficients are knobs.
 */
export function systemBadness(naturalSum, musicBudget, isLast) {
  if (musicBudget <= 0) return 1e9;
  if (naturalSum > musicBudget) {
    return 1000 + (naturalSum - musicBudget);
  }
  if (isLast) {
    const underfill = musicBudget - naturalSum;
    return 0.1 * underfill;
  }
  const stretch = musicBudget / naturalSum;
  if (stretch < 1.0) return 1000; // guarded; shouldn't reach
  const x = stretch - 1;
  if (stretch > 1.5) return 100 * x * x * x;
  return 100 * x * x;
}

/**
 * Knuth-Plass-style optimal system breaking.
 *
 * O(M^2) DP over candidate break points. `best[m]` is the minimum total
 * badness of laying out the first m measures into systems. The recurrence
 * tries every possible "previous break" m' < m and picks the one that
 * minimises `best[m'] + systemBadness([m'..m-1], isLast = m == M)`.
 *
 * The prelude differs per system index (time sig only on system 0), and
 * the DP doesn't know the system index of `[m'..m-1]` until reconstruction.
 * We approximate by using `preludeWidthFn(systemIndexEstimate)` where
 * `systemIndexEstimate` is derived from the predecessor chain implied by
 * `m'`: we estimate it as `predecessorCount(m')`. Since most preludes are
 * identical across systems (key sig is uniform; only system 0's time sig
 * differs), this is exact in practice. We track predecessors so we can
 * reconstruct and assign correct system indices on the way out.
 *
 * Inputs match `breakIntoSystems`.
 *
 * @param {Array<number>} combinedIntrinsics
 * @param {number} availableWidth
 * @param {(systemIndex:number) => number} preludeWidthFn
 * @returns {Array<SystemPlan>}
 */
export function breakIntoSystemsOptimal(combinedIntrinsics, availableWidth, preludeWidthFn) {
  const n = combinedIntrinsics.length;
  if (n === 0) return [];

  // best[m] = min total badness ending with m measures placed.
  // prev[m] = predecessor index (m'), and prevSystemIndex[m] is the system
  // index that the last system would land on. We compute system index via
  // a chain count from m back to 0.
  const best = new Array(n + 1).fill(Infinity);
  const prev = new Array(n + 1).fill(-1);
  const sysIdx = new Array(n + 1).fill(0); // system count to reach m
  best[0] = 0;
  sysIdx[0] = 0;

  // Prefix sums for O(1) range natural-sum.
  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + combinedIntrinsics[i];

  // Practical pruning: skip ranges much wider than the canvas.
  // Use the smallest prelude as a lower bound on the budget for pruning.
  const minPrelude = Math.min(preludeWidthFn(0), preludeWidthFn(1));
  const looseBudget = availableWidth - minPrelude;
  const pruneLimit = looseBudget * 4; // wide latitude; only avoids absurd spans

  for (let m = 1; m <= n; m += 1) {
    const isLast = m === n;
    for (let mp = m - 1; mp >= 0; mp -= 1) {
      const natural = prefix[m] - prefix[mp];
      if (natural > pruneLimit && mp < m - 1) break; // monotonic: more measures = more width
      // System index that [mp..m-1] would occupy is sysIdx[mp] (0-based).
      const systemIndex = sysIdx[mp];
      const prelude = preludeWidthFn(systemIndex);
      const musicBudget = availableWidth - prelude;
      const badness = systemBadness(natural, musicBudget, isLast);
      // If this is a non-last severely-overflowed range AND we have at
      // least one alternative in mp, no need to extend further leftward.
      const candidate = best[mp] + badness;
      if (candidate < best[m]) {
        best[m] = candidate;
        prev[m] = mp;
        sysIdx[m] = sysIdx[mp] + 1;
      }
      // Pruning: once we're firmly in overflow territory and have a
      // finite-cost alternative, going further left only makes natural
      // larger and badness monotonically worse for this system. Stop.
      if (natural > musicBudget && best[m] < Infinity) break;
    }
  }

  // Reconstruct.
  const plans = [];
  let cursor = n;
  while (cursor > 0) {
    const mp = prev[cursor];
    const natural = prefix[cursor] - prefix[mp];
    plans.push({
      startMeasure: mp,
      endMeasure: cursor - 1,
      intrinsicSum: natural,
      isLast: false,
    });
    cursor = mp;
  }
  plans.reverse();
  if (plans.length > 0) plans[plans.length - 1].isLast = true;

  // Degenerate-fit warning to match greedy's behaviour.
  for (const p of plans) {
    if (p.endMeasure === p.startMeasure) {
      const prelude = preludeWidthFn(plans.indexOf(p));
      const music = availableWidth - prelude;
      if (p.intrinsicSum > music) {
        // eslint-disable-next-line no-console
        console.warn(
          `breakIntoSystemsOptimal: measure ${p.startMeasure} intrinsic width ${p.intrinsicSum.toFixed(1)}px exceeds available music width ${music.toFixed(1)}px; placing solo and overflowing`
        );
      }
    }
  }

  return plans;
}
