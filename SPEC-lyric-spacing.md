# SPEC: Lyric-aware spacing, lyric sizing, and long-tie flattening

Status: implementing. Three related engraving-quality jobs, in order, each with
its own TDD cycle and commit. Consumer: singHarmony2 (74 hymns with 1-6 stacked
verses; worst crowding in dense syllabic passages).

## JOB 1 — Syllable-width-aware note spacing

Today lyric syllables render centered under their note but contribute NOTHING
to horizontal spacing, so adjacent syllables in the same verse line can crowd
or overlap when notes are close (short durations, narrow systems).

Rule: for each pair of CONSECUTIVE lyric-bearing notes within a voice, for each
verse line, the horizontal advance between the two notes must be at least
  (estWidth(sylA) + estWidth(sylB)) / 2 + LYRIC_GAP
where LYRIC_GAP ≈ 8 units and estWidth uses a character-count heuristic
(~0.5 × font-size per character; jsdom offers no text metrics — document the
constant). Take the max requirement across all verse lines of that voice, and
across voices sharing the system (staves are x-aligned). Notes between the pair
that carry no syllable (melisma notes) subdivide the requirement naturally —
the constraint applies between the two anchor x positions, so intervening
notes only relax it.

Integration: feed these minima into the existing intrinsic-width/spring layout
so the line breaker sees wider measures and puts fewer of them per system.
The requirement must survive justification (stretch is fine; compression must
not go below the lyric minimum).

Also: when a system's FIRST lyric-bearing note carries verse numbers, reserve
enough leading space that the number (est. width of "N." at its font size)
does not collide with the clef/key-signature block or protrude past the
system's left edge.

Tests (write first):
- two eighth notes with long syllables get a wider advance than the same notes
  bare (assert on x positions)
- melisma between anchors does not tighten the requirement
- multi-verse: the widest verse line governs
- justified systems never compress below the lyric minimum
- verse-number leading-space reservation on a system whose first note is
  lyric-bearing
- songs without lyrics: byte-identical output (regression harness)

## JOB 2 — Lyric size defaults

Raise the engraving defaults in src/components/Lyric.js:
- syllable font-size 11 → 15
- verse number font-size 10 → 13
- VERSE_LINE_HEIGHT 26 → 30 (keep LYRIC_BASE_Y unchanged)
Update every test that asserts the old constants (this is a deliberate design
change, not test-fudging — note it in the commit message). JOB 1's width
heuristic must read the real font-size constant, not hardcode it.
Check CLAUDE.md's consumer note: resound-fe must be grepped for lyric usage; if
it renders no lyrics, state that in the report; if it does, flag the visual
delta prominently instead of silently shipping it.

## JOB 3 — Flatten long ties/slurs

Observed: a tie across a barline (or between distant notes) renders with a
tall, balloon-like arc; engraving practice keeps long ties SHALLOW — arc
height grows sub-linearly with span and caps out.

Rule: tie/slur arc height = clamp(h_min, k × span^0.6-ish, h_max) with
h_max ≈ 14 units for ties (slurs may keep a slightly larger cap ≈ 18). Short
ties (≤ a couple of noteheads apart) must render exactly as today (regression:
pick constants so the current short-span geometry is preserved). Direction
rules unchanged.

Tests: short tie unchanged (pin exact path numbers from today's output);
cross-barline tie height ≤ cap; monotonic but sub-linear growth.

## Ground rules (same as previous jobs)

Read CLAUDE.md first. TDD per job; failing test before implementation. All
existing tests green except those updated per JOB 2's explicit constant change.
No version bump, no push, no publish. One commit per job. Report per job:
approach, test counts, compromises — they will be adversarially reviewed.
