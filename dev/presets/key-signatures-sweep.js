// Every standard major key signature: C, the 7 sharp keys, and the
// 7 flat keys. Each voice plays the tonic and mediant of its key so
// the first-note position can be eyeballed against the key-sig width.
const KEYS = [
  { key: 'C', tonic: 'C5', mediant: 'E5' },
  { key: 'G', tonic: 'G5', mediant: 'B5' },
  { key: 'D', tonic: 'D5', mediant: 'F#5' },
  { key: 'A', tonic: 'A4', mediant: 'C#5' },
  { key: 'E', tonic: 'E5', mediant: 'G#5' },
  { key: 'B', tonic: 'B4', mediant: 'D#5' },
  { key: 'F#', tonic: 'F#5', mediant: 'A#5' },
  { key: 'C#', tonic: 'C#5', mediant: 'E#5' },
  { key: 'F', tonic: 'F5', mediant: 'A5' },
  { key: 'Bb', tonic: 'Bb4', mediant: 'D5' },
  { key: 'Eb', tonic: 'Eb5', mediant: 'G5' },
  { key: 'Ab', tonic: 'Ab4', mediant: 'C5' },
  { key: 'Db', tonic: 'Db5', mediant: 'F5' },
  { key: 'Gb', tonic: 'Gb4', mediant: 'Bb4' },
  { key: 'Cb', tonic: 'Cb5', mediant: 'Eb5' },
];

export default {
  name: 'key-signatures-sweep',
  group: 'api',
  description: 'Every major key signature (C, 7 sharps, 7 flats)',
  song: {
    voices: KEYS.map(({ key, tonic, mediant }) => ({
      id: key,
      clef: 'treble',
      keySignature: key,
      notes: [
        { pitch: tonic, length: '1/2' },
        { pitch: mediant, length: '1/2' },
      ],
    })),
  },
};
