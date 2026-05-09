export default {
  name: 'ledger-lines-extreme',
  group: 'api',
  description: 'extreme high and low pitches — many ledger lines',
  song: {
    voices: [
      {
        id: 'high',
        clef: 'treble',
        notes: [
          { pitch: 'A5', length: '1/4' },
          { pitch: 'C6', length: '1/4' },
          { pitch: 'E6', length: '1/4' },
          { pitch: 'G6', length: '1/4' },
          { pitch: 'B6', length: '1/4' },
          { pitch: 'D7', length: '1/4' },
          { pitch: 'F7', length: '1/4' },
          { pitch: 'A7', length: '1/4' },
        ],
      },
      {
        id: 'low',
        clef: 'bass',
        notes: [
          { pitch: 'C3', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'F2', length: '1/4' },
          { pitch: 'D2', length: '1/4' },
          { pitch: 'B1', length: '1/4' },
          { pitch: 'G1', length: '1/4' },
          { pitch: 'E1', length: '1/4' },
          { pitch: 'C1', length: '1/4' },
        ],
      },
    ],
  },
};
