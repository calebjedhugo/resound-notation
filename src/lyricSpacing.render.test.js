/** @jest-environment jsdom */

/**
 * Renderer-level tests for syllable-width-aware note spacing
 * (SPEC-lyric-spacing.md, JOB 1).
 *
 * Width assertions use the SAME estimation heuristic as the implementation
 * (estimateLyricWidth — character count x ratio x font size; jsdom offers
 * no real text metrics).
 */

import { NotationRenderer } from './NotationRenderer.js';
import {
  LYRIC_GAP,
  VERSE_NUMBER_GAP,
  PRELUDE_NOTE_MIN_DAYLIGHT,
  VERSE_NUMBER_LEAD_CLEARANCE,
} from './lib/lyricSpacing.js';
import {
  estimateLyricWidth,
  VERSE_NUMBER_FONT_SIZE,
} from './components/Lyric.js';
import amazingGrace from './__tests__/fixtures/amazing-grace.json';
import wonderfulGrace from './__tests__/fixtures/wonderful-grace-of-jesus.json';

function renderSong(song, width = 800) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = new NotationRenderer({ container, width });
  renderer.render(song);
  return {
    container,
    cleanup() {
      renderer.clear();
      container.remove();
    },
  };
}

function translateOf(el) {
  const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(
    el.getAttribute('transform') || ''
  );
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

/** x positions of sounding .note groups (incl. chords), in DOM order. */
function noteXs(container) {
  return [...container.querySelectorAll('.note')]
    .filter((g) => !g.closest('.grace-note'))
    .map((g) => translateOf(g).x);
}

/**
 * For every rendered system, group syllables by (staff group, verse line y),
 * sort by x, and verify every adjacent pair keeps the lyric minimum.
 * Returns the number of adjacent pairs checked.
 */
function expectNoSameVerseCrowding(container) {
  let pairs = 0;
  const staffGroups = container.querySelectorAll('[data-system-index]');
  for (const g of staffGroups) {
    const byLine = new Map();
    for (const el of g.querySelectorAll('.lyric')) {
      const { x, y } = translateOf(el);
      if (!byLine.has(y)) byLine.set(y, []);
      byLine.get(y).push({ x, text: el.textContent });
    }
    for (const entries of byLine.values()) {
      entries.sort((a, b) => a.x - b.x);
      for (let i = 1; i < entries.length; i += 1) {
        const a = entries[i - 1];
        const b = entries[i];
        const required =
          (estimateLyricWidth(a.text) + estimateLyricWidth(b.text)) / 2 +
          LYRIC_GAP;
        expect(b.x - a.x).toBeGreaterThanOrEqual(required - 0.5);
        pairs += 1;
      }
    }
  }
  return pairs;
}

describe('syllable-width-aware note spacing (JOB 1)', () => {
  it('two eighth notes with long syllables get a wider advance than the same notes bare', () => {
    const notes = (withLyrics) => [
      { pitch: 'C4', length: '1/8', ...(withLyrics ? { lyric: 'extraordinary' } : {}) },
      { pitch: 'D4', length: '1/8', ...(withLyrics ? { lyric: 'extraordinary' } : {}) },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'G4', length: '1/4' },
    ];
    const bare = renderSong({ timeSignature: [4, 4], notes: notes(false) });
    const withLyr = renderSong({ timeSignature: [4, 4], notes: notes(true) });

    const bareAdv = noteXs(bare.container)[1] - noteXs(bare.container)[0];
    const xs = noteXs(withLyr.container);
    const lyrAdv = xs[1] - xs[0];
    const required = estimateLyricWidth('extraordinary') + LYRIC_GAP;

    expect(required).toBeGreaterThan(bareAdv); // test premise: constraint binds
    expect(lyrAdv).toBeGreaterThan(bareAdv);
    expect(lyrAdv).toBeGreaterThanOrEqual(required - 0.5);

    bare.cleanup();
    withLyr.cleanup();
  });

  it('melisma between anchors does not tighten the requirement', () => {
    const syl = 'Wonderful-counselor'; // 19 chars — binds over two 16th gaps
    const required = estimateLyricWidth(syl) + LYRIC_GAP;
    const fill = Array.from({ length: 5 }, (_, i) => ({
      pitch: 'G4',
      length: '1/16',
    }));

    const melisma = renderSong({
      timeSignature: [2, 4],
      notes: [
        { pitch: 'C4', length: '1/16', lyric: syl },
        { pitch: 'D4', length: '1/16' }, // melisma note between the anchors
        { pitch: 'E4', length: '1/16', lyric: syl },
        ...fill,
      ],
    });
    const adjacent = renderSong({
      timeSignature: [2, 4],
      notes: [
        { pitch: 'C4', length: '1/16', lyric: syl },
        { pitch: 'E4', length: '1/16', lyric: syl },
        ...fill,
        { pitch: 'G4', length: '1/16' },
      ],
    });

    const mx = noteXs(melisma.container);
    const ax = noteXs(adjacent.container);

    // Anchor-to-anchor spans both meet the minimum...
    expect(mx[2] - mx[0]).toBeGreaterThanOrEqual(required - 0.5);
    expect(ax[1] - ax[0]).toBeGreaterThanOrEqual(required - 0.5);
    // ...and the melisma version subdivides the SAME span — the intervening
    // note does not force a second full requirement on each sub-gap.
    expect(mx[1] - mx[0]).toBeLessThan(required);
    expect(mx[2] - mx[0]).toBeLessThan(required + 40);

    melisma.cleanup();
    adjacent.cleanup();
  });

  it('multi-verse: the widest verse line governs', () => {
    const notes = (verse2) => [
      { pitch: 'C4', length: '1/8', lyric: verse2 ? ['a', 'extraordinary'] : ['a'] },
      { pitch: 'D4', length: '1/8', lyric: verse2 ? ['b', 'extraordinary'] : ['b'] },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'G4', length: '1/4' },
    ];
    const short = renderSong({ timeSignature: [4, 4], notes: notes(false) });
    const wide = renderSong({ timeSignature: [4, 4], notes: notes(true) });

    const shortAdv = noteXs(short.container)[1] - noteXs(short.container)[0];
    const xs = noteXs(wide.container);
    const wideAdv = xs[1] - xs[0];
    const required = estimateLyricWidth('extraordinary') + LYRIC_GAP;

    expect(wideAdv).toBeGreaterThan(shortAdv);
    expect(wideAdv).toBeGreaterThanOrEqual(required - 0.5);

    short.cleanup();
    wide.cleanup();
  });

  it('justified systems never compress below the lyric minimum (multi-system)', () => {
    const syl = 'wonderful'; // 9 chars — requirement exceeds the 16th gap
    const notes = [];
    for (let m = 0; m < 3; m += 1) {
      for (let i = 0; i < 8; i += 1) {
        notes.push({
          pitch: ['C4', 'D4', 'E4', 'F4'][i % 4],
          length: '1/16',
          lyric: syl,
        });
      }
    }
    const { container, cleanup } = renderSong(
      { timeSignature: [2, 4], notes },
      700
    );
    const systems = new Set(
      [...container.querySelectorAll('[data-system-index]')].map((g) =>
        g.getAttribute('data-system-index')
      )
    );
    expect(systems.size).toBeGreaterThan(1); // wraps: justified + ragged systems
    const pairs = expectNoSameVerseCrowding(container);
    expect(pairs).toBeGreaterThan(15);
    cleanup();
  });

  it('reserves leading space for verse numbers on a system whose first note is lyric-bearing', () => {
    const syl = 'Wonderful-';
    const notes = (withLyrics) => [
      { pitch: 'G4', length: '1/4', ...(withLyrics ? { lyric: [syl, syl] } : {}) },
      { pitch: 'A4', length: '1/4', ...(withLyrics ? { lyric: ['b', 'b'] } : {}) },
      { pitch: 'B4', length: '1/4', ...(withLyrics ? { lyric: ['c', 'c'] } : {}) },
      { pitch: 'G4', length: '1/4', ...(withLyrics ? { lyric: ['d', 'd'] } : {}) },
    ];
    const bare = renderSong({ timeSignature: [4, 4], notes: notes(false) });
    const withNum = renderSong({ timeSignature: [4, 4], notes: notes(true) });

    const bareX = noteXs(bare.container)[0];
    const lyrX = noteXs(withNum.container)[0];
    const expectedReservation =
      estimateLyricWidth(syl) / 2 +
      VERSE_NUMBER_GAP +
      estimateLyricWidth('2.', VERSE_NUMBER_FONT_SIZE) +
      VERSE_NUMBER_LEAD_CLEARANCE -
      PRELUDE_NOTE_MIN_DAYLIGHT;
    expect(expectedReservation).toBeGreaterThan(0); // test premise
    expect(lyrX - bareX).toBeCloseTo(expectedReservation, 1);

    // The number's estimated left edge stays clear of the prelude block:
    // >= (prelude ink edge) + clearance, where the ink edge is bounded by
    // bare first-note x minus the documented minimum daylight.
    const numbers = [...withNum.container.querySelectorAll('.lyric-verse-number')];
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) {
      const numLeft =
        translateOf(n).x -
        estimateLyricWidth(n.textContent, VERSE_NUMBER_FONT_SIZE);
      expect(numLeft).toBeGreaterThanOrEqual(
        bareX - PRELUDE_NOTE_MIN_DAYLIGHT + VERSE_NUMBER_LEAD_CLEARANCE - 0.5
      );
    }

    bare.cleanup();
    withNum.cleanup();
  });

  describe('singHarmony2 hymn fixtures (realistic multi-verse SATB)', () => {
    it('amazing-grace: no adjacent same-verse syllables crowd at width 800', () => {
      const { container, cleanup } = renderSong(amazingGrace, 800);
      const pairs = expectNoSameVerseCrowding(container);
      expect(pairs).toBeGreaterThan(50); // 5 verses x ~27 anchor pairs
      cleanup();
    });

    it('wonderful-grace-of-jesus (dense): no adjacent same-verse syllables crowd at width 800', () => {
      const { container, cleanup } = renderSong(wonderfulGrace, 800);
      const pairs = expectNoSameVerseCrowding(container);
      expect(pairs).toBeGreaterThan(100);
      cleanup();
    });
  });
});
