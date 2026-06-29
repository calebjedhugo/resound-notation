# resound-notation — CLAUDE.md

Published SVG notation package extracted from `resound-fe/src/notation/`. See `README.md` for usage and `CHANGELOG.md` for history.

## Architecture

- `src/NotationRenderer.js` — top-level renderer. ~43 kB; the meatiest file.
- `src/components/` — 27 SVG primitives. Each exports a `create*` or `render*` factory that returns an SVG element or fragment.
- `src/lib/` — 11 pure helpers. No DOM, no I/O. Cheap to test, fast to reason about.
- `src/index.js` — minimal barrel re-exporting `NotationRenderer`. Subpath exports do the rest.
- All internal imports use **relative paths with explicit `.js` extensions** (mechanically rewritten from `notation/...` absolute imports during the extraction). Don't reintroduce absolute imports — there's no resolver plugin to handle them.

## Workflows

```bash
npm test            # 507 jest tests (jsdom). Keep these green.
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
- **Tests use `/** @jest-environment jsdom */` headers.** The default `testEnvironment` in `jest.config.mjs` is also `jsdom`, so this is belt-and-suspenders, but don't strip the headers — they make individual tests portable.

## Consumer

`resound-fe` (`~/Development/personal dev work.nosync/resound-fe/`) imports from this package via 9 files (5 in `src/editor/ui/`, plus `src/ui/NotationDisplay.js`, `src/editor/model/serialization.js`, `src/editor/ui/MetadataPanel.js`, `src/editor/ui/RhythmPalette.js`). Suite is 644/37 — keep it green when bumping the package.

The legacy `^notation/` jest moduleNameMapper has been removed; consumers must use `resound-notation/...` import paths.
