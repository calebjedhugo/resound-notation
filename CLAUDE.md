# resound-notation — CLAUDE.md

Published SVG notation package extracted from `resound-fe/src/notation/`. See `README.md` for usage and `CHANGELOG.md` for history.

## Architecture

- `src/NotationRenderer.js` — top-level renderer. ~4.7 k lines / ~210 kB; by far the meatiest file. Two methods dominate it: `render()` (piece-level: staff placement, system breaking) and `_renderSystem()` (everything visible in one system).
- `src/components/` — 28 SVG primitives. Each exports a `create*` or `render*` factory that returns an SVG element or fragment.
- `src/lib/` — 18 pure helpers. No DOM, no I/O. Cheap to test, fast to reason about. `lib/engravingDefaults.js` is the shared-constants module: Bravura stroke weights plus the staff geometry (`LINE_SPACING`, `MIDDLE_LINE_Y`, `STEM_LENGTH`, `STEM_THICKNESS`) that components and the renderer must agree on.
- `src/assets/glyphs.js` — the SMuFL/Bravura glyph table (path data + bboxes) plus `createSmuflGlyph` / `smuflTip`. Not a public subpath export.
- `src/index.js` — minimal barrel re-exporting `NotationRenderer`. Subpath exports do the rest.
- All internal imports use **relative paths with explicit `.js` extensions** (mechanically rewritten from `notation/...` absolute imports during the extraction). Don't reintroduce absolute imports — there's no resolver plugin to handle them.

## Workflows

```bash
npm test            # 925 jest tests across 51 suites (jsdom). Keep these green.
npm run build       # babel CLI src→dist (per-file ESM) + tsc emit-only for .d.ts
```

### Release

**Publish manually** (this is the supported path — 0.1.0, 0.2.0, and 1.0.0 all shipped this way):

```bash
npm version patch        # bumps package.json + creates commit + v* tag
git push --follow-tags

npm run build            # CI does this too; build dist/ before publishing
npm login                # if `npm whoami` errors (E401), the local session expired
npm publish --access public --otp=<6-digit-code>   # OTP from your authenticator app

npm view resound-notation version   # confirm it landed
```

A non-logged-in publish fails with a misleading `E404 Not Found` on the `PUT` (npm
disguises auth failures as 404 for existing packages) — run `npm login` and retry.

There is a `.github/workflows/release.yml` that publishes on `v*` tag push using the
`NPM_TOKEN` repo secret, but releases have been done by hand; treat the manual flow
above as canonical.

## Gotchas

- **`STAFF_TOP_OFFSET` is the visual-regression hazard.** The `.staff-lines` transform-pin test in `NotationRenderer.test.js` (`'applies STAFF_TOP_OFFSET to .staff-lines and only to .staff-lines'`) catches the double-offset bug class. If that test fails, **do not mutate the test** — fix the bug it caught.
- **Babel config has two modes.** `babel.config.cjs` uses `api.env('test')` to pick CJS-target for jest vs `modules: false` ESM for the build. Don't collapse to a single config — jest needs CJS, dist must be ESM (subpath exports require it).
- **`package.json` `"type": "module"`** — config files must stay `.cjs` (babel.config.cjs). Don't rename to `.js`.
- **Subpath exports require per-file dist output.** Don't switch to a single-file webpack bundle — would break every deep import in resound-fe (which is the entire point of the design).
- **Consumers using jest need `transformIgnorePatterns: ['/node_modules/(?!(resound-notation)/)']`** — the published bundle is ESM and babel-jest skips `node_modules` by default. resound-fe already has this.
- **`components/*` and `lib/*` are PUBLIC subpath exports.** Every named export in those two directories is reachable by consumers via `resound-notation/lib/foo`, so removing one is a semver-major break even when nothing inside this repo imports it. Several such exports are currently referenced only by their own tests (see "Known dead-but-public exports" below) — leave them unless you are cutting a major. `src/assets/` is NOT exported, so it can be pruned freely.
- **Geometry constants live in `lib/engravingDefaults.js`.** `LINE_SPACING`, `MIDDLE_LINE_Y`, `STEM_LENGTH` and `STEM_THICKNESS` were copy-pasted across `NotationRenderer.js`, `components/Note.js`, `Beam.js`, `Rest.js`, `LedgerLine.js`, `Staff.js`, `lib/beaming.js` and `lib/stemLength.js`. Import them; don't re-declare. `lib/engravingDefaults.test.js` pins the values, because changing one silently re-engraves every score. `engravingDefaults.js` imports nothing, so it can never be part of a cycle — keep it that way.
  - **Known exception, left deliberately:** `TOP_LINE_Y = 10` / `BOTTOM_LINE_Y = 90` are still declared privately in `components/BarLine.js`, `RepeatBarline.js` and `LedgerLine.js`, and the renderer keeps its own `STAFF_TOP_OFFSET`/`STAFF_HEIGHT`. Unifying these means touching `STAFF_TOP_OFFSET` — the flagged visual-regression hazard above — so it was left alone. If you do it, add `STAFF_TOP_LINE_Y`/`STAFF_BOTTOM_LINE_Y` here, convert **all four** sites at once (a partial conversion leaves more sources of truth, not fewer), and lean on the `.staff-lines` transform-pin test.
- **Every relative import needs an explicit `.js`.** `package.json` `files` ships raw `src/`, and `dist/` is per-file ESM, so babel emits your specifier verbatim. An extensionless import works under jest/bundlers and throws `ERR_MODULE_NOT_FOUND` for a Node-ESM consumer. (`lib/clefInference.js` shipped that way until it was caught.)
- **Tests use `/** @jest-environment jsdom */` headers.** The default `testEnvironment` in `jest.config.mjs` is also `jsdom`, so this is belt-and-suspenders, but don't strip the headers — they make individual tests portable.

## Known dead-but-public exports

Audited 2026-08-03. These sit under the public `lib/*` / `components/*` subpaths, so removing one is a semver-major break — they were deliberately left in place. Delete them only as part of a major version bump.

**Group A — no caller anywhere (not src, not `dev/`, not even a test):**

| Export | File |
| --- | --- |
| `_svgNs` | `components/OttavaBracket.js` — an alias of `createSvgElement` kept only to keep an import alive |
| `VALID_ARTICULATIONS` (the `export { … }` statement) | `components/Articulation.js` — the const itself IS used internally; only the re-export is unreferenced |

**Group B — no consumer outside their own module.** Nothing in `src/` or `dev/` imports them; the only external reader is their own sibling test. Rows marked "also used internally" still do real work inside their module — only the `export` is idle, so a deletion there means un-exporting, not removing the code.

| Export | File |
| --- | --- |
| `justifySystem` | `lib/breakIntoSystems.js` — a fully superseded justification algorithm; `justifySystemSpring` replaced it. The biggest single removal available. |
| `measureStartBeat`, `measureFillLength`, `pickupBeamOffset` | `lib/measureGrid.js` (note: `NotationRenderer.js` has a *local variable* named `measureStartBeat` — not this import) |
| `getTupletGroupBeats` | `lib/tuplets.js` |
| `createEllipse` | `lib/svgHelpers.js` — noteheads are SMuFL paths now |
| `isValidKeySignature` | `lib/keySignatures.js` |
| `VALID_LENGTHS` | `lib/durationSymbols.js` |
| `MIN_NOTE_GAP`, `BARLINE_GAP`, `springNatLength`, `__TESTING__` | `lib/measureIntrinsicWidths.js` — `MIN_NOTE_GAP` is a self-described "legacy alias" for `BASE_GAP`; `__TESTING__` exists solely so the test can reach private internals |
| `systemBadness` | `lib/breakIntoSystems.js` (also used internally) |
| `parseFraction` | `lib/durationSymbols.js` (also used internally) |
| `CLEF_CONSTANTS` | `lib/notePositions.js` (also used internally) |
| `reconcileOttava` | `lib/segmentOttava.js` — but OTTAVA-DESIGN.md §6 advertises it as public API, so treat it as intentional |
| `computeLyricConstraints`, `LYRIC_GAP`, `PRELUDE_NOTE_MIN_DAYLIGHT`, `VERSE_NUMBER_LEAD_CLEARANCE`, `BARLINE_LYRIC_GAP`, `PRE_BARLINE_INK_EXTENT` | `lib/lyricSpacing.js` (all also used internally) |
| `KEY_SIG_POSITIONS` | `components/KeySignature.js` (also used internally) |
| `LYRIC_CHAR_WIDTH_RATIO`, `LYRIC_CHAR_WIDTHS` | `components/Lyric.js` (both also used internally) |

**Group C — exported, used internally, referenced by nothing at all outside their own module (not even a test):** `BASE_GAP`, `LOG_FACTOR`, `MIN_GAP` and `springStretchability` in `lib/measureIntrinsicWidths.js`. Their `__TESTING__` entries are unused too — the test destructures only `ACCIDENTAL_WIDTH`, `DOT_WIDTH`, `noteheadWidthFor`, `springNatLength`. Dropping `export` is still a public-surface change.

This table is **not exhaustive** — it lists what the 2026-08-03 audit confirmed. Before deleting anything, re-run the check yourself; several entries are also used *inside* their own module, so only the `export` keyword is dead, not the value.

Related: `measureIntrinsicWidths()` runs on **every** `render()` but feeds only the public `getIntrinsicWidths()` accessor, which nothing in this repo calls. It is live public API, so it stays — but it is the largest candidate for removal in a major.

## Consumer

Two consumers:

- **`singHarmony2`** — links this package with a local `file:` dependency and puts all 74 of its hymns through the renderer in its own test suite, so **its suite is the de-facto visual regression test for this package.** It depends on the unpublished-as-of-1.0.0 features: two voices per staff (close score), multi-verse lyrics, lyric spacing/baseline/size, and tie flattening.
- **`resound-fe`** (`~/Development/personal dev work.nosync/resound-fe/`) — imports from this package across `src/editor/ui/`, `src/ui/NotationDisplay.js` and `src/editor/model/serialization.js`. Keep its suite green when bumping the package.

The legacy `^notation/` jest moduleNameMapper has been removed; consumers must use `resound-notation/...` import paths.
