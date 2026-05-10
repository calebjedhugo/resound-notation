// Ottava algorithm showcase. Each bar exercises a different case from
// OTTAVA-DESIGN.md; comments below cite the relevant fragment / rule.
//
// Treble voice (top staff) renders three brackets:
//   * 8va over bars 1-3 (clean run + 2-note dip stay + dip-exit closure)
//   * 8va over bars 7-8 (context-pull C6 G6 B5 C6 G6, with a spanned rest)
//   * 8vb over bar 10 (treble going low into D3- territory)
// Bar 4 is intentionally mid-staff to reset the analyzer to OUT.
// Bar 5 places an isolated G6 surrounded by mid-staff notes — the
//   single-note suppression rule (§3.1.2) drops the segment.
// Bar 6 is the continuation of the 3-note dip that closes the suppressed
//   single-note segment, plus more mid-staff filler.
// Bar 9 is descending mid-staff to set up the treble 8vb in bar 10.
//
// Bass voice (bottom staff) renders one bracket:
//   * 8vb over bar 10 — uses the new bass-clef thresholds (trigger = F1,
//     in-range edge = G1). Bars 1-9 stay comfortably in-staff.
//
// No explicit barlines are placed; the renderer auto-bars by timeSignature.

export default {
  name: 'ottava-showcase',
  group: 'api',
  description:
    'Showcase of the 8va/8vb segmentation algorithm — clean runs, dip stays, '
    + 'dip exits, context-pull, single-note suppression, rest spanning, treble '
    + '8vb, and bass-clef 8vb (new in this iteration).',
  song: {
    timeSignature: [4, 4],
    keySignature: 'C',
    voices: [
      {
        id: 'treble',
        clef: 'treble',
        notes: [
          // Bar 1 — Fragment 1: clean 8va run
          { pitch: 'G6', length: '1/4' },
          { pitch: 'A6', length: '1/4' },
          { pitch: 'B6', length: '1/4' },
          { pitch: 'C7', length: '1/4' },
          // Bar 2 — Fragment 2: 2-note dip mid-segment, stays in 8va
          { pitch: 'D7', length: '1/4' },
          { pitch: 'F6', length: '1/4' },
          { pitch: 'E6', length: '1/4' },
          { pitch: 'G6', length: '1/4' },
          // Bar 3 — Fragment 3: 3-note dip-exit closes the first segment
          { pitch: 'A6', length: '1/4' },
          { pitch: 'F6', length: '1/4' },
          { pitch: 'E6', length: '1/4' },
          { pitch: 'D6', length: '1/4' },
          // Bar 4 — mid-staff: analyzer fully back to OUT
          { pitch: 'C5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          // Bar 5 — Fragment 4 setup: isolated G6 amid mid-staff neighbors
          { pitch: 'C5', length: '1/4' },
          { pitch: 'G6', length: '1/4' }, // SUPPRESSED — single-note rule §3.1.2
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          // Bar 6 — completes the 3-note dip that suppressed the G6 above,
          // then more mid-staff filler
          { pitch: 'F5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          // Bar 7 — Fragment 5: context-pull C6 G6 B5 C6 ...
          { pitch: 'C6', length: '1/4' },
          { pitch: 'G6', length: '1/4' },
          { pitch: 'B5', length: '1/4' },
          { pitch: 'C6', length: '1/4' },
          // Bar 8 — ... G6 (rest) A6 B6 — Fragment 6 rest-spanning here too
          { pitch: 'G6', length: '1/4' },
          { length: '1/4' }, // rest inside the 8va span
          { pitch: 'A6', length: '1/4' },
          { pitch: 'B6', length: '1/4' },
          // Bar 9 — descent to set up 8vb
          { pitch: 'A5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          // Bar 10 — Fragment 7: treble 8vb (D3 and lower)
          { pitch: 'D3', length: '1/4' },
          { pitch: 'C3', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
        ],
      },
      {
        id: 'bass',
        clef: 'bass',
        notes: [
          // Bars 1-9: comfortable bass-clef pitches. The mid-staff filler
          // keeps the analyzer's 8vb context-pull from grabbing these notes
          // when bar 10 triggers — bar 9 stays at G2 or above (>= MIDI 43,
          // outside the "within 12 of bass trigger F1" near-trigger window).
          { pitch: 'G2', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'C3', length: '1/4' },

          { pitch: 'D3', length: '1/4' },
          { pitch: 'C3', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'A2', length: '1/4' },

          { pitch: 'G2', length: '1/4' },
          { pitch: 'F2', length: '1/4' },
          { pitch: 'E2', length: '1/4' },
          { pitch: 'D2', length: '1/4' },

          { pitch: 'C2', length: '1/4' },
          { pitch: 'D2', length: '1/4' },
          { pitch: 'E2', length: '1/4' },
          { pitch: 'F2', length: '1/4' },

          { pitch: 'G2', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'C3', length: '1/4' },

          { pitch: 'D3', length: '1/4' },
          { pitch: 'C3', length: '1/4' },
          { pitch: 'B2', length: '1/4' },
          { pitch: 'A2', length: '1/4' },

          { pitch: 'G2', length: '1/4' },
          { pitch: 'F2', length: '1/4' },
          { pitch: 'E2', length: '1/4' },
          { pitch: 'D2', length: '1/4' },

          { pitch: 'C2', length: '1/4' },
          { pitch: 'D2', length: '1/4' },
          { pitch: 'E2', length: '1/4' },
          { pitch: 'F2', length: '1/4' },

          // Bar 9: stay >= G2 so CP-2 absorb doesn't pull these into the
          // bar-10 bass 8vb bracket (G2=43 > F1+12=41).
          { pitch: 'A2', length: '1/4' },
          { pitch: 'G2', length: '1/4' },
          { pitch: 'A2', length: '1/4' },
          { pitch: 'B2', length: '1/4' },

          // Bar 10 — bass-clef 8vb: F1 is the trigger (new per-clef
          // threshold; see OTTAVA-DESIGN.md §2 + §3.1.4).
          { pitch: 'F1', length: '1/4' },
          { pitch: 'E1', length: '1/4' },
          { pitch: 'D1', length: '1/4' },
          { pitch: 'C1', length: '1/4' },
        ],
      },
    ],
  },
};
