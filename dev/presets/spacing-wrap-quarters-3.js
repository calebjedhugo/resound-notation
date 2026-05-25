// Wrap-spacing test: 3 quarter notes in 4/4. Sparse content — last
// quarter sits at beat 2; tests how the unsounding tail (beat 3 → bar
// end) is treated.
export default {
  name: 'spacing-wrap-quarters-3',
  group: 'api',
  description: '3 quarters in 4/4. Sparse content with an unsounding tail.',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        notes: [
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
        ],
      },
    ],
  },
};
