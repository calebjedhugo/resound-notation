# OTTAVA-DESIGN — 8va / 8vb Segmentation Algorithm

Design spec for Iteration C TDD. Decides which notes in a treble-clef voice render under an `8va---` (ottava alta) or `8vb---` (ottava bassa) bracket.

> **Process note.** This iteration was scoped to spawn two parallel design agents and a synthesis agent. The current harness does not expose a sub-agent / Task tool, so the two framings (engraver per Gould "Behind Bars" ch. 9 "Ottavas"; competitive-programming sequence segmentation) and the synthesis pass were performed inline by reasoning through both perspectives in sequence. The fragments in §4 were used as the judging rubric throughout. Anywhere the two framings disagreed, §5 flags it as an open question for review.

---

## 1. Scope

**In:**
- Treble clef voices: both 8va and 8vb.
- Bass clef voices: 8vb only (very low pitches below G1).
- Choosing the **segments** (contiguous ranges of note indices, with rests silently spanned) that should render under an `8va` (above) or `8vb` (below) bracket.
- The segmentation output is consumed by a renderer that (a) draws the bracket + dashed continuation and (b) transposes the noteheads under it by an octave so they sit on the staff.

**Out:**
- Bass clef 8va. Bass-clef-above-an-octave is an engraving anti-pattern (Gould §9.4); cases that musically need it use tenor or treble clef instead. The analyzer skips the 8va direction for bass voices.
- `15ma` / `15mb` (double ottava). Same algorithm shape applies later, but this spec doesn't address two-octave segments.
- Multi-staff piano grand-staff splitting (left vs. right hand assignment). Per-voice only.
- Rendering of the bracket glyph itself, the dashed line, the "8" digit, the hook. Those live in a separate component (`OttavaBracket.js`-to-be).

## 2. Definitions

Pitches are referenced by scientific pitch name (`C4` = middle C) and MIDI number.

| Concept | Treble 8va (above) | Treble 8vb (below) | Bass 8vb (below) |
|---|---|---|---|
| **Last in-range pitch** (highest/lowest pitch still drawn cleanly on the staff with ledger lines) | **F6** (MIDI 89) | **E3** (MIDI 52) | **G1** (MIDI 31) |
| **Trigger threshold** (one octave past the last in-range pitch) | **G6** (MIDI 91) and higher | **D3** (MIDI 50) and lower | **F1** (MIDI 29) and lower |
| **In-range zone** (won't, by itself, force or sustain a bracket) | MIDI ≤ 89 | MIDI ≥ 52 | MIDI ≥ 31 |
| **Out-of-range zone** (trigger zone) | MIDI ≥ 91 | MIDI ≤ 50 | MIDI ≤ 29 |

Note that MIDI 90 (F♯6 / G♭6) sits in the gap between F6 and G6. Pragmatically: treat MIDI 90 as **in-range** for entry decisions (it isn't a trigger), but **as "neutral"** for exit decisions (it does not count toward the 3-consecutive in-range exit requirement). Mirror for MIDI 51 on the treble 8vb side, and MIDI 30 (F♯1 / G♭1) on the bass 8vb side. This avoids the pathological case where a chromatic neighbor toggles the bracket. See §5 OQ-1.

**Rest.** A rest is treated as a transparent token: it neither triggers entry nor counts toward the exit dip. It is *silently spanned* if it falls between two in-bracket notes.

**Voice.** A monophonic sequence of `Note | Rest` events, in time order, with optional `barline` markers between events. Voices originate from the model layer upstream of the renderer.

## 3. The algorithm

The algorithm has three passes:

1. **Pass A — single-voice segmentation.** Greedy left-to-right with a 3-note exit hysteresis and a context-pull post-merge.
2. **Pass B — boundary snapping.** Nudge segment start/end indices to the nearest barline or downbeat within a small budget.
3. **Pass C — multi-voice conflict resolution.** If two voices on the same staff disagree on a span, drop the bracket on the conflicting span and emit one `console.warn`.

### 3.1 Pass A — single-voice segmentation

Input: `events: Array<Note | Rest>` for one voice. For 8vb, mirror all comparisons (≥ vs. ≤). Below is the 8va direction; run the same procedure independently for 8vb and merge segment lists at the end (the two directions cannot overlap because the trigger zones don't overlap).

Constants:
- `TRIGGER = 91` (G6) — minimum MIDI for 8va entry.
- `IN_RANGE_MAX = 89` (F6) — maximum MIDI that counts as "in-range" for the exit dip.
- `EXIT_DIP = 3` — consecutive in-range notes required to leave the bracket.
- `CONTEXT_PULL_WINDOW = 4` — see §3.1.3.
- `CONTEXT_PULL_RATIO = 0.5` — see §3.1.3.

#### 3.1.1 Raw segmentation (greedy with hysteresis)

```
segments = []
state = OUT
seg_start = null
dip_count = 0
for i, e in enumerate(events):
  if e is Rest: continue   // rests do not change state or dip_count

  if state == OUT:
    if midi(e) >= TRIGGER:
      seg_start = i
      state = IN
      dip_count = 0

  else: // state == IN
    if midi(e) >= TRIGGER:
      dip_count = 0
    elif midi(e) <= IN_RANGE_MAX:
      dip_count += 1
      if dip_count >= EXIT_DIP:
        // close at the note BEFORE the dip started
        seg_end = i - EXIT_DIP
        // walk seg_end forward past any trailing rests already counted? No —
        // rests don't increment dip_count, so seg_end is correct as-is.
        // But trim trailing rests from inside the segment:
        while seg_end > seg_start and events[seg_end] is Rest:
          seg_end -= 1
        segments.push({start: seg_start, end: seg_end, kind: '8va'})
        state = OUT
        seg_start = null
        dip_count = 0
    else: // "neutral" (the MIDI-90 chromatic-gap case) — do nothing
      pass

if state == IN:
  // voice ended inside a segment; close at last non-rest index
  end = last_non_rest_index(events)
  segments.push({start: seg_start, end: end, kind: '8va'})
```

#### 3.1.2 Single-note suppression

After raw segmentation, drop any segment that contains exactly one non-rest event whose neighbors (previous non-rest, next non-rest, across the full event stream) are both more than an octave lower than the trigger note. Concretely: if the segment contains 1 note at MIDI `m`, and both the prior and following non-rest notes have MIDI `< m - 12`, **drop the segment**. Fragment 4 (`C5 D5 G6 D5 C5`) is the motivating case — an isolated leap is read as a leap, not as a register change.

#### 3.1.3 Context-pull merge (the soft rule)

Motivating fragment: `C6 G6 B5 C6 G6` — the user reports this reads better entirely under 8va. The formal observation is that the high notes are the *melodically prominent* notes and the in-range notes are *connective tissue* between them. We approximate "melodically prominent" with a sliding-window density rule:

> **Rule CP-1.** After raw segmentation, for any two adjacent segments `S_i` and `S_{i+1}` of the same kind separated by a gap of `g` non-rest in-range notes: if **either**
>   (a) every note in the gap is within an octave of `TRIGGER` (i.e. MIDI ≥ `TRIGGER - 12`), **and** `g ≤ CONTEXT_PULL_WINDOW`, **or**
>   (b) the ratio `out_of_range_count / total_non_rest_count` across the span `[S_i.start … S_{i+1}.end]` is `≥ CONTEXT_PULL_RATIO`,
> then **merge** `S_i` and `S_{i+1}` into a single segment spanning `[S_i.start, S_{i+1}.end]`.

> **Rule CP-2.** A segment may additionally absorb a leading or trailing run of in-range notes (length ≤ `CONTEXT_PULL_WINDOW`) when **every** note in that run is within an octave of `TRIGGER` *and* the absorbed run is bounded on the outside by either (a) the start/end of the voice, (b) a different-clef-zone note, or (c) a barline.

Rationale: (a) catches `C6 G6 B5 C6 G6` because B5, C6 are all within an octave of G6 and the gap is short; the high notes outnumber none of the local connectives. (b) is a backstop for longer phrases like `G6 A6 F6 E6 G6 A6` (Fragment 2) where the dip is only 2 notes — raw hysteresis already keeps it together, so CP-1 should not be needed there, but if hysteresis somehow split it, the ratio rule would re-merge it.

CP-1(a) is the primary rule. CP-1(b) is a safety net. CP-2 is the "absorb the pickup" rule. The constants `4` and `0.5` are picked to keep CP-1 from over-pulling; tune in iteration C.

#### 3.1.4 8vb mirror

Run §3.1.1 / §3.1.2 / §3.1.3 again with all MIDI comparisons mirrored. Threshold constants are **per-clef**:
- **Treble:** `TRIGGER_VB_TREBLE = 50` (D3), `IN_RANGE_VB_TREBLE = 52` (E3).
- **Bass:** `TRIGGER_VB_BASS = 29` (F1), `IN_RANGE_VB_BASS = 31` (G1).

The analyzer picks the constants from `input.clef`. With either set:
- Compare `midi(e) <= TRIGGER_VB_*` for entry, `midi(e) >= IN_RANGE_VB_*` for exit-dip increment.
- "Within an octave of TRIGGER" in CP-1(a) becomes `midi <= TRIGGER_VB_* + 12`.

For treble voices the 8va and 8vb passes cannot produce overlapping segments (their trigger zones are 41 semitones apart). Bass voices do not run the 8va pass at all (see §1 Scope).

### 3.2 Pass B — boundary snapping

Goal: prefer to start/end segments at barlines or downbeats.

For each segment `{start, end}`:
1. Find the nearest **barline or downbeat index** to `start` within a budget of `SNAP_BUDGET = 2` events (forward or backward).
2. If candidate boundary `b` is found and **shifting `start` to `b` would not change which trigger note enters the bracket** (i.e. all notes in the shifted range are still ≥ `TRIGGER - 12` for 8va, mirror for 8vb), shift `start` to `b`. Prefer **earlier** boundary on ties (read the bracket as starting on the downbeat that owns the figure).
3. Repeat for `end` with the symmetric criterion. Prefer **later** boundary on ties.
4. **Abort the snap** if it would (a) make the segment overlap another segment, (b) shrink the segment to fewer than 2 non-rest events, or (c) push the boundary across a different segment's boundary. In those cases, leave the boundary at the trigger note.

### 3.3 Pass C — multi-voice conflict

Input: one segment list per voice on the staff.

For every pair of voices `(V1, V2)`:
- For each pair of segments `(s1, s2)` from different voices that overlap in time and **disagree** on `kind` (one is `8va`, the other absent or `8vb`):
  - Mark the overlapping time range as **conflicted**.
  - Drop the conflicting portion from both segment lists (truncate or split).
  - Emit `console.warn` once per voice-pair-per-overlap: `"resound-notation: voices N and M disagree on 8va over <range>; rendering without ottava. Consider splitting onto separate staves."`

If both voices agree on the same kind for an overlapping range, do nothing — they share the bracket (the renderer will draw one bracket spanning the staff).

## 4. Worked examples

Indices are 0-based note positions (rests counted separately). Format: `[start..end] kind`.

### Fragment 1 — clean high run

`G6 A6 B6 C7 D7 | C7 B6 A6 G6`

All 9 notes are ≥ G6. Raw pass yields `[0..8] 8va`. Boundary snap leaves it alone (already starts on a note that may be a downbeat — barline at index 4 is mid-segment). **Expected: `[0..8] 8va`.**

### Fragment 2 — rule-of-three dip (stay)

`G6 A6 F6 E6 G6 A6 B6`

Indices 2 (F6) and 3 (E6) are in-range; `dip_count` reaches 2 but not 3 before index 4 (G6) resets it. **Expected: `[0..6] 8va`.** CP not invoked.

### Fragment 3 — rule-of-three exit

`G6 A6 B6 F6 E6 D6 G6 A6`

Indices 3, 4, 5 are in-range; `dip_count` hits 3 at index 5, segment closes at `5 - 3 = 2` (B6). Indices 6, 7 start a new segment. **Expected: `[0..2] 8va`, `[6..7] 8va`.** CP-1(a): gap is 3 in-range notes (F6, E6, D6); F6 and E6 are within an octave of G6 (≥ 79); D6 is also ≥ 79 (MIDI 86). All three are within an octave of trigger. Gap length 3 ≤ 4. **CP-1(a) WOULD merge into `[0..7]`.**

This is the headline tension between the engraver framing (respect the user's explicit "rule of three exit" example — keep the split) and the algorithm framing (the CP rule pulls it back together). **Resolution: the hard constraint wins.** The exit-dip hysteresis is a hard constraint; CP-1 must not undo it.

> **Rule CP-3 (precedence).** CP-1 may only merge segments that were split by reasons *other than* a completed exit dip. Tag each segment closure with its reason (`exit_dip_complete` vs. `voice_ended` vs. boundary-truncated). CP-1 skips pairs where the gap was created by `exit_dip_complete`.

With CP-3 in place: **Expected: `[0..2] 8va`, `[6..7] 8va`.**

### Fragment 4 — isolated high note

`C5 D5 G6 D5 C5`

Raw pass opens a segment at index 2, no closing event before voice end. Single-note suppression in §3.1.2: segment has 1 note (G6 = MIDI 91); prior note D5 = 62 < 91 − 12 = 79 ✓; next note D5 = 62 < 79 ✓. **Drop.** **Expected: no segment.**

### Fragment 5 — context-pull case

`C6 G6 B5 C6 G6`

MIDI: 72, 91, 71, 72, 91. Raw pass: open at index 1, dip at indices 2–3 (B5, C6, only 2 notes), reset at index 4. Segment is `[1..4] 8va`. CP-2 applies to the leading C6 (MIDI 72): is 72 ≥ 91 − 12 = 79? **No.** So CP-2 does **not** absorb the leading C6.

This is a problem — the user said the whole thing should be 8va. Inspecting: the local highs (G6) are an octave above the local mids (B5/C6). The "within an octave of trigger" condition (MIDI ≥ 79) excludes C6 and B5, which is too tight for this case.

**Revision.** Relax CP-1(a) and CP-2's "within an octave of trigger" condition to "within an octave of the *adjacent in-bracket pitch*", computed at the join. For Fragment 5, the in-bracket pitch at the left edge is G6; the leading C6 is a fifth (5 semitones) below — within an octave. CP-2 now absorbs it. Same reasoning extends the segment to absorb the trailing run if any.

Concretely:
> **Rule CP-1(a) revised.** For each gap note `n` in the gap between `S_i` and `S_{i+1}`: `midi(n)` is "close" if it's within 12 semitones of the **nearest in-bracket note across either segment boundary**.
> **Rule CP-2 revised.** Each absorbed run note must be within 12 semitones of the bracket-edge note.

**Expected: `[0..4] 8va`.**

### Fragment 6 — rest spanning

`G6 A6 R R B6 C7`

Rests at indices 2 and 3 (in event stream). All 4 notes are out-of-range. Segment is `[0..5] 8va` (segment is over the event stream, not the note stream; rests are inside). **Expected: `[0..5] 8va`.** The renderer draws the dashed continuation across the rests.

### Fragment 7 — 8vb mirror

`D3 C3 B2 A2 | B2 C3 D3 E3`

All 8 notes are ≤ D3 (MIDI ≤ 50). Mirror of Fragment 1. **Expected: `[0..7] 8vb`.**

### Fragment 8 — boundary preference

Example: `F6 G6 A6 B6 | C7 D7 C7 B6 A6 G6 F6 E6 D6 C6` with the bar at index 4.

Raw pass: F6 (89) is below trigger, so segment opens at index 1 (G6). Exit dip starts at index 10 (F6); at index 12 (D6) the dip count hits 3, closing the segment at `12 − 3 = 9` (G6). Boundary snap on `start`: nearest barline within budget 2 of index 1 is at index 4 — too far (budget = 2). Snap fails; leave start at 1. Boundary snap on `end`: nearest barline within budget 2 of index 9 is at index 4 — too far. Leave end at 9. **Expected: `[1..9] 8va`.**

Alternate: if the bar were at index 1, snap would shift start to index 1 (no-op). If the run were `F6 | G6 A6 ...`, the barline at index 1 would coincide and `start = 1` reads cleanly.

A more interesting case: `E6 F6 | G6 A6 B6 C7` — raw starts at index 2 (G6). Barline at index 2 is a zero-cost snap (same index). Start stays at 2. **Expected: `[2..5] 8va`.**

## 5. Edge cases and open questions

- **OQ-1 (MIDI 90 / 51 chromatic gap).** Spec says "neutral" — neither triggers entry nor counts toward exit dip. Alternative: treat as out-of-range for entry (so F♯6 alone would force 8va). Rejected for now — F♯6 with ledger lines is still common and readable. Verify with engraving reference.
- **OQ-2 (CP constants).** `CONTEXT_PULL_WINDOW = 4` and `CONTEXT_PULL_RATIO = 0.5` are guesses. Iteration C should tune against a larger fragment corpus.
- **OQ-3 (CP-2 leading absorb).** The relaxed condition "within 12 semitones of bracket-edge note" admits Fragment 5 but could over-pull on long lyrical descents. Bound the absorbed run length tightly (≤ 4) and never absorb across a barline; the boundary-snap pass should prefer to start at the barline anyway.
- **OQ-4 (Multi-voice agreement).** When two voices agree on the 8va span, the renderer should draw **one** bracket above (or below) the system, not two. This is a renderer concern but the segmenter output should support a `voiceIds: number[]` field per segment.
- **OQ-5 (Chord notes).** Treble chord with one note in 8va range and the rest in-range — spec assumes monophonic voices. If a model chord straddles the threshold, treat its highest pitch as the chord's representative pitch for 8va analysis. Re-examine in iteration C.
- **OQ-6 (Voice ends mid-segment).** Spec closes at the last non-rest index. Should the bracket also extend across trailing rests? Engraving convention: no — end at the last sounding note. Confirmed by §3.1.1.
- **OQ-7 (8va of 0 notes).** Disallow. Single-note suppression handles the "1 note" case; a 0-note segment cannot be produced by the algorithm as written.
- **OQ-8 (Clef gating).** The function accepts a clef hint. Treble voices return both 8va and 8vb segments; bass voices return only 8vb segments (run with bass-specific thresholds). Other clefs (alto, tenor, percussion) return `[]`. Bass-clef 8va is suppressed at the analyzer level — the kind list never includes `'8va'` for bass input.

## 6. API surface

```ts
type Midi = number;            // 0..127
type EventKind = 'note' | 'rest' | 'barline';

interface NoteEvent  { kind: 'note'; midi: Midi; index: number; isDownbeat?: boolean; }
interface RestEvent  { kind: 'rest'; index: number; }
interface BarEvent   { kind: 'barline'; index: number; }
type VoiceEvent = NoteEvent | RestEvent | BarEvent;

type OttavaKind = '8va' | '8vb';

interface OttavaSegment {
  kind: OttavaKind;
  startIndex: number;          // index into the input events array (inclusive)
  endIndex: number;            // inclusive; always a note index, never a rest/barline
  voiceIds: number[];          // populated by Pass C; single-voice = [voiceId]
  closureReason: 'exit_dip_complete' | 'voice_ended' | 'boundary_snap' | 'merged' | 'absorbed';
}

interface OttavaInput {
  voiceId: number;
  clef: 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion';
  events: VoiceEvent[];
}

// Single-voice analysis (Passes A + B):
function segmentOttava(input: OttavaInput): OttavaSegment[];

// Multi-voice reconciliation (Pass C):
function reconcileOttava(perVoice: OttavaSegment[][]): OttavaSegment[][];

// Convenience top-level entry point used by the renderer:
function analyzeOttava(voices: OttavaInput[]): OttavaSegment[][];
```

Returns an empty array for bass-clef voices. Emits `console.warn` from `reconcileOttava` on cross-voice conflicts.

---

*End of spec. Iteration C implements `analyzeOttava` and writes tests against §4 first.*
