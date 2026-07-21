# SPEC: Multi-verse lyrics (hymnal-style stacked verses)

Status: planned (implement AFTER SPEC-multi-voice-staff.md lands — same renderer
regions). Motivation: hymnals print verses 1..n stacked under the melody staff;
the current per-note `lyric: string` supports only one line of text.

## Data model

`lyric` on a note accepts a string (today's behavior, unchanged) **or an array
of strings/nulls**, one entry per verse:

```js
{ pitch: 'G4', length: '1/4', lyric: ['A-', 'Twas', 'Through'] }   // verses 1-3
{ pitch: 'B4', length: '1/8', lyric: [null, 'grace', 'many'] }     // v1 melisma here
```

- Array index = verse index. `null`/missing = no syllable for that verse on
  this note (melisma or verse ends earlier).
- Verses may have different melisma placement — each verse line computes its
  own melisma underscores independently, using the same rules as the current
  single-verse rendering.
- Mixed usage in one voice (some notes string, some array) is allowed; a bare
  string means verse 1.

## Rendering rules

1. Verse lines stack below the staff: verse 1 at today's lyric y-position,
   each additional verse one line-height (~26 units) lower.
2. **Verse numbers**: at the first lyric-bearing note of each SYSTEM, prefix
   the verse's first syllable with "1. ", "2. ", … — or render the number as a
   small separate text element left-aligned to that syllable (implementer's
   choice; must not shift note spacing). Numbers appear on every system
   (hymnal convention varies; every system is the more readable choice here).
3. Reserved vertical space below a staff (used by the content-aware
   inter-staff spacing) grows with the verse count so following staves /
   systems don't collide with the lyric block.
4. Syllable-continuation hyphens: keep today's behavior (trailing hyphen is
   part of the syllable text). No engraving change required in this spec.
5. Single-verse input renders pixel-identically to today.

## Testing (TDD)

New test file Lyric.multiVerse.test.js (or extend the existing lyric tests):
- array lyric renders one text element per verse, stacked at increasing y
- null entries produce melisma underscores per verse independently
- verse numbers render at each system's first lyric-bearing note
- inter-staff spacing accounts for the verse block height
- bare-string lyric output is unchanged (regression)

All existing tests stay green. `npm test` before and after.

## Consumer note

singHarmony2 stores per-song verse alignments in `lyrics/<slug>.json` as
`{"verses": [[...], [...]]}` (each inner array aligned to soprano onsets) and
passes them through as arrays. Its converter currently emits single-string
`lyric` fields from a `syllables` array — it will switch to arrays when this
lands.
