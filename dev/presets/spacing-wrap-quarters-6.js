// Wrap-spacing test: 6 quarter notes in 4/4. Tests a different wrap
// balance — 4 in wrapped system, 2 in final system.
export default {
  name: 'spacing-wrap-quarters-6',
  group: 'api',
  description: '6 quarters in 4/4. Narrow widths wrap 4+2.',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        notes: [
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
        ],
      },
    ],
  },
};
