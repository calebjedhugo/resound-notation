/**
 * J.S. Bach — Two-Part Invention No. 1 in C major, BWV 772, opening 4 bars.
 * Public domain.
 *
 * Tests two-voice independent counterpoint. The two voices are notated on
 * separate treble staves (rather than a grand staff) since both lines sit
 * largely above middle C.
 */
export default {
  name: 'Bach Invention 1',
  group: 'piece',
  description: 'BWV 772 opening 4 bars — two-voice counterpoint',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'soprano',
        clef: 'treble',
        notes: [
          // m1: subject in C
          { pitch: 'C5', length: '1/16' },
          { pitch: 'D5', length: '1/16' },
          { pitch: 'E5', length: '1/16' },
          { pitch: 'F5', length: '1/16' },
          { pitch: 'D5', length: '1/16' },
          { pitch: 'E5', length: '1/16' },
          { pitch: 'C5', length: '1/16' },
          { length: '1/16' },
          { pitch: 'G5', length: '1/8' },
          { pitch: 'C5', length: '1/8' },
          { pitch: 'E5', length: '1/8' },
          { pitch: 'G5', length: '1/8' },
          // m2
          { pitch: 'D5', length: '1/16' },
          { pitch: 'E5', length: '1/16' },
          { pitch: 'F5', length: '1/16' },
          { pitch: 'G5', length: '1/16' },
          { pitch: 'E5', length: '1/16' },
          { pitch: 'F5', length: '1/16' },
          { pitch: 'D5', length: '1/16' },
          { length: '1/16' },
          { pitch: 'A5', length: '1/8' },
          { pitch: 'D5', length: '1/8' },
          { pitch: 'F5', length: '1/8' },
          { pitch: 'A5', length: '1/8' },
        ],
      },
      {
        id: 'alto',
        clef: 'treble',
        notes: [
          // m1: rest then countersubject entry on beat 3
          { length: '1/2' },
          { pitch: 'C4', length: '1/16' },
          { pitch: 'D4', length: '1/16' },
          { pitch: 'E4', length: '1/16' },
          { pitch: 'F4', length: '1/16' },
          { pitch: 'D4', length: '1/16' },
          { pitch: 'E4', length: '1/16' },
          { pitch: 'C4', length: '1/16' },
          { length: '1/16' },
          // m2
          { pitch: 'G4', length: '1/8' },
          { pitch: 'C4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'D4', length: '1/16' },
          { pitch: 'E4', length: '1/16' },
          { pitch: 'F4', length: '1/16' },
          { pitch: 'G4', length: '1/16' },
          { pitch: 'E4', length: '1/16' },
          { pitch: 'F4', length: '1/16' },
          { pitch: 'D4', length: '1/16' },
          { length: '1/16' },
        ],
      },
    ],
  },
};
