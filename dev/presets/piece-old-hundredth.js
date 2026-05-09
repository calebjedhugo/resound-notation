/**
 * "Old Hundredth" / "Doxology" — Louis Bourgeois, 1551. Public domain.
 *
 * Hymn-tune setting on grand staff. SATB simplified to two voices: the
 * treble carries soprano, the bass carries the bass line. (No lyrics —
 * resound-notation only supports a single lyric string per note, and hymn
 * use cases need stanza-by-stanza which isn't expressible.)
 *
 * Opening 4 bars ("Praise God from whom all blessings flow").
 */
export default {
  name: 'Old Hundredth',
  group: 'piece',
  description: 'Doxology opening — grand staff (S+B)',
  song: {
    timeSignature: [4, 4],
    keySignature: 'G',
    voices: [
      {
        id: 's',
        clef: 'treble',
        notes: [
          // "Praise God from whom all bless-ings flow"
          { pitch: 'G4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'D4', length: '1/2' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'G4', length: '1/1' },
        ],
      },
      {
        id: 'b',
        clef: 'bass',
        notes: [
          { pitch: 'G3', length: '1/4' },
          { pitch: 'E3', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'D3', length: '1/4' },
          { pitch: 'C3', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'D3', length: '1/2' },
          { pitch: 'G3', length: '1/4' },
          { pitch: 'D3', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'D3', length: '1/4' },
          { pitch: 'G2', length: '1/1' },
        ],
      },
    ],
    staffGroups: [{ type: 'brace', voiceIds: ['s', 'b'] }],
  },
};
