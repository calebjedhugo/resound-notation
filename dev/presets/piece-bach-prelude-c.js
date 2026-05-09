/**
 * J.S. Bach — Prelude in C major, BWV 846 (WTC Book I), opening 2 bars
 * (simplified). Public domain.
 *
 * Each measure is an arpeggio pattern played as 16 sixteenth notes (the
 * 8-note figure repeated). We notate two voices on a grand staff: the
 * arpeggios on treble, sustained roots on bass.
 */
export default {
  name: 'Bach Prelude in C',
  group: 'piece',
  description: 'BWV 846 opening 2 bars — arpeggio on grand staff',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'rh',
        clef: 'treble',
        notes: [
          // m1: pattern is C E G C E G C E G C E G C E G C (16 sixteenths)
          // Bach repeats the 8-figure: [E4 G4 C5 E5] x2 then again, etc.
          // Simplified arpeggio: E4 G4 C5 E5 (×4)
          ...arp(['E4', 'G4', 'C5', 'E5']),
          ...arp(['E4', 'G4', 'C5', 'E5']),
          ...arp(['E4', 'G4', 'C5', 'E5']),
          ...arp(['E4', 'G4', 'C5', 'E5']),
          // m2: D7 figure — D F A D
          ...arp(['D4', 'A4', 'D5', 'F5']),
          ...arp(['D4', 'A4', 'D5', 'F5']),
          ...arp(['D4', 'A4', 'D5', 'F5']),
          ...arp(['D4', 'A4', 'D5', 'F5']),
        ],
      },
      {
        id: 'lh',
        clef: 'bass',
        notes: [
          // m1: C pedal
          { pitch: 'C3', length: '1/1' },
          // m2: C-D foundation
          { pitch: 'C3', length: '1/1' },
        ],
      },
    ],
    staffGroups: [{ type: 'brace', voiceIds: ['rh', 'lh'] }],
  },
};

function arp(pitches) {
  return pitches.map((p) => ({ pitch: p, length: '1/16' }));
}
