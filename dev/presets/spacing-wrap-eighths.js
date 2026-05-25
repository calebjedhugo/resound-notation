// Wrap-spacing test: 8 beamed eighth notes. Tests denser content.
export default {
  name: 'spacing-wrap-eighths',
  group: 'api',
  description: '8 beamed eighths in 4/4. Probes dense-content wrap behavior.',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
          { pitch: 'B4', length: '1/8' },
          { pitch: 'C5', length: '1/8' },
        ],
      },
    ],
  },
};
