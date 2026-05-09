# Changelog

## 0.1.0 — 2026-05-08

Initial release. Extracted from `resound-fe/src/notation/`.

- `NotationRenderer` — top-level entry; renders a phrase into an SVG (with or without a container).
- 27 SVG component builders under `components/` (`Note`, `Clef`, `Staff`, `KeySignature`, `TimeSignature`, `BarLine`, `Beam`, `Tie`, `Slur`, `Articulation`, `Dynamic`, `Hairpin`, `RepeatBarline`, `Ending`, `GraceNote`, `TupletBracket`, …).
- 11 pure helpers under `lib/` (`notePositions`, `keySignatures`, `beaming`, `clefInference`, `dataParser`, `durationSymbols`, `slurGrouping`, `svgHelpers`, `tieResolver`, `tuplets`).
- Subpath exports (`resound-notation/components/*`, `resound-notation/lib/*`); deep imports preserved from the resound-fe source layout.
- 507 jest tests (jsdom). `dist/` ships per-file ESM with sibling `.d.ts` declarations.
