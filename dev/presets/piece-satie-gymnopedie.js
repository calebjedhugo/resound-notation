/**
 * Erik Satie — Gymnopédie No. 1 (1888), opening 4 bars. Public domain.
 *
 * Tests grand staff + dynamics. Original is in 3/4 with a "Lent et
 * douloureux" tempo marking (we render the tempo marker), pp dynamic
 * marking on the treble.
 *
 * The piece's signature pattern: LH alternates root (D2 / A2) and chord
 * (a-c#-e). RH plays a soaring melody starting only on m5 — the opening 4
 * bars are LH only. We include 2 bars of LH intro + 2 bars where the RH
 * starts its melodic phrase.
 */
export default {
  name: 'Satie Gymnopédie 1',
  group: 'piece',
  description: 'opening 4 bars — grand staff with tempo + dynamic',
  song: {
    timeSignature: [3, 4],
    keySignature: 'D', // 2 sharps (G major / D mixolydian context)
    voices: [
      {
        id: 'rh',
        clef: 'treble',
        notes: [
          { tempo: { text: 'Lent et douloureux' } },
          { dynamic: 'pp' },
          // m1, m2 rest while LH establishes vamp
          { length: '1/4' },
          { length: '1/4' },
          { length: '1/4' },
          { length: '1/4' },
          { length: '1/4' },
          { length: '1/4' },
          // m3: melody enters — F# half note then quarter
          { pitch: 'F#5', length: '1/2' },
          { pitch: 'E5', length: '1/4' },
          // m4
          { pitch: 'D5', length: '1/2', dotted: true },
        ],
      },
      {
        id: 'lh',
        clef: 'bass',
        notes: [
          // signature LH vamp: low D / chord / chord
          { pitch: 'D2', length: '1/4' },
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          { pitch: 'A2', length: '1/4' },
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          { pitch: 'D2', length: '1/4' },
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          { pitch: 'A2', length: '1/4' },
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          [
            { pitch: 'A3', length: '1/4' },
            { pitch: 'C#4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
        ],
      },
    ],
    staffGroups: [{ type: 'brace', voiceIds: ['rh', 'lh'] }],
  },
};
