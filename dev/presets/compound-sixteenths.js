/**
 * Dotted-eighth + sixteenth figures in 6/8 — the Greensleeves rhythm.
 *
 * Repro for the fractional-beam defect seen in singHarmony2's "What Child
 * Is This?": the sixteenth's partial (fractional) beam must hug the primary
 * beam, one beam-separation below it, on the sixteenth's side of the group.
 */
export default {
  name: 'compound-sixteenths',
  group: 'regression',
  description: '6/8 dotted-8th+16th beam groups (Greensleeves rhythm)',
  song: {
    timeSignature: [6, 8],
    keySignature: 'G',
    pickupBeats: 0.5,
    voices: [
      {
        id: 'melody',
        clef: 'treble',
        notes: [
          { pitch: 'E4', length: '1/8' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/8' },
          { pitch: 'B4', length: '1/8', dotted: true },
          { pitch: 'C5', length: '1/16' },
          { pitch: 'B4', length: '1/8' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'F#4', length: '1/8' },
          { pitch: 'D4', length: '1/8', dotted: true },
          { pitch: 'E4', length: '1/16' },
          { pitch: 'F#4', length: '1/8' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'E4', length: '1/8', dotted: true },
          { pitch: 'D#4', length: '1/16' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F#4', length: '1/4' },
          { pitch: 'D#4', length: '1/8' },
          { pitch: 'B3', length: '1/4', dotted: true },
        ],
      },
    ],
  },
};
