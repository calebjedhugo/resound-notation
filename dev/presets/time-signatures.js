export default {
  name: 'time-signatures',
  group: 'api',
  description: '4/4, 3/4, 6/8, and unmetered',
  song: {
    voices: [
      {
        id: '4-4',
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
        ],
      },
      {
        id: '3-4',
        clef: 'treble',
        timeSignature: [3, 4],
        notes: [
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'A5', length: '1/4' },
        ],
      },
      {
        id: '6-8',
        clef: 'treble',
        timeSignature: [6, 8],
        notes: [
          { pitch: 'C5', length: '1/8' },
          { pitch: 'D5', length: '1/8' },
          { pitch: 'E5', length: '1/8' },
          { pitch: 'F5', length: '1/8' },
          { pitch: 'G5', length: '1/8' },
          { pitch: 'A5', length: '1/8' },
        ],
      },
      {
        id: 'unmetered',
        clef: 'treble',
        notes: [
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/8' },
          { pitch: 'E5', length: '1/8' },
          { pitch: 'F5', length: '1/4' },
          { pitch: 'G5', length: '1/2' },
        ],
      },
    ],
  },
};
