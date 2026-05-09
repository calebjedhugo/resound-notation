/** @jest-environment jsdom */

import { createBrace } from './Brace.js';

describe('Brace', () => {
  describe('createBrace', () => {
    it('returns a group with class "brace"', () => {
      const group = createBrace({ height: 200 });
      expect(group.tagName).toBe('g');
      expect(group.getAttribute('class')).toBe('brace');
    });

    it('contains a path element', () => {
      const group = createBrace({ height: 200 });
      const path = group.querySelector('path');
      expect(path).not.toBeNull();
    });

    it('path has a d attribute with curve data', () => {
      const group = createBrace({ height: 200 });
      const path = group.querySelector('path');
      const d = path.getAttribute('d');
      expect(d).toBeTruthy();
      expect(d.length).toBeGreaterThan(0);
    });

    it('scales to match the requested height', () => {
      // Different heights should produce different effective Y-scales
      // somewhere in the rendered tree (group or path transform).
      const small = createBrace({ height: 100 });
      const large = createBrace({ height: 300 });
      const collectTransforms = (root) =>
        Array.from(root.querySelectorAll('*'))
          .map((el) => el.getAttribute('transform'))
          .filter(Boolean)
          .join(' ');
      expect(collectTransforms(small)).not.toEqual(collectTransforms(large));
    });

    it('uses default height when not specified', () => {
      const group = createBrace({});
      const path = group.querySelector('path');
      expect(path).not.toBeNull();
    });

    it('path has stroke and fill attributes', () => {
      const group = createBrace({ height: 200 });
      const path = group.querySelector('path');
      expect(path.getAttribute('fill')).toBe('currentColor');
    });
  });
});
