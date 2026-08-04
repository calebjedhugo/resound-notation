# TODO

Visual issues caught in the dev playground after the SMuFL Bravura swap (commits up through `7cd6a84`). Verify each by snapping the relevant preset (`cd dev && ./snap.sh <name>`) before/after fixing.

## Visual issues — deferred from the 2026-05-13 iterate-notation pass

- [ ] **Volta-2 + ledger-line collision at end-repeat.** Partially fixed in `3c3b48b` (notehead center now clears the end-repeat's thick stroke by 10px). The volta-2's first note's ledger line still optically crowds the end-repeat's thick stroke. Proper fix is in the volta-layout pass: push the second-ending `startX` past the end-repeat's full geometry (thick + dots + inner pad), not just past the barline center. Repro: `cd dev && ./snap.sh repeats`, look at the second system's right side.

- [ ] **Barlines past staff-line right edge in `accidentals-sweep`.** Side-finding from the #6 beam-overflow investigation — that system's regular barlines sit at x≈818 while staff lines stop at x=800. Not a beam bug; a staff-width vs barline-x mismatch in the layout. Probably the system-width computation forgot to extend the staff-lines to cover the final barline, or the barline is drawn at an unintended cursor position. Worth ~30 min to trace `staffLineWidth` / `systemEndX` divergence in `NotationRenderer.js`.

- [ ] **Tuplet bracket on/off rules never audited.** Current behavior: number-only (no bracket) for beamed tuplets, bracket for unbeamed. Gould's rules are more nuanced (bracket needed when the tuplet spans rests, or when beam direction makes the grouping ambiguous). Not a snap-evident bug, but the rules haven't been verified against Behind Bars.

- [ ] **First-note clearance past clef in continuation systems still reads tight.** After `4c7f3e4` the timesig-trailing case is fixed (≥20px to digit visible right edge). The clef-only continuation case measures 20.2px which is at-spec but visually feels close — possibly because clef trailing extent isn't accounting for the clef's curl extending right of its nominal bbox. If the user re-flags it, look at the clef glyph's true visual right-x vs its bbox-x.

## Visual issues — `tuplets` preset, rightmost group: the "6" tuplet digit appears half-clipped or overlapping the beam stack above it. Check whether it's a real layout collision (tuplet number rendered too close to the beam, or beam extension on 16th/32nds pushing into tuplet-number Y) vs. just the snap window width truncating. If real, the tuplet-number Y offset needs to push further from the beam outer edge — likely in `TupletBracket.js` or wherever `BEAM_THICKNESS`/`BEAM_GAP` gets accounted for.

- [x] ~~**Accidental spacing inside beamed groups.**~~ Done. `ACCIDENTAL_OFFSET` is now **30** (not the 24 this item was written against) and `ACCIDENTAL_OFFSET_BEAMED_PRIOR = ACCIDENTAL_OFFSET - 6` applies the per-context shrink, gated by `ACCIDENTAL_PRIOR_NEAR` so it only fires when the prior beamed head is actually close. See `src/NotationRenderer.js`.

- [ ] **Snap height clipping on multi-voice presets** — `time-signatures` preset, 4th (unmetered) voice: appears cut off vertically. Probably a `dev/snap.html` SVG height issue rather than a renderer bug — the multi-voice output got taller after the SMuFL/beam changes and the snap viewport isn't growing. Check the SVG `height` attribute and viewBox against `--window-size` in `dev/snap.sh`.

## Engraving defects found in the 2026-08-03 refactor audit

These are **confirmed, reproducible** and each changes rendered output, so they were left unfixed during a no-behavior-change refactor. Each needs a failing test first (see `/iterate-notation`).

- [ ] **`computeBeamGroups` doesn't advance its beat cursor across a tuplet.** `getElementBeats` (`src/lib/beaming.js`) returns 0 for a `{tuplet, notes}` wrapper because the wrapper has no `.length`, so every note after a tuplet is grouped against the wrong beat boundary. Invisible when the tuplet spans a whole number of beats (a triplet of 8ths in 4/4 — the common case), visible otherwise. Repro: `computeBeamGroups([{tuplet:[3,2],notes:[three 16ths]}, e,e,e,e], [4,4])` → `[[1,2],[3,4]]`; correct is `[[2,3]]`. Fix: reuse the exported `elementBeats` from `src/lib/sliceVoiceByMeasure.js`, which already handles chords and tuplets — that also collapses one of three divergent beat-walkers.

- [ ] **`computeBeamGroups` doesn't reset its beat cursor on an explicit `barline` marker.** `sliceVoiceByMeasure.js` does `beat = 0` at a barline; `beaming.js` just flushes the group and keeps counting. Harmless when bars are a whole number of beats, wrong for an irregular bar. Repro: `[quarter, eighth, {barline:'single'}, e,e,e,e]` in 4/4 → `[[4,5]]`; a reset cursor gives `[[3,4],[5,6]]`.

- [ ] **Fermata stacking offset is inverted.** `src/components/Articulation.js`: `let fermataOffset = stemDown ? NOTEHEAD_GAP : offset;`. The other articulations render on the side opposite the stem (`below = !stemDown`) and grow `offset`. So when `stemDown` is true the others are stacked *above* and the fermata resets to `NOTEHEAD_GAP` and **collides with them**; when `stemDown` is false the others went *below* yet the fermata inherits their grown `offset` and floats too high. The two arms should be swapped: `stemDown ? offset : NOTEHEAD_GAP`. No test combines a fermata with another articulation.

- [ ] **Tenor-clef flat key signatures may be mis-placed.** `KEY_SIG_POSITIONS.tenor.flat` is `['B3','E3','A3','D3','G3','C3','F3']` — all octave 3, the only row of the four clefs that doesn't alternate octaves. It yields y = `40, 80, 50, 90, 60, 100, 70`, putting the 6th flat (C♭) at y=100, below the bottom staff line (90). The pattern-consistent row `['B3','E4','A3','D4','G3','C4','F3']` gives `40,10,50,20,60,30,70`, entirely inside the staff. **Needs a musician's eye before changing** — treble *sharps* legitimately reach above the staff (G♯ in the space above the top line) and bass *flats* reach below, so "outside the staff" is not by itself proof of a bug. No test renders a tenor or alto key signature at all.

- [ ] **`measureIntrinsicWidths` ignores `pickupBeats`.** Its private `measureVoice` splits on `accumulatedBeats >= measureLength` and never sees the pickup, so on a pickup piece its `measureIndex` values are off by one relative to `measureGrid.js` / `sliceVoiceByMeasure.js`. Currently harmless because the table feeds only the public `getIntrinsicWidths()` accessor, which nothing calls — but that makes it a trap for whoever wires it up.

- [ ] **`isMeasureBoundary(0, len, pickup)` returns `false` under a pickup**, contradicting its own docstring ("beat 0 counts as a boundary"). Not live today — `computeSystemSpringLayout`'s `isInteriorBoundary` already rejects `beat <= 0` — but the contract and the doc disagree. Its sibling `measureIndexAt` also lacks the `measureLength` guard that `isMeasureBoundary` has, returning `Infinity` for both 0 and null (null coerces to 0 in the division).

- [ ] **`lyricSpacing` drops constraints silently on a beat-key miss.** `applyLyricSpacing` looks syllable anchor beats up in `computeBeatLayout`'s map and `continue`s when the index is < 0. The module's correctness depends on three separate beat-walkers (`walkLyricAnchors`, `collectVoiceEvents`, `elementBeats`) staying bit-identical; when float drift breaks that, syllables overlap with no diagnostic. Worth a `console.warn` or a returned miss count.

- [ ] **`segmentOttava` clobbers `closureReason`.** A segment that absorbed nothing still comes back labelled `'absorbed'`, wiping `'voice_ended'` / `'merged'`. `closureReason` is part of the module's returned shape. Related: both `boundarySnap` loops iterate `delta` over `[-SNAP_BUDGET, +SNAP_BUDGET]` but only ever accept `cand < startIndex` (resp. `cand > endIndex`), so half of each loop is unreachable and the "prefer earlier/later" intent is only half-implemented.

## Asset coverage still pending

- [ ] **Brace** (`Brace.js`) — still hand-rolled path. Bravura has no atomic brace SVG (it's drawn as a wide path or multi-segment); revisit if a brace asset arrives.
- [x] ~~**Articulations**~~ — wired. `Articulation.js` dispatches to `ARTICULATION_GLYPHS` for staccato / accent / tenuto / marcato / fermata (Above+Below pairs). Only `staccatissimo` and `portato`, which have no Bravura entry here, are still hand-rolled.
- [x] ~~**Fermata**~~ — shipped; `fermataAbove` / `fermataBelow` are in `ARTICULATION_GLYPHS`.
- [ ] **Ornaments** — `ornamentTrill`, `ornamentMordent`, `ornamentTurn` available.
- [ ] **Repeat / final barlines** — Bravura has `repeatLeft`, `repeatRight`, `barlineFinal`, `barlineDouble`. Current barline rendering may already match, but worth a visual check.
- [ ] **Augmentation dot** — `augmentationDot` glyph exists; check whether dotted notes use it or a hand-rolled circle.

## Polish ideas (lower priority)

- [ ] Re-run a sweep through every preset, snapping each, eyeballing for new regressions introduced by the SMuFL swap (ties/slurs, grace notes, percussion, multi-voice independent, key-signatures, ledger-lines-extreme).
- [ ] Consider exposing a Petaluma variant — `~/Desktop/smufl-glyphs/petaluma/` is the same 83 glyphs in handwritten/jazz style.

## System layout — deferred from the responsive-layout work

- [x] ~~**Final-system justification is too coarse.**~~ Closed by Iteration E: Knuth-Plass optimal break-point selection picks balanced finals on its own, and the renderer dropped the ">1.5 stretch" escape hatch. The 1-measure-final-stays-ragged convention is retained.
- [x] ~~**Backflow when the final system is very short.**~~ Closed by Iteration E: the optimizer sees the whole piece, so 17 uniform measures at budget 5/system now wrap [4,4,4,5] instead of greedy's [5,5,5,2].
- [ ] **Cross-system ties and slurs.** Currently truncated at boundaries with a `console.warn`. Engraving convention is a half-tie at end of system N and a half-tie at start of system N+1 reconnecting the same pitch. Needs a per-system handoff state in `_renderSystem` and a new tie-fragment renderer.

## Notes

- 925/925 tests across 51 suites passing as of 2026-08-03. (This line goes stale fast — `npm test` is the source of truth.)
- Live dev playground: `cd dev && npm run dev` → http://127.0.0.1:5173/ — the playground supports `?preset=<name>` for direct loading of a single preset via `snap.html`.
