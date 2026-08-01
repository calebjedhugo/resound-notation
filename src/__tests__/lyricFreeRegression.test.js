/** @jest-environment jsdom */

/**
 * Byte-identical regression harness for LYRIC-FREE input
 * (SPEC-lyric-spacing.md ground rules).
 *
 * The fixture `fixtures/lyricFreeBaseline.json` pins the renderer's full
 * SVG serialization for a battery of lyric-free songs, captured at the
 * pre-lyric-spacing commit (3031c00 "Fix final systems rendering wider
 * than the page"). The lyric-spacing work (JOBs 1/2/4) must not perturb
 * lyric-free output by a single byte.
 *
 * Scope: the battery intentionally contains no ties/slurs — JOB 3
 * (long-tie/slur flattening) changes tie/slur geometry for all input by
 * design; its own byte-exact regression (short-tie path pin) lives in
 * src/components/Tie.test.js. See fixtures/lyricFreeBaselineSongs.js.
 */

import { NotationRenderer } from '../NotationRenderer.js';
import { buildLyricFreeBaselineSongs } from './fixtures/lyricFreeBaselineSongs.js';
import baseline from './fixtures/lyricFreeBaseline.json';
import amazingGrace from './fixtures/amazing-grace.json';

describe('lyric-free byte-identical regression harness', () => {
  const battery = buildLyricFreeBaselineSongs({ amazingGrace });

  it('covers every baseline entry (and nothing else)', () => {
    expect(battery.map((b) => b.name).sort()).toEqual(
      Object.keys(baseline).sort()
    );
  });

  for (const { name, width, song } of buildLyricFreeBaselineSongs({
    amazingGrace,
  })) {
    it(`renders "${name}" byte-identical to the pre-change baseline`, () => {
      const renderer = new NotationRenderer({ width });
      const svg = renderer.render(song);
      expect(svg.outerHTML).toBe(baseline[name]);
      renderer.clear();
    });
  }
});
