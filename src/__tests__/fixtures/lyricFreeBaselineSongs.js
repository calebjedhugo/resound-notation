/**
 * Battery of LYRIC-FREE songs for the byte-identical regression harness
 * (SPEC-lyric-spacing.md, JOB 1: "songs without lyrics: byte-identical
 * output").
 *
 * The harness pins the renderer's full SVG serialization for these songs
 * against a baseline captured at the pre-change commit (3031c00). Any
 * lyric-spacing work that perturbs lyric-free layout fails the harness.
 *
 * Scope note: the battery deliberately contains NO ties and NO slurs —
 * JOB 3 (long-tie/slur flattening) intentionally changes tie/slur arc
 * geometry for all inputs; its own regression pin (short-tie path bytes)
 * lives in Tie.test.js. Everything else the spacing pipeline touches is
 * represented: single voice, multi-measure wrap, grand staff + brace,
 * shared-staff close score, tuplets/dynamics/hairpins, dense sixteenths,
 * a wide ragged last system, and a real hymn (Amazing Grace) with its
 * lyric fields stripped.
 *
 * `buildLyricFreeBaselineSongs` is pure so both the (uncommitted) baseline
 * generator and the committed jest harness build the identical battery.
 */

/** Deep-clone a song, dropping every `lyric` field. */
export function stripLyrics(song) {
  const clone = JSON.parse(JSON.stringify(song));
  const strip = (notes) => {
    for (const el of notes || []) {
      if (!el || Array.isArray(el)) continue;
      if (el.lyric !== undefined) delete el.lyric;
      if (el.notes) strip(el.notes);
    }
  };
  if (clone.voices) {
    for (const v of clone.voices) strip(v.notes);
  } else if (Array.isArray(clone)) {
    strip(clone);
  } else {
    strip(clone.notes);
  }
  return clone;
}

/**
 * @param {Object} deps
 * @param {Object} deps.amazingGrace - parsed amazing-grace.json (has lyrics;
 *   they are stripped here).
 * @returns {Array<{name: string, width: number, song: Object}>}
 */
export function buildLyricFreeBaselineSongs({ amazingGrace }) {
  return [
    {
      name: 'level1-simple-array',
      width: 800,
      song: [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/8' },
        { pitch: 'E4', length: '1/8' },
        { pitch: 'F#4', length: '1/4' },
        { length: '1/4' },
        { pitch: 'G4', length: '1/2', dotted: true },
        { pitch: 'Bb4', length: '1/4' },
      ],
    },
    {
      name: 'g-major-multi-system',
      width: 800,
      song: {
        timeSignature: [4, 4],
        keySignature: 'G',
        notes: [
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/8' },
          { pitch: 'B4', length: '1/8' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/2' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'F#4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/2' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'G4', length: '1/1' },
        ],
      },
    },
    {
      name: 'grand-staff-brace',
      width: 700,
      song: {
        timeSignature: [4, 4],
        keySignature: 'F',
        voices: [
          {
            id: 'rh',
            clef: 'treble',
            notes: [
              { pitch: 'F4', length: '1/4' },
              { pitch: 'A4', length: '1/4' },
              { pitch: 'C5', length: '1/4' },
              { pitch: 'A4', length: '1/4' },
              { pitch: 'Bb4', length: '1/2' },
              { pitch: 'G4', length: '1/2' },
              { pitch: 'F4', length: '1/4' },
              { pitch: 'E4', length: '1/4' },
              { pitch: 'F4', length: '1/2' },
              { pitch: 'G4', length: '1/1' },
            ],
          },
          {
            id: 'lh',
            clef: 'bass',
            notes: [
              { pitch: 'F3', length: '1/2' },
              { pitch: 'C3', length: '1/2' },
              { pitch: 'D3', length: '1/2' },
              { pitch: 'E3', length: '1/2' },
              { pitch: 'F3', length: '1/2' },
              { pitch: 'C3', length: '1/2' },
              { pitch: 'F2', length: '1/1' },
            ],
          },
        ],
        staffGroups: [{ type: 'brace', voiceIds: ['rh', 'lh'] }],
      },
    },
    {
      name: 'close-score-shared-staff',
      width: 800,
      song: {
        timeSignature: [4, 4],
        keySignature: 'G',
        voices: [
          {
            id: 'soprano',
            staff: 'upper',
            clef: 'treble',
            notes: [
              { pitch: 'G4', length: '1/4' },
              { pitch: 'G4', length: '1/4' },
              { pitch: 'A4', length: '1/4' },
              { pitch: 'D4', length: '1/4' },
              { pitch: 'B4', length: '1/2' },
              { length: '1/2' },
            ],
          },
          {
            id: 'alto',
            staff: 'upper',
            notes: [
              { pitch: 'D4', length: '1/4' },
              { pitch: 'E4', length: '1/4' },
              { pitch: 'F#4', length: '1/4' },
              { pitch: 'C4', length: '1/4' },
              { pitch: 'D4', length: '1/2' },
              { length: '1/2' },
            ],
          },
          {
            id: 'tenor',
            staff: 'lower',
            clef: 'bass',
            notes: [
              { pitch: 'B3', length: '1/4' },
              { pitch: 'C4', length: '1/4' },
              { pitch: 'D4', length: '1/4' },
              { pitch: 'A3', length: '1/4' },
              { pitch: 'G3', length: '1/2' },
              { length: '1/2' },
            ],
          },
          {
            id: 'bass',
            staff: 'lower',
            notes: [
              { pitch: 'G2', length: '1/4' },
              { pitch: 'C3', length: '1/4' },
              { pitch: 'D3', length: '1/4' },
              { pitch: 'F#3', length: '1/4' },
              { pitch: 'G2', length: '1/2' },
              { length: '1/2' },
            ],
          },
        ],
        staffGroups: [
          { type: 'brace', voiceIds: ['soprano', 'alto', 'tenor', 'bass'] },
        ],
      },
    },
    {
      name: 'tuplets-dynamics-hairpin',
      width: 600,
      song: {
        timeSignature: [4, 4],
        notes: [
          { dynamic: 'p' },
          { tuplet: [3, 2], notes: [
            { pitch: 'C4', length: '1/8' },
            { pitch: 'D4', length: '1/8' },
            { pitch: 'E4', length: '1/8' },
          ] },
          { hairpin: 'crescendo', start: true },
          { pitch: 'F4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { hairpin: 'crescendo', stop: true },
          { dynamic: 'f' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'C4', length: '1/2' },
        ],
      },
    },
    {
      name: 'sixteenth-sweep-tight',
      width: 500,
      song: {
        timeSignature: [2, 4],
        notes: Array.from({ length: 24 }, (_, i) => ({
          pitch: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'][i % 6],
          length: '1/16',
        })),
      },
    },
    {
      name: 'wide-ragged-final',
      width: 1200,
      song: {
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/2' },
          { pitch: 'E4', length: '1/2' },
          { pitch: 'G4', length: '1/1' },
        ],
      },
    },
    {
      name: 'amazing-grace-lyrics-stripped',
      width: 800,
      song: stripLyrics(amazingGrace),
    },
  ];
}
