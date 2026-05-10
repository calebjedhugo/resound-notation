---
name: iterate-notation
description: Iteratively polish the rendered notation in resound-notation toward proper engraving. Snap a preset, find the next visually-off thing, dispatch a focused agent to TDD-fix it (write failing test → audit it → fix → snap → commit), then verify and check in with the user. Use when the user says "polish notation", "iterate on <preset>", "fix the next obvious thing", or invokes /iterate-notation.
---

# Iterate on notation rendering

Drive visual polish of the SMuFL/Bravura notation renderer in `resound-notation` via short focused iterations. The pattern that landed well: **dispatch each iteration to a fresh agent** rather than running the loop in the main session. This keeps the main context clean for direction-setting and verification, and the per-iteration agents stay tight on a single visible defect.

## What you do (main session)

1. **Snap and look.** Render the current state of the relevant preset to a PNG and view it via the multimodal Read tool. The user sees a live browser tab; you see whatever you snap. Default preset is `single-voice-treble`.
   ```bash
   cd dev && npm run dev    # leave running in background
   ./snap.sh <preset>       # writes /tmp/notation-snaps/<preset>.png
   ```
   For higher-detail inspection (e.g. stem-notehead connection): pass `--force-device-scale-factor=3` to chrome and use a smaller `?width=`.

2. **Pick the next visually-off thing.** Compare against engraving conventions (Gould "Behind Bars", Bravura defaults). When the user names a target ("the half-note stem looks wrong"), trust their visual feedback over your math.

3. **Dispatch an iteration agent.** One agent per defect. The agent does the full red→audit→green→snap→commit cycle. Keep the prompt focused — see template below. Use `subagent_type: general-purpose` (or `Plan` if the change spans multiple files and the path is unclear).

4. **Verify the agent's work.** When the agent returns, snap the preset yourself and confirm the fix landed. The agent's summary describes what it intended; the snap shows what actually happened. If the snap looks wrong, dispatch a follow-up agent with the specific evidence.

5. **Report concisely.** One or two sentences on what changed. Defer further iterations to the user.

## Iteration agent prompt template

The agent doesn't have your context; brief it like a smart colleague walking in. Always include:

- **The defect, with file/line specificity** if you can. "The half-note stem at the C5 doesn't connect to the head" beats "fix the half note."
- **The expected behavior, with engraving rationale**. Cite Gould/Bravura/Lilypond if applicable.
- **Project conventions** the agent must respect:
  - Integration-first tests in `src/NotationRenderer.test.js` going through `ctx.render([...])` and querying the DOM. Unit tests need an explicit reason.
  - The agent must spawn a *second* sub-agent to audit its newly-added test for integration-first quality before running the suite. (Sub-sub-agents can't use the Agent tool, so the audit must be the agent's own first dispatch.) Audit prompt template included below.
  - One iteration = one commit. Commit message in the style of recent commits (`git log --oneline -10`).
- **The success criterion**: snap the preset and verify the fix is visible.

### Template

```
You're driving one iteration of a visual TDD loop in
~/Development/personal dev work.nosync/resound-notation.

DEFECT: <one-sentence description>
EVIDENCE: <preset name + what looks wrong + reference to /tmp/notation-snaps/<preset>.png if helpful>
EXPECTED: <engraving rule + citation>

Your iteration:
1. Read the project CLAUDE.md (repo root) and TODO.md for context.
2. Add ONE failing integration test in src/NotationRenderer.test.js
   that pins the corrected behavior. Test through ctx.render([...]) and
   query the resulting DOM. Avoid unit tests unless there's a specific
   reason. Run jest matching that test name to confirm it's RED.
3. Spawn a fresh general-purpose agent to AUDIT the test before fixing:
   "Audit this newly-added test for integration-first quality. File:
   src/NotationRenderer.test.js, test: '<title>', lines <range>. Decide:
   public API (yes/no), strictness (over-pinned/right/under), duplication
   with unit tests, convention fit. Report APPROVE / REVISE under 200
   words. Don't modify any files." Address REVISE feedback before
   proceeding.
4. Make the smallest change that turns the test green. Touch SMuFL glyph
   metadata (src/assets/glyphs.js) or component layout, not test
   assertions, to fix.
5. Run the full suite (npx jest) and verify all tests pass.
6. Snap the preset (cd dev && ./snap.sh <preset>) and Read the PNG to
   visually confirm the fix.
7. git add -A and commit with a Gould-style explanatory message:
   subject describes what changed, body explains why and includes the
   engraving rationale. Co-author trailer.

Constraints:
- One commit per iteration.
- Don't touch CLAUDE.md, TODO.md, or unrelated tests.
- If the fix spans Note.js, Beam.js, NotationRenderer.js, GraceNote.js,
  update them in lockstep — these four duplicate the head/stem geometry
  intentionally.
- Geometry conventions in TODO.md and the existing constants are
  load-bearing. Don't change LINE_SPACING, STEM_LENGTH, BEAM_THICKNESS,
  etc. unless that's the defect.

Report when done: file paths touched, commit hash, one sentence on the
visible change. Under 200 words.
```

## Repo cheat sheet

- **Main entry:** `src/NotationRenderer.js`
- **Per-element components:** `src/components/{Note,Beam,GraceNote,Clef,Rest,Accidental,...}.js`
- **SMuFL glyph data:** `src/assets/glyphs.js` (path `d` strings + bbox + tip metadata extracted from `~/Desktop/smufl-glyphs/bravura/`)
- **Coordinate system:** 1 staff space = 20px = 250 SMuFL font units. Scale 0.08 from font units to local pixels. y=0 in font units = staff midline.
- **Integration tests:** `src/NotationRenderer.test.js` (the canonical place to land new behavior tests). 520+ tests, jsdom env.
- **Dev playground:** `dev/` (separate package, vite). `snap.html` accepts `?preset=<name>&width=<px>`. `snap.sh` wraps headless Chrome.

## Saved feedback (auto-loads from memory)

- Default to integration tests through public APIs; unit tests need an explicit reason.
- For scoped multi-step jobs, spawn a fresh agent and verify; don't run heavy work in-session.
- Cache busts: when iterating, snap fresh — Vite HMR is reliable but verify the DOM dump (`grep` the rendered SVG for the value you expect).

## When NOT to use this skill

- One-off exploratory questions ("what does this preset look like?") — just snap and view directly, no need for the iteration loop.
- Bugs that need debugging across multiple files where the defect isn't visible — use a Plan agent or work directly, not this skill.
- Asset additions where the issue is "we don't have a glyph for X yet" — that's an asset-sourcing task, not an iteration.
