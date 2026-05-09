export default {
  name: 'grace-notes',
  group: 'api',
  description: 'acciaccatura (slashed) and appoggiatura (no slash)',
  song: {
    clef: 'treble',
    timeSignature: [4, 4],
    notes: [
      { pitch: 'D5', length: '1/4', grace: { pitch: 'C5', type: 'acciaccatura' } },
      { pitch: 'F5', length: '1/4', grace: { pitch: 'E5', type: 'appoggiatura' } },
      {
        pitch: 'A5',
        length: '1/4',
        grace: [
          { pitch: 'F5', type: 'acciaccatura' },
          { pitch: 'G5', type: 'acciaccatura' },
        ],
      },
      { pitch: 'B5', length: '1/4', grace: { pitch: 'C#5', type: 'acciaccatura' } },
    ],
  },
};
