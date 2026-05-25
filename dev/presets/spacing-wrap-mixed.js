// Wrap-spacing test: mixed rhythm (halves + quarters). Tests
// proportional stretch with non-uniform natural inter-note widths.
// Surfaces the "half-note gap is disproportionate" defect.
export default {
  name: 'spacing-wrap-mixed',
  group: 'api',
  description: 'Mixed halves and quarters. Probes proportional stretch across non-uniform durations.',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        notes: [
          { pitch: 'C4', length: '1/2' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'C5', length: '1/2' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      },
    ],
  },
};
