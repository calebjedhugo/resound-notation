export default {
  name: 'tuplets',
  group: 'api',
  description: 'triplets, quintuplet, sextuplet',
  song: {
    clef: 'treble',
    timeSignature: [4, 4],
    notes: [
      {
        tuplet: [3, 2],
        notes: [
          { pitch: 'C5', length: '1/8' },
          { pitch: 'D5', length: '1/8' },
          { pitch: 'E5', length: '1/8' },
        ],
      },
      {
        tuplet: [3, 2],
        notes: [
          { pitch: 'F5', length: '1/8' },
          { pitch: 'G5', length: '1/8' },
          { pitch: 'A5', length: '1/8' },
        ],
      },
      {
        tuplet: [5, 4],
        notes: [
          { pitch: 'C5', length: '1/16' },
          { pitch: 'D5', length: '1/16' },
          { pitch: 'E5', length: '1/16' },
          { pitch: 'F5', length: '1/16' },
          { pitch: 'G5', length: '1/16' },
        ],
      },
      {
        tuplet: [6, 4],
        notes: [
          { pitch: 'A5', length: '1/16' },
          { pitch: 'G5', length: '1/16' },
          { pitch: 'F5', length: '1/16' },
          { pitch: 'E5', length: '1/16' },
          { pitch: 'D5', length: '1/16' },
          { pitch: 'C5', length: '1/16' },
        ],
      },
    ],
  },
};
