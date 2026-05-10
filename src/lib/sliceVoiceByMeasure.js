/**
 * Slice a voice's note array by measure index range.
 *
 * Used by the system-breaking pass to hand each system a per-voice note
 * array containing exactly the measures that system covers. Non-sounding
 * markers (dynamics, hairpins, navigation, etc.) attach to the *next*
 * sounding note, so they belong to whatever measure that note is in.
 *
 * @param {Array} voiceNotes
 * @param {number|null} measureLength  beats per measure, null = no time sig
 * @param {number} startMeasure  inclusive
 * @param {number} endMeasure    inclusive
 * @returns {Array}  sliced subset of voiceNotes
 */
import { fractionToBeats } from './durationSymbols.js';
import { getTupletNoteDuration } from './tuplets.js';

function elementBeats(element) {
  if (!element) return 0;
  if (Array.isArray(element)) {
    const first = element.find((n) => n && n.length);
    if (!first) return 0;
    return fractionToBeats(first.length) * (first.dotted ? 1.5 : 1);
  }
  if (element.tuplet && Array.isArray(element.notes)) {
    const [actual, normal] = element.tuplet;
    let total = 0;
    for (const inner of element.notes) {
      if (Array.isArray(inner)) {
        const first = inner.find((n) => n && n.length);
        if (first) total += getTupletNoteDuration(first.length, !!first.dotted, [actual, normal]);
      } else if (inner && inner.length) {
        total += getTupletNoteDuration(inner.length, !!inner.dotted, [actual, normal]);
      }
    }
    return total;
  }
  if (element.length && !isMarker(element)) {
    return fractionToBeats(element.length) * (element.dotted ? 1.5 : 1);
  }
  return 0;
}

function isMarker(element) {
  if (!element || Array.isArray(element)) return false;
  return (
    element.barline !== undefined
    || element.ending !== undefined
    || element.navigation !== undefined
    || element.tempo !== undefined
    || element.tempoChange !== undefined
    || element.expression !== undefined
    || element.rehearsal !== undefined
    || element.dynamic !== undefined
    || element.hairpin !== undefined
  );
}

export function sliceVoiceByMeasure(voiceNotes, measureLength, startMeasure, endMeasure) {
  // First pass: assign each note index to its measure index.
  const measureOf = new Array(voiceNotes.length).fill(-1);
  let measureIdx = 0;
  let beat = 0;
  // Pending markers attach to next sounding note.
  let pendingMarkerStart = null;
  for (let i = 0; i < voiceNotes.length; i += 1) {
    const el = voiceNotes[i];
    if (!el) continue;
    if (el && !Array.isArray(el) && el.barline !== undefined) {
      // Explicit barline: any pending markers attach to the current
      // measure (where the barline lives), THEN we advance.
      if (pendingMarkerStart !== null) {
        for (let j = pendingMarkerStart; j < i; j += 1) {
          if (measureOf[j] === -1 && isMarker(voiceNotes[j])) measureOf[j] = measureIdx;
        }
        pendingMarkerStart = null;
      }
      measureOf[i] = measureIdx;
      measureIdx += 1;
      beat = 0;
      continue;
    }
    if (isMarker(el)) {
      // Defer: marker attaches to the next sounding note's measure.
      if (pendingMarkerStart === null) pendingMarkerStart = i;
      continue;
    }
    const b = elementBeats(el);
    // This sounding note is in the current measure.
    measureOf[i] = measureIdx;
    // Flush pending markers to current measure.
    if (pendingMarkerStart !== null) {
      for (let j = pendingMarkerStart; j < i; j += 1) {
        if (measureOf[j] === -1 && isMarker(voiceNotes[j])) measureOf[j] = measureIdx;
      }
      pendingMarkerStart = null;
    }
    beat += b;
    if (measureLength && beat >= measureLength - 1e-6) {
      // Wrap any small overflow forward.
      const overflow = beat - measureLength;
      measureIdx += 1;
      beat = overflow > 1e-6 ? overflow : 0;
    }
  }
  // Trailing markers (no following sounding note) attach to the LAST
  // measure that received content. If `beat > 0` we're still inside the
  // current `measureIdx`; otherwise we just flushed, so the last live
  // measure is `measureIdx - 1`.
  if (pendingMarkerStart !== null) {
    const targetMeasure = beat > 0 ? measureIdx : Math.max(0, measureIdx - 1);
    for (let j = pendingMarkerStart; j < voiceNotes.length; j += 1) {
      if (measureOf[j] === -1 && isMarker(voiceNotes[j])) measureOf[j] = targetMeasure;
    }
  }

  // Second pass: collect elements whose measure is in range.
  const out = [];
  for (let i = 0; i < voiceNotes.length; i += 1) {
    const m = measureOf[i];
    if (m >= startMeasure && m <= endMeasure) out.push(voiceNotes[i]);
  }
  return out;
}
