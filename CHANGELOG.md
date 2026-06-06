# Changelog

## 0.2.0 — Unreleased

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

### Added

- `PROFESSIONAL_BASE_SCALE` named export from `NotationRenderer.js` — the
  internal-units → professional-pixels base, for consumers doing visual ↔ layout
  width math.

This release also accumulates the engraving/spacing refinements committed since
0.1.0 (barline padding, system-wrap justification, spring-based spacing); see
the git history for details.

## 0.1.0 — 2026-05-08

Initial release. Extracted from `resound-fe/src/notation/`.

- `NotationRenderer` — top-level entry; renders a phrase into an SVG (with or without a container).
- 27 SVG component builders under `components/` (`Note`, `Clef`, `Staff`, `KeySignature`, `TimeSignature`, `BarLine`, `Beam`, `Tie`, `Slur`, `Articulation`, `Dynamic`, `Hairpin`, `RepeatBarline`, `Ending`, `GraceNote`, `TupletBracket`, …).
- 11 pure helpers under `lib/` (`notePositions`, `keySignatures`, `beaming`, `clefInference`, `dataParser`, `durationSymbols`, `slurGrouping`, `svgHelpers`, `tieResolver`, `tuplets`).
- Subpath exports (`resound-notation/components/*`, `resound-notation/lib/*`); deep imports preserved from the resound-fe source layout.
- 507 jest tests (jsdom). `dist/` ships per-file ESM with sibling `.d.ts` declarations.
