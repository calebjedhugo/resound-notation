export default {
  name: 'grand-staff-brace',
  group: 'api',
  description: 'Grand staff with curly brace + shared barlines',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'rh',
        clef: 'treble',
        notes: [
          { pitch: 'C5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'C6', length: '1/4' },
        ],
      },
      {
        id: 'lh',
        clef: 'bass',
        notes: [
          { pitch: 'C3', length: '1/2' },
          { pitch: 'G2', length: '1/2' },
        ],
      },
    ],
    staffGroups: [{ type: 'brace', voiceIds: ['rh', 'lh'] }],
  },
};
