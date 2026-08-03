/** @jest-environment jsdom */

/**
 * Multi-verse lyrics (hymnal-style stacked verses) — SPEC-multi-verse-lyrics.md.
 *
 * NOTE (JOB 4, lyric-baseline-clears-content): tests here that assert the
 * EXACT legacy baseline y use pitches whose ink stays inside the staff
 * (stem bottoms <= 80 staff-local, comfortably under the JOB 5 clearance
 * threshold of 90). B4's down-stem reaches y=120 and D5's reaches y=100 —
 * both now inside the (much wider, JOB 5) lyric band — so those songs use
 * G4/A4 instead; a B4 or D5 song now correctly shifts its lyric block down
 * (covered in lyricBaseline.test.js).
 *
 * `lyric` accepts a string (verse 1, unchanged) or an array of strings/nulls
 * (one entry per verse). Verses stack below the staff, each verse line
 * computes its own melismas, verse numbers render at each system's first
 * lyric-bearing note, and inter-staff spacing reserves room for the block.
 */

import { createNotationContext } from './__tests__/helpers/testUtils.js';
import { NotationRenderer } from './NotationRenderer.js';

// SPEC-lyric-engraving-scale.md JOB 5: LYRIC_BASE_Y raised 115 -> 126 (a
// 39px font's ascenders need more clearance above the staff bottom);
// melisma drop stays a fixed +5 off that raised baseline (131); verse line
// height raised 30 -> 39 (measured verse-row pitch ~= 1x font size, not a
// naive 2x guess — see Lyric.js).
const LYRIC_BASE_Y = 126;
const MELISMA_BASE_Y = 131;
const VERSE_LINE = 39;

function parseTranslate(el) {
  const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(
    el.getAttribute('transform') || ''
  );
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

describe('Multi-verse lyrics', () => {
  let ctx;

  beforeEach(() => {
    ctx = createNotationContext();
  });

  afterEach(() => {
    ctx.destroy();
  });

  describe('stacked verse lines', () => {
    it('renders one text element per verse, stacked at increasing y', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G4', length: '1/4', lyric: ['A-', 'Twas', 'Through'] },
          { pitch: 'A4', length: '1/4', lyric: ['maz-', 'grace', 'man-'] },
          { pitch: 'A4', length: '1/4', lyric: ['ing', 'that', 'y'] },
          { pitch: 'G4', length: '1/4', lyric: ['grace', 'taught', 'dan-'] },
        ],
      });
      const lyrics = [...ctx.getLyrics()];
      expect(lyrics).toHaveLength(12); // 4 notes x 3 verses
      const ys = new Set(lyrics.map((l) => parseTranslate(l).y));
      expect(ys).toEqual(
        new Set([LYRIC_BASE_Y, LYRIC_BASE_Y + VERSE_LINE, LYRIC_BASE_Y + 2 * VERSE_LINE])
      );
      // Verse 1 of the first note keeps today's exact position.
      const verse1 = lyrics.filter((l) => parseTranslate(l).y === LYRIC_BASE_Y);
      expect(verse1).toHaveLength(4);
      expect(verse1[0].textContent).toBe('A-');
    });
  });

  describe('per-verse melismas', () => {
    it('null entries produce melisma underscores per verse independently', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          // Verse 1 melisma over note 2; verse 2 has a syllable there.
          { pitch: 'G4', length: '1/4', lyric: ['A-', 'Grace'] },
          { pitch: 'A4', length: '1/4', lyric: [null, 'how'] },
          { pitch: 'A4', length: '1/4', lyric: ['zing', 'sweet'] },
          { pitch: 'G4', length: '1/4', lyric: ['grace', 'sound'] },
        ],
      });
      const melismas = [...ctx.container.querySelectorAll('.lyric-melisma')];
      expect(melismas).toHaveLength(1);
      expect(parseFloat(melismas[0].getAttribute('y1'))).toBe(MELISMA_BASE_Y);
    });

    it('a verse-2 melisma draws on the verse-2 line', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G4', length: '1/4', lyric: ['A-', 'Grace-'] },
          { pitch: 'A4', length: '1/4', lyric: ['ma-', null] },
          { pitch: 'A4', length: '1/4', lyric: ['zing', 'less'] },
          { pitch: 'G4', length: '1/4', lyric: ['grace', 'now'] },
        ],
      });
      const melismas = [...ctx.container.querySelectorAll('.lyric-melisma')];
      expect(melismas).toHaveLength(1);
      expect(parseFloat(melismas[0].getAttribute('y1'))).toBe(
        MELISMA_BASE_Y + VERSE_LINE
      );
    });
  });

  describe('verse numbers', () => {
    it('renders a number per verse at the first lyric-bearing note (single system)', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G4', length: '1/4', lyric: ['A-', 'Twas'] },
          { pitch: 'A4', length: '1/4', lyric: ['maz-', 'grace'] },
          { pitch: 'A4', length: '1/2', lyric: ['ing', 'that'] },
        ],
      });
      const numbers = [...ctx.container.querySelectorAll('.lyric-verse-number')];
      expect(numbers).toHaveLength(2);
      expect(numbers.map((n) => n.textContent).sort()).toEqual(['1.', '2.']);
      // Number sits LEFT of its syllable and on the verse's own line.
      const firstLyric = parseTranslate(ctx.container.querySelector('.lyric'));
      for (const n of numbers) {
        expect(parseTranslate(n).x).toBeLessThan(firstLyric.x);
      }
      const numYs = new Set(numbers.map((n) => parseTranslate(n).y));
      expect(numYs).toEqual(new Set([LYRIC_BASE_Y, LYRIC_BASE_Y + VERSE_LINE]));
    });

    it('renders verse numbers on EVERY system', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderer = new NotationRenderer({ container, width: 600 });
      const notes = [];
      for (let i = 0; i < 16; i += 1) {
        notes.push({
          pitch: i % 2 ? 'A4' : 'G4',
          length: '1/4',
          lyric: [`a${i}`, `b${i}`],
        });
      }
      renderer.render({ timeSignature: [4, 4], notes });
      const systems = new Set(
        [...container.querySelectorAll('[data-system-index]')].map((g) =>
          g.getAttribute('data-system-index')
        )
      );
      expect(systems.size).toBeGreaterThan(1);
      const numbers = container.querySelectorAll('.lyric-verse-number');
      expect(numbers).toHaveLength(2 * systems.size);
      renderer.clear();
      container.remove();
    });
  });

  describe('inter-staff spacing', () => {
    function staffGap(withVerses) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderer = new NotationRenderer({ container, width: 800 });
      const lyric = (i) =>
        withVerses ? [`v1-${i}`, `v2-${i}`, `v3-${i}`, `v4-${i}`] : `v1-${i}`;
      renderer.render({
        timeSignature: [4, 4],
        voices: [
          {
            id: 'melody',
            clef: 'treble',
            notes: Array.from({ length: 4 }, (_, i) => ({
              pitch: 'B4',
              length: '1/4',
              lyric: lyric(i),
            })),
          },
          {
            id: 'bass',
            clef: 'bass',
            notes: Array.from({ length: 4 }, (_, i) => ({
              pitch: 'D3',
              length: '1/4',
            })),
          },
        ],
        staffGroups: [{ type: 'brace', voiceIds: ['melody', 'bass'] }],
      });
      const staves = [...container.querySelectorAll('.staff')].map(
        (g) => parseTranslate(g).y
      );
      renderer.clear();
      container.remove();
      return Math.max(...staves) - Math.min(...staves);
    }

    it('reserves room below the staff for the verse block', () => {
      const gapWithout = staffGap(false);
      const gapWith = staffGap(true);
      expect(gapWith).toBeGreaterThan(gapWithout);
    });

    it('reserves room below a SHARED staff carrying verses', () => {
      const render = (withVerses) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const renderer = new NotationRenderer({ container, width: 800 });
        const lyric = (i) =>
          withVerses ? [`v1-${i}`, `v2-${i}`, `v3-${i}`, `v4-${i}`] : undefined;
        const mk = (pitch, withLyrics) =>
          Array.from({ length: 4 }, (_, i) => ({
            pitch,
            length: '1/4',
            ...(withLyrics && lyric(i) !== undefined ? { lyric: lyric(i) } : {}),
          }));
        renderer.render({
          timeSignature: [4, 4],
          voices: [
            { id: 's', staff: 'up', clef: 'treble', notes: mk('B4', true) },
            { id: 'a', staff: 'up', clef: 'treble', notes: mk('G4', false) },
            { id: 't', staff: 'low', clef: 'bass', notes: mk('B3', false) },
            { id: 'b', staff: 'low', clef: 'bass', notes: mk('G2', false) },
          ],
          staffGroups: [{ type: 'brace', voiceIds: ['s', 'a', 't', 'b'] }],
        });
        const staves = [...container.querySelectorAll('[data-staff-id]')].map(
          (g) => parseTranslate(g).y
        );
        renderer.clear();
        container.remove();
        return Math.max(...staves) - Math.min(...staves);
      };
      expect(render(true)).toBeGreaterThan(render(false));
    });
  });

  describe('backward compatibility', () => {
    it('bare-string lyrics render exactly one line at the legacy position with no numbers', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G4', length: '1/4', lyric: 'A-' },
          { pitch: 'A4', length: '1/4', lyric: 'maz-' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'G4', length: '1/4', lyric: 'ing' },
        ],
      });
      const lyrics = [...ctx.getLyrics()];
      expect(lyrics).toHaveLength(3);
      for (const l of lyrics) {
        expect(parseTranslate(l).y).toBe(LYRIC_BASE_Y);
      }
      expect(ctx.container.querySelectorAll('.lyric-verse-number')).toHaveLength(0);
      // Legacy melisma over the un-lyric'd note, on the legacy line.
      const melismas = [...ctx.container.querySelectorAll('.lyric-melisma')];
      expect(melismas).toHaveLength(1);
      expect(parseFloat(melismas[0].getAttribute('y1'))).toBe(MELISMA_BASE_Y);
    });

    it('a single-entry array behaves like a bare string (no numbers, legacy line)', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G4', length: '1/4', lyric: ['one'] },
          { pitch: 'A4', length: '1/4', lyric: 'two' },
          { pitch: 'A4', length: '1/2', lyric: ['three'] },
        ],
      });
      const lyrics = [...ctx.getLyrics()];
      expect(lyrics).toHaveLength(3);
      for (const l of lyrics) {
        expect(parseTranslate(l).y).toBe(LYRIC_BASE_Y);
      }
      expect(ctx.container.querySelectorAll('.lyric-verse-number')).toHaveLength(0);
    });
  });
});
