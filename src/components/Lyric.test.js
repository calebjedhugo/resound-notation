/** @jest-environment jsdom */

/**
 * Lyric engraving defaults (SPEC-lyric-spacing.md JOB 2;
 * SPEC-lyric-engraving-scale.md JOB 5).
 *
 * JOB 2's 15px/13px/30px sizes were a first pass at "bigger than the
 * professional display scale made them read." JOB 5 replaces that guess
 * with sizes MEASURED off real hymnal engravings (Amazing Grace, Holy
 * Holy Holy scans): fontSize/staffSpace averaged 1.97 across 4 pages,
 * giving 39px syllables at this renderer's 20px staff space. Verse
 * numbers stay 0.85x that (33px). Verse-line pitch was independently
 * measured (baseline-to-baseline, identical-glyph cross-checks) at
 * ~1.00x font size, not assumed at 2x — 39px line height. LYRIC_BASE_Y
 * moves from the legacy 115 to 126 so the taller ascenders still clear
 * the staff bottom (deliberate design change, not a legacy pin anymore).
 */

import {
  renderLyric,
  renderMelisma,
  renderVerseNumber,
  estimateLyricWidth,
  LYRIC_FONT_SIZE,
  VERSE_NUMBER_FONT_SIZE,
  LYRIC_CHAR_WIDTH_RATIO,
  LYRIC_CHAR_WIDTHS,
  VERSE_LINE_HEIGHT,
  LYRIC_BASE_Y,
} from './Lyric.js';

describe('lyric engraving defaults (JOB 2)', () => {
  it('pins the measured-from-engravings size constants', () => {
    expect(LYRIC_FONT_SIZE).toBe(39);
    expect(VERSE_NUMBER_FONT_SIZE).toBe(33);
    expect(VERSE_LINE_HEIGHT).toBe(39);
    // JOB 5: raised so a 39px font's ascenders still clear the staff.
    expect(LYRIC_BASE_Y).toBe(126);
  });

  it('renderLyric emits the syllable font size from the constant', () => {
    const g = renderLyric({ text: 'grace', x: 100 });
    const text = g.querySelector('text');
    expect(text.getAttribute('font-size')).toBe(String(LYRIC_FONT_SIZE));
    expect(text.getAttribute('font-size')).toBe('39');
  });

  it('renderVerseNumber emits the number font size from the constant', () => {
    const g = renderVerseNumber({ number: 3, x: 50 });
    const text = g.querySelector('text');
    expect(text.getAttribute('font-size')).toBe(String(VERSE_NUMBER_FONT_SIZE));
    expect(text.getAttribute('font-size')).toBe('33');
    expect(text.textContent).toBe('3.');
  });

  it('verse lines stack at the raised line height from the raised base', () => {
    const v0 = renderLyric({ text: 'a', x: 0, verseIndex: 0 });
    const v2 = renderLyric({ text: 'c', x: 0, verseIndex: 2 });
    const y = (el) =>
      parseFloat(/translate\([-\d.]+,\s*([-\d.]+)\)/.exec(el.getAttribute('transform'))[1]);
    expect(y(v0)).toBe(LYRIC_BASE_Y);
    expect(y(v2)).toBe(LYRIC_BASE_Y + 2 * VERSE_LINE_HEIGHT);
    const m = renderMelisma({ startX: 0, endX: 40, verseIndex: 1 });
    // Melisma drop stays a fixed 5px below the (now-raised) baseline.
    expect(parseFloat(m.getAttribute('y1'))).toBe(LYRIC_BASE_Y + 5 + VERSE_LINE_HEIGHT);
  });

  it('the width heuristic follows the measured font size', () => {
    const sum = (text) => [...text].reduce(
      (total, ch) => total + (LYRIC_CHAR_WIDTHS[ch] ?? LYRIC_CHAR_WIDTH_RATIO), 0
    );
    expect(estimateLyricWidth('grace')).toBeCloseTo(sum('grace') * 39);
    expect(estimateLyricWidth('2.', VERSE_NUMBER_FONT_SIZE)).toBeCloseTo(
      sum('2.') * 33
    );
  });

  it('estimates per character, so wide glyphs reserve more than narrow ones', () => {
    // A flat per-character ratio under-reserved wide syllables, and barlines
    // struck through them ("dimmed" in America the Beautiful).
    expect(estimateLyricWidth('dimmed')).toBeGreaterThan(estimateLyricWidth('little'));
    expect(estimateLyricWidth('mm')).toBeGreaterThan(2 * estimateLyricWidth('il'));
  });

  it('estimates within a few percent of the real advance widths', () => {
    // Advance widths measured in a browser at font-size 100 (the renderer's
    // default sans stack), as a fraction of font size.
    const MEASURED = {
      dimmed: 3.432, cross: 2.246, 'beau-': 2.523, O: 0.731, ful: 1.035, 'shin-': 2.166,
    };
    for (const [text, ratio] of Object.entries(MEASURED)) {
      const error = Math.abs(estimateLyricWidth(text, 100) - ratio * 100) / (ratio * 100);
      expect(error).toBeLessThan(0.03);
    }
  });

  it('falls back to the average ratio for characters it has no width for', () => {
    expect(estimateLyricWidth('üü', 100)).toBeCloseTo(2 * LYRIC_CHAR_WIDTH_RATIO * 100);
  });
});
