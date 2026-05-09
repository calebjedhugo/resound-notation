export default {
  name: 'articulations',
  group: 'api',
  description: 'staccato, staccatissimo, accent, marcato, tenuto, fermata',
  song: {
    clef: 'treble',
    timeSignature: [4, 4],
    notes: [
      { pitch: 'C5', length: '1/4', articulation: 'staccato' },
      { pitch: 'D5', length: '1/4', articulation: 'staccatissimo' },
      { pitch: 'E5', length: '1/4', articulation: 'accent' },
      { pitch: 'F5', length: '1/4', articulation: 'marcato' },
      { pitch: 'G5', length: '1/4', articulation: 'tenuto' },
      { pitch: 'A5', length: '1/4', articulation: 'fermata' },
      { pitch: 'B5', length: '1/4', articulation: ['accent', 'staccato'] },
      { pitch: 'C6', length: '1/4', articulation: ['marcato', 'tenuto'] },
    ],
  },
};
