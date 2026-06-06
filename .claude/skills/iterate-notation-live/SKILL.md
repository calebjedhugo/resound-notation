---
name: iterate-notation-live
description: Boot the resound-notation dev playground and open it in a live browser (chrome-devtools MCP) so you and the user are looking at the SAME rendered notation, then run the iterate-notation polish loop. Use when the user says "load the notation dev env in the browser", "let's look at <preset> together", "open resound-notation so we can both see it", or invokes /iterate-notation-live. For the snap-only loop without a shared browser, use iterate-notation instead.
---

# Iterate on notation rendering — with a shared live browser

Same goal as the sibling `iterate-notation` skill (visual polish of the SMuFL/Bravura
renderer in `resound-notation`), but it first stands up a **live browser tab the user
also has open**, so you both see the same page in real time. The live browser also lets
you inspect the rendered DOM directly for exact coordinates — far more precise than a
PNG snap when diagnosing overlaps, alignment, or spacing.

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

## Step 3 — Do the work (follow iterate-notation)

From here, **follow the process documented in the sibling skill**:
`../iterate-notation/SKILL.md` (read it now and execute it). In short: pick the next
visually-off thing, dispatch ONE focused agent per defect to run the red → audit →
green → snap → commit cycle, then verify yourself and check in with the user.

Differences when running the live variant:
- **Verify in the live browser, not just `snap.sh`.** After an agent returns, reload the
  tab (or re-click the preset) and re-run the overlap/position `evaluate_script` to
  confirm the fix landed in the actual DOM. The agent's summary says what it intended;
  the live DOM shows what happened.
- The agents themselves still use `snap.sh` + TDD as documented in `iterate-notation`
  — the shared browser is the **main session's** eyes, not the agent's.

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
