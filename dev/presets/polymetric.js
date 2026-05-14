export default {
  name: 'polymetric',
  group: 'api',
  description: 'Three voices with different time signatures (4/4, 3/4, 6/8). First notes should align on a shared music-start gridline.',
  song: {
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
        ],
      },
      {
        id: 'v2',
        clef: 'treble',
        timeSignature: [3, 4],
        notes: [
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
        ],
      },
      {
        id: 'v3',
        clef: 'treble',
        timeSignature: [6, 8],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
        ],
      },
    ],
  },
};
