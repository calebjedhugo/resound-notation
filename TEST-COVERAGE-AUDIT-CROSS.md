# Cross-Audit: Test Coverage of Iterations A–E

Independent second-pass audit of test strength for the responsive-layout overhaul (intrinsic measurement → system breaking → reactive layout → spring spacing → Knuth-Plass). Findings are formed without reading the first auditor's report.

Audited files:
- `src/NotationRenderer.test.js` (lines 2584–3341 — new A–E blocks)
- `src/lib/breakIntoSystems.test.js`
- `src/lib/measureIntrinsicWidths.test.js`
- `src/lib/segmentOttava.test.js`
- `src/lib/` directory listing for untested modules

---

## 1. Weak tests

### W1. `NotationRenderer.test.js:2701` — "keeps voices synchronized across system boundaries"

**Weakness.** The only assertions are `v0.length === v1.length` and `>= 2`. A bug that broke at the same measures but in a way that shifted measure ranges per voice (e.g. voice A breaks after measure 4, voice B after measure 5) could still produce equal `staff-lines` counts. The test name promises "same measure breakpoints" but doesn't verify breakpoint *measure indices*.

**Failure mode that passes.** Greedy breaker run independently per voice, where each voice happens to produce the same number of systems but at different boundaries. The two staves render misaligned but the counts match.

**Strengthen.** Either expose `data-start-measure`/`data-end-measure` on the per-system staff group and assert equality voice-by-voice, OR for each system, assert that the x-position of the *final barline within that system* matches between voices (same systemEndX). Also assert that the count of `.note` elements per system per voice matches the input measure boundaries.

### W2. `NotationRenderer.test.js:2841` — "renders an ottava bracket per system when a segment spans a system break"

**Weakness.** Asserts only `brackets.length > 0` and `systems >= 2`. The test name claims "per system when … spans a system break" but does not check that the bracket count *grew* relative to the unbroken case, nor that the brackets actually appear in two different systems.

**Failure mode that passes.** Ottava clipping logic is broken and emits exactly one bracket on the first system, ignoring the slice on the second. `brackets.length > 0` is satisfied.

**Strengthen.** Render the same preset wide (single system) and narrow (multi-system); assert `narrow.brackets > wide.brackets` for the segment known to straddle a break. Additionally bucket brackets by their parent `data-system-index` (or by Y range) and assert at least one bracket appears in each of two systems.

### W3. `NotationRenderer.test.js:2786` — "respects the breakingStrategy: 'greedy' escape hatch"

**Weakness.** Only checks that both strategies produce `>= 1` staff-line. Does not verify that `greedy` and `optimal` *differ on the same input* — the input is chosen (17 measures) precisely because they differ in `breakIntoSystems.test.js:229`, but the renderer test never confirms the option is actually wired through.

**Failure mode that passes.** `breakingStrategy: 'greedy'` is silently ignored (typo in option name, hard-coded `breakIntoSystemsOptimal`). Both renders use optimal; both produce systems; test passes.

**Strengthen.** Assert `greedy` produces a 2-measure final system and `optimal` produces a ≥4-measure final system (using the same measure-count derivation already proven correct in the lib-level test).

### W4. `NotationRenderer.test.js:2669` and 2724 — final-barline-x checks use `<= width+1` and `> width/2`

**Weakness.** The justification claim is `barline lands at width`. The assertion `x > width/2` is satisfied by any system filled past 50%. A regression where justify factor is, say, 0.7 instead of 1.0 (computed against the wrong target) would still pass.

**Failure mode that passes.** Off-by-prelude justification: the system stretches to `width − preludeWidth + offset` instead of `width`. Result lands at, e.g., 0.85·width.

**Strengthen.** For a piece known to have ≥1.0 stretch ratio (`makeLongPiece(4)` at width=800 should), assert `x` is within 2px of `width`, not just `<= width+1`.

### W5. `NotationRenderer.test.js:3043` — "keeps multi-voice notes at the same beat aligned"

**Weakness.** Checks only beat-0 and beat-1 alignment between top voice notes 0/1 and bot voice notes 0/2. Spring justification is per-voice in the current code path (or per-combined); a bug that aligned downbeats but misaligned mid-measure off-beats would not be caught.

**Failure mode that passes.** Spring solver uses voice-local naturalSums, then justifies each voice independently to the same width. Downbeats align (forced by prelude+barline shared geometry), but eighth-note positions drift between voices.

**Strengthen.** Sample every beat alignment between voices across the measure (including the eighth-off-beats: bot note 1 in this test is the off-beat between top note 0 and top note 1; the existing assertion never touches it).

### W6. `NotationRenderer.test.js:3076` — "preserves natural spacing when slack ≤ 0"

**Weakness.** Asserts gaps are equal-among-themselves; never asserts they equal the natural (springs-at-rest) length. A bug that uniformly compressed the system to, say, 0.9× natural would still produce equal gaps and pass.

**Strengthen.** Compute the expected natural inter-note gap from `springNatLength` (exposed by the lib's `__TESTING__`) and assert `g1 ≈ expectedNatural` within 1px.

### W7. `breakIntoSystems.test.js:188` — "grows as stretch increases above 1.0"

**Weakness.** Only checks `b2 > b1 > b...`. A monotonic-but-linear cost function would pass; the algorithm's Knuth-Plass behavior depends on a *super-linear* (quadratic) cost so that two medium-stretch systems beat one tight + one very-stretched. There is no test that codifies the convexity.

**Strengthen.** Assert convexity: `b3 - b2 > b2 - b1` (i.e. badness rises faster as stretch grows). Without convexity, optimal degenerates into greedy.

### W8. `NotationRenderer.test.js:3131` (rAF batching) — uses `_flush` directly

**Weakness.** The test calls `renderer._flush()` instead of letting the rAF callback fire. The "batching" claim therefore is never tested end-to-end. Per the comment, this is endorsed by the spec, but it means a bug where `_scheduleRender` never enqueues to rAF (and instead flushes synchronously inside `setWidth`) is undetectable.

**Failure mode that passes.** `setWidth` immediately calls `this.render(this._song)` synchronously (skipping the rAF altogether). Test assertions after `setWidth` still observe the *new* SVG, except the test explicitly checks `getSvgElement() === beforeSvg` after `setWidth` — that actually *would* fail under that bug. Good — but a subtler bug: `_scheduleRender` calls `setTimeout(_flush, 0)` instead of `requestAnimationFrame`, so it batches but at the wrong cadence; the test passes because `_flush` is called manually.

**Strengthen.** Mock `requestAnimationFrame` with `jest.fn()` and assert `mock.calls.length === 1` after three `setWidth`s; assert it's called with a function whose invocation produces the flushed render. This proves the actual rAF contract, not just `_flush` idempotence.

### W9. `NotationRenderer.test.js:3155` — coalescing "one render"

**Weakness.** `flushSpy` counts calls to `_flush`, which is what the test itself invokes manually. The `tick(renderer)` line calls `_flush` once, so `toHaveBeenCalledTimes(1)` is trivially satisfied regardless of whether the three `setWidth`s actually coalesced. The setWidth implementations could each schedule independent rAFs that never fire (since rAF isn't being driven) and the spy would still see exactly one call (the manual one).

**Strengthen.** Spy on `render` (the actual rendering work), not `_flush`, OR spy on `requestAnimationFrame` and assert exactly one schedule.

### W10. `NotationRenderer.test.js:3198` — "setScale batches and re-renders with new SVG dimensions"

**Weakness.** Doesn't verify the batching part for scale at all. It calls `setScale`, then immediately `tick(renderer)`, then reads width. A non-batched implementation (synchronous re-render inside `setScale`) would pass.

**Strengthen.** Between `setScale(2)` and `tick`, assert `getSvgElement().getAttribute('width')` still equals `w1` (unchanged until flush).

### W11. `NotationRenderer.test.js:3288` — zoom-to-fit "system count unchanged"

**Weakness.** "Same system count" is a necessary but very weak condition for zoom-to-fit. A buggy mode that didn't change scale at all (no-op) would pass: same count, scale never updated. Mitigated by the `_scale === 1.5` check above it — good. But the test never verifies the SVG `width` attribute changed, only the internal `_scale`. A bug where `_scale` is written but not propagated to SVG dimensions would pass.

**Strengthen.** Assert the SVG `width` attribute changed from `w1` to `w1 * 1.5`.

### W12. `measureIntrinsicWidths.test.js:95` — "combined takes the max across voices"

**Weakness.** Asserts `combined === top`. Only tested on one measure. A bug that returned `perVoice[0]` (always voice 0) instead of the per-measure max would pass when voice 0 happens to be wider, as in this test.

**Strengthen.** Add a case where the bottom voice is wider on some measures and the top voice wider on others, and assert `combined[i] = max(perVoice[*][i])` for every i.

### W13. `breakIntoSystems.test.js:23` — "greedily packs measures and breaks…"

**Weakness.** Uses uniform intrinsics (all 200). A bug where the greedy algorithm tracks running width incorrectly (e.g. uses last measure's width instead of accumulator) would still happen to produce the same split because every measure has the same width.

**Strengthen.** Add a non-uniform variant ([200, 150, 200, 200, 150, 200]) and assert exact split points; verify that the running width logic actually accumulates.

### W14. `segmentOttava.test.js:170` — "agreeing voices keep their segments"

**Weakness.** Inputs are byte-identical segments with no `endIndex` divergence. A reconciler that *always* merges voiceIds regardless of agreement on `startIndex`/`endIndex`/`kind` would pass.

**Strengthen.** Add a case where two voices have the same kind but slightly different end indices, and verify the reconciler either merges to a covering interval or drops with a warning — pin down the actual policy.

---

## 2. Missing tests

### Iteration A — intrinsic widths
- **No test that intrinsic width is independent of canvas width.** Render the same song at width=400 and width=4000; the *intrinsic* widths reported by `getIntrinsicWidths()` should be identical. Catches a class of bugs where measurement leaks layout.
- **No test for time-signature/key-signature contribution to the first measure's "prelude".** All breaker tests pass a `prelude` factory; no test verifies the renderer computes the correct prelude from real key+time signatures.

### Iteration B — system breaking + scale
- **No "scale doesn't affect system count" symmetry test** at multiple widths; only the trivial single-note version exists (line 2823).
- **No test that the breaker uses `combined` intrinsic widths (not per-voice).** A 2-voice piece where the bottom voice is much wider should break at the same points as if the wide voice were alone. Currently nothing pins this.
- **No test for `wrapMeasure(...)` on the first system having the *full* prelude (clef + key + time)** vs subsequent systems having only clef.

### Iteration C — reactive layout
- **No test that `setSong(null)` or `setSong(undefined)` clears the render.** Edge case for editor consumers.
- **No test that `unobserve()` actually stops further callbacks.** `clear()` is tested as the disconnect path; `unobserve()` is the documented API.
- **No test that a second `observe()` call is idempotent** (doesn't double-subscribe leading to double-render).
- **No test for `responsiveMode` invalid value** (does it warn? default? throw?).
- **No test that the ResizeObserver callback fires across a real rAF boundary.** Current tests fire synchronously then call `_flush`. There's no test that proves the callback path *enqueues* rather than runs synchronously, which is the entire point of rAF batching for ResizeObserver thrash.

### Iteration D — spring spacing
- **No test for chord vs. single-note spring K.** A chord on a quarter beat should get the same spring K as a single quarter — there's no assertion of this.
- **No test for spring behavior across barlines.** All tests are within a single measure or across a one-barline boundary; no proof that barline padding doesn't break the spring solver.
- **No test that the dotted-eighth/sixteenth pair gets correct relative spacing** (canonical engraving challenge). The lib test covers half-note dotting, but not the common 3:1 ratio.
- **No test that rests participate in the spring layout** identically to notes of the same duration.

### Iteration E — Knuth-Plass optimal
- **No test that optimal handles a "river" case** where two near-equal break paths produce different aesthetics — the lib test exercises 17 uniform measures, which has one obvious answer.
- **No test that optimal is deterministic** (two identical calls produce identical plans).
- **No test for monotonicity of the breaker w.r.t. width:** widening the canvas should never produce *more* systems. Useful invariant; trivially asserted, catches a wide class of regressions.
- **No test that an empty voice (zero measures) does not throw.**
- **No test for the `isLast: true` flag landing on exactly one plan, on the last plan**, in the optimal output. Currently asserted in `:269` for a specific input — should be a generic invariant.
- **No integration test on a real preset** (e.g. `ottava-showcase`, `piece-bach-invention-1`) that pins the optimal break points to a snapshot. The lib-level pathological case is the only proof optimal does anything differently.

### Cross-cutting
- **No test that 626-test-passing pieces actually render valid SVG** for the wrap case — only counts of elements are checked. A regression that produced malformed `transform` strings would not be caught.
- **No test for ottava bracket clipping when a segment ends exactly at a system boundary** (the off-by-one regression class).
- **No test for the interplay between optimal breaking and spring spacing.** Optimal scores plans using `systemBadness(naturalSum, musicBudget)`, but the actual rendering uses springs. If the natural-sum metric and the spring-solver metric ever drift apart, optimal will pick suboptimal break points. No test pins these together.

---

## 3. False-confidence risks (name vs. assertion mismatch)

- **`renders an ottava bracket per system when a segment spans a system break` (2841):** name says "per system" → asserts `> 0`. Could be 1 bracket in 2 systems.
- **`keeps voices synchronized across system boundaries (same measure breakpoints)` (2701):** name says "same measure breakpoints" → asserts only equal staff-line counts.
- **`respects the breakingStrategy: "greedy" escape hatch` (2786):** name says "respects" → never proves the strategy parameter changed anything.
- **`coalesces multiple setWidth calls in the same tick into one render` (3155):** spies on `_flush` which the test itself drives, not on `render` or `requestAnimationFrame`.
- **`keeps multi-voice notes at the same beat aligned to the same x` (3043):** "the same beat" → tests two beats out of four; never tests the off-beats.
- **`preserves natural spacing when slack ≤ 0` (3076):** "preserves natural" → only checks uniformity, never compares to natural length.
- **`setScale batches and re-renders` (3198):** "batches" → never tests the batching, only the re-render result.
- **`combined takes the max across voices` (measureIntrinsicWidths 95):** "max" → only one measure where the first voice happens to be max.

---

## 4. Untested files

`src/lib/*.js` without a sibling `*.test.js`:

- `src/lib/sliceVoiceByMeasure.js` — **no test**. Given how central voice slicing is to the system-breaking pipeline (each system slices each voice by measure range), this is alarming. Bugs here surface as off-by-one notes per system or duplicate notes at boundaries, exactly the failure class iteration B nearly shipped.
- `src/lib/slurGrouping.js` — **no test**. Slurs across system breaks are explicitly TODO'd; the grouping logic has no coverage.
- `src/lib/tuplets.js` — **no test**. Sextuplet rendering has integration coverage in NotationRenderer.test.js but the tuplet-grouping helper itself is untested.

---

## 5. Top 5 priorities

1. **Add `sliceVoiceByMeasure` unit tests.** Highest-leverage gap. This helper is the pipeline's gatekeeper across system breaks; a regression here is exactly the iteration-B class of bug (voices wrapping into independent systems / off-by-one measure boundaries) and there is currently zero direct coverage. Test: empty voice, single measure, slice exactly at a measure boundary, slice across a tie, slice across a beamed group, slice at end-of-voice.

2. **Tighten "voices synchronized across system boundaries" (W1).** Replace the staff-line-count equality with a per-system breakpoint-index equality (expose `data-start-measure` / `data-end-measure`) or assert per-voice final-barline x equality within each system. This is the same class of bug iteration B shipped — the user's stated worry.

3. **Strengthen rAF batching tests (W8, W9, W10).** Stop driving `_flush` directly; spy on `requestAnimationFrame` and on `render`. Add the "SVG unchanged between setX and tick" assertion for `setScale`. Without this, the reactive layout could regress to synchronous-per-call rendering and all current tests would still pass.

4. **Add the "breaker uses combined intrinsics" + "scale-independence of system count" + "monotonicity w.r.t. width" invariants** at the renderer level. Each is one line, each catches a broad regression class, and together they pin down the most under-specified part of iteration B/E.

5. **Pin Knuth-Plass behavior on real presets via a deterministic break-point fixture.** Render `piece-bach-invention-1` at 3 fixed widths (e.g. 400/600/1000) and assert exact `(startMeasure, endMeasure)` plans. Today the only proof optimal differs from greedy is one synthetic 17-uniform-measure case; a real-music fixture protects against the optimizer silently degenerating to greedy on non-uniform input.

---

*Audit completed without reading `TEST-COVERAGE-AUDIT.md`.*
