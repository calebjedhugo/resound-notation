export default {
  name: 'ledger-lines-extreme',
  group: 'api',
  description:
    'Maximum in-range ledger lines without triggering 8va/8vb — the limit case. '
    + 'Treble spans E3 (MIDI 52, lowest pre-8vb) to F6 (MIDI 89, highest pre-8va). '
    + 'Bass spans G1 (MIDI 31, lowest pre-8vb on bass) to A4 (one octave above the top staff line A3).',
  song: {
    voices: [
      {
        id: 'high',
        clef: 'treble',
        notes: [
          // Climb from the 8vb in-range edge up to the 8va in-range edge.
          // No pitch crosses into either trigger zone (≥ G6 / ≤ D3).
          { pitch: 'E3', length: '1/4' },
          { pitch: 'A3', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
          { pitch: 'B5', length: '1/4' },
          { pitch: 'F6', length: '1/4' },
        ],
      },
      {
        id: 'low',
        clef: 'bass',
        notes: [
          // Climb from the bass 8vb in-range edge (G1) up to A4 — one
          // octave above the top staff line (A3). No pitch crosses the
          // bass 8vb trigger zone (≤ F1).
          { pitch: 'G1', length: '1/4' },
          { pitch: 'C2', length: '1/4' },
          { pitch: 'F2', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'E3', length: '1/4' },
          { pitch: 'A3', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
        ],
      },
    ],
  },
};
