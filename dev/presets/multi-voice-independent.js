export default {
  name: 'multi-voice-independent',
  group: 'api',
  description: 'Two independent staves (no brace), both treble',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'soprano',
        clef: 'treble',
        notes: [
          { pitch: 'E5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'E5', length: '1/2' },
        ],
      },
      {
        id: 'alto',
        clef: 'treble',
        notes: [
          { pitch: 'C5', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'C5', length: '1/2' },
        ],
      },
    ],
  },
};
