// Wrap-spacing test: 8 quarter notes in 4/4. Narrow widths force a
// mid-measure wrap after 4 quarters. Inter-note gaps should be uniform
// and the last note in the wrapped system should have a clear but
// modest gap before the closing thin barline.
export default {
  name: 'spacing-wrap-quarters-8',
  group: 'api',
  description: '8 quarters in 4/4. Narrow widths force a mid-measure wrap.',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
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
