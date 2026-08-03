/** @jest-environment jsdom */

/**
 * Renderer-level tests for barline↔syllable clearance
 * (SPEC-pickup-and-barline-lyrics.md JOB A).
 *
 * Observed defect (America the Beautiful): a measure's first note carries a
 * wide syllable that extends LEFT past the preceding barline, so the barline
 * strikes through the text. Rule: the daylight between a barline and an
 * adjacent lyric anchor must be at least estWidth(widest syllable across
 * verse lines)/2 + BARLINE_LYRIC_GAP.
 *
 * Width assertions use the SAME estimation heuristic as the implementation
 * (estimateLyricWidth — jsdom offers no real text metrics).
 */

import { NotationRenderer } from './NotationRenderer.js';
import { BARLINE_LYRIC_GAP } from './lib/lyricSpacing.js';
import { estimateLyricWidth } from './components/Lyric.js';
import americaTheBeautiful from './__tests__/fixtures/america-the-beautiful.json';

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

/** x positions of sounding .note groups (excl. grace notes), DOM order. */
function noteXs(container) {
  return [...container.querySelectorAll('.note')]
    .filter((g) => !g.closest('.grace-note'))
    .map((g) => translateOf(g).x);
}

/**
 * Every barline x (absolute) within a staff group: plain auto-barlines
 * (.bar-line line) plus each line of repeat/final barline groups.
 */
function barlineXsIn(group) {
  const xs = [];
  for (const line of group.querySelectorAll('.bar-line line')) {
    xs.push(parseFloat(line.getAttribute('x1')));
  }
  for (const bl of group.querySelectorAll('.barline')) {
    const t = translateOf(bl);
    if (!t) continue;
    for (const line of bl.querySelectorAll('line')) {
      xs.push(t.x + parseFloat(line.getAttribute('x1')));
    }
  }
  return xs;
}

/**
 * Assert no barline strikes through any rendered syllable's estimated
 * horizontal extent [x - w/2 + tol, x + w/2 - tol]. Returns the number of
 * (syllable, barline) pairs inspected.
 */
function expectNoBarlineThroughSyllables(container, tol = 0.5) {
  let checked = 0;
  const staffGroups = container.querySelectorAll('[data-voice-id]');
  for (const g of staffGroups) {
    const barlines = barlineXsIn(g);
    for (const lyric of g.querySelectorAll('.lyric')) {
      const { x } = translateOf(lyric);
      const half = estimateLyricWidth(lyric.textContent) / 2;
      for (const bx of barlines) {
        checked += 1;
        const strikes = bx > x - half + tol && bx < x + half - tol;
        if (strikes) {
          // Build a readable failure.
          expect(
            `barline at ${bx.toFixed(1)} strikes syllable "${lyric.textContent}" ` +
              `centered at ${x.toFixed(1)} (half-width ${half.toFixed(1)})`
          ).toBe('no strike-through');
        }
      }
    }
  }
  return checked;
}

describe('barline-syllable clearance (JOB A)', () => {
  it('pushes a wide first-of-measure syllable clear of the preceding barline', () => {
    const wide = 'dimmed,'; // 7 chars — half-width exceeds the default daylight
    const song = {
      timeSignature: [4, 4],
      notes: [
        { pitch: 'G4', length: '1/4', lyric: 'a' },
        { pitch: 'A4', length: '1/4', lyric: 'b' },
        { pitch: 'B4', length: '1/4', lyric: 'c' },
        { pitch: 'G4', length: '1/4', lyric: 'd' },
        { pitch: 'A4', length: '1/4', lyric: wide },
        { pitch: 'B4', length: '1/4', lyric: 'e' },
        { pitch: 'A4', length: '1/4', lyric: 'f' },
        { pitch: 'G4', length: '1/4', lyric: 'g' },
      ],
    };
    // Width 1200 keeps both measures on ONE system so the wide anchor has a
    // preceding barline (at 800 the widened measures wrap instead — equally
    // valid engraving, but not the case under test).
    const { container, cleanup } = renderSong(song, 1200);
    expect(container.querySelectorAll('[data-voice-id]').length).toBe(1);

    const xs = noteXs(container);
    const anchorX = xs[4]; // first note of measure 2
    const required = estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP;
    // Preceding barline = the auto-barline left of the anchor.
    const barlines = barlineXsIn(
      container.querySelector('[data-voice-id]')
    ).filter((bx) => bx < anchorX);
    expect(barlines.length).toBeGreaterThan(0);
    const precedingBarlineX = Math.max(...barlines);
    // Test premise: the requirement exceeds the default across-bar daylight
    // the narrow control below settles at.
    expect(anchorX - precedingBarlineX).toBeGreaterThanOrEqual(required - 0.5);
    expectNoBarlineThroughSyllables(container);
    cleanup();
  });

  it('multi-verse: the widest verse line governs the clearance', () => {
    const song = {
      timeSignature: [4, 4],
      notes: [
        { pitch: 'G4', length: '1/4', lyric: ['a', 'a'] },
        { pitch: 'A4', length: '1/4', lyric: ['b', 'b'] },
        { pitch: 'B4', length: '1/4', lyric: ['c', 'c'] },
        { pitch: 'G4', length: '1/4', lyric: ['d', 'd'] },
        { pitch: 'A4', length: '1/4', lyric: ['e', 'Undimmed,'] }, // verse 2 wide
        { pitch: 'B4', length: '1/4', lyric: ['f', 'f'] },
        { pitch: 'A4', length: '1/4', lyric: ['g', 'g'] },
        { pitch: 'G4', length: '1/4', lyric: ['h', 'h'] },
      ],
    };
    const { container, cleanup } = renderSong(song);
    const xs = noteXs(container);
    const anchorX = xs[4];
    const required = estimateLyricWidth('Undimmed,') / 2 + BARLINE_LYRIC_GAP;
    const barlines = barlineXsIn(
      container.querySelector('[data-voice-id]')
    ).filter((bx) => bx < anchorX);
    const precedingBarlineX = Math.max(...barlines);
    expect(anchorX - precedingBarlineX).toBeGreaterThanOrEqual(required - 0.5);
    expectNoBarlineThroughSyllables(container);
    cleanup();
  });

  it('mirror: a wide last-of-measure syllable stays clear of the following barline (melisma next)', () => {
    // The next measure opens on a MELISMA note (no syllable), so JOB 1's
    // anchor-pair constraint spreads across two gaps and does NOT pin the
    // barline daylight by itself — the pre-barline floor must.
    const wide = 'extraordinary,';
    const song = {
      timeSignature: [4, 4],
      notes: [
        { pitch: 'G4', length: '1/4', lyric: 'a' },
        { pitch: 'A4', length: '1/4', lyric: 'b' },
        { pitch: 'B4', length: '1/4', lyric: 'c' },
        { pitch: 'G4', length: '1/8', lyric: 'd' },
        { pitch: 'A4', length: '1/8', lyric: wide },
        { pitch: 'B4', length: '1/4' }, // melisma — no syllable
        { pitch: 'A4', length: '1/4', lyric: 'e' },
        { pitch: 'G4', length: '1/4', lyric: 'f' },
        { pitch: 'A4', length: '1/4', lyric: 'g' },
      ],
    };
    const { container, cleanup } = renderSong(song);
    const xs = noteXs(container);
    const anchorX = xs[4]; // the wide-syllable eighth ending measure 1
    const required = estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP;
    const barlines = barlineXsIn(
      container.querySelector('[data-voice-id]')
    ).filter((bx) => bx > anchorX);
    expect(barlines.length).toBeGreaterThan(0);
    const followingBarlineX = Math.min(...barlines);
    expect(followingBarlineX - anchorX).toBeGreaterThanOrEqual(required - 0.5);
    expectNoBarlineThroughSyllables(container);
    cleanup();
  });

  it('system-closing barline clears a wide final syllable', () => {
    // Piece ENDS on a wide syllable: no following anchor exists, so only
    // the trailing-barline floor can protect the closing barline.
    const wide = 'extraordinary,';
    const song = {
      timeSignature: [4, 4],
      notes: [
        { pitch: 'G4', length: '1/4', lyric: 'a' },
        { pitch: 'A4', length: '1/4', lyric: 'b' },
        { pitch: 'B4', length: '1/4', lyric: 'c' },
        { pitch: 'G4', length: '1/2', lyric: 'd' },
        { pitch: 'A4', length: '1/4', lyric: 'e' },
        { pitch: 'B4', length: '1/8', lyric: 'f' },
        { pitch: 'A4', length: '1/8', lyric: wide },
      ],
    };
    const { container, cleanup } = renderSong(song);
    const xs = noteXs(container);
    const anchorX = xs[xs.length - 1];
    const required = estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP;
    const barlines = barlineXsIn(
      container.querySelector('[data-voice-id]')
    ).filter((bx) => bx > anchorX);
    expect(barlines.length).toBeGreaterThan(0);
    const closingBarlineX = Math.min(...barlines);
    expect(closingBarlineX - anchorX).toBeGreaterThanOrEqual(required - 0.5);
    expectNoBarlineThroughSyllables(container);
    cleanup();
  });

  it('narrow syllables leave note positions untouched (no constraint binds)', () => {
    const mk = (withLyrics) => ({
      timeSignature: [4, 4],
      notes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((syl, i) => ({
        pitch: ['G4', 'A4', 'B4', 'G4'][i % 4],
        length: '1/4',
        ...(withLyrics ? { lyric: syl } : {}),
      })),
    });
    const bare = renderSong(mk(false));
    const lyr = renderSong(mk(true));
    expect(noteXs(lyr.container)).toEqual(noteXs(bare.container));
    bare.cleanup();
    lyr.cleanup();
  });

  describe('singHarmony2 fixture (America the Beautiful — 4 verses, SATB)', () => {
    for (const width of [800, 1200]) {
      it(`no barline strikes any syllable at width ${width}`, () => {
        const { container, cleanup } = renderSong(americaTheBeautiful, width);
        const checked = expectNoBarlineThroughSyllables(container);
        expect(checked).toBeGreaterThan(100);
        cleanup();
      });
    }
  });
});
