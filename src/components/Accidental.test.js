/** @jest-environment jsdom */

import { createAccidental } from './Accidental.js';
import { smuflGlyphPaths } from '../__tests__/helpers/testUtils.js';

describe('Accidental', () => {
  describe('createAccidental', () => {
    it('returns a glyph instance with class "accidental sharp" for sharp', () => {
      const el = createAccidental('sharp');
      expect(el.tagName).toBe('use');
      expect(el.getAttribute('class')).toBe('accidental sharp');
    });

    it('returns a group with class "accidental flat" for flat', () => {
      const el = createAccidental('flat');
      expect(el.getAttribute('class')).toBe('accidental flat');
    });

    it('returns a group with class "accidental natural" for natural', () => {
      const el = createAccidental('natural');
      expect(el.getAttribute('class')).toBe('accidental natural');
    });

    it('resolves to a glyph def path for each accidental type', () => {
      for (const type of ['sharp', 'flat', 'natural']) {
        const el = createAccidental(type);
        expect(smuflGlyphPaths(el).length).toBeGreaterThan(0);
      }
    });

    it('sharp symbol resolves to a path with data', () => {
      const [path] = smuflGlyphPaths(createAccidental('sharp'));
      expect(path).toBeDefined();
      expect(path.getAttribute('d')).toBeTruthy();
    });

    it('flat symbol resolves to a path with data', () => {
      const [path] = smuflGlyphPaths(createAccidental('flat'));
      expect(path).toBeDefined();
      expect(path.getAttribute('d')).toBeTruthy();
    });

    it('natural symbol resolves to a path with data', () => {
      const [path] = smuflGlyphPaths(createAccidental('natural'));
      expect(path).toBeDefined();
      expect(path.getAttribute('d')).toBeTruthy();
    });

    it('throws for unknown accidental type', () => {
      expect(() => createAccidental('double-sharp')).toThrow();
    });
  });
});
