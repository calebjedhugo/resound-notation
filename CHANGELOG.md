# Changelog

## Unreleased

### Added

- **Multi-verse lyrics (hymnal-style stacked verses)** —
  SPEC-multi-verse-lyrics.md. `lyric` now also accepts an array of
  strings/nulls, one entry per verse (`['A-', 'Twas', 'Through']`); `null`
  means no syllable for that verse on that note. Verse lines stack below
  the staff 26 units apart (verse 1 at the legacy position); each verse
  computes its own melisma underscores independently; verse numbers
  ("1.", "2.", …) render as separate end-anchored text elements at each
  system's first syllable of every verse (multi-verse voices only, so note
  spacing never shifts); inter-staff skylines, the inter-system gap, and
  the viewBox all reserve room for the verse block — including below a
  shared (close score) staff. Bare-string lyric input renders
  pixel-identically to before.

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
