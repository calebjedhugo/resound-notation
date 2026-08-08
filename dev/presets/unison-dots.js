/**
 * Dotted unisons on a shared staff — repro for the dot-collision defect.
 *
 * When soprano and alto sound the same pitch, the second voice's notehead
 * was covering the first voice's augmentation dot. Cases:
 *   bar 1: both voices dotted-half unison (space note, then line note);
 *   bar 2: soprano dotted-half against alto half+quarter (unequal values);
 *   bar 3: alto dotted against plain soprano, then a plain unison control.
 */
export default {
  name: 'unison-dots',
  group: 'regression',
  description: 'Dotted S/A unisons on one staff: dots must clear both heads',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'soprano',
        staff: 'upper',
        clef: 'treble',
        notes: [
          { pitch: 'A4', length: '1/2', dotted: true }, // space unison, both dotted
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/2', dotted: true }, // line unison, both dotted
          { pitch: 'B4', length: '1/4' },
          { pitch: 'G4', length: '1/2', dotted: true }, // dotted over half+quarter
          { pitch: 'G4', length: '1/4' },
          { pitch: 'E4', length: '1/2' },               // plain over dotted
          { pitch: 'E4', length: '1/4', dotted: true },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'C5', length: '1/1' },               // plain unison control
        ],
      },
      {
        id: 'alto',
        staff: 'upper',
        clef: 'treble',
        notes: [
          { pitch: 'A4', length: '1/2', dotted: true },
          { pitch: 'F4', length: '1/4' },
          { pitch: 'B4', length: '1/2', dotted: true },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'G4', length: '1/2' },               // unequal: plain half under dotted half
          { pitch: 'G4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'E4', length: '1/2', dotted: true }, // alto dotted, soprano plain
          { pitch: 'F4', length: '1/4' },
          { pitch: 'C5', length: '1/1' },
        ],
      },
    ],
  },
};
