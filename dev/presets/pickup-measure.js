/**
 * Pickup (anacrusis) measure — SPEC-pickup-and-barline-lyrics.md JOB B.
 *
 * "America the Beautiful" opening phrase (Samuel A. Ward, 1882. Public
 * domain): a 4/4 hymn phrase whose 1-beat pickup carries the first
 * syllable. Measure 0 spans beats [0, 1); the first barline lands right
 * after the pickup note; later boundaries sit at 1 + 4k. Lyrics included
 * so the barline↔syllable clearance (JOB A) shows on the same preset.
 */
export default {
  name: 'Pickup measure',
  group: 'api',
  description: '1-beat anacrusis: short measure 0, shifted barline grid, lyrics',
  song: {
    timeSignature: [4, 4],
    keySignature: 'Bb',
    pickupBeats: 1,
    notes: [
      { pitch: 'F4', length: '1/4', lyric: 'O' }, // pickup
      { pitch: 'F4', length: '1/4', dotted: true, lyric: 'beau-' },
      { pitch: 'D4', length: '1/8', lyric: 'ti-' },
      { pitch: 'D4', length: '1/4', lyric: 'ful' },
      { pitch: 'F4', length: '1/4', lyric: 'for' },
      { pitch: 'F4', length: '1/4', dotted: true, lyric: 'spa-' },
      { pitch: 'C4', length: '1/8', lyric: 'cious' },
      { pitch: 'C4', length: '1/4', lyric: 'skies,' },
      { pitch: 'D4', length: '1/4', lyric: 'For' },
      { pitch: 'Eb4', length: '1/4', lyric: 'am-' },
      { pitch: 'F4', length: '1/4', lyric: 'ber' },
      { pitch: 'G4', length: '1/4', lyric: 'waves' },
      { pitch: 'A4', length: '1/4', lyric: 'of' },
      { pitch: 'F4', length: '1/2', dotted: true, lyric: 'grain,' },
    ],
  },
};
