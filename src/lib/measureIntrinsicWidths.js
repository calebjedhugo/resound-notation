/**
 * Pure intrinsic-width measurement pass.
 *
 * For each voice, walks the events and groups them into measures using the
 * voice's time signature. Returns the minimum natural width (in px) needed
 * to render each measure legibly — sum of per-event widths plus a trailing
 * barline gap. Excludes the system prelude (clef, key sig, time sig).
 *
 * No DOM, no I/O. Used by future iterations to drive responsive system
 * breaking and justification. This iteration only computes/exposes the
 * table; it does NOT feed into layout.
 *
 * @typedef {Object} MeasureWidth
 * @property {number} measureIndex
 * @property {number} intrinsicWidth
 * @property {number} contentNoteCount
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

// Per-event width constants. These match the visual scale used by the
// renderer (notehead glyphs ~12px wide, accidentals ~14px, etc.) but are
// intentionally kept here as a measurement-only contract — Iteration B+
// will tune them against the actual layout output.
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
export const MIN_NOTE_GAP = 18;
export const BARLINE_GAP = 10;

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
 * Compute the per-event intrinsic width for a single element. Returns null
 * when the element is a non-sounding marker (dynamic, hairpin, ottava,
 * barline, tuplet wrapper, etc.) and should not advance the measure cursor.
 *
 * Returns { width, beats } for sounding events.
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
    const width = Math.max(maxNoteWidth, headWidth)
      + (dotted ? DOT_WIDTH : 0)
      + MIN_NOTE_GAP;
    const beats = fractionToBeats(length) * (dotted ? 1.5 : 1);
    return { width, beats, isSounding: true };
  }

  // Tuplet wrapper — recurse into inner notes.
  if (element.tuplet && Array.isArray(element.notes)) {
    const [actual, normal] = element.tuplet;
    let width = 0;
    let beats = 0;
    let count = 0;
    for (const inner of element.notes) {
      const m = measureElement(inner);
      if (!m) continue;
      width += m.width;
      // Tuplet scales the durations: actual notes fit in normal's time.
      beats += m.beats * (normal / actual);
      if (m.isSounding) count += 1;
    }
    return { width, beats, isSounding: true, count };
  }

  // Sounding single note or rest (has length, no inline marker fields).
  if (element.length) {
    const length = element.length;
    const dotted = !!element.dotted;
    const nh = noteheadWidthFor(length);
    const acc = hasAccidentalInPitch(element.pitch) ? ACCIDENTAL_WIDTH : 0;
    const width = nh + acc + (dotted ? DOT_WIDTH : 0) + MIN_NOTE_GAP;
    const beats = fractionToBeats(length) * (dotted ? 1.5 : 1);
    return { width, beats, isSounding: true };
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
  let currentWidth = 0;
  let currentCount = 0;

  const flush = () => {
    measures.push({
      measureIndex,
      intrinsicWidth: currentWidth + BARLINE_GAP,
      contentNoteCount: currentCount,
    });
    measureIndex += 1;
    accumulatedBeats = 0;
    currentWidth = 0;
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

    currentWidth += m.width;
    currentCount += m.count || 1;
    accumulatedBeats += m.beats;

    if (measureLength && accumulatedBeats >= measureLength - 1e-6) {
      // Use a small epsilon for fp jitter. Wrap any small overflow into the
      // next measure's beat budget.
      const overflow = accumulatedBeats - measureLength;
      flush();
      accumulatedBeats = overflow > 1e-6 ? overflow : 0;
    }
  }

  // Trailing partial measure (or the whole song when there's no time sig).
  if (currentWidth > 0 || currentCount > 0) {
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
  noteheadWidthFor,
};
