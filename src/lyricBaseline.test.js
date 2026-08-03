/** @jest-environment jsdom */

/**
 * JOB 4 — lyric baseline must clear staff content.
 *
 * Lyrics used to render at the fixed LYRIC_BASE_Y (115) regardless of how
 * far the staff's content descends; on a shared staff the down-stem
 * voice's stems (alto on a treble staff) overlapped the lyric text. The
 * per-system rule: a staff's lyric baseline =
 *   max(LYRIC_BASE_Y, lowest content extent of the staff's voices + ~8px)
 * Verse lines stack below that baseline; melismas and verse numbers shift
 * with their line; inter-staff/inter-system reservations follow.
 */

import { NotationRenderer } from './NotationRenderer.js';
import { LYRIC_BASE_Y, VERSE_LINE_HEIGHT } from './components/Lyric.js';

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

/**
 * Staff-local bottom of the deepest stem in the container: note groups are
 * translate(x, noteY) and stems are local lines, so bottom = noteY +
 * max(y1, y2). Chord/tuplet groups are translate(x, 0) with staff-frame
 * stem coords — the noteY term is then 0, which the same math handles.
 */
function deepestStemBottom(container) {
  let deepest = -Infinity;
  for (const stem of container.querySelectorAll('.note-stem')) {
    const parent = stem.closest('g[transform]');
    const ty = parent ? translateOf(parent).y : 0;
    const bottom =
      ty + Math.max(parseFloat(stem.getAttribute('y1')), parseFloat(stem.getAttribute('y2')));
    if (bottom > deepest) deepest = bottom;
  }
  return deepest;
}

describe('lyric baseline clears staff content (JOB 4)', () => {
  it('a low down-stem voice on a shared staff pushes the lyric line below the stem tips', () => {
    // Soprano carries the lyric; alto is forced stem-down on the shared
    // staff and its stems reach ~126px — past the legacy 115 baseline.
    const { container, cleanup } = renderSong({
      timeSignature: [4, 4],
      voices: [
        {
          id: 's',
          staff: 'up',
          clef: 'treble',
          notes: [
            { pitch: 'C5', length: '1/4', lyric: 'A-' },
            { pitch: 'C5', length: '1/4', lyric: 'maz-' },
            { pitch: 'C5', length: '1/4', lyric: 'ing' },
            { pitch: 'C5', length: '1/4', lyric: 'grace' },
          ],
        },
        {
          id: 'a',
          staff: 'up',
          notes: [
            { pitch: 'G4', length: '1/4' },
            { pitch: 'G4', length: '1/4' },
            { pitch: 'G4', length: '1/4' },
            { pitch: 'G4', length: '1/4' },
          ],
        },
      ],
    });

    const stemBottom = deepestStemBottom(container);
    expect(stemBottom).toBeGreaterThan(LYRIC_BASE_Y); // test premise: overlap existed
    const lyrics = [...container.querySelectorAll('.lyric')];
    expect(lyrics.length).toBe(4);
    for (const l of lyrics) {
      const { y } = translateOf(l);
      expect(y).toBeGreaterThan(LYRIC_BASE_Y);
      expect(y).toBeGreaterThanOrEqual(stemBottom + 8 - 0.5);
    }
    cleanup();
  });

  it('a staff whose content stays inside the staff keeps the exact legacy baseline', () => {
    // Stem-up notes (F4/G4/A4, stem bottom y=80) never reach past the
    // staff's own bottom line (y=90), let alone LYRIC_BASE_Y - clearance
    // (JOB 5 raised the clearance to 36px so it now takes more headroom
    // below the staff to trigger a shift than JOB 4's D5 case did).
    const { container, cleanup } = renderSong({
      timeSignature: [4, 4],
      notes: [
        { pitch: 'F4', length: '1/4', lyric: 'A-' },
        { pitch: 'G4', length: '1/4', lyric: 'maz-' },
        { pitch: 'A4', length: '1/4', lyric: 'ing' },
        { pitch: 'G4', length: '1/4', lyric: 'grace' },
      ],
    });
    const lyrics = [...container.querySelectorAll('.lyric')];
    expect(lyrics.length).toBe(4);
    for (const l of lyrics) {
      expect(translateOf(l).y).toBe(LYRIC_BASE_Y);
    }
    cleanup();
  });

  it('verse lines, melismas, and verse numbers all shift with the raised baseline', () => {
    // B4 (middle line) is stem-down with its tip at ~116 — deep content.
    const { container, cleanup } = renderSong({
      timeSignature: [4, 4],
      notes: [
        { pitch: 'B4', length: '1/4', lyric: ['A-', 'Twas'] },
        { pitch: 'B4', length: '1/4', lyric: [null, 'grace'] },
        { pitch: 'B4', length: '1/4', lyric: ['zing', 'that'] },
        { pitch: 'B4', length: '1/4', lyric: ['grace', 'taught'] },
      ],
    });

    const stemBottom = deepestStemBottom(container);
    const lyrics = [...container.querySelectorAll('.lyric')];
    const ys = [...new Set(lyrics.map((l) => translateOf(l).y))].sort((a, b) => a - b);
    expect(ys).toHaveLength(2);
    const baseY = ys[0];
    expect(baseY).toBeGreaterThanOrEqual(stemBottom + 8 - 0.5);
    // Verse stacking below the SHIFTED baseline is unchanged.
    expect(ys[1]).toBeCloseTo(baseY + VERSE_LINE_HEIGHT, 6);

    // Verse numbers sit on their shifted lines.
    const numYs = [...container.querySelectorAll('.lyric-verse-number')]
      .map((n) => translateOf(n).y)
      .sort((a, b) => a - b);
    expect(numYs).toEqual(ys);

    // The verse-1 melisma underscore rides its shifted line (+5 melisma drop).
    const melismas = [...container.querySelectorAll('.lyric-melisma')];
    expect(melismas).toHaveLength(1);
    expect(parseFloat(melismas[0].getAttribute('y1'))).toBeCloseTo(baseY + 5, 6);

    cleanup();
  });

  it('inter-staff spacing reservation reflects the shifted baseline', () => {
    // Same verse count, same rhythm — deep-content melody (B4, stem tips
    // ~116) must reserve MORE room below than shallow content (A4).
    const gapFor = (pitch) => {
      const { container, cleanup } = renderSong({
        timeSignature: [4, 4],
        voices: [
          {
            id: 'melody',
            clef: 'treble',
            notes: Array.from({ length: 4 }, (_, i) => ({
              pitch,
              length: '1/4',
              lyric: [`v1-${i}`, `v2-${i}`, `v3-${i}`],
            })),
          },
          {
            id: 'bass',
            clef: 'bass',
            notes: Array.from({ length: 4 }, () => ({ pitch: 'D3', length: '1/4' })),
          },
        ],
        staffGroups: [{ type: 'brace', voiceIds: ['melody', 'bass'] }],
      });
      const ys = [...container.querySelectorAll('.staff')].map((g) => translateOf(g).y);
      cleanup();
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(gapFor('B4')).toBeGreaterThan(gapFor('A4'));
  });
});
