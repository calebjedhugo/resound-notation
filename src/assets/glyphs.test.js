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

  test('ottavaBassaVb is wider than ottavaAlta (it has the extra "vb")', () => {
    const a = OTTAVA_GLYPHS.ottavaAlta.bbox;
    const b = OTTAVA_GLYPHS.ottavaBassaVb.bbox;
    expect(b.xMax - b.xMin).toBeGreaterThan(a.xMax - a.xMin);
  });
});
