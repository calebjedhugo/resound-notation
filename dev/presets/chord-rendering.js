export default {
  name: 'chord-rendering',
  group: 'api',
  description: 'chord arrays — multiple stacked noteheads, shared stem',
  song: {
    clef: 'treble',
    timeSignature: [4, 4],
    notes: [
      [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ],
      [
        { pitch: 'D4', length: '1/4' },
        { pitch: 'F4', length: '1/4' },
        { pitch: 'A4', length: '1/4' },
      ],
      [
        { pitch: 'E4', length: '1/2' },
        { pitch: 'G4', length: '1/2' },
        { pitch: 'B4', length: '1/2' },
        { pitch: 'D5', length: '1/2' },
      ],
      [
        { pitch: 'C4', length: '1/2' },
        { pitch: 'E4', length: '1/2' },
        { pitch: 'G4', length: '1/2' },
        { pitch: 'C5', length: '1/2' },
      ],
    ],
  },
};
