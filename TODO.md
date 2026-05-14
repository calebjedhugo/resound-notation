# TODO

Visual issues caught in the dev playground after the SMuFL Bravura swap (commits up through `7cd6a84`). Verify each by snapping the relevant preset (`cd dev && ./snap.sh <name>`) before/after fixing.

## Visual issues — deferred from the 2026-05-13 iterate-notation pass

- [ ] **Volta-2 + ledger-line collision at end-repeat.** Partially fixed in `3c3b48b` (notehead center now clears the end-repeat's thick stroke by 10px). The volta-2's first note's ledger line still optically crowds the end-repeat's thick stroke. Proper fix is in the volta-layout pass: push the second-ending `startX` past the end-repeat's full geometry (thick + dots + inner pad), not just past the barline center. Repro: `cd dev && ./snap.sh repeats`, look at the second system's right side.

- [ ] **Barlines past staff-line right edge in `accidentals-sweep`.** Side-finding from the #6 beam-overflow investigation — that system's regular barlines sit at x≈818 while staff lines stop at x=800. Not a beam bug; a staff-width vs barline-x mismatch in the layout. Probably the system-width computation forgot to extend the staff-lines to cover the final barline, or the barline is drawn at an unintended cursor position. Worth ~30 min to trace `staffLineWidth` / `systemEndX` divergence in `NotationRenderer.js`.

- [ ] **Tuplet bracket on/off rules never audited.** Current behavior: number-only (no bracket) for beamed tuplets, bracket for unbeamed. Gould's rules are more nuanced (bracket needed when the tuplet spans rests, or when beam direction makes the grouping ambiguous). Not a snap-evident bug, but the rules haven't been verified against Behind Bars.

- [ ] **First-note clearance past clef in continuation systems still reads tight.** After `4c7f3e4` the timesig-trailing case is fixed (≥20px to digit visible right edge). The clef-only continuation case measures 20.2px which is at-spec but visually feels close — possibly because clef trailing extent isn't accounting for the clef's curl extending right of its nominal bbox. If the user re-flags it, look at the clef glyph's true visual right-x vs its bbox-x.

## Visual issues — `tuplets` preset, rightmost group: the "6" tuplet digit appears half-clipped or overlapping the beam stack above it. Check whether it's a real layout collision (tuplet number rendered too close to the beam, or beam extension on 16th/32nds pushing into tuplet-number Y) vs. just the snap window width truncating. If real, the tuplet-number Y offset needs to push further from the beam outer edge — likely in `TupletBracket.js` or wherever `BEAM_THICKNESS`/`BEAM_GAP` gets accounted for.

- [ ] **Accidental spacing inside beamed groups** — `accidentals-sweep` preset: sharp before the second beamed 16th sits almost touching the preceding notehead. `ACCIDENTAL_OFFSET = 24` works for non-beamed contexts but reads tight when both flanks are eighth/16th heads in a beam. Consider a per-context offset (e.g. add ~6px when the prior element is a beamed sibling), or just bump the global to ~28-30 and check it doesn't push other layouts apart.

- [ ] **Snap height clipping on multi-voice presets** — `time-signatures` preset, 4th (unmetered) voice: appears cut off vertically. Probably a `dev/snap.html` SVG height issue rather than a renderer bug — the multi-voice output got taller after the SMuFL/beam changes and the snap viewport isn't growing. Check the SVG `height` attribute and viewBox against `--window-size` in `dev/snap.sh`.

## Asset coverage still pending

- [ ] **Brace** (`Brace.js`) — still hand-rolled path. Bravura has no atomic brace SVG (it's drawn as a wide path or multi-segment); revisit if a brace asset arrives.
- [ ] **Articulations** — staccato / accent / tenuto / marcato glyphs are in Bravura (`articStaccatoAbove` etc.) but not yet wired. Hand-rolled in `Articulation.js` if implemented at all.
- [ ] **Fermata** — `fermataAbove` / `fermataBelow` available in Bravura.
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

- 520/520 tests passing as of commit `7cd6a84`.
- Live dev playground: `cd dev && npm run dev` → http://127.0.0.1:5173/ — the playground supports `?preset=<name>` for direct loading of a single preset via `snap.html`.
