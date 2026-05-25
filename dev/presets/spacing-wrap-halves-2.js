// Wrap-spacing test: 2 half notes filling one 4/4 bar. Minimum-content
// case — surfaces "huge empty gap after the last note" defects when
// the natural duration-extent of the last note isn't compressed.
export default {
  name: 'spacing-wrap-halves-2',
  group: 'api',
  description: '2 half notes in 4/4. Surfaces unsounding-tail spacing.',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'v1',
        clef: 'treble',
        notes: [
          { pitch: 'C5', length: '1/2' },
          { pitch: 'G4', length: '1/2' },
        ],
      },
    ],
  },
};
