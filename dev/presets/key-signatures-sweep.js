export default {
  name: 'key-signatures-sweep',
  group: 'api',
  description: 'Cycle through several keys (each voice = different key)',
  song: {
    voices: [
      {
        id: 'C',
        clef: 'treble',
        keySignature: 'C',
        notes: [{ pitch: 'C5', length: '1/2' }, { pitch: 'E5', length: '1/2' }],
      },
      {
        id: 'G',
        clef: 'treble',
        keySignature: 'G',
        notes: [{ pitch: 'G5', length: '1/2' }, { pitch: 'B5', length: '1/2' }],
      },
      {
        id: 'D',
        clef: 'treble',
        keySignature: 'D',
        notes: [{ pitch: 'D5', length: '1/2' }, { pitch: 'F#5', length: '1/2' }],
      },
      {
        id: 'F',
        clef: 'treble',
        keySignature: 'F',
        notes: [{ pitch: 'F5', length: '1/2' }, { pitch: 'A5', length: '1/2' }],
      },
      {
        id: 'Bb',
        clef: 'treble',
        keySignature: 'Bb',
        notes: [{ pitch: 'Bb4', length: '1/2' }, { pitch: 'D5', length: '1/2' }],
      },
      {
        id: 'Eb',
        clef: 'treble',
        keySignature: 'Eb',
        notes: [{ pitch: 'Eb5', length: '1/2' }, { pitch: 'G5', length: '1/2' }],
      },
    ],
  },
};
