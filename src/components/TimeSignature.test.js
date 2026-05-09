/** @jest-environment jsdom */

import { createTimeSignature } from './TimeSignature.js';

describe('TimeSignature', () => {
  describe('createTimeSignature', () => {
    it('returns { element, width } with element class "time-signature"', () => {
      const { element, width } = createTimeSignature([4, 4]);
      expect(element.getAttribute('class')).toBe('time-signature');
      expect(width).toBeGreaterThan(0);
    });

    it('renders numerator and denominator as Bravura path glyphs (no <text>)', () => {
      const { element } = createTimeSignature([4, 4]);
      expect(element.querySelector('text')).toBeNull();
      expect(element.querySelector('.time-numerator path')).not.toBeNull();
      expect(element.querySelector('.time-denominator path')).not.toBeNull();
    });

    it('renders one path glyph per digit', () => {
      const { element } = createTimeSignature([12, 8]);
      expect(element.querySelectorAll('.time-numerator path').length).toBe(2);
      expect(element.querySelectorAll('.time-denominator path').length).toBe(1);
    });

    it('positions numerator centered in upper staff half (y=30)', () => {
      const { element } = createTimeSignature([4, 4]);
      const digit = element.querySelector('.time-numerator > g');
      const transform = digit.getAttribute('transform');
      expect(transform).toMatch(/translate\([-\d.]+,\s*30\)/);
    });

    it('positions denominator centered in lower staff half (y=70)', () => {
      const { element } = createTimeSignature([4, 4]);
      const digit = element.querySelector('.time-denominator > g');
      const transform = digit.getAttribute('transform');
      expect(transform).toMatch(/translate\([-\d.]+,\s*70\)/);
    });

    it('reports width matching the wider of numerator vs denominator', () => {
      // 12/8: numerator (1+2 digits) wider than denominator (1 digit).
      const { width: w128 } = createTimeSignature([12, 8]);
      const { width: w44 } = createTimeSignature([4, 4]);
      expect(w128).toBeGreaterThan(w44);
    });
  });
});
