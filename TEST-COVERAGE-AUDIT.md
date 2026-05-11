# Test Coverage Audit — Iterations A–E (responsive layout overhaul)

Scope: `src/NotationRenderer.test.js` (focus on the new blocks starting at line ~2584), `src/lib/breakIntoSystems.test.js`, `src/lib/measureIntrinsicWidths.test.js`, `src/lib/segmentOttava.test.js`, plus a sweep for untested files. Audit only — no code or test changes.

Total tests audited (in the relevant areas): ~80 across the targeted blocks. Several tests have strong assertions; many in the new responsive/spring/optimal blocks have at least one significant weakness or are silently complemented by other tests in ways future authors should not rely on.

---

## 1. Strong tests worth highlighting

- **`multi-voice piece keeps voices stacked within each system`** (`NotationRenderer.test.js:2863`). The Y-bucketing approach is the model. It is exactly the kind of structural invariant that survives implementation changes and would catch the original Iteration-B regression. Keep this template in mind for other "stacked" invariants.
- **`breakIntoSystemsOptimal — rebalances 17 uniform measures`** (`breakIntoSystems.test.js:229`). Asserts greedy gives a 2-measure straggler AND optimal gives ≥4; a regression to greedy fails immediately.
- **`breakIntoSystemsOptimal — covers all measures exactly once with monotonically increasing ranges`** (`breakIntoSystems.test.js:269`). The right structural invariant for an optimizer — every off-by-one bug fails this.
- **`justifySystemSpring — quarter > eighth, margin grows under stretch`** (`breakIntoSystems.test.js:157`). Asserts a real property (stretched margin > rest margin), not just inequality.
- **`coalesces multiple setWidth calls in the same tick into one render`** (`NotationRenderer.test.js:3155`). Spies on `_flush`, asserts exactly one call AND that the final width is the latest value. Solid.
- **`applies STAFF_TOP_OFFSET to .staff-lines and only to .staff-lines`** (line 396). The named "tripwire" test, still doing its job.

---

## 2. Weak tests (specific weaknesses + concrete fix)

### `NotationRenderer.test.js`

#### `renders a short piece as a single system` (line 2656)
- **Weakness:** the sole assertion is `staff-lines length == 1`. A two-measure whole-note input is forced; if the renderer dropped the second measure entirely or rendered an empty staff, this would still pass.
- **Fix:** also assert `svg.querySelectorAll('.note').length === 2` and that there is exactly one `.barline-final`.

#### `wraps a long piece onto multiple systems` (line 2690)
- **Weakness:** `expect(systems.length).toBeGreaterThanOrEqual(2)`. A buggy implementation that produces 50 single-note systems also passes.
- **Fix:** assert an upper bound too (e.g. `staves.length <= 8` for a 16-measure piece at width 800), and assert each system has at least one `.barline` inside it.

#### `keeps voices synchronized across system boundaries` (line 2701)
- **Weakness:** Only asserts `v0.length === v1.length` and `>= 2`. This is exactly the assertion pattern that allowed commit `2ae5ebb` to slip through — two voices each in their own one-voice system would also produce equal counts at equal `>= 2`. The new "Y-bucketing" test at line 2863 catches it for the Bach preset; this test does not for the synthetic case it builds.
- **Fix:** apply the Y-bucketing pattern from line 2863 here too (synthetic 2-voice piece). Or at minimum, assert that the `data-voice-id="top"` and `data-voice-id="bot"` staves share Y buckets across the systems.

#### `keeps a solo trailing measure unjustified` (line 2724)
- **Weakness:** the only meaningful assertion is `x <= 801`. That passes for any number from 0 to 801. The test claims to verify the "1-measure last-system rule" but does not assert the system is actually short of width (i.e. that it is in fact unjustified). Also assumes a particular break that optimal may not actually produce.
- **Fix:** First assert there really is a 1-measure final system (count notes-per-system or barlines-per-system). Then assert `x < width * 0.95` (ragged) — the engraving convention requires the final to look unjustified. Currently this test does not pin the unjustification.

#### `respects the breakingStrategy: "greedy" escape hatch` (line 2786)
- **Weakness:** only asserts each renderer produced `>=1` staff. Does not assert that greedy and optimal actually differ on this input, or that the greedy result matches the known-pathological [5,5,5,2] layout. If `breakingStrategy: 'greedy'` is silently ignored and falls back to optimal, this test still passes.
- **Fix:** count measures-per-system in the greedy output and assert the last system is the small straggler (`<=2`). Cross-check with the optimal result and assert they differ.

#### `applies a uniform scale parameter to the SVG dimensions` (line 2807)
- **Weakness:** uses a one-note input — there is no chance of a system-count change being driven by content density. Also: as implemented, scale does NOT use a `transform="scale(N)"` attribute (it manipulates `width/height` vs `viewBox`). A test that explicitly verified the contract — "viewBox unchanged, only width/height attrs scale" — would harden the design intent.
- **Fix:** add an explicit `viewBox` invariant assertion (the viewBox values at scale=1 and scale=2 must be identical). Currently nothing pins that — if a future refactor adds a `transform="scale(N)"` wrapper, this test still passes but the design promise breaks.

#### `renders a thin-final barline at the very end of the piece` (line 2829)
- **Weakness:** asserts `>=1`, says nothing about position, count (should be exactly 1), or that it sits on the last system.
- **Fix:** `expect(finals.length).toBe(1)` and assert its `x` is at the rightmost of any barline in the SVG.

#### `renders an ottava bracket per system when a segment spans a system break` (line 2841)
- **Weakness:** asserts only `brackets.length > 0`. The test name promises "per system when a segment spans a system break," but the assertion does NOT verify the segment actually spans a system boundary, nor that two bracket halves emit (one per system) with correct hooks (end-hook on the first, start-hook on the second). A bug that renders one bracket on system 1 and silently drops the continuation on system 2 passes.
- **Fix:** count `.ottava-bracket` per system parent (group by ancestor `g[data-system-index]` if available, or by Y bucket). Assert at least one segment yields 2 bracket elements with adjacent system indices; assert their X ranges form a continuation. Without this, cross-system ottava correctness is uncovered.

#### `within a system, voices share x positions at the same beat` (line 2942)
- **Weakness:** only checks beat 0. Beat 0 being the system-start (post-clef/key/time) is a relatively easy-to-get-right case; the failure mode is beats 1..N.
- **Fix:** check beats 1, 2, 3 as well (`topNotes[i]` vs `botNotes[i]`).

#### `setSong batches and re-renders with the new song` (line 3179)
- **Weakness:** asserts only `noteCountAfter > noteCountBefore`. A bug where `setSong` ignores the new song but appends a stray `.note` to the old one would pass. Also: does not verify the batching contract — that the SVG is unchanged BEFORE `tick(renderer)` (the way the `setWidth` batching test correctly does at line 3140).
- **Fix:** add a pre-tick assertion that the SVG element identity is unchanged and the note count is still the old value. Then after tick, assert `noteCountAfter === 3`.

#### `setScale batches and re-renders with new SVG dimensions` (line 3198)
- **Weakness:** only checks SVG `width` attr doubled. Does not check height, does not check the viewBox is unchanged, does not check that no re-layout happened (system count unchanged). Same pre-tick batching guarantee missing as `setSong` above.
- **Fix:** add pre-tick assertion (SVG identity unchanged), and post-tick assert height doubled AND viewBox unchanged AND system count unchanged.

#### `setWidth before any render(song) is a no-op` (line 3214)
- **Weakness:** test name says "no-op" but only checks `getSvgElement() === null`. Does not verify that the queued state was actually applied when `render(song)` is later called — i.e. that `setWidth(400)` before `render()` survives or is forgotten as intended. Whichever the contract is, it should be pinned.
- **Fix:** after the first `render(song)`, assert the SVG width is 400 (if the early `setWidth` is meant to persist) — or assert it is the constructor default (if it is meant to be lost). The spec is silent and the test doesn't pin either way.

#### `ResizeObserver — observe() attaches a ResizeObserver to the container` (line 3254)
- **Weakness:** verifies one observer was created and the container is among `targets`. The hand-rolled mock has no test that `observe()` is idempotent in practice — the implementation guards with `if (this._resizeObserver) return;` but no test asserts a second `observe()` does not double-attach.
- **Fix:** call `observe()` twice, assert `observerInstances.length === 1`.

#### `ResizeObserver mock realism` (line 3234)
- **Weakness:** the mock's `fire()` calls `cb([], this)` with an empty entries array. The real ResizeObserver passes entries with `contentRect.width`. The implementation does not read from entries (it uses `container.clientWidth`), so the mock is OK by coincidence. But if any future change reads `entries[0].contentRect.width`, every reactive test passes against an empty array (silently using undefined) and the bug ships.
- **Fix:** have the mock pass realistic `entries` (with a `contentRect.width === clientWidth`), so the assertion catches a future code path that reads entries.

#### `clear() disconnects the ResizeObserver` (line 3316)
- **Weakness:** asserts `getSvgElement() === null` after `clear()` + `fire()` + `_flush()`. But `clear()` already nulls the SVG; the test does not pin that the resize callback short-circuited. If `clear()` did NOT disconnect the observer and the callback re-rendered, the assertion `getSvgElement() === null` would still pass only because `_flush()` early-returns on `!_song` (also cleared by `clear()`). The disconnect contract is therefore not actually exercised by the SVG assertion.
- **Fix:** assert `observerInstances[0].targets.length === 0` after `clear()`. That directly verifies disconnect was called.

#### `zoom-to-fit mode: callback updates scale, not width; system count unchanged` (line 3288)
- **Weakness:** good test, but does not assert that `_width` did NOT change. A buggy zoom-to-fit that also bumps `_width` would still produce the same system count if the changes happened to cancel. Negative assertion missing.
- **Fix:** capture `_width` before, assert unchanged after.

### `breakIntoSystems.test.js`

#### `justifySystem — leaves a last system unjustified when it has only one measure` (line 69)
- **Weakness:** intrinsics arg `[0, 0, 0, 0, 0, 100]` — five leading zeros are unrealistic. Fine as a unit test but easy to misread.
- **Fix:** none required; cosmetic.

#### `systemBadness — penalizes overflow with a large finite cost` (line 196)
- **Weakness:** lower bound `>100` is very loose. The whole point of overflow penalty is that it dominates everything else; a tighter lower bound (e.g. `> 10 * systemBadness(400, 440, false)`) would catch a bug that under-penalizes overflow such that the optimizer prefers a too-tight system.
- **Fix:** assert overflow cost dwarfs in-range stretch cost.

#### `breakIntoSystemsOptimal — matches greedy on an even-distribution piece` (line 217)
- **Weakness:** good but the converse is not tested — no test asserts optimal NEVER produces worse total badness than greedy on any input. A property-style test would catch optimizer regressions broadly.
- **Fix:** see Missing tests §3.

### `measureIntrinsicWidths.test.js`
- No major weaknesses. Tests are tightly numeric. The one gap: no test covers the rest/barline contribution to width — only notes. If a future change makes rests zero-width, no test catches it.

### `segmentOttava.test.js`
- Strong overall. No coverage of system-break interaction (that lives in `NotationRenderer.test.js:2841`, which has its own weakness — see above).

---

## 3. Missing tests (proposed additions)

### System breaking & justification
- **Optimal-vs-greedy total-badness invariant.** For 10 random intrinsic-width arrays (seeded), assert `sum(systemBadness)` for `breakIntoSystemsOptimal` is `≤` that of `breakIntoSystems`. Catches optimizer regressions that other tests miss.
- **Synthetic multi-voice Y-bucketing test.** The Bach-preset test at line 2863 is the only true voice-stacking integration test. Add a synthetic 16-measure 2-voice test at width 600 that applies the same Y-bucket assertion. The preset can change shape; a synthetic input pins the contract.
- **Voice count > 2.** No 3- or 4-voice system-break test exists. The `% numVoices === 0` invariant would be more meaningful at 3 voices.
- **System-break preserves total content.** Assert that across all systems combined, the count of `.note` elements equals the count of input note events. Currently nothing prevents a system-break bug that drops or duplicates notes at the boundary.
- **Greedy "respects the breakingStrategy" actually differs.** See §2.

### Reactive layout
- **rAF batching is real on `setSong`/`setScale` (not just `setWidth`).** Current `setSong`/`setScale` tests do not verify pre-flush invariance (see §2).
- **`setWidth` + `setSong` + `setScale` together coalesce to ONE flush.** Cross-setter coalescing is uncovered — only `setWidth × 3` is exercised. A bug that schedules an independent rAF per setter would pass the existing test (it spies on `_flush`) only if no setter forgets to check `_rafId != null`. Verify directly: call all three setters, spy `_flush`, expect exactly 1 call.
- **ResizeObserver entries are read correctly.** Mock should pass real `entries`; assertion should fail if the implementation regresses to reading `entries[0].contentRect.width` and finds undefined.
- **`unobserve()` after `observe()` then `fire()` — no render.** Currently only `clear()` is tested for this. A bare `unobserve()` (without `clear()`) is not.
- **`responsiveMode` invalid value falls back gracefully** (or throws). No test pins behavior for `responsiveMode: 'invalid'` or absent.
- **`observe()` is idempotent.** See §2.

### Spring spacing
- **Same piece at width=400 vs width=800: rhythmic proportions are preserved.** For a measure `[1/4, 1/4, 1/8, 1/8, 1/8, 1/8]` rendered at 400 and 800, assert the *ratio* `quarterGap / eighthGap` is approximately the same at both widths (within 20%). This is the actual engraving-quality property the spring model is supposed to give; nothing asserts it today.
- **`justifySystemSpring` with mixed positive/zero/negative K.** No test covers K=0 (fixed-width spring). If the solver divides by sumK, K=0 input could NaN.
- **Single-spring system edge case** (one note, one barline). Implicitly covered but not explicitly.

### Optimal breaking
- **Final-system 1-measure case stays ragged in optimal too.** Currently the "1-measure unjustified" test (line 2724) runs through the renderer with `breakingStrategy='optimal'` (the default) and does not actually verify a 1-measure final occurred. Construct an input where optimal IS forced to leave 1 measure final (e.g. 5 measures at a budget that fits 2/system) and assert ragged.
- **Badness gradient sanity.** `systemBadness` should be monotonically nondecreasing in `|stretch - 1|`. Property-style sweep over stretches 0.5 to 2.0.

### Scale parameter
- **`scale=0.5` and `scale=3`.** Only `1` and `2` tested. A divide-by-zero-prone refactor at scale<1 wouldn't be caught.
- **`scale=2` viewBox unchanged.** See §2.
- **`scale` interacts with `observe()`** in zoom-to-fit: covered, weakly (see §2).

### Ottava + system breaking
- **Two bracket elements when an 8va segment spans a system boundary.** See §2. Construct a 6-measure preset where an 8va segment definitely spans a break; assert exactly 2 `.ottava-bracket` elements, one per system, both with proper end-hook/start-hook glyphs.
- **No spurious bracket re-open on system start when the segment ended on system 1.** Negative case.
- **8vb + system break mirror.** Same as above for low passages.

### Untested files
- **`src/lib/sliceVoiceByMeasure.js`** has zero tests. This is *the* function that drives multi-voice voice-major slicing during system breaks. Add unit tests covering: measure-aligned splits, mid-tuplet attempts (should it warn/throw/round?), empty trailing measures, voice with fewer measures than `endMeasure`. Currently every behavior here is tested only indirectly through end-to-end SVG output.
- **`src/lib/slurGrouping.js`** has zero tests.
- **`src/lib/tuplets.js`** has zero tests.

---

## 4. False-confidence risk

These tests are most likely to mislead a future developer into thinking a feature works when there is a real gap:

1. **`keeps voices synchronized across system boundaries`** (line 2701). The name promises strong sync; the assertion only checks equal counts. The Iteration-B regression pattern would re-pass this test if it recurred in a different shape (e.g. one voice per "system" with synthetic input rather than the Bach preset). The Bach Y-bucket test catches it for that specific input — but a future author who reads this test name will believe synthetic 2-voice sync is covered. It is not.
2. **`renders an ottava bracket per system when a segment spans a system break`** (line 2841). Name promises per-system bracket emission across breaks; assertion only verifies "more than zero brackets." A regression that drops the second half of a cross-system ottava ships green.
3. **`respects the breakingStrategy: "greedy" escape hatch`** (line 2786). Name promises greedy is honored. Assertion does not distinguish greedy from optimal output. If `breakingStrategy` were ignored entirely, this passes.
4. **`setSong batches and re-renders with the new song`** (line 3179). Name promises batching; the test never proves the pre-flush invariance the way the `setWidth` analog does.
5. **`clear() disconnects the ResizeObserver`** (line 3316). Name promises disconnect. The assertion piggybacks on `_song` being nulled, so it does not actually test disconnect.
6. **`applies a uniform scale parameter to the SVG dimensions`** (line 2807). Name promises "uniform scale." Does not assert the viewBox stays in internal coordinates (the design property). A future refactor breaks the design and the test still passes.

---

## 5. Recommended next iteration — top 5 priorities

1. **Add a synthetic-input multi-voice Y-bucketing test** mirroring line 2863 but without depending on a preset file. Apply at 2, 3, and 4 voices. (Closes the largest false-confidence gap — the same regression class that bit Iteration B.)
2. **Strengthen the cross-system ottava test** (line 2841) to actually verify a 2-bracket continuation with correct hooks. Today this is the weakest "important" test in the suite — ottava + system-break is a known hard interaction and the only test that covers it asserts essentially nothing.
3. **Tighten reactive-layout batching tests** to enforce pre-flush SVG invariance on `setSong` and `setScale` (currently only `setWidth` does this) and add a cross-setter coalescing test (`setSong` + `setWidth` + `setScale` → one `_flush`).
4. **Add unit tests for `sliceVoiceByMeasure.js`.** Zero coverage on a function load-bearing for system breaks is the silent risk most likely to bite the next refactor.
5. **Add the "rhythmic proportions preserved across widths" spring-spacing test.** This is the property engravers actually care about; the current spring tests verify the math but not the visible result across two widths.

---

*Audit produced 2026-05-10. Read-only. No code or test changes were made.*
