# resound-notation

SVG music notation renderer extracted from the [Resound](https://github.com/calebjedhugo/resound-fe) game. Pure browser/jsdom rendering — no audio, no game state, no DOM framework.

## Install

```bash
npm install resound-notation
```

## Usage

The package is shipped as ESM with subpath exports. Import what you need:

```js
import { NotationRenderer } from 'resound-notation';
// or
import { NotationRenderer } from 'resound-notation/NotationRenderer';
import { createNote } from 'resound-notation/components/Note';
import { pitchToStaffY } from 'resound-notation/lib/notePositions';
```

Render a phrase into an existing container:

```js
const container = document.querySelector('#score');
const renderer = new NotationRenderer({ container });
renderer.render([
  { pitch: 'C4', length: '1/4' },
  { pitch: 'E4', length: '1/4' },
  { pitch: 'G4', length: '1/2' },
]);
```

`NotationRenderer` also runs containerless (returns the SVG element) when `container` is omitted.

## Subpath exports

| Path                                | What it gives you                                             |
| ----------------------------------- | ------------------------------------------------------------- |
| `resound-notation`                  | `NotationRenderer` (re-exported from the root)                |
| `resound-notation/NotationRenderer` | `NotationRenderer` directly                                   |
| `resound-notation/components/*`     | Individual SVG primitives (`Note`, `Clef`, `BarLine`, etc.)   |
| `resound-notation/lib/*`            | Pure helpers (`notePositions`, `keySignatures`, `beaming`, …) |

## Coordinate system gotcha

Staff lines sit at `y = 10, 30, 50, 70, 90` (spacing 20, `STAFF_TOP_OFFSET = 10`). All components have that offset baked into their coordinates. **Apply `STAFF_TOP_OFFSET` only to the `.staff-lines` element — never to a parent group.** Doing so produces a double-offset bug. The renderer pins this with a regression test.

## Consumer Jest config

`resound-notation` ships ESM. If your consumer uses Jest with babel-jest, allow it to transform this package:

```js
// jest.config.{js,mjs}
export default {
  transformIgnorePatterns: ['/node_modules/(?!(resound-notation)/)'],
};
```

DOM-touching tests need jsdom: either set `testEnvironment: 'jsdom'` globally or add `/** @jest-environment jsdom */` to individual files.

## Develop

```bash
npm test            # 507 jest tests (jsdom)
npm run build       # babel CLI per-file → dist/, then tsc emits .d.ts
```

## Release

```bash
npm version patch    # bumps package.json + creates v* tag
git push --follow-tags
```

The tag push triggers `.github/workflows/release.yml`, which runs the suite, builds, verifies the tag matches `package.json`, and publishes. Requires an `NPM_TOKEN` automation token configured in repo secrets.

## License

ISC
