/**
 * Pure intrinsic-width measurement pass.
 *
 * For each voice, walks the events and groups them into measures using the
 * voice's time signature. For each event, computes a structured EventLayout
 * record:
 *   - fixedWidth        notehead + accidental + dot (does NOT stretch)
 *   - gapNatLength      natural length of the gap AFTER this event before
 *                       the next (the spring's rest length)
 *   - gapStretchability spring constant K — how much the gap stretches per
 *                       unit of force
 *   - durationBeats     duration of the note starting that gap (for spring
 *                       solver and diagnostics)
 *
 * Per-measure `intrinsicWidth` is the natural width — sum of `fixedWidth` +
 * sum of `gapNatLength` (+ trailing barline gap). That is, the width the
 * measure occupies at rest with no spring force applied. `breakIntoSystems`
 * uses this minimum-ish width to pack measures left-to-right.
 *
 * NATURAL LENGTH FORMULA — Gould "Behind Bars" (Spacing chapter) and
 * Lilypond. Each duration doubling adds a constant chunk of horizontal
 * space (log-based, not linear), then we clamp at MIN_GAP so 16ths don't
 * collapse into each other:
 *   L_nat(d) = max(BASE_GAP + LOG_FACTOR * log2(d / quarter), MIN_GAP)
 * Dotted: L_nat * 1.5.
 *
 * STRETCHABILITY FORMULA — gaps with more natural slack are more
 * stretchable. Simple and robust:
 *   K(d) = max(L_nat(d) - MIN_GAP, 1)
 *
 * Tuned constants (visible spring sanity-check on snap battery — quarters
 * pull comfortably more space than eighths/sixteenths under stretch, halves
 * pull even more, without 16ths collapsing):
 *   BASE_GAP    = 18  (a quarter note's at-rest gap matches MIN_NOTE_GAP)
 *   LOG_FACTOR  = 12  (each doubling adds 12 px to the at-rest gap)
 *   MIN_GAP     = 10  (floor — shorter than 8th notes clamp here)
 *
 * No DOM, no I/O.
 *
 * @typedef {Object} EventLayout
 * @property {number} fixedWidth
 * @property {number} gapNatLength
 * @property {number} gapStretchability
 * @property {number} durationBeats
 *
 * @typedef {Object} MeasureWidth
 * @property {number} measureIndex
 * @property {number} intrinsicWidth  natural width (sum of fixed + nat gaps)
 * @property {number} contentNoteCount
 * @property {Array<EventLayout>} events
 *
 * @typedef {Object} VoiceWidths
 * @property {string|number} voiceId
 * @property {Array<MeasureWidth>} measures
 *
 * @typedef {Object} IntrinsicWidths
 * @property {Array<VoiceWidths>} perVoice
 * @property {Array<{ measureIndex: number, intrinsicWidth: number }>} combined
 */

import { parseNoteData } from './dataParser.js';
import { fractionToBeats } from './durationSymbols.js';

// Per-event width constants. Notehead glyph widths approximate Bravura's
// actual rendered widths.
const NOTEHEAD_WIDTH_BY_LENGTH = {
  '1/1': 20, // whole
  '1/2': 12, // half
  '1/4': 12, // quarter
  '1/8': 12, // eighth
  '1/16': 12,
  '1/32': 12,
};
const DEFAULT_NOTEHEAD_WIDTH = 12;
const ACCIDENTAL_WIDTH = 14;
const DOT_WIDTH = 6;

// Spring-model tunables.
export const BASE_GAP = 18;
export const LOG_FACTOR = 12;
export const MIN_GAP = 10;

// Legacy alias preserved for callers that imported MIN_NOTE_GAP. Equal to
// BASE_GAP — quarter note's at-rest gap.
export const MIN_NOTE_GAP = BASE_GAP;
export const BARLINE_GAP = 10;

// Trailing barline spring — small natural length, modest stretchability so
// it doesn't dominate the system stretch.
const BARLINE_GAP_NAT = BARLINE_GAP;
const BARLINE_GAP_K = 4;

/**
 * Spring natural length for a gap whose starting event lasts `beats`
 * quarter-notes (so quarter=1, eighth=0.5, half=2, etc.).
 */
export function springNatLength(beats) {
  if (!beats || beats <= 0) return MIN_GAP;
  const raw = BASE_GAP + LOG_FACTOR * Math.log2(beats);
  return Math.max(raw, MIN_GAP);
}

/**
 * Spring stretchability K — gaps with more slack above MIN_GAP stretch
 * more under load. Floor at 1 so every spring contributes something.
 */
export function springStretchability(beats) {
  return Math.max(springNatLength(beats) - MIN_GAP, 1);
}

function hasAccidentalInPitch(pitchString) {
  if (typeof pitchString !== 'string') return false;
  return /^[A-G](#|b)\d$/.test(pitchString);
}

function noteheadWidthFor(length) {
  return NOTEHEAD_WIDTH_BY_LENGTH[length] !== undefined
    ? NOTEHEAD_WIDTH_BY_LENGTH[length]
    : DEFAULT_NOTEHEAD_WIDTH;
}

/**
 * Compute the per-event layout record for a single element. Returns null
 * when the element is a non-sounding marker (dynamic, hairpin, ottava,
 * barline, tuplet wrapper, etc.) and should not advance the measure cursor.
 *
 * @returns {EventLayout & { isSounding: boolean, count?: number } | null}
 */
function measureElement(element) {
  if (!element) return null;

  // Chord — array of note objects sharing a duration.
  if (Array.isArray(element)) {
    const notes = element.filter((n) => n && n.length);
    if (notes.length === 0) return null;
    const first = notes[0];
    const length = first.length;
    const dotted = !!first.dotted;
    const headWidth = noteheadWidthFor(length);
    let maxNoteWidth = 0;
    for (const n of notes) {
      const nh = noteheadWidthFor(n.length || length);
      const acc = hasAccidentalInPitch(n.pitch) ? ACCIDENTAL_WIDTH : 0;
      const w = nh + acc;
      if (w > maxNoteWidth) maxNoteWidth = w;
    }
    const fixedWidth = Math.max(maxNoteWidth, headWidth) + (dotted ? DOT_WIDTH : 0);
    const baseBeats = fractionToBeats(length);
    const dotFactor = dotted ? 1.5 : 1;
    const durationBeats = baseBeats * dotFactor;
    const gapNatLength = springNatLength(baseBeats) * dotFactor;
    const gapStretchability = springStretchability(baseBeats) * dotFactor;
    return { fixedWidth, gapNatLength, gapStretchability, durationBeats, isSounding: true };
  }

  // Tuplet wrapper — recurse into inner notes.
  if (element.tuplet && Array.isArray(element.notes)) {
    const [actual, normal] = element.tuplet;
    let fixedWidth = 0;
    let gapNatLength = 0;
    let gapStretchability = 0;
    let durationBeats = 0;
    let count = 0;
    for (const inner of element.notes) {
      const m = measureElement(inner);
      if (!m) continue;
      // Tuplet scales the durations: actual notes fit in normal's time.
      const scale = normal / actual;
      fixedWidth += m.fixedWidth;
      gapNatLength += m.gapNatLength * scale;
      gapStretchability += m.gapStretchability * scale;
      durationBeats += m.durationBeats * scale;
      if (m.isSounding) count += 1;
    }
    return { fixedWidth, gapNatLength, gapStretchability, durationBeats, isSounding: true, count };
  }

  // Sounding single note or rest (has length, no inline marker fields).
  if (element.length) {
    const length = element.length;
    const dotted = !!element.dotted;
    const nh = noteheadWidthFor(length);
    const acc = hasAccidentalInPitch(element.pitch) ? ACCIDENTAL_WIDTH : 0;
    const fixedWidth = nh + acc + (dotted ? DOT_WIDTH : 0);
    const baseBeats = fractionToBeats(length);
    const dotFactor = dotted ? 1.5 : 1;
    const durationBeats = baseBeats * dotFactor;
    const gapNatLength = springNatLength(baseBeats) * dotFactor;
    const gapStretchability = springStretchability(baseBeats) * dotFactor;
    return { fixedWidth, gapNatLength, gapStretchability, durationBeats, isSounding: true };
  }

  return null;
}

function measureVoice(voice) {
  const measures = [];
  const measureLength = voice.timeSignature
    ? voice.timeSignature[0] * (4 / voice.timeSignature[1])
    : null;

  let measureIndex = 0;
  let accumulatedBeats = 0;
  let currentEvents = [];
  let currentFixed = 0;
  let currentNatGap = 0;
  let currentCount = 0;

  const flush = () => {
    // The last event's gap leads to the barline; replace with a barline
    // spring (small natural length, modest K). For simplicity we add the
    // barline as a trailing pseudo-event in `events` so the spring solver
    // can see it.
    const eventsOut = currentEvents.map((e) => ({
      fixedWidth: e.fixedWidth,
      gapNatLength: e.gapNatLength,
      gapStretchability: e.gapStretchability,
      durationBeats: e.durationBeats,
    }));
    measures.push({
      measureIndex,
      intrinsicWidth: currentFixed + currentNatGap + BARLINE_GAP_NAT,
      contentNoteCount: currentCount,
      events: eventsOut,
      barlineSpring: { gapNatLength: BARLINE_GAP_NAT, gapStretchability: BARLINE_GAP_K },
    });
    measureIndex += 1;
    accumulatedBeats = 0;
    currentEvents = [];
    currentFixed = 0;
    currentNatGap = 0;
    currentCount = 0;
  };

  for (const element of voice.notes || []) {
    // Explicit barline token splits a measure regardless of time signature.
    if (element && !Array.isArray(element) && element.barline !== undefined) {
      flush();
      continue;
    }

    const m = measureElement(element);
    if (!m) continue;

    currentEvents.push(m);
    currentFixed += m.fixedWidth;
    currentNatGap += m.gapNatLength;
    currentCount += m.count || 1;
    accumulatedBeats += m.durationBeats;

    if (measureLength && accumulatedBeats >= measureLength - 1e-6) {
      const overflow = accumulatedBeats - measureLength;
      flush();
      accumulatedBeats = overflow > 1e-6 ? overflow : 0;
    }
  }

  // Trailing partial measure (or the whole song when there's no time sig).
  if (currentFixed > 0 || currentCount > 0) {
    flush();
  }

  return { voiceId: voice.id, measures };
}

/**
 * Compute intrinsic minimum widths per measure per voice.
 *
 * @param {Array|Object} song - Level 1/2/3 song input.
 * @returns {IntrinsicWidths}
 */
export function measureIntrinsicWidths(song) {
  const parsed = parseNoteData(song);
  const perVoice = parsed.voices.map((v) => measureVoice(v));

  const combinedMap = new Map();
  for (const v of perVoice) {
    for (const m of v.measures) {
      const prev = combinedMap.get(m.measureIndex);
      if (prev === undefined || m.intrinsicWidth > prev) {
        combinedMap.set(m.measureIndex, m.intrinsicWidth);
      }
    }
  }
  const combined = Array.from(combinedMap.keys())
    .sort((a, b) => a - b)
    .map((measureIndex) => ({
      measureIndex,
      intrinsicWidth: combinedMap.get(measureIndex),
    }));

  return { perVoice, combined };
}

export const __TESTING__ = {
  ACCIDENTAL_WIDTH,
  DOT_WIDTH,
  MIN_NOTE_GAP,
  BARLINE_GAP,
  BASE_GAP,
  LOG_FACTOR,
  MIN_GAP,
  noteheadWidthFor,
  springNatLength,
  springStretchability,
};
