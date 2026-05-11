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
 * Last-system rule (Gould "Behind Bars", Spacing): if `isLast` AND the
 * system has a single measure OR the stretch ratio would exceed 1.5, do
 * not justify — leave intrinsic widths unchanged.
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

  if (systemPlan.isLast && (intrinsics.length === 1 || stretch > 1.5)) {
    // Don't justify the final system if it would stretch absurdly or it
    // only has one measure.
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
 * Last-system rule (Gould): if `isLast` AND (system has 1 measure OR the
 * effective stretch factor (= 1 + F*sumK/sumNat) exceeds 1.5), return
 * natural lengths unchanged.
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
  // Effective music stretch ratio: total music / natural music.
  const naturalMusic = sumFixed + sumNat;
  const stretchedMusic = naturalMusic + F * sumK;
  const stretchRatio = naturalMusic > 0 ? stretchedMusic / naturalMusic : 1;

  if (isLast && (measureCount === 1 || stretchRatio > 1.5)) {
    return springs.map((s) => s.natLength);
  }

  return springs.map((s) => s.natLength + F * s.K);
}
