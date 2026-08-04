# SPEC: Two Voices per Staff (close score)

Status: **shipped** (unreleased; see CHANGELOG). Tests: `src/NotationRenderer.multiVoiceStaff.test.js`. Dev preset: `close-score-hymn`. Motivation: SATB hymn close score (soprano+alto on one
treble staff, tenor+bass on one bass staff) — the layout every hymnal uses.
Consumer: singHarmony2 (sing-harmony-beta.calebhugo.com).

## Data model

A Level-3 voice may declare an optional `staff` key. Voices with the same
`staff` value render on ONE shared staff:

```js
{
  timeSignature: [4, 4],
  keySignature: 'D',
  voices: [
    { id: 'soprano', staff: 'upper', clef: 'treble', notes: [...] },
    { id: 'alto',    staff: 'upper', clef: 'treble', notes: [...] },
    { id: 'tenor',   staff: 'lower', clef: 'bass',   notes: [...] },
    { id: 'bass',    staff: 'lower', clef: 'bass',   notes: [...] },
  ],
  staffGroups: [{ type: 'brace', voiceIds: ['soprano', 'alto', 'tenor', 'bass'] }],
}
```

- No `staff` key → exactly today's behavior (one voice per staff). Backward
  compatible; all existing inputs unchanged.
- **Max 2 voices may share a `staff` value** — throw a clear Error otherwise.
- Voices sharing a staff MUST declare the same clef (or omit; first voice's
  resolved clef wins). Mismatch → throw.
- Voices sharing a staff must have equal total duration (same rule as brace
  groups). Shared-staff voices are implicitly barline-synchronized.
- `staffGroups` keeps accepting `voiceIds`; a group covers the set of staves
  its voices live on. Listing any voice of a shared staff includes that staff.

## Engraving rules

1. **Stems**: on a shared staff the FIRST declared voice is the upper voice —
   stems always up. The second voice's stems always down. This overrides the
   middle-line rule. Beams follow their voice's forced direction
   (`beamGroupStemDown` already honors `{voiceIndex, voiceCount}` — reuse).
2. **Staff furniture once per staff**: staff lines, clef, key signature, time
   signature, barlines are drawn once per staff, not per voice.
3. **X alignment**: both voices use the shared beat→x spacing map (as brace
   groups do today), so simultaneous notes stack vertically.
4. **Notehead collisions**: when the two voices sound at the same beat and
   their pitches are a unison or a second apart (diatonic distance ≤ 1), or the
   lower voice is ABOVE the upper voice (voice crossing), shift the down-stem
   voice's notehead right by one notehead width (~22 units). Otherwise
   noteheads align on the same x.
5. **Rests**: up-voice rests shift up one staff space; down-voice rests shift
   down one staff space. If both voices rest at the same beat with the same
   duration, draw ONE rest, centered (no shift).
6. **Accidentals**: in-measure accidental memory is per STAFF (merged across
   its voices), since a printed accidental applies to the staff. An accidental
   introduced by one voice is remembered for both.
7. **Ties/slurs**: up-voice ties/slurs curve above; down-voice below.
8. **Lyrics**: unchanged — rendered below the staff. (In close score the upper
   staff's lyrics land between the staves, which is the traditional spot.)
9. **Dynamics/hairpins/markers**: unchanged, attach per voice as today.

## DOM contract (consumers depend on this)

- Each voice keeps its own `<g data-voice-id="..." data-system-index="..."
  data-start-measure="..." data-end-measure="...">` wrapper containing its
  notes/rests with `data-beat` — singHarmony2 colors voices and drives its
  playback cursor off these. Two such groups per shared staff.
- Staff furniture lives outside the per-voice note groups (its own group per
  staff, e.g. `data-staff-id`), so per-voice CSS `color` doesn't tint the
  shared staff lines. Staff lines/clef/etc should render in the default ink
  color, not a voice color.
- `data-beat` stays system-relative (existing semantics; do not change).

## Testing (TDD — write these first)

Add `NotationRenderer.multiVoiceStaff.test.js` covering at least:
- two voices with `staff` share one staff (staff-line count halves)
- stem directions forced up/down
- backward compat: no `staff` key → per-voice staves (existing tests stay green)
- >2 voices on a staff throws; clef mismatch throws
- unison/second collision applies notehead offset; third+ does not
- same-beat same-duration rests dedupe to one centered rest
- accidental memory merges across the staff's voices within a measure
- per-voice `data-voice-id` groups + `data-beat` preserved on a shared staff
- staff furniture not inside either voice group

All existing tests must stay green (925 as of 2026-08-03). `npm test` before and after.

## Dev playground

Add `dev/presets/close-score-hymn.js` — a short SATB phrase (e.g. the Doxology
opening) on two shared staves with a brace, demonstrating stems, a
second-interval collision, a shared rest, and lyrics on the soprano.
