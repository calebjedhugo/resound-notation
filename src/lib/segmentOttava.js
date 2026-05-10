/**
 * Ottava segmentation — decides which notes in a treble-clef voice should
 * render under an 8va or 8vb bracket. See OTTAVA-DESIGN.md for the spec.
 *
 * Pure logic, no DOM, no I/O. Operates on event arrays whose note events
 * carry pre-computed MIDI numbers.
 *
 * The algorithm runs in three passes:
 *   A. Single-voice raw segmentation (greedy + 3-note exit hysteresis)
 *      plus a context-pull post-merge (CP-1, CP-2, CP-3 precedence).
 *   B. Boundary snapping (prefer to start/end at barlines).
 *   C. Multi-voice reconciliation — drop conflicting spans, warn once.
 *
 * Input event shape:
 *   { kind: 'note', midi: number, index: number, isDownbeat?: boolean }
 *   { kind: 'rest', index: number }
 *   { kind: 'barline', index: number }
 *
 * Voice input: { voiceId, clef, events }.
 */

const TRIGGER_VA = 91; // G6
const IN_RANGE_MAX_VA = 89; // F6
const TRIGGER_VB = 50; // D3
const IN_RANGE_MIN_VB = 52; // E3
const EXIT_DIP = 3;
const CONTEXT_PULL_WINDOW = 4;
const SNAP_BUDGET = 2;

function notesOnly(events) {
  return events.filter((e) => e.kind === 'note');
}

function segmentDirection(events, kind) {
  // 8va vs 8vb direction parameterization. Returns trigger predicate,
  // in-range predicate (for exit-dip count), and the "within 12 of trigger"
  // predicate used by CP-1(a).
  if (kind === '8va') {
    return {
      isTrigger: (m) => m >= TRIGGER_VA,
      isInRange: (m) => m <= IN_RANGE_MAX_VA,
      isNearTrigger: (m) => m >= TRIGGER_VA - 12,
      trigger: TRIGGER_VA,
    };
  }
  return {
    isTrigger: (m) => m <= TRIGGER_VB,
    isInRange: (m) => m >= IN_RANGE_MIN_VB,
    isNearTrigger: (m) => m <= TRIGGER_VB + 12,
    trigger: TRIGGER_VB,
  };
}

function rawSegmentation(events, kind) {
  const dir = segmentDirection(events, kind);
  const segments = [];
  let state = 'OUT';
  let segStart = null;
  let dipCount = 0;

  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (e.kind !== 'note') continue;

    if (state === 'OUT') {
      if (dir.isTrigger(e.midi)) {
        segStart = i;
        state = 'IN';
        dipCount = 0;
      }
    } else {
      if (dir.isTrigger(e.midi)) {
        dipCount = 0;
      } else if (dir.isInRange(e.midi)) {
        dipCount += 1;
        if (dipCount >= EXIT_DIP) {
          // close at the note BEFORE the dip started — walk back over rests
          let segEnd = i;
          let inRangeSeen = 0;
          while (segEnd > segStart && inRangeSeen < EXIT_DIP) {
            if (events[segEnd].kind === 'note' && dir.isInRange(events[segEnd].midi)) {
              inRangeSeen += 1;
              if (inRangeSeen === EXIT_DIP) {
                segEnd -= 1;
                break;
              }
            }
            segEnd -= 1;
          }
          // Trim trailing rests/barlines
          while (segEnd > segStart && events[segEnd].kind !== 'note') {
            segEnd -= 1;
          }
          segments.push({
            kind,
            startIndex: segStart,
            endIndex: segEnd,
            closureReason: 'exit_dip_complete',
          });
          state = 'OUT';
          segStart = null;
          dipCount = 0;
        }
      }
      // else: neutral (MIDI 90 for 8va, MIDI 51 for 8vb) — do nothing
    }
  }

  if (state === 'IN') {
    // Walk back from the end to the last trigger-zone note. Any trailing
    // in-range run after the last trigger isn't part of the bracket — it
    // would be the start of an exit dip that just didn't complete.
    let lastTriggerIdx = -1;
    for (let i = events.length - 1; i >= segStart; i -= 1) {
      if (events[i].kind === 'note' && dir.isTrigger(events[i].midi)) {
        lastTriggerIdx = i;
        break;
      }
    }
    if (lastTriggerIdx >= 0) {
      segments.push({
        kind,
        startIndex: segStart,
        endIndex: lastTriggerIdx,
        closureReason: 'voice_ended',
      });
    }
  }

  return segments;
}

function noteIndicesBetween(events, startExclusive, endExclusive) {
  const idxs = [];
  for (let i = startExclusive + 1; i < endExclusive; i += 1) {
    if (events[i].kind === 'note') idxs.push(i);
  }
  return idxs;
}

function singleNoteSuppression(events, segments) {
  return segments.filter((seg) => {
    const noteIdxs = [];
    for (let i = seg.startIndex; i <= seg.endIndex; i += 1) {
      if (events[i].kind === 'note') noteIdxs.push(i);
    }
    if (noteIdxs.length !== 1) return true;

    const m = events[noteIdxs[0]].midi;
    // Find prior and next non-rest (note) across the full stream
    let prior = null;
    for (let i = noteIdxs[0] - 1; i >= 0; i -= 1) {
      if (events[i].kind === 'note') { prior = events[i].midi; break; }
    }
    let next = null;
    for (let i = noteIdxs[0] + 1; i < events.length; i += 1) {
      if (events[i].kind === 'note') { next = events[i].midi; break; }
    }
    // For 8va: drop if both neighbors are > 1 octave below m.
    // For 8vb: drop if both neighbors are > 1 octave above m.
    if (seg.kind === '8va') {
      if (prior !== null && prior >= m - 12) return true;
      if (next !== null && next >= m - 12) return true;
      return false;
    }
    if (prior !== null && prior <= m + 12) return true;
    if (next !== null && next <= m + 12) return true;
    return false;
  });
}

function contextPullMerge(events, segments, kind) {
  const dir = segmentDirection(events, kind);
  if (segments.length < 2) return segments;

  const out = [];
  let cur = { ...segments[0] };

  for (let i = 1; i < segments.length; i += 1) {
    const next = segments[i];
    // CP-3 precedence: do not merge across an exit_dip_complete closure.
    const canMerge = cur.closureReason !== 'exit_dip_complete';

    if (canMerge) {
      const gapNoteIdxs = noteIndicesBetween(events, cur.endIndex, next.startIndex);
      if (
        gapNoteIdxs.length <= CONTEXT_PULL_WINDOW
        && gapNoteIdxs.every((idx) => dir.isNearTrigger(events[idx].midi))
      ) {
        cur = {
          kind,
          startIndex: cur.startIndex,
          endIndex: next.endIndex,
          closureReason: next.closureReason === 'voice_ended' ? 'voice_ended' : 'merged',
        };
        continue;
      }
    }
    out.push(cur);
    cur = { ...next };
  }
  out.push(cur);
  return out;
}

function contextPullAbsorb(events, segments, kind) {
  // CP-2: absorb a leading/trailing in-range run (≤ CONTEXT_PULL_WINDOW)
  // where every note is within 12 semitones of TRIGGER, bounded by voice
  // start/end or a barline.
  const dir = segmentDirection(events, kind);

  return segments.map((seg, segIdx) => {
    let { startIndex, endIndex } = seg;
    const prev = segments[segIdx - 1];
    const next = segments[segIdx + 1];
    // CP-3 precedence: don't absorb across an exit_dip_complete boundary.
    const canAbsorbLeading = !(prev && prev.closureReason === 'exit_dip_complete');
    const canAbsorbTrailing = !(seg.closureReason === 'exit_dip_complete');

    // Leading absorb
    if (canAbsorbLeading) {
      const absorbed = [];
      const lowerBound = prev ? prev.endIndex + 1 : 0;
      for (let i = startIndex - 1; i >= lowerBound; i -= 1) {
        const ev = events[i];
        if (ev.kind === 'barline') break;
        if (ev.kind === 'rest') continue;
        // ev is note
        if (dir.isTrigger(ev.midi)) break; // shouldn't happen for in-range run
        if (!dir.isInRange(ev.midi)) break;
        if (!dir.isNearTrigger(ev.midi)) break;
        absorbed.push(i);
        if (absorbed.length >= CONTEXT_PULL_WINDOW) break;
      }
      if (absorbed.length > 0) {
        startIndex = absorbed[absorbed.length - 1];
      }
    }
    // Trailing absorb
    if (canAbsorbTrailing) {
      const absorbed = [];
      const upperBound = next ? next.startIndex : events.length;
      for (let i = endIndex + 1; i < upperBound; i += 1) {
        const ev = events[i];
        if (ev.kind === 'barline') break;
        if (ev.kind === 'rest') continue;
        if (dir.isTrigger(ev.midi)) break;
        if (!dir.isInRange(ev.midi)) break;
        if (!dir.isNearTrigger(ev.midi)) break;
        absorbed.push(i);
        if (absorbed.length >= CONTEXT_PULL_WINDOW) break;
      }
      if (absorbed.length > 0) {
        endIndex = absorbed[absorbed.length - 1];
      }
    }
    return { ...seg, startIndex, endIndex, closureReason: seg.closureReason === 'exit_dip_complete' ? seg.closureReason : 'absorbed' };
  });
}

function boundarySnap(events, segments) {
  // Pass B: prefer to start/end at a barline within SNAP_BUDGET events.
  // Constraint: don't change which trigger note enters; don't overlap
  // adjacent segments; don't shrink below 2 non-rest events.
  const isBarOrDown = (i) => {
    if (i < 0 || i >= events.length) return false;
    const e = events[i];
    return e.kind === 'barline' || (e.kind === 'note' && e.isDownbeat);
  };

  return segments.map((seg, segIdx) => {
    const prev = segments[segIdx - 1];
    const next = segments[segIdx + 1];

    let { startIndex, endIndex } = seg;

    // Snap start (prefer earlier)
    for (let delta = -SNAP_BUDGET; delta <= SNAP_BUDGET; delta += 1) {
      const cand = startIndex + delta;
      if (cand === startIndex) continue;
      if (!isBarOrDown(cand)) continue;
      if (prev && cand <= prev.endIndex) continue;
      // Don't push the start past the trigger note
      // (just leave at trigger — keep simple)
      // For now we conservatively accept earlier candidates only.
      if (cand < startIndex) {
        startIndex = cand;
        break;
      }
    }
    // Snap end (prefer later)
    for (let delta = SNAP_BUDGET; delta >= -SNAP_BUDGET; delta -= 1) {
      const cand = endIndex + delta;
      if (cand === endIndex) continue;
      if (!isBarOrDown(cand)) continue;
      if (next && cand >= next.startIndex) continue;
      if (cand > endIndex) {
        endIndex = cand;
        break;
      }
    }

    // Endpoint must be a note, not a barline/rest
    while (endIndex > startIndex && events[endIndex].kind !== 'note') {
      endIndex -= 1;
    }
    while (startIndex < endIndex && events[startIndex].kind !== 'note') {
      startIndex += 1;
    }

    return { ...seg, startIndex, endIndex };
  });
}

/**
 * Single-voice Pass A + Pass B. Returns [] for non-treble clefs (8vb is
 * also runnable on treble; bass voices short-circuit per the spec).
 */
export function segmentOttava(input) {
  if (!input || !input.events) return [];
  if (input.clef && input.clef !== 'treble') return [];

  const { events, voiceId } = input;

  // Pass A: run 8va and 8vb directions independently; they cannot overlap
  // because their trigger zones are 41 semitones apart.
  let segments = [];
  for (const kind of ['8va', '8vb']) {
    let raw = rawSegmentation(events, kind);
    raw = singleNoteSuppression(events, raw);
    raw = contextPullMerge(events, raw, kind);
    raw = contextPullAbsorb(events, raw, kind);
    segments = segments.concat(raw);
  }
  segments.sort((a, b) => a.startIndex - b.startIndex);

  // Pass B: boundary snap
  segments = boundarySnap(events, segments);

  return segments.map((s) => ({
    kind: s.kind,
    startIndex: s.startIndex,
    endIndex: s.endIndex,
    voiceIds: voiceId !== undefined ? [voiceId] : [],
    closureReason: s.closureReason,
  }));
}

/**
 * Pass C — multi-voice reconciliation.
 *
 * For every pair of voices, find overlapping segments that disagree on
 * kind. Drop the conflicting region from both voices and emit one
 * console.warn per conflict.
 *
 * Time domain: we use event indices, which only make sense within a single
 * voice. For cross-voice comparison we use the segment's index range as a
 * proxy for time. This is approximate but matches the spec's intent.
 */
export function reconcileOttava(perVoice) {
  if (!Array.isArray(perVoice) || perVoice.length < 2) {
    return perVoice ? perVoice.map((segs) => [...segs]) : [];
  }
  const out = perVoice.map((segs) => segs.map((s) => ({ ...s, voiceIds: [...s.voiceIds] })));

  for (let i = 0; i < out.length; i += 1) {
    for (let j = i + 1; j < out.length; j += 1) {
      const a = out[i];
      const b = out[j];
      const toDropA = new Set();
      const toDropB = new Set();
      for (let ai = 0; ai < a.length; ai += 1) {
        for (let bi = 0; bi < b.length; bi += 1) {
          const sa = a[ai];
          const sb = b[bi];
          const overlap = !(sa.endIndex < sb.startIndex || sb.endIndex < sa.startIndex);
          if (!overlap) continue;
          if (sa.kind !== sb.kind) {
            // eslint-disable-next-line no-console
            console.warn(
              `resound-notation: voices ${i} and ${j} disagree on 8va over `
                + `[${Math.max(sa.startIndex, sb.startIndex)}..${Math.min(sa.endIndex, sb.endIndex)}]; `
                + 'rendering without ottava. Consider splitting onto separate staves.'
            );
            toDropA.add(ai);
            toDropB.add(bi);
          } else {
            // Agreement — share the bracket
            const merged = Array.from(new Set([...sa.voiceIds, ...sb.voiceIds]));
            sa.voiceIds = merged;
            sb.voiceIds = merged;
          }
        }
      }
      out[i] = a.filter((_, ai) => !toDropA.has(ai));
      out[j] = b.filter((_, bi) => !toDropB.has(bi));
    }
  }
  return out;
}

/**
 * Convenience top-level: run Pass A+B per voice, then Pass C across voices.
 */
export function analyzeOttava(voices) {
  if (!Array.isArray(voices) || voices.length === 0) return [];
  const perVoice = voices.map((v) => segmentOttava(v));
  return reconcileOttava(perVoice);
}
