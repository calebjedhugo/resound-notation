# Changelog

## Unreleased

### Added

- **Double dots** — `dotted: 2` on a note, rest or chord member is a
  double-dotted value (1.75x the written length; `dotted: true` / `1`
  stays one dot, 1.5x). Engraved with two augmentation dots (new
  `components/AugmentationDots`), and counted at 1.75x everywhere the
  renderer turns a length into beats (layout, barlines, beaming, measure
  slicing, lyric spacing, tuplets, playback `data-beat`s). New
  `lib/durationSymbols` exports `dotCount(dotted)` and `dotFactor(dotted)`.
- **Dotted chords draw their dots** — every head of a dotted chord gets its
  dot(s) in a space (a space two heads of a second share is dotted once).
  Before, a dotted chord took a dotted chord's time but showed no dot.
- Tests pin per-note ties inside chords (one chord tone tied, the rest
  struck; a tie into an entry lacking its pitch draws nothing).

- **`getContentWidth()`** — the rightmost rendered extent (widest system's
  closing barline) of the most recent render, in layout units. Lets a
  consumer that probe-renders at an oversized width (a one-system ribbon)
  re-render tight to the music without a `getBBox` sweep over the live SVG.

### Performance

- Layout-pass hotspots memoized: `parseFraction`/`fractionToBeats`,
  `getDurationInfo` (frozen shared rows instead of per-call clones),
  `parsePitch`, `estimateLyricWidth`, the breaker's `systemNaturalWidth`
  (per render), and `sliceVoiceByMeasure`'s measure-assignment walk (per
  voice array). `computeBeatLayout` and `computeBarlineLyricFloors` drop
  their quadratic inner scans for cursor sweeps.
- Single-system fast path: when the whole piece fits the container as one
  system (every ribbon render), the Knuth-Plass DP is skipped outright.
- `measureIntrinsicWidths` now computes lazily inside `getIntrinsicWidths()`
  instead of on every render; ottava index maps skip ottava-free voices;
  `setWidth` ignores same-value calls and the ResizeObserver ignores
  sub-2px container jitter.
- Four-hymn benchmark (jsdom): page renders ~1060ms → ~300ms, ribbon
  ~2790ms → ~210ms.

### Fixed

- `npm run build` now cleans `dist/` first, so files deleted from `src/`
  (the old `dist/editor/*`) no longer ship as stale build output.

- **Double accidentals** — `##`/`bb` accepted in pitch strings end to end
  (parse, MIDI math, ottava logic) and rendered with the SMuFL doubleSharp /
  doubleFlat glyphs, honouring in-measure accidental memory. A Db-major
  augmented sixth's Bbb no longer throws `Invalid pitch`. The doubleFlat is
  composed from two flat glyphs at the font's 411-unit advance (the asset
  dump's doubleFlat outline is truncated/corrupt and rendered with
  artifacts); doubleSharp uses its intact glyph.
- **Accidental staggering** (Gould: accidentals on notes within a sixth
  never share a vertical column) — simultaneous accidentals in one attack
  column, whether chord notes or the two voices of a shared staff, now
  step left column by column instead of colliding. Wide glyphs
  (doubleFlat) right-align to the standard accidental edge and claim
  their full width.

- **Two voices per staff (close score)** — SPEC-multi-voice-staff.md. A
  Level-3 voice may declare an optional `staff` key; voices with the same
  value render on ONE shared staff (the SATB hymnal layout: soprano+alto on
  one treble staff, tenor+bass on one bass staff). Engraving rules: first
  declared voice stems always up, second always down (beams follow); staff
  furniture (lines, clef, key/time signature, barlines) draws once per staff
  in its own `data-staff-id` group outside the per-voice `data-voice-id`
  groups; both voices share the beat→x spacing grid; same-beat
  unisons/seconds and voice crossings shift the down-stem voice's notehead
  right one notehead width; up/down-voice rests shift up/down one staff
  space with same-beat same-duration rests deduped to one centered rest;
  in-measure accidental memory merges per staff; up-voice ties/slurs curve
  above and down-voice below. Validation: >2 voices per staff, clef
  mismatches, and unequal total durations throw. Inputs without `staff`
  keys render byte-identically to 1.0.0. New dev preset `close-score-hymn`.

- **Multi-verse lyrics (hymnal-style stacked verses)** —
  SPEC-multi-verse-lyrics.md. `lyric` now also accepts an array of
  strings/nulls, one entry per verse (`['A-', 'Twas', 'Through']`); `null`
  means no syllable for that verse on that note. Verse lines stack below
  the staff `VERSE_LINE_HEIGHT` (39) units apart (verse 1 at the legacy
  position); each verse computes its own melisma underscores
  independently; verse numbers
  ("1.", "2.", …) render as separate end-anchored text elements at each
  system's first syllable of every verse (multi-verse voices only, so note
  spacing never shifts); inter-staff skylines, the inter-system gap, and
  the viewBox all reserve room for the verse block — including below a
  shared (close score) staff. Bare-string lyric input renders
  pixel-identically to before.

- **Pickup (anacrusis) measures** — SPEC-pickup-and-barline-lyrics.md JOB B.
  New top-level **public input key `pickupBeats`**: measure 0 spans
  `[0, pickupBeats)` and every later measure boundary shifts by that amount
  (`src/lib/measureGrid.js`). Beam grouping counts a pickup backwards from
  the barline per standard engraving, and the system breaker/slicer honour
  the shifted grid. `validatePickup` throws when the declared pickup
  exceeds the measure length. Omitting the key reproduces the exact legacy
  grid. New dev preset `pickup-measure`.

- **Lyric-aware horizontal spacing** — SPEC-lyric-spacing.md JOB 1. Note
  spacing now widens so consecutive same-verse syllables cannot crowd, and
  a system opening on a multi-verse voice reserves lead-in room for its
  end-anchored verse numbers. Applied to the shared natural-width metric,
  so the system breaker sees the widened measures and justification
  preserves the minima. No-op for lyric-free input.

- **Syllable/barline clearance** — SPEC-pickup-and-barline-lyrics.md JOB A.
  Per-boundary floors keep a wide syllable centred on a measure's first or
  last note from reaching under the barline, including the closing barline
  of a system. Rides the barline-pad mechanism so lyric-free scores keep
  every pad at its exact previous value.

- **Per-character lyric width estimation.** `estimateLyricWidth` now sums a
  measured per-character width table rather than multiplying a character
  count by a flat ratio, so `MI` and `il` no longer reserve the same room.

### Changed

- **Lyric engraving scale raised to measured hymnal proportions** —
  SPEC-lyric-engraving-scale.md JOB 5 (and JOB 2 before it). Syllable font
  size 11 → 15 → **39**, verse numbers 10 → 13 → **33**,
  `VERSE_LINE_HEIGHT` 26 → 30 → **39**, `LYRIC_BASE_Y` 115 → **126**.
  Sized off real hymnal scans; JOB 2's intermediate values are superseded.

- **Lyric baselines sit below staff content** — JOB 4. A verse block's
  baseline is pushed past the staff's lowest ink (down-stem tips, beams,
  low ledgers) plus the measured ascender reach, so a down-stem partner
  voice on a shared staff can no longer overlap the text. Scores whose
  content stays clear of the band keep the legacy baseline exactly.

- **Long ties and slurs flatten** — SPEC-lyric-spacing.md JOB 3. Arc height
  grows sub-linearly with span instead of proportionally, so a tie spanning
  a stretched measure no longer balloons into the lyric band.

### Fixed

- **Final systems could render WIDER than the page.** A ragged last system
  placed its closing barline at the last note's duration-proportional
  trailing (`naturalRenderRightX`), but the system breaker only reserved
  the minimum trailing floor — so a piece ending on a long note
  (whole/dotted-whole) overflowed the container by up to ~16%
  (singHarmony2 repro: o-holy-night rendered its last system at 2287
  units in a 1971-unit page). The ragged render edge is now clamped to
  the container: ragged-right may be narrower than the page, never wider.
  Note positions are untouched, the trailing gap keeps its
  MIN_BARLINE_PADDING floor, and a degenerate single measure that cannot
  fit still renders at its natural (overfull) extent rather than being
  compressed.

- **Lyric extender lines after a voice's final syllable** — the melisma
  underscore now extends past the last syllable only through tied
  continuations of its own note. Untexted notes after the voice's last word
  (a bass echo line ending mid-song) no longer drew a line to the double
  bar.

## 1.0.0 — 2026-06-25

First stable release. The package is feature-complete for real engraving use and
has been driving `resound-fe` in production. From this point the **public API**
— the input JSON schema (`pitch`/`length`/`tuplet`/`voices`/…), the exported JS
surface, and the subpath-export structure — follows semver; breaking any of
those means a 2.0. Engraving *output* will keep being refined and such visual
changes are **not** considered breaking.

### Added

- **Automatic system breaking & wrapping.** Long phrases flow onto multiple
  justified staff systems using Knuth–Plass optimal break-point selection, with
  visible continuation barlines and per-system right-justification.
- **Responsive-by-default rendering.** The container owns the width; the
  renderer re-lays-out reactively via `ResizeObserver` + `requestAnimationFrame`
  batching (`scheduleRender`). A `scale` parameter zoom-reflows the bars.
- **Ottava (8va/8vb) auto-engraving** — automatic high/low-passage detection,
  bracket segmentation, dashed-line anchoring, and bass-clef 8vb support.
- **Rhythm-proportional horizontal spacing** via a spring-model justification
  (each note's trailing space scales with its own duration).
- `PROFESSIONAL_BASE_SCALE` named export from `NotationRenderer.js` — the
  internal-units → professional-pixels base, for consumers doing visual ↔ layout
  width math.

### Changed

- **`scale: 1.0` now renders a professional staff size** (~7 mm / 1.75 mm staff
  space at 96 dpi). Previously `scale: 1.0` left the renderer's internal
  20 px-per-staff-space unit unscaled (~5.3 mm/space at 96 dpi — about 3× the
  engraving norm). The professional base (`PROFESSIONAL_BASE_SCALE` ≈ 0.331) is
  now baked into the scale, so `scale: N` renders N × professional size.
  **Output-only change:** the rendered SVG's `width`/`height` attributes are
  ≈0.331× their former values; the `viewBox` is unchanged, so consumers that
  size the SVG via CSS or the viewBox — or rasterize it stretched-to-fit — are
  visually unaffected. Only code reading the intrinsic `width`/`height`
  attributes (expecting them to equal the input `width`) sees a difference.
- **Bravura/SMuFL conformance** — SMuFL flag glyphs for unbeamed notes, and
  spec-accurate thicknesses for staff lines, stems, barlines, ledger lines,
  slurs, ties, and hairpins.
- **Extensive engraving refinements** — Gould-correct beamed stem direction,
  ledger-line stem lengths (reach the middle line), beamed-tuplet stem
  projection onto the beam line, content-aware inter-staff spacing, the
  barline padding/spacing model, repeat-barline + volta geometry, and
  dynamics/hairpin/accidental placement.

### Fixed

- Suppressed a duplicate closing barline when a measure ends in a tuplet.
- Folded beams, dynamics, and hairpins into the content bounding box so the
  `viewBox` grows to fit them (no clipping of stems-up beams or trailing edges).

This release also accumulates the many smaller engraving/spacing refinements
committed since 0.1.0; see the git history for the full detail.

## 0.1.0 — 2026-05-08

Initial release. Extracted from `resound-fe/src/notation/`.

- `NotationRenderer` — top-level entry; renders a phrase into an SVG (with or without a container).
- 27 SVG component builders under `components/` (`Note`, `Clef`, `Staff`, `KeySignature`, `TimeSignature`, `BarLine`, `Beam`, `Tie`, `Slur`, `Articulation`, `Dynamic`, `Hairpin`, `RepeatBarline`, `Ending`, `GraceNote`, `TupletBracket`, …).
- 11 pure helpers under `lib/` (`notePositions`, `keySignatures`, `beaming`, `clefInference`, `dataParser`, `durationSymbols`, `slurGrouping`, `svgHelpers`, `tieResolver`, `tuplets`).
- Subpath exports (`resound-notation/components/*`, `resound-notation/lib/*`); deep imports preserved from the resound-fe source layout.
- 507 jest tests (jsdom). `dist/` ships per-file ESM with sibling `.d.ts` declarations.
