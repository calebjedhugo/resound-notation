---
name: iterate-notation-live
description: Boot the resound-notation dev playground and open it in a live browser (chrome-devtools MCP) so you and the user are looking at the SAME rendered notation, then WAIT for the user to say what to fix — do not pick defects on your own. When the user names a fix, dispatch an agent that drives the live browser directly (chrome-devtools) to see the defect and verify its fix, following iterate-notation's TDD discipline. Use when the user says "load the notation dev env in the browser", "let's look at <preset> together", "open resound-notation so we can both see it", or invokes /iterate-notation-live. For the snap-only autonomous loop, use iterate-notation instead.
---

# Iterate on notation rendering — with a shared live browser

Same engineering discipline as the sibling `iterate-notation` skill (visual polish of the
SMuFL/Bravura renderer in `resound-notation`), with two deliberate differences:

1. **You do NOT pick what to fix.** After setup you stop and wait for the user. This skill
   is driver-in-the-loop, not autonomous.
2. **The fix agents drive the live browser directly** (chrome-devtools MCP) to see the
   defect and verify their own fix in the real DOM — not `snap.sh` PNGs.

It first stands up a **live browser tab the user also has open**, so you both see the same
page in real time, and the DOM can be inspected for exact coordinates.

## Step 1 — Boot the dev server (once)

```bash
cd "/Users/calebhugo/Development/personal dev work.nosync/resound-notation/dev"
npm run dev          # run in the BACKGROUND; serves http://localhost:5173/
```

Wait for `Local: http://localhost:5173/` in the output before opening the browser.

## Step 2 — Open the shared browser (chrome-devtools MCP)

Use the `chrome-devtools` MCP tools (load schemas via ToolSearch first; they're deferred):

1. `new_page` → `http://localhost:5173/` (it auto-redirects to a `?preset=…` URL).
2. `take_screenshot` to confirm the playground loaded, then tell the user you're both
   looking at the same tab.
3. Switch presets by clicking the chips. The preset slug in the URL is the chip's
   **display label** (`?preset=Twinkle+Twinkle`, `?preset=single-voice-treble`), not a
   guessed slug — when unsure, `take_snapshot` and click the button by uid.

Inspect precisely with `evaluate_script` against `svg.notation`. Noteheads are
`g.note > .note-head`; each `g.note` carries a `transform="translate(x, y)"` and a
`data-beat`. To check for the classic "two notes rendered on top of each other" bug,
pull every note's x and flag pairs within ~0.5px:

```js
() => {
  const svg = document.querySelector('svg.notation');
  const notes = [...svg.querySelectorAll('g.note')].map(g => ({
    beat: g.getAttribute('data-beat'),
    x: parseFloat(/translate\(([-\d.]+)/.exec(g.getAttribute('transform'))[1]),
  }));
  const overlaps = notes.filter((n,i) => i && Math.abs(n.x - notes[i-1].x) < 0.5);
  return { count: notes.length, overlaps };
}
```

## Step 3 — STOP. Wait for the user to name the fix.

After the browser is open and confirmed, **do not start fixing anything.** Do not scan
for defects, do not pick "the next visually-off thing," do not dispatch any agent. Say
what's on screen, then hand control back to the user and wait. The user decides what to
fix and when.

(This is the key difference from `iterate-notation`, whose default is to pick the next
defect itself. Here, you only act on an explicit instruction.)

You may, when asked, help the user look: switch presets, screenshot, run the
`evaluate_script` DOM probes above. That's observation, not iteration — still no agents.

## Step 4 — When the user names a fix, dispatch a browser-driving agent

One agent per defect the user names. Follow the TDD discipline documented in
`../iterate-notation/SKILL.md` (read it for the red → audit → green → full-suite →
commit cycle, the integration-first test rules, and the lockstep-files constraint), with
these live-variant overrides:

- **The agent uses the live browser, not `snap.sh`.** It loads the chrome-devtools MCP
  tools (via ToolSearch) and drives the browser to (a) observe the defect and (b) verify
  its own fix in the real DOM with `take_screenshot` + the `evaluate_script` probes.
- **Browser hygiene:** the agent opens its OWN page with `new_page` (don't hijack the
  user's tab), works there, and closes it when done. Run agents **sequentially** (one
  defect at a time) — multiple agents driving Chrome at once collide.
- **To see a source edit in the browser the agent MUST restart Vite** (the `.nosync` HMR
  gotcha below): `pkill -f vite`, `rm -rf dev/node_modules/.vite`, restart `npm run dev`,
  then load its page with `ignoreCache`. A plain reload shows stale output.
- **`npx jest` remains the source of truth for correctness** (unaffected by HMR); the
  browser is for the *visual* confirmation the user cares about.

After the agent returns, **verify in the shared tab yourself** — reload with `ignoreCache`
and re-run the overlap/position probe; the agent's summary says what it intended, the live
DOM shows what happened. Report one or two sentences, then **wait for the next
instruction** (back to Step 3). Never auto-advance to another fix.

> Note: subagents driving chrome-devtools depends on MCP tools being available inside the
> dispatched agent. Verify on first use; if the agent can't reach chrome-devtools, fall
> back to having it use `snap.sh` for its own viewing while the MAIN session does the live
> browser verification.

### Agent prompt template (live variant)

```
One iteration of a visual fix in
~/Development/personal dev work.nosync/resound-notation. A Vite dev server
is running (dev/, http://localhost:5173) and the user is watching a tab.

DEFECT (named by the user): <one sentence>
PRESET / INPUT: <preset label or JSON the user gave>
EXPECTED: <engraving rule + Gould/Bravura citation if any>

Do this:
1. Read the repo CLAUDE.md and ../iterate-notation/SKILL.md for conventions.
2. Load the chrome-devtools MCP tools (ToolSearch), new_page your OWN tab to
   http://localhost:5173/?preset=<label>, and confirm you can see the defect
   (take_screenshot + evaluate_script over svg.notation). If chrome-devtools
   is unavailable to you, say so and use dev/snap.sh instead.
3. Add ONE failing integration test in src/NotationRenderer.test.js through
   ctx.render([...]) querying the DOM; run jest to confirm RED.
4. Spawn a fresh agent to AUDIT the test (integration-first quality) before
   fixing; address REVISE feedback. (Audit prompt: see iterate-notation.)
5. Make the smallest change that turns it green. Run `npx jest`; all pass.
6. Restart Vite so the browser reflects the edit (pkill -f vite;
   rm -rf dev/node_modules/.vite; npm run dev &), reload your tab with cache
   bypass, and visually confirm the fix + re-run the DOM probe.
7. Close your tab. git add -A and commit (Gould-style message, co-author
   trailer). One commit.

Constraints: don't touch CLAUDE.md/TODO.md/unrelated tests; keep
Note.js/Beam.js/NotationRenderer.js/GraceNote.js geometry in lockstep;
don't change load-bearing constants unless that's the defect.
Report: files touched, commit hash, one sentence on the visible change. <200 words.
```

## Gotchas (this environment) — see memory `reference_resound_dev_debug`

- **Vite HMR does NOT reliably pick up edits to `src/*.js`.** The repo lives under a
  `.nosync` (iCloud) folder, which breaks fsevents watching, so Vite serves a stale
  cached transform even while logging `hmr update /main.js`. After a source edit, to see
  it in the browser: `pkill -f vite`, `rm -rf dev/node_modules/.vite`, restart
  `npm run dev`, then reload the tab with `ignoreCache` (or a cache-bust query param).
  The agents run `npx jest` against `src/` directly, so they are unaffected — this only
  bites the live-browser view.
- **chrome-devtools console capture only sees logs emitted AFTER it attaches** (post
  initial page load). The renderer runs during module eval on load, so a `console.log`
  you add to the renderer won't show on first load. Trigger a re-render via an in-page
  interaction (click a preset chip) to capture it, or stash data on `window.__X` and
  read it back with `evaluate_script`.

## When NOT to use this skill

- Headless / cron / no-display runs — there's no shared browser to open; use
  `iterate-notation` (snap-only) instead.
- One-off "what does <preset> look like?" — just snap or open the tab and look; no
  iteration loop needed.
