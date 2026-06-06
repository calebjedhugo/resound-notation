---
name: iterate-notation-live
description: Boot the resound-notation dev playground and open it in a live browser (chrome-devtools MCP) so you and the user are looking at the SAME rendered notation, then WAIT for the user to say what to fix — do not pick defects on your own. When the user names a fix, dispatch an agent that observes the defect in the live browser directly (chrome-devtools, read-only — it reuses the shared tab, never opens/closes pages or restarts Vite) and fixes it via iterate-notation's TDD discipline; the main session does the post-fix visual verify. Use when the user says "load the notation dev env in the browser", "let's look at <preset> together", "open resound-notation so we can both see it", or invokes /iterate-notation-live. For the snap-only autonomous loop, use iterate-notation instead.
---

# Iterate on notation rendering — with a shared live browser

Same engineering discipline as the sibling `iterate-notation` skill (visual polish of the
SMuFL/Bravura renderer in `resound-notation`), with two deliberate differences:

1. **You do NOT pick what to fix.** After setup you stop and wait for the user. This skill
   is driver-in-the-loop, not autonomous.
2. **The fix agents observe the defect in the live browser directly** (chrome-devtools
   MCP, read-only) instead of `snap.sh` PNGs. The post-fix *visual* verify is done by the
   main session (it owns the Vite-restart needed to see source edits); the agent's own
   gate is `npx jest`.

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

One agent per defect the user names, run **sequentially** (one at a time — two agents
driving Chrome at once collide). Follow the TDD discipline documented in
`../iterate-notation/SKILL.md` (read it for the red → audit → green → full-suite →
commit cycle, the integration-first test rules, and the lockstep-files constraint), with
these live-variant overrides:

- **The agent observes the defect in the live browser (read-only), not `snap.sh`.** It
  loads the chrome-devtools MCP tools (via ToolSearch) and uses the **existing shared
  page** (`list_pages` → `select_page` the localhost tab, or `navigate_page` it to the
  preset) to confirm the defect with `take_screenshot` + the `evaluate_script` probes.
- **The agent MUST NOT manage page lifecycle.** No `new_page`, no `close_page`. (Tested:
  a subagent closing "its own" page closed the *user's* shared tab instead — look-alike
  localhost URLs and shifting page indices make cleanup unsafe. The single shared tab is
  the only browser surface; the user is watching it, so the agent simply reuses it.)
- **The agent MUST NOT restart Vite or do the post-edit *visual* verify.** Because of the
  `.nosync` HMR gotcha, seeing a source edit requires a Vite restart, and a Vite restart
  is a shared-resource action — keep it in the MAIN session. The agent's correctness gate
  is **`npx jest`** (unaffected by HMR); its integration test pins the visual property
  numerically. (Tested: an agent's `nohup`-backgrounded process *does* survive the agent
  exit, so an agent *could* restart Vite — we deliberately don't, to keep one owner of the
  dev-server lifecycle and avoid a half-restarted server if the agent errors.)

After the agent returns, **the MAIN session does the visual verify**: restart Vite
(`pkill -f vite`; `rm -rf dev/node_modules/.vite`; `npm run dev` in background), reload the
shared tab with `ignoreCache`, and re-run the overlap/position probe with the user
watching. The agent's summary says what it intended; the live DOM shows what happened.
Report one or two sentences, then **wait for the next instruction** (back to Step 3).
Never auto-advance to another fix.

> Confirmed by test: dispatched subagents CAN reach the chrome-devtools MCP (load tools
> via ToolSearch, screenshot, `evaluate_script`). If a future run finds they can't, fall
> back to the agent using `dev/snap.sh` for its own viewing while the MAIN session does the
> live-browser verify.

### Agent prompt template (live variant)

```
One iteration of a visual fix in
~/Development/personal dev work.nosync/resound-notation. A Vite dev server
is running (dev/, http://localhost:5173) and the user is watching ONE shared
browser tab.

DEFECT (named by the user): <one sentence>
PRESET / INPUT: <preset label or JSON the user gave>
EXPECTED: <engraving rule + Gould/Bravura citation if any>

Do this:
1. Read the repo CLAUDE.md and ../iterate-notation/SKILL.md for conventions.
2. Load the chrome-devtools MCP tools (ToolSearch). Observe the defect in the
   EXISTING shared tab (read-only): list_pages, select_page the localhost tab
   (or navigate_page it to ?preset=<label>), then take_screenshot +
   evaluate_script over svg.notation. DO NOT new_page and DO NOT close_page
   (that has closed the user's tab). If chrome-devtools is unavailable to you,
   say so and use dev/snap.sh instead.
3. Add ONE failing integration test in src/NotationRenderer.test.js through
   ctx.render([...]) querying the DOM; run jest to confirm RED.
4. Spawn a fresh agent to AUDIT the test (integration-first quality) before
   fixing; address REVISE feedback. (Audit prompt: see iterate-notation.)
5. Make the smallest change that turns it green. Run `npx jest`; all pass.
   This is your correctness gate — do NOT restart Vite, the main session
   handles the browser verify.
6. git add -A and commit (Gould-style message, co-author trailer). One commit.

Constraints: don't touch CLAUDE.md/TODO.md/unrelated tests; keep
Note.js/Beam.js/NotationRenderer.js/GraceNote.js geometry in lockstep;
don't change load-bearing constants unless that's the defect; never
new_page/close_page/restart-vite.
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
