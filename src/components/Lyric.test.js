/** @jest-environment jsdom */

/**
 * Lyric engraving defaults (SPEC-lyric-spacing.md JOB 2).
 *
 * The raised sizes are a deliberate design change: 11px lyric text at the
 * professional display scale (~0.33) rendered ~3.6px on screen — far below
 * hymnal lyric size relative to a 7mm staff. 15px syllables / 13px verse
 * numbers / 30px verse line-height restore engraving proportions.
 * LYRIC_BASE_Y stays at the legacy 115.
 */

import {
  renderLyric,
  renderMelisma,
  renderVerseNumber,
  estimateLyricWidth,
  LYRIC_FONT_SIZE,
  VERSE_NUMBER_FONT_SIZE,
  LYRIC_CHAR_WIDTH_RATIO,
  VERSE_LINE_HEIGHT,
  LYRIC_BASE_Y,
} from './Lyric.js';

describe('lyric engraving defaults (JOB 2)', () => {
  it('pins the raised size constants', () => {
    expect(LYRIC_FONT_SIZE).toBe(15);
    expect(VERSE_NUMBER_FONT_SIZE).toBe(13);
    expect(VERSE_LINE_HEIGHT).toBe(30);
    // Deliberately unchanged: verse 1 stays at the legacy baseline.
    expect(LYRIC_BASE_Y).toBe(115);
  });

  it('renderLyric emits the syllable font size from the constant', () => {
    const g = renderLyric({ text: 'grace', x: 100 });
    const text = g.querySelector('text');
    expect(text.getAttribute('font-size')).toBe(String(LYRIC_FONT_SIZE));
    expect(text.getAttribute('font-size')).toBe('15');
  });

  it('renderVerseNumber emits the number font size from the constant', () => {
    const g = renderVerseNumber({ number: 3, x: 50 });
    const text = g.querySelector('text');
    expect(text.getAttribute('font-size')).toBe(String(VERSE_NUMBER_FONT_SIZE));
    expect(text.getAttribute('font-size')).toBe('13');
    expect(text.textContent).toBe('3.');
  });

  it('verse lines stack at the raised line height from the unchanged base', () => {
    const v0 = renderLyric({ text: 'a', x: 0, verseIndex: 0 });
    const v2 = renderLyric({ text: 'c', x: 0, verseIndex: 2 });
    const y = (el) =>
      parseFloat(/translate\([-\d.]+,\s*([-\d.]+)\)/.exec(el.getAttribute('transform'))[1]);
    expect(y(v0)).toBe(LYRIC_BASE_Y);
    expect(y(v2)).toBe(LYRIC_BASE_Y + 2 * VERSE_LINE_HEIGHT);
    const m = renderMelisma({ startX: 0, endX: 40, verseIndex: 1 });
    expect(parseFloat(m.getAttribute('y1'))).toBe(120 + VERSE_LINE_HEIGHT);
  });

  it('the width heuristic follows the raised font size', () => {
    expect(estimateLyricWidth('grace')).toBeCloseTo(
      5 * LYRIC_CHAR_WIDTH_RATIO * 15
    );
    expect(estimateLyricWidth('2.', VERSE_NUMBER_FONT_SIZE)).toBeCloseTo(
      2 * LYRIC_CHAR_WIDTH_RATIO * 13
    );
  });
});
