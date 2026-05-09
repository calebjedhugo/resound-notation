export default {
  name: 'staff-bracket',
  group: 'api',
  description: 'Three-staff ensemble grouped with a square bracket',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'vln1',
        clef: 'treble',
        notes: [
          { pitch: 'G5', length: '1/4' },
          { pitch: 'A5', length: '1/4' },
          { pitch: 'B5', length: '1/4' },
          { pitch: 'C6', length: '1/4' },
        ],
      },
      {
        id: 'vln2',
        clef: 'treble',
        notes: [
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
        ],
      },
      {
        id: 'vc',
        clef: 'bass',
        notes: [
          { pitch: 'C3', length: '1/2' },
          { pitch: 'G3', length: '1/2' },
        ],
      },
    ],
    staffGroups: [{ type: 'bracket', voiceIds: ['vln1', 'vln2', 'vc'] }],
  },
};
