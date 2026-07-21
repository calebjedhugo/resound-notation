/**
 * Close-score SATB hymn — two voices per staff (SPEC-multi-voice-staff.md).
 *
 * Loosely after the Doxology ("Old Hundredth") opening, arranged to
 * demonstrate the shared-staff feature set:
 *   - soprano+alto share the upper (treble) staff, tenor+bass the lower
 *     (bass) staff — the layout every hymnal uses;
 *   - forced stems: soprano/tenor up, alto/bass down;
 *   - a second-interval collision (bar 1 beat 4: soprano D4 over alto C4)
 *     shifting the alto head right;
 *   - a shared rest (all voices rest on bar 2 beat 4 → one centered rest
 *     per staff);
 *   - lyrics on the soprano (landing between the staves, the traditional
 *     close-score spot).
 */
export default {
  name: 'Close Score Hymn',
  group: 'piece',
  description: 'SATB close score — two voices per staff (S+A treble, T+B bass)',
  song: {
    timeSignature: [4, 4],
    keySignature: 'G',
    voices: [
      {
        id: 'soprano',
        staff: 'upper',
        clef: 'treble',
        notes: [
          { pitch: 'G4', length: '1/4', lyric: 'Praise' },
          { pitch: 'G4', length: '1/4', lyric: 'God' },
          { pitch: 'G4', length: '1/4', lyric: 'from' },
          { pitch: 'D4', length: '1/4', lyric: 'whom' },
          { pitch: 'E4', length: '1/4', lyric: 'all' },
          { pitch: 'E4', length: '1/4', lyric: 'bless-' },
          { pitch: 'D4', length: '1/4', lyric: 'ings' },
          { length: '1/4' },
          { pitch: 'B4', length: '1/4', lyric: 'Praise' },
          { pitch: 'B4', length: '1/4', lyric: 'Him' },
          { pitch: 'A4', length: '1/4', lyric: 'all' },
          { pitch: 'A4', length: '1/4', lyric: 'crea-' },
          { pitch: 'G4', length: '1/2', dotted: true, lyric: 'tures' },
          { length: '1/4' },
        ],
      },
      {
        id: 'alto',
        staff: 'upper',
        clef: 'treble',
        notes: [
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'C4', length: '1/4' }, // 2nd below soprano D4 → collision shift
          { pitch: 'C4', length: '1/4' },
          { pitch: 'C4', length: '1/4' },
          { pitch: 'B3', length: '1/4' },
          { length: '1/4' }, // same beat+duration as soprano rest → ONE centered rest
          { pitch: 'D4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'F#4', length: '1/4' },
          { pitch: 'F#4', length: '1/4' },
          { pitch: 'B3', length: '1/2', dotted: true },
          { length: '1/4' },
        ],
      },
      {
        id: 'tenor',
        staff: 'lower',
        clef: 'bass',
        notes: [
          { pitch: 'B3', length: '1/4' },
          { pitch: 'B3', length: '1/4' },
          { pitch: 'B3', length: '1/4' },
          { pitch: 'A3', length: '1/4' },
          { pitch: 'G3', length: '1/4' },
          { pitch: 'A3', length: '1/4' },
          { pitch: 'G3', length: '1/4' },
          { length: '1/4' },
          { pitch: 'B3', length: '1/4' },
          { pitch: 'B3', length: '1/4' },
          { pitch: 'A3', length: '1/4' },
          { pitch: 'A3', length: '1/4' },
          { pitch: 'B3', length: '1/2', dotted: true },
          { length: '1/4' },
        ],
      },
      {
        id: 'bass',
        staff: 'lower',
        clef: 'bass',
        notes: [
          { pitch: 'G2', length: '1/4' },
          { pitch: 'G2', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'D3', length: '1/4' },
          { pitch: 'C3', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'G2', length: '1/4' },
          { length: '1/4' },
          { pitch: 'G3', length: '1/4' },
          { pitch: 'E3', length: '1/4' },
          { pitch: 'D3', length: '1/4' },
          { pitch: 'D3', length: '1/4' },
          { pitch: 'G2', length: '1/2', dotted: true },
          { length: '1/4' },
        ],
      },
    ],
    staffGroups: [
      { type: 'brace', voiceIds: ['soprano', 'alto', 'tenor', 'bass'] },
    ],
  },
};
