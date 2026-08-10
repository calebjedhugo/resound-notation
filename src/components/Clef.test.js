/** @jest-environment jsdom */

import { createClef } from './Clef.js';
import { smuflGlyphPaths } from '../__tests__/helpers/testUtils.js';

describe('Clef', () => {
  describe('createClef', () => {
    it('returns a group element with class "clef clef-treble" for treble clef', () => {
      const el = createClef('treble');
      expect(el.tagName).toBe('g');
      expect(el.getAttribute('class')).toBe('clef clef-treble');
    });

    it('returns a group element with class "clef clef-bass" for bass clef', () => {
      const el = createClef('bass');
      expect(el.getAttribute('class')).toBe('clef clef-bass');
    });

    it('returns a group element with class "clef clef-percussion" for percussion clef', () => {
      const el = createClef('percussion');
      expect(el.getAttribute('class')).toBe('clef clef-percussion');
    });

    it('resolves to a glyph path for treble clef', () => {
      const [path] = smuflGlyphPaths(createClef('treble'));
      expect(path).toBeDefined();
      expect(path.getAttribute('d')).toBeTruthy();
    });

    it('resolves to a glyph path for bass clef', () => {
      const [path] = smuflGlyphPaths(createClef('bass'));
      expect(path).toBeDefined();
      expect(path.getAttribute('d')).toBeTruthy();
    });

    it('contains elements for percussion clef', () => {
      const el = createClef('percussion');
      expect(el.children.length).toBeGreaterThan(0);
    });

    it('throws for unknown clef type', () => {
      expect(() => createClef('unknown')).toThrow();
    });
  });
});
