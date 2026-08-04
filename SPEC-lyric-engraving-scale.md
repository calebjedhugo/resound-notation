# SPEC: Lyric baseline clearance + measured engraving scale

Status: shipped (JOB 4, JOB 5). RECONSTRUCTED 2026-08-03 — this file did not
exist when JOB 4 and JOB 5 were implemented; it is written after the fact from
commits 3bf430b and 2c19b70, the provenance comments left in
src/components/Lyric.js, and the tests those commits shipped
(src/lyricBaseline.test.js, src/Lyric.multiVerse.test.js,
src/components/Lyric.test.js, src/lib/lyricSpacing.test.js). Every number
below is traceable to one of those sources; nothing here is a new measurement.
Consumer: singHarmony2.

## JOB 4 — Lyric baselines must clear staff content

Observed defect (singHarmony2, close-score/shared-staff SATB): lyrics always
rendered at the fixed `LYRIC_BASE_Y` (115) regardless of how far the staff's
own ink descended. On a shared staff the down-stem alto's stems reached
y=120+ staff-local and overlapped the verse text.

Rule: per staff, per system,

```
staff lyric baseline = max(LYRIC_BASE_Y,
                            lowest content extent of the staff's voices
                            + LYRIC_BASELINE_CLEARANCE)
```

"Lowest content extent" is the same content-only `voiceSkyline` geometry that
already drives staff-to-staff placement — noteheads, down-stem tips (via
`effectiveStemLength`), beam lines, ledger reach — merged across every voice
that shares the staff (a shared-staff partner's stems can push the baseline
down even when the lyric-bearing voice's own notes stay shallow). At JOB 4,
`LYRIC_BASELINE_CLEARANCE` was a flat 8px air gap.

Verse lines stack below the (possibly shifted) baseline exactly as before,
one `VERSE_LINE_HEIGHT` apart. Melisma underscores and verse numbers ride
their verse line, so `renderLyric`/`renderMelisma`/`renderVerseNumber` each
grew a `baseY` parameter (default = the legacy `LYRIC_BASE_Y`, so any caller
that doesn't pass one gets byte-identical legacy output).

Reservation follows the shift: the lyric verse block folds into the skyline
at STAFF level (not per-voice) — a partner voice's deep stems push the whole
block, including a single-verse block, which the legacy layout never
reserved room for at all. Both the inter-staff spacing pass and the
viewBox's `contentMaxY` fold use the shifted baseline; so does the
inter-system advance (the gap after the last staff of a system must clear a
shifted block on that staff, not the legacy one).

Integration: `lyricBaselineFor(contentLowestY)` computes the per-staff
baseline; `lyricBlockBottomAt(baseY, verseCount)` computes the reserved
bottom edge (0 when nothing needs reserving — legacy single-verse-at-legacy-
baseline stays a no-op, matching SPEC-multi-verse-lyrics.md rule 5). Both
live in NotationRenderer.js next to the staff-skyline code they extend.
`voiceSkyline()` itself stopped folding the lyric block in per-voice (that
became STAFF-level, since the block's baseline depends on content across ALL
of a staff's voices, not just the lyric-bearing one).

Tests shipped (src/lyricBaseline.test.js):
- a low down-stem partner voice on a shared staff pushes the lyric line
  below the stem tips (asserts `y > LYRIC_BASE_Y` and clears
  `stemBottom + 8`)
- a staff whose content stays inside the staff keeps the EXACT legacy
  baseline (no shift when nothing needs clearing)
- verse lines, melismas, and verse numbers all shift together with the
  raised baseline (stacking spacing unchanged; melisma keeps its fixed drop
  off the new baseline)
- inter-staff spacing reservation is measurably larger for deep-content
  melody than shallow-content melody at the same verse count

Regression note: some `Lyric.multiVerse.test.js` fixtures that asserted the
EXACT legacy baseline had used B4 (down-stem bottom y=120, inside the newly-
clearing band) — those songs were switched to a pitch whose ink stays above
the band (D5 at JOB 4; see JOB 5 below for why D5 later had to move too), and
the shifted-baseline behavior for the higher pitch is covered separately in
lyricBaseline.test.js instead. Lyric-free output stays byte-identical
(regression harness green).

## JOB 5 — Measured hymnal engraving scale

Deliberate design change, not a bug fix. SPEC-lyric-spacing.md JOB 2's
15px/13px/30px lyric sizes were a first-pass guess ("bigger than the
professional display scale made them read"). JOB 5 replaces that guess by
measuring real hymnal engravings pixel-by-pixel: Amazing Grace and Holy,
Holy, Holy scans, 4 pages total, cross-checked with cap-height/x-height and
identical-glyph comparisons rather than taken from a single sample.

Measurements recorded in code (src/components/Lyric.js) and the JOB 5 commit
body — reconstructed here verbatim, source noted per number:

- **Syllable font size.** fontSize/staffSpace measured 1.93–2.01 across the
  4 pages, averaging 1.97. At this renderer's 20px staff space (`LINE_SPACING`
  in NotationRenderer.js), 1.97 × 20 = 39 → `LYRIC_FONT_SIZE` 15 → 39.
- **Verse-number font size.** Kept at 0.85 × `LYRIC_FONT_SIZE`, the same
  ratio JOB 2 used (13/15 ≈ 0.867, rounded to the same 0.85 convention) →
  `VERSE_NUMBER_FONT_SIZE` 13 → 33.
- **Verse-line pitch.** Measured baseline-to-baseline between stacked verse
  rows via identical-glyph cross-checks ("to"/"to" on one page, "my"/"my" and
  "God"/"God" on others), NOT assumed at a naive 2×-font-size line height.
  pitch/fontSize measured 0.947 (Amazing Grace, 2 pages, baseline-span ÷
  gap-count) and 1.057 (Holy, Holy, Holy) — averaging ~1.00, i.e. hymnal
  verse stacks pack at roughly one nominal font size per line. 1.00 × 39 =
  39 → `VERSE_LINE_HEIGHT` 30 → 39.
- **Ascender reach.** A 39px font's ascenders reach much further above the
  baseline than the legacy 15px font's did, so JOB 4's flat 8px clearance no
  longer keeps ascenders off the staff/stems (it only ever budgeted air
  beyond the *baseline*, which happened to clear the old font's small
  ascenders by coincidence). Measured a 16px ascender height ("h"/"d"/"A")
  against a 22.4px nominal font size on the same pages used for
  `LYRIC_FONT_SIZE`: 16/22.43 = 0.71 → `LYRIC_ASCENDER_RATIO` (new constant).
- **Baseline clearance.** Now ascender-reach-aware instead of a flat pad:
  `LYRIC_BASELINE_CLEARANCE = round(LYRIC_FONT_SIZE × LYRIC_ASCENDER_RATIO)
  + LYRIC_BASELINE_AIR_GAP`, where `LYRIC_BASELINE_AIR_GAP` is the original
  JOB 4 8px kept as the breathing-room term. round(39 × 0.71) + 8 = 28 + 8 =
  36 (8 → 36).
- **LYRIC_BASE_Y.** Moves so the unshifted case still clears the staff:
  `STAFF_TOP_OFFSET + STAFF_HEIGHT` (10 + 80 = 90, the staff's bottom line)
  + `LYRIC_BASELINE_CLEARANCE` (36) = 126 (115 → 126). Lyric.js keeps this as
  a literal (`LYRIC_Y = 126`) rather than importing NotationRenderer's staff
  constants, to avoid a cyclic import (NotationRenderer already imports
  FROM Lyric.js) — the code comment there says as much and warns to
  recompute by hand if either the staff geometry or the clearance formula
  changes.
- **Melisma drop.** Stays a fixed +5px off the (now-raised) baseline —
  unchanged since JOB 4, not scaled with font size; only the baseline it
  hangs from moved.
- **LYRIC_BLOCK_DESCENT_PAD.** Scaled proportionally so it doesn't go stale
  next to the new font: `round(8 × LYRIC_FONT_SIZE / 15)` = round(8 × 39/15)
  = round(20.8) = 21 (8 → 21).

Integration: every derived constant reads `LYRIC_FONT_SIZE` /
`LYRIC_ASCENDER_RATIO` from components/Lyric.js rather than hardcoding a
number, so a future re-measurement only requires editing the source
constants. `LYRIC_BASELINE_CLEARANCE` and `LYRIC_BLOCK_DESCENT_PAD` are
computed once at module load in NotationRenderer.js from those imports.

Tests shipped/updated:
- src/components/Lyric.test.js — pins the measured constants
  (`LYRIC_FONT_SIZE` 39, `VERSE_NUMBER_FONT_SIZE` 33, `VERSE_LINE_HEIGHT` 39,
  `LYRIC_BASE_Y` 126); renderLyric/renderVerseNumber emit the new font sizes;
  verse-line stacking and the melisma's fixed +5 drop use the raised base;
  the width heuristic follows the measured font size.
- src/Lyric.multiVerse.test.js — same assertions restated at the raised
  constants (`LYRIC_BASE_Y` 126, `MELISMA_BASE_Y` 131, `VERSE_LINE` 39).
  Fixtures that had used D5 to stay inside the (JOB 4-sized) legacy band were
  swapped to A4/G4/F4 — the much wider JOB 5 clearance (36px vs. 8px) means
  D5's stem bottom (y=100) and even B4's (y=120) both now sit inside the
  band, so those pitches correctly trigger a shift and the "stays at the
  exact legacy baseline" fixtures needed pitches whose stem bottoms stay
  comfortably inside the staff itself (≤ 80 staff-local, under the new
  clearance threshold of 90).
- src/lyricBaseline.test.js — same fixture swap for the "keeps the exact
  legacy baseline" case (D5/B4 → F4/G4/A4, stem bottom y=80), same reasoning.
- src/lib/lyricSpacing.test.js — `verseNumberLeadReservation`'s "is zero when
  the short first syllable already fits" premise stopped being reachable at
  the raised font size (even a 1-character syllable no longer fits inside
  `PRELUDE_NOTE_MIN_DAYLIGHT` at 39px), so that test was rewritten to assert
  the reservation FORMULA at a short syllable instead of asserting a zero
  result — the formula under test didn't change, only what a "short"
  syllable's reservation evaluates to.

Full suite at JOB 5: 834/834 green (925 as of 2026-08-03); `npm run build` passes.

## What could not be recovered

- The exact source images/pages (which specific scans, which page numbers)
  are not preserved anywhere in the repo — only "Amazing Grace" and "Holy,
  Holy, Holy" are named, plus "4 pages" for the font-size measurement and "2
  pages" / other pages for the verse-line-pitch measurement. No image files,
  measurement scripts, or raw pixel-coordinate data survive in this repo;
  the commit message and code comments are the only record and are quoted
  above as closely as possible.
- The per-page measurement breakdown (which of the 4 pages gave 1.93 vs.
  2.01 for fontSize/staffSpace) is not recorded — only the range and the
  average.
- Whether "22.4px nominal font size" for the ascender-ratio measurement was
  itself derived from the same 1.97 staffSpace ratio or measured
  independently is not stated in the source; it is reported here exactly as
  the code comment states it (16/22.43 = 0.71) without further
  interpretation.

## Ground rules (same as previous jobs)

Read CLAUDE.md first. TDD per job; failing test before implementation. All
existing tests green except those updated per each job's explicit constant
change. No version bump, no push, no publish. One commit per job. Report per
job: approach, test counts, compromises — they will be adversarially
reviewed.
