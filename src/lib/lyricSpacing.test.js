/** @jest-environment jsdom */

/**
 * Unit tests for the pure lyric-spacing helpers (SPEC-lyric-spacing.md,
 * JOB 1). The renderer-level integration is covered in
 * src/lyricSpacing.render.test.js.
 */

import {
  LYRIC_GAP,
  VERSE_NUMBER_GAP,
  PRELUDE_NOTE_MIN_DAYLIGHT,
  VERSE_NUMBER_LEAD_CLEARANCE,
  BARLINE_LYRIC_GAP,
  PRE_BARLINE_INK_EXTENT,
  computeLyricConstraints,
  computeBarlineLyricFloors,
  applyLyricSpacing,
  verseNumberLeadReservation,
  lyricSyllableForVerse,
  maxLyricVerseCount,
} from './lyricSpacing.js';
import {
  estimateLyricWidth,
  LYRIC_FONT_SIZE,
  VERSE_NUMBER_FONT_SIZE,
  LYRIC_CHAR_WIDTH_RATIO,
  LYRIC_CHAR_WIDTHS,
} from '../components/Lyric.js';

describe('estimateLyricWidth', () => {
  const ems = (text) => [...text].reduce(
    (total, ch) => total + (LYRIC_CHAR_WIDTHS[ch] ?? LYRIC_CHAR_WIDTH_RATIO), 0
  );

  it('sums per-character advances against the REAL font-size constant', () => {
    expect(estimateLyricWidth('grace')).toBeCloseTo(ems('grace') * LYRIC_FONT_SIZE);
    // width-sensitive, not merely character-count-sensitive
    expect(estimateLyricWidth('mmmmm')).toBeGreaterThan(estimateLyricWidth('iiiii'));
  });

  it('accepts an explicit font size (verse numbers)', () => {
    expect(estimateLyricWidth('2.', VERSE_NUMBER_FONT_SIZE)).toBeCloseTo(
      ems('2.') * VERSE_NUMBER_FONT_SIZE
    );
  });
});

describe('lyric verse helpers', () => {
  it('bare string is verse 1 only', () => {
    expect(lyricSyllableForVerse('la', 0)).toBe('la');
    expect(lyricSyllableForVerse('la', 1)).toBeNull();
  });

  it('array entries map to verses; null/undefined entries are melisma', () => {
    expect(lyricSyllableForVerse(['a', null, 'c'], 0)).toBe('a');
    expect(lyricSyllableForVerse(['a', null, 'c'], 1)).toBeNull();
    expect(lyricSyllableForVerse(['a', null, 'c'], 2)).toBe('c');
  });

  it('maxLyricVerseCount counts the widest lyric array', () => {
    expect(
      maxLyricVerseCount([
        { pitch: 'C4', length: '1/4', lyric: 'one' },
        { pitch: 'D4', length: '1/4', lyric: ['a', 'b', 'c'] },
        { pitch: 'E4', length: '1/4' },
      ])
    ).toBe(3);
    expect(maxLyricVerseCount([{ pitch: 'C4', length: '1/4' }])).toBe(0);
  });
});

describe('computeLyricConstraints', () => {
  const est = (t) => estimateLyricWidth(t);

  it('emits one constraint per consecutive same-verse anchor pair', () => {
    const voices = [
      {
        notes: [
          { pitch: 'C4', length: '1/4', lyric: 'one' },
          { pitch: 'D4', length: '1/4', lyric: 'two' },
          { pitch: 'E4', length: '1/4', lyric: 'three' },
        ],
      },
    ];
    const cs = computeLyricConstraints(voices);
    expect(cs).toHaveLength(2);
    expect(cs[0]).toEqual({
      fromBeat: 0,
      toBeat: 1,
      minAdvance: (est('one') + est('two')) / 2 + LYRIC_GAP,
    });
    expect(cs[1].fromBeat).toBe(1);
    expect(cs[1].toBeat).toBe(2);
  });

  it('melisma notes between anchors extend the interval instead of splitting it', () => {
    const voices = [
      {
        notes: [
          { pitch: 'C4', length: '1/4', lyric: 'stre-' },
          { pitch: 'D4', length: '1/4' }, // melisma
          { pitch: 'E4', length: '1/4', lyric: 'ength' },
        ],
      },
    ];
    const cs = computeLyricConstraints(voices);
    expect(cs).toHaveLength(1);
    expect(cs[0].fromBeat).toBe(0);
    expect(cs[0].toBeat).toBe(2);
  });

  it('tracks each verse line independently (per-verse melismas)', () => {
    const voices = [
      {
        notes: [
          { pitch: 'C4', length: '1/4', lyric: ['a-', 'Grace'] },
          { pitch: 'D4', length: '1/4', lyric: [null, 'how'] },
          { pitch: 'E4', length: '1/4', lyric: ['zing', 'sweet'] },
        ],
      },
    ];
    const cs = computeLyricConstraints(voices);
    // Verse 1: 0->2. Verse 2: 0->1 and 1->2.
    expect(cs).toHaveLength(3);
    const spans = cs.map((c) => `${c.fromBeat}->${c.toBeat}`).sort();
    expect(spans).toEqual(['0->1', '0->2', '1->2']);
  });

  it('rests advance the beat cursor but never anchor', () => {
    const voices = [
      {
        notes: [
          { length: '1/2' }, // pickup rest
          { pitch: 'C4', length: '1/4', lyric: 'A-' },
          { pitch: 'D4', length: '1/4', lyric: 'maz-' },
        ],
      },
    ];
    const cs = computeLyricConstraints(voices);
    expect(cs).toHaveLength(1);
    expect(cs[0].fromBeat).toBe(2);
    expect(cs[0].toBeat).toBe(3);
  });

  it('collects constraints from every voice (x-aligned staves)', () => {
    const voices = [
      { notes: [{ pitch: 'C4', length: '1/4', lyric: 'hi' }, { pitch: 'D4', length: '1/4', lyric: 'ho' }] },
      { notes: [{ pitch: 'C3', length: '1/2', lyric: 'low' }, { pitch: 'D3', length: '1/2', lyric: 'lower' }] },
    ];
    const cs = computeLyricConstraints(voices);
    expect(cs).toHaveLength(2);
    expect(cs.map((c) => c.toBeat).sort()).toEqual([1, 2]);
  });
});

describe('applyLyricSpacing', () => {
  it('widens a deficient interval to the minimum, shifting later beats', () => {
    const map = new Map([[0, 100], [1, 150], [2, 200], [3, 260]]);
    const voices = [
      {
        notes: [
          { pitch: 'C4', length: '1/4', lyric: 'x'.repeat(20) }, // est 110
          { pitch: 'D4', length: '1/4', lyric: 'x'.repeat(20) },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
        ],
      },
    ];
    const req = estimateLyricWidth('x'.repeat(20)) + LYRIC_GAP; // avg of equals
    expect(req).toBeGreaterThan(50); // sanity: constraint binds
    applyLyricSpacing(map, voices);
    expect(map.get(1) - map.get(0)).toBeCloseTo(req, 6);
    // Later gaps preserved, later beats shifted.
    expect(map.get(2) - map.get(1)).toBeCloseTo(50, 6);
    expect(map.get(3) - map.get(2)).toBeCloseTo(60, 6);
  });

  it('leaves already-satisfied intervals byte-identical', () => {
    const map = new Map([[0, 100], [1, 400], [2, 500]]);
    const voices = [
      {
        notes: [
          { pitch: 'C4', length: '1/4', lyric: 'hi' },
          { pitch: 'D4', length: '1/4', lyric: 'ho' },
          { pitch: 'E4', length: '1/4' },
        ],
      },
    ];
    applyLyricSpacing(map, voices);
    expect([...map.entries()]).toEqual([[0, 100], [1, 400], [2, 500]]);
  });

  it('no lyrics -> the map object is untouched', () => {
    const map = new Map([[0, 100], [1, 120]]);
    const before = [...map.entries()];
    applyLyricSpacing(map, [{ notes: [{ pitch: 'C4', length: '1/4' }, { pitch: 'D4', length: '1/4' }] }]);
    expect([...map.entries()]).toEqual(before);
  });

  it('an interval widened for one voice satisfies an overlapping one from another', () => {
    // Voice A constrains [0,1] hard; voice B's [0,2] requirement is smaller
    // than A's and must not re-widen.
    const map = new Map([[0, 0], [1, 10], [2, 20]]);
    const voices = [
      {
        notes: [
          { pitch: 'C4', length: '1/4', lyric: 'x'.repeat(20) },
          { pitch: 'D4', length: '1/4', lyric: 'x'.repeat(20) },
          { pitch: 'E4', length: '1/4' },
        ],
      },
      {
        notes: [
          { pitch: 'C3', length: '1/2', lyric: 'ab' },
          { pitch: 'D3', length: '1/2', lyric: 'cd' },
        ],
      },
    ];
    applyLyricSpacing(map, voices);
    const reqA = estimateLyricWidth('x'.repeat(20)) + LYRIC_GAP;
    expect(map.get(1) - map.get(0)).toBeCloseTo(reqA, 6);
    // [1,2] gap untouched by the small [0,2] constraint (already satisfied).
    expect(map.get(2) - map.get(1)).toBeCloseTo(10, 6);
  });
});

describe('verseNumberLeadReservation', () => {
  const mkVoices = (firstLyric) => [
    {
      notes: [
        { pitch: 'G4', length: '1/4', lyric: firstLyric },
        { pitch: 'A4', length: '1/4', lyric: ['b', 'b'] },
      ],
    },
  ];

  it('is zero without lyrics or with a single verse (no numbers render)', () => {
    expect(verseNumberLeadReservation([{ notes: [{ pitch: 'C4', length: '1/4' }] }], [0])).toBe(0);
    expect(
      verseNumberLeadReservation(mkVoices('WonderfulWord'), [1])
    ).toBe(0);
  });

  it('reserves the deficit for a long first syllable with verse numbers', () => {
    const syl = 'Wonderful-';
    const needed =
      estimateLyricWidth(syl) / 2 +
      VERSE_NUMBER_GAP +
      estimateLyricWidth('2.', VERSE_NUMBER_FONT_SIZE) +
      VERSE_NUMBER_LEAD_CLEARANCE -
      PRELUDE_NOTE_MIN_DAYLIGHT;
    expect(needed).toBeGreaterThan(0); // test premise
    expect(
      verseNumberLeadReservation(mkVoices([syl, syl]), [2])
    ).toBeCloseTo(needed, 6);
  });

  it('matches the formula for a short first syllable', () => {
    // JOB 5: at 39px lyrics, even a 1-char syllable no longer fits inside
    // PRELUDE_NOTE_MIN_DAYLIGHT — the reservation formula is what's under
    // test here, not a "premise" of zero, which the raised font size makes
    // unreachable at any syllable length. Same formula/toBeCloseTo pattern
    // as the "long first syllable" test above.
    const syl = 'a';
    const needed = Math.max(
      0,
      estimateLyricWidth(syl) / 2 +
        VERSE_NUMBER_GAP +
        estimateLyricWidth('2.', VERSE_NUMBER_FONT_SIZE) +
        VERSE_NUMBER_LEAD_CLEARANCE -
        PRELUDE_NOTE_MIN_DAYLIGHT
    );
    expect(
      verseNumberLeadReservation(mkVoices([syl, syl]), [2])
    ).toBeCloseTo(needed, 6);
  });

  it('is zero when the system FIRST note carries no syllable', () => {
    const voices = [
      {
        notes: [
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/4', lyric: ['Wonderful-', 'Wonderful-'] },
        ],
      },
    ];
    expect(verseNumberLeadReservation(voices, [2])).toBe(0);
  });
});

describe('computeBarlineLyricFloors (SPEC-pickup-and-barline-lyrics.md JOB A)', () => {
  const HEAD = 10.84;
  // 4/4: four quarters, boundary at beat 4, four quarters, system end at 8.
  const map = new Map([
    [0, 200], [1, 300], [2, 400], [3, 500],
    [4, 600], [5, 700], [6, 800], [7, 900], [8, 1000],
  ]);
  const boundaries = [4, 8];
  const mkVoice = (lyrics) => [{
    notes: lyrics.map((lyric, i) => ({
      pitch: 'C4',
      length: '1/4',
      ...(lyric === undefined ? {} : { lyric }),
    })),
  }];

  it('returns empty maps for lyric-free input', () => {
    const { pre, post } = computeBarlineLyricFloors(
      mkVoice(Array(8).fill(undefined)), boundaries, map, HEAD
    );
    expect(pre.size).toBe(0);
    expect(post.size).toBe(0);
  });

  it('post floor: a wide downbeat syllable demands its half-width + gap', () => {
    const wide = 'dimmed,';
    const { post } = computeBarlineLyricFloors(
      mkVoice(['a', 'b', 'c', 'd', wide, 'e', 'f', 'g']), boundaries, map, HEAD
    );
    expect(post.get(4)).toBeCloseTo(
      estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP - HEAD,
      6
    );
  });

  it('pre floor: a wide measure-final syllable adds the barline ink extent', () => {
    const wide = 'extraordinary,';
    const { pre } = computeBarlineLyricFloors(
      mkVoice(['a', 'b', 'c', wide, 'd', 'e', 'f', 'g']), boundaries, map, HEAD
    );
    expect(pre.get(4)).toBeCloseTo(
      estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP + PRE_BARLINE_INK_EXTENT - HEAD,
      6
    );
  });

  it('in-measure map distance relaxes the requirement for non-adjacent anchors', () => {
    const wide = 'extraordinary,';
    // Wide syllable a beat BEFORE the measure end: the 100px gap between it
    // and the measure's last onset (beat 3) is subtracted from the floor.
    const { pre } = computeBarlineLyricFloors(
      mkVoice(['a', 'b', wide, undefined, 'd', 'e', 'f', 'g']), boundaries, map, HEAD
    );
    expect(pre.get(4)).toBeCloseTo(
      estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP + PRE_BARLINE_INK_EXTENT - HEAD - 100,
      6
    );
  });

  it('narrow syllables never raise a floor past the MIN_BARLINE_PADDING regime', () => {
    const { pre, post } = computeBarlineLyricFloors(
      mkVoice(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), boundaries, map, HEAD
    );
    for (const v of [...pre.values(), ...post.values()]) {
      expect(v).toBeLessThan(40); // MIN_BARLINE_PADDING — pads unchanged
    }
  });

  it('the widest verse line governs a multi-verse anchor', () => {
    const { post } = computeBarlineLyricFloors(
      mkVoice(['a', 'b', 'c', 'd', ['e', 'Undimmed,'], 'f', 'g', 'h']),
      boundaries, map, HEAD
    );
    expect(post.get(4)).toBeCloseTo(
      estimateLyricWidth('Undimmed,') / 2 + BARLINE_LYRIC_GAP - HEAD,
      6
    );
  });

  it('the system-closing boundary takes a pre floor from the last anchor', () => {
    const wide = 'extraordinary,';
    const { pre } = computeBarlineLyricFloors(
      mkVoice(['a', 'b', 'c', 'd', 'e', 'f', 'g', wide]), boundaries, map, HEAD
    );
    expect(pre.get(8)).toBeCloseTo(
      estimateLyricWidth(wide) / 2 + BARLINE_LYRIC_GAP + PRE_BARLINE_INK_EXTENT - HEAD,
      6
    );
  });
});
