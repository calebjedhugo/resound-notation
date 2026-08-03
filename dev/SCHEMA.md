# resound-notation Input Schema (audit notes)

Notes for the dev playground. Source: `src/lib/dataParser.js`, `src/NotationRenderer.js`, `SPEC.md`, `SPEC-*.md`. v0.1.0.

## Three input shapes

The renderer accepts three shapes. `parseNoteData()` normalizes them.

1. **Level 1 — Bare array.** `[noteOrRestOrChord, ...]` — single voice, key=C, no time sig, clef inferred.
2. **Level 2 — Single voice with metadata.** `{ clef, keySignature, timeSignature, notes: [...] }`.
3. **Level 3 — Multi-voice.**
   ```js
   {
     keySignature, timeSignature,        // top-level defaults
     staffGroups: [{ type: 'brace', voiceIds: [...] }],  // optional grand-staff brace
     voices: [
       { id, clef, keySignature?, timeSignature?, staff?, notes: [...] }
     ]
   }
   ```

`staffGroups` only supports `type: 'brace'` today. The brace draws a curly brace at the left edge plus shared barlines spanning grouped voices.

## `pickupBeats` — pickup (anacrusis) measure

Optional top-level key on Level 2/3 input (quarter-note beats, same units as note durations):

```js
{ timeSignature: [4, 4], pickupBeats: 1, notes: [...] }
```

- Measure 0 spans beats `[0, pickupBeats)`; measure m ≥ 1 spans `[pickupBeats + (m-1)·L, pickupBeats + m·L)` (L = full measure length). The whole barline grid shifts: breaking, slicing, shared barlines, accidental resets, `data-start-measure`/`data-end-measure` (the pickup counts as measure 0). `data-beat` stays system-relative and unshifted.
- Constraints (validated, throws): requires a `timeSignature`; `0 < pickupBeats < measure length`; every voice's content must fill the pickup exactly (no element may straddle the pickup boundary — do NOT pad the anacrusis with leading rests anymore).
- A normal thin barline closes the pickup; no time-signature re-print.
- Auto-beaming groups the pickup against the measure's END (anacrusis beats count backwards from the barline).
- Dev preset: `pickup-measure`.

## `staff` — two voices per staff (close score)

A Level-3 voice may declare an optional `staff` key. Voices with the same
`staff` value render on ONE shared staff (SATB hymn close score):

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

Rules (see `SPEC-multi-voice-staff.md`; dev preset: `close-score-hymn`):

- No `staff` key → one voice per staff (legacy behavior, unchanged).
- **Max 2 voices** per `staff` value — more throws.
- Voices sharing a staff must declare the **same clef** (or omit; the first
  voice's resolved clef wins). A declared mismatch throws.
- Voices sharing a staff must have **equal total duration** — throws otherwise.
- The FIRST declared voice is the upper voice: **stems always up**; the
  second voice's stems always down (overrides the middle-line rule; beams too).
- Staff furniture (lines, clef, key/time sig, barlines) draws once per staff
  in its own `data-staff-id` group; each voice keeps its own
  `data-voice-id` group (notes/rests with `data-beat`), so per-voice CSS
  `color` doesn't tint the shared staff.
- Same-beat unisons/seconds (and voice crossings) shift the down-stem
  voice's notehead right by ~one notehead width.
- Up-voice rests shift up one space, down-voice rests down one; a same-beat
  same-duration rest in both voices draws ONE centered rest.
- In-measure accidental memory merges across the staff's voices.
- Up-voice ties/slurs curve above; down-voice below.

## Element types in `notes[]` (canonical detection order, see SPEC.md)

| Priority | Element | Detection rule | Sample |
|---|---|---|---|
| 1 | Chord | `Array.isArray()` | `[{pitch:'C4',length:'1/4'},{pitch:'E4',length:'1/4'}]` |
| 2 | Tuplet | has `tuplet` | `{tuplet:[3,2], notes:[...]}` |
| 3 | Barline marker | has `barline` | `{barline:'repeat-start'}` (also `'repeat-end'`, `'repeat-both'`, `'final'`) |
| 4 | Ending (volta) | has `ending` | `{ending:{number:1,type:'start'}}` / `'stop'` |
| 5 | Navigation | has `navigation` | `{navigation:'segno'}` (`coda`, `fine`, `dc`, `ds`, `to-coda`, etc.) |
| 6 | Tempo marker | has `tempo` | `{tempo:{bpm:120,beat:'1/4',text:'Allegro'}}` |
| 7 | Tempo change | has `tempoChange` | `{tempoChange:'rit'}` etc. |
| 8 | Expression | has `expression` | `{expression:'dolce'}` |
| 9 | Rehearsal mark | has `rehearsal` | `{rehearsal:'A'}` |
| 10 | Dynamic | has `dynamic` | `{dynamic:'mf'}` (free-form text — `pp`,`p`,`mp`,`mf`,`f`,`ff`,`sfz`,`fp`, etc.) |
| 11 | Hairpin | has `hairpin` | `{hairpin:'crescendo',start:true}` / `stop:true` |
| 12 | Note (pitched) | has `pitch` | `{pitch:'C4',length:'1/4'}` |
| 12 | Note (percussion) | has `position` (1-9) | `{position:3,length:'1/4'}` |
| 13 | Rest | has `length`, no pitch/position | `{length:'1/4'}` |

## Pitch / length / accidentals

- **Pitch:** `[A-G][#b]?[0-8]`. Accidentals: `#` (sharp), `b` (flat). No `bb`/`##`/naturals as glyphs (key-sig overrides aside).
- **Length:** `'1/1'`, `'1/2'`, `'1/4'`, `'1/8'`, `'1/16'`, `'1/32'`. Add `dotted: true` for dotted rhythm.
- **Clef:** `'treble' | 'bass' | 'alto' | 'tenor' | 'percussion'`.
- **Key signatures:** `C`, `G`, `D`, `A`, `E`, `B`, `F#`, `C#` (sharps); `F`, `Bb`, `Eb`, `Ab`, `Db`, `Gb`, `Cb` (flats).
- **Time signature:** `[beats, beatValue]`. Null/omitted = unmetered (no barlines, no auto-beaming).

## Per-note enrichment properties

| Property | Values | Notes |
|---|---|---|
| `dotted` | `true` | Renders aug. dot, multiplies duration by 1.5 |
| `articulation` | `'staccato'`, `'staccatissimo'`, `'accent'`, `'marcato'`, `'tenuto'`, `'fermata'`, or array of these | Fermata also valid on rests |
| `tie` | `'start' \| 'continue' \| 'stop'` | Spans across rests/barlines; matches by pitch |
| `slur` | `'start' \| 'stop'` | Stack-based; nesting allowed |
| `grace` | `{pitch, type:'acciaccatura'\|'appoggiatura'}` or array | Drawn before the host note |
| `lyric` | string or array of strings/nulls | Plain text below the note (`Hel-`, `lo`, etc.). Implicit melismata when subsequent notes lack a lyric. An **array stacks hymnal verses** (`['A-', 'Twas', 'Through']` = verses 1-3; `null` = no syllable for that verse → per-verse melisma). Verse lines stack 26 units apart; verse numbers (`1.`, `2.`, …) render at each system's first syllable when a voice has >1 verse; inter-staff/system spacing reserves room for the block. A bare string = verse 1 (unchanged). |

## Tuplet wrapper

```js
{ tuplet: [actual, normal], notes: [...] }
```
Inside notes you may have notes / rests / chords. **No nested tuplets.** Bracket auto-hides when group fully beams.

## Repeats / endings / navigation

- `{barline:'repeat-start'}`, `{barline:'repeat-end'}`, `{barline:'repeat-both'}`, `{barline:'final'}`
- `{barline:'repeat-end', times:N}` — playback hint, not visual
- `{ending:{number:1,type:'start'}}` ... `{ending:{number:1,type:'stop'}}` (last ending may omit stop, draws open-ended)
- Navigation: `segno`, `coda`, `fine`, `dc`, `ds`, `dc-al-fine`, `dc-al-coda`, `ds-al-fine`, `ds-al-coda`, `to-coda`

## NOT expressible (verified by code reading, not guessed)

- **Naturals or double-sharps/double-flats as accidentals on a note** — the parser only maps `#` and `b`. A natural would have to come via key-sig context.
- **Multi-measure rests / measure repeats** — not in the parser.
- **Chord symbols (Cmaj7, etc.)** — there's no `chordSymbol` element.
- **Cross-staff beaming** — beaming is per-voice.
- **Nested tuplets** — explicitly rejected by the validator.
- **Glissando / arpeggio markings** — no element type.
- **Trills, mordents, turns, ornaments** — not articulations; no separate element type.
- **8va / 8vb** — no element.
- **Pedal markings** — no element.
- **System breaks / page breaks** — single SVG row, scrolls horizontally.

## Defaults / inference

- Missing clef → inferred from median pitch (>= C4 → treble; < C4 → bass; no pitches → percussion).
- Missing key sig → C.
- Missing time sig → unmetered (no barlines, no automatic beaming).

## Visual gotcha (relevant to playground)

The CLAUDE.md flags `STAFF_TOP_OFFSET = 10` as a regression hazard. The playground includes a coordinate-grid overlay toggle to make Y-coordinate bugs catchable visually.
