export default {
  name: 'percussion',
  group: 'api',
  description: 'X-noteheads at staff positions 1-9 (kick, snare, hat, ride)',
  song: {
    clef: 'percussion',
    timeSignature: [4, 4],
    notes: [
      { position: 5, length: '1/8' }, // hi-hat
      { position: 5, length: '1/8' },
      { position: 3, length: '1/8' }, // snare
      { position: 5, length: '1/8' },
      { position: 1, length: '1/8' }, // kick
      { position: 5, length: '1/8' },
      { position: 3, length: '1/8' },
      { position: 5, length: '1/8' },
      { position: 9, length: '1/4' }, // ride
      { position: 7, length: '1/4' }, // crash
      { position: 1, length: '1/4' },
      { position: 3, length: '1/4' },
    ],
  },
};
