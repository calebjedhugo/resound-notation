/**
 * Twinkle Twinkle Little Star — opening 8 bars (single voice, treble).
 * Public domain. Simple test case to eyeball obvious bugs.
 */
export default {
  name: 'Twinkle Twinkle',
  group: 'piece',
  description: 'opening 8 bars, treble, C major',
  song: {
    clef: 'treble',
    keySignature: 'C',
    timeSignature: [4, 4],
    notes: [
      // "Twinkle twinkle little star"
      { pitch: 'C4', length: '1/4' },
      { pitch: 'C4', length: '1/4' },
      { pitch: 'G4', length: '1/4' },
      { pitch: 'G4', length: '1/4' },
      { pitch: 'A4', length: '1/4' },
      { pitch: 'A4', length: '1/4' },
      { pitch: 'G4', length: '1/2' },
      // "How I wonder what you are"
      { pitch: 'F4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'C4', length: '1/2' },
      // "Up above the world so high"
      { pitch: 'G4', length: '1/4' },
      { pitch: 'G4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'D4', length: '1/2' },
      // "Like a diamond in the sky"
      { pitch: 'G4', length: '1/4' },
      { pitch: 'G4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'F4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'E4', length: '1/4' },
      { pitch: 'D4', length: '1/2' },
    ],
  },
};
