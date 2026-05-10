# TODO

Visual issues caught in the dev playground after the SMuFL Bravura swap (commits up through `7cd6a84`). Verify each by snapping the relevant preset (`cd dev && ./snap.sh <name>`) before/after fixing.

## Visual issues

- [ ] **Tuplet number / beam collision** — `tuplets` preset, rightmost group: the "6" tuplet digit appears half-clipped or overlapping the beam stack above it. Check whether it's a real layout collision (tuplet number rendered too close to the beam, or beam extension on 16th/32nds pushing into tuplet-number Y) vs. just the snap window width truncating. If real, the tuplet-number Y offset needs to push further from the beam outer edge — likely in `TupletBracket.js` or wherever `BEAM_THICKNESS`/`BEAM_GAP` gets accounted for.

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

- [ ] **Final-system justification is too coarse.** Current Gould rule (don't justify if 1 measure final OR stretch >1.5) leaves visually short last systems ragged. Some short-last-system cases should still justify (Gould has nuanced sub-cases). Look at how Lilypond / Dorico decide.
- [ ] **Backflow when the final system is very short.** When the last system contains far less content than the prior systems, an optimal break would pull a measure from system N-1 to balance. Requires Knuth-Plass-style optimal break-point selection (sketched as "Iteration E" in the responsive-layout plan) — DP across all candidate break points minimizing total badness.
- [ ] **Cross-system ties and slurs.** Currently truncated at boundaries with a `console.warn`. Engraving convention is a half-tie at end of system N and a half-tie at start of system N+1 reconnecting the same pitch. Needs a per-system handoff state in `_renderSystem` and a new tie-fragment renderer.

## Notes

- 520/520 tests passing as of commit `7cd6a84`.
- Live dev playground: `cd dev && npm run dev` → http://127.0.0.1:5173/ — the playground supports `?preset=<name>` for direct loading of a single preset via `snap.html`.
