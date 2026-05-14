/** @jest-environment jsdom */
import { OTTAVA_GLYPHS } from './glyphs.js';

describe('OTTAVA_GLYPHS', () => {
  test.each(['ottavaAlta', 'ottavaBassaVb'])(
    '%s has non-empty path and sensible bbox',
    (name) => {
      const g = OTTAVA_GLYPHS[name];
      expect(g).toBeDefined();
      expect(typeof g.d).toBe('string');
      expect(g.d.length).toBeGreaterThan(0);
      // bbox sanity: ordered, non-degenerate, in plausible SMuFL font-unit range
      expect(g.bbox.xMax).toBeGreaterThan(g.bbox.xMin);
      expect(g.bbox.yMax).toBeGreaterThan(g.bbox.yMin);
      expect(g.bbox.xMax - g.bbox.xMin).toBeLessThan(2000);
      expect(g.bbox.yMax - g.bbox.yMin).toBeLessThan(2000);
    },
  );

  test('both ottava glyphs are composed (wider than the bare "8" digit)', () => {
    // The bare SMuFL ottava digit (U+E510) is ~386 font-units wide. The
    // composed "8va" (U+E511) and "8vb" (U+E51C) glyphs add letter
    // outlines and should be substantially wider — pin that we're using
    // the composed glyphs, not the bare digit (regression catch for the
    // earlier ottavaAlta data which was U+E510 misnamed).
    const BARE_8_WIDTH = 386;
    const a = OTTAVA_GLYPHS.ottavaAlta.bbox;
    const b = OTTAVA_GLYPHS.ottavaBassaVb.bbox;
    expect(a.xMax - a.xMin).toBeGreaterThan(BARE_8_WIDTH * 1.5);
    expect(b.xMax - b.xMin).toBeGreaterThan(BARE_8_WIDTH * 1.5);
  });
});
