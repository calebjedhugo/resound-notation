# SPEC: Barline-syllable clearance + pickup measures

Two jobs, in order, each its own TDD cycle and commit. Consumer: singHarmony2.

## JOB A — Syllables must not cross barlines

Observed defect (America the Beautiful): a measure's first note carries wide
syllables ("dimmed", "cross") that extend LEFT past the barline, so the
barline strikes through the text. The lyric-spacing feature (lyricSpacing.js)
constrains syllable-to-syllable gaps but not barline-to-first-syllable
clearance.

Rule: for each measure whose FIRST lyric-bearing anchor carries syllables, the
daylight between the preceding barline x and that anchor x must be at least
estWidth(widest syllable across all verse lines) / 2 + BARLINE_LYRIC_GAP
(~6 units) — the syllable is centered on the note, so half its width reaches
left. Feed this into the same natural beat→x map mechanism JOB 1 used (widen
the post-barline pad / the barline→note interval), so the breaker sees it and
justification preserves it. Mirror case (last syllable of a measure reaching
RIGHT into the next barline) should be covered by the same-anchor-pair
constraints already in place — verify with a test rather than assuming.

Tests: wide first-syllable measure gets pushed right of the barline (assert
barlineX + halfSyllable ≤ anchorX in the rendered DOM); narrow syllables
unchanged; lyric-free byte-identical battery stays green.

## JOB B — Pickup (anacrusis) measures

Today the renderer has no pickup concept: consumers pad the anacrusis with
leading rests, producing a wrong-looking nearly-empty first measure. Add real
support:

Data model: optional top-level `pickupBeats` (Level 2/3), in the same
quarter-note beat units as fractionToBeats. Constraints: 0 < pickupBeats <
measure length; voices' content must fill the pickup exactly (validated — the
existing measure-fill validation adapts).

Semantics:
- Measure 0 spans beats [0, pickupBeats); measure m ≥ 1 spans
  [pickupBeats + (m-1)·L, pickupBeats + m·L) where L = full measure length.
  Centralize this mapping in ONE exported helper (e.g. lib/measureGrid.js:
  measureStartBeat(m, L, pickup), measureIndexAt(beat, L, pickup)) and use it
  everywhere measures are computed — breaker, slicing, barlines, shared
  barlines, repeat/ending logic, data-start-measure/data-end-measure attrs.
- data-beat semantics unchanged (system-relative). data-start-measure keeps
  counting the pickup as measure 0.
- No time-signature re-print, no special barline after the pickup (normal
  barline).
- Auto-beaming within the pickup groups against the measure's END (standard
  engraving: a pickup's beats are counted from the barline backwards) — if
  that proves deep, grouping from beat 0 is an acceptable first cut; state the
  compromise.

Tests: pickup renders a short first measure with the barline at pickupBeats;
full measures land on the shifted grid; multi-system pieces with pickup break
and slice correctly (data-start/end-measure right); voices not filling the
pickup throw; `pickupBeats` absent → byte-identical output (regression
battery).

## Ground rules

Read CLAUDE.md first. Never touch the STAFF_TOP_OFFSET transform-pin test.
All existing tests stay green (834+). Update dev/SCHEMA.md (pickupBeats) and
add a dev preset (e.g. pickup-measure.js — a 4/4 hymn phrase with a 1-beat
pickup and lyrics). Commit the spec with JOB A. No push, no version bump, no
publish. Report per job: approach, test counts, compromises — adversarial
review follows.
