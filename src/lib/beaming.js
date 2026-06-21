/**
 * Beam grouping logic.
 * Groups notes into beam groups based on time signature and beat boundaries.
 * Pure data module — no DOM.
 */

import { getDurationInfo, fractionToBeats } from './durationSymbols.js';

const MAX_GROUP_SIZE = 4;

// Middle staff line in the pitchToStaffY frame. Mirror of MIDDLE_LINE_Y in
// NotationRenderer.js; kept here so the (pure) stem-direction rule has no
// DOM/geometry dependency.
const MIDDLE_LINE_Y = 50;

/**
 * Stem direction for a beamed group, per Gould "Behind Bars" (Stems):
 * the note FARTHEST from the middle staff line sets the whole group's
 * direction. A note below the middle line (larger y) farthest out → stems
 * UP; a note above (smaller y) farthest out → stems DOWN. This replaces
 * the old average-pitch rule, which mishandled wide groups straddling the
 * middle line (e.g. Bach Prelude m2 RH: D4 is farther below than E5 is
 * above, so the group should stem UP, not down).
 *
 * Tie-break (a note equidistant above and below, e.g. a symmetric group
 * centered on the middle line): on a multi-staff system the upper staff
 * stems UP and the lower staff stems DOWN (point away from the other
 * staff — grand-staff convention). On a single staff, fall back to the
 * existing high-note rule (governing y ≤ middle → stems down).
 *
 * @param {number[]} yValues - pitchToStaffY for each note in the group
 * @param {{voiceIndex?: number, voiceCount?: number}} [ctx]
 * @returns {boolean} true if stems point down
 */
export function beamGroupStemDown(yValues, ctx = {}) {
  if (!yValues || yValues.length === 0) return false;
  let governingY = yValues[0];
  let bestDist = Math.abs(yValues[0] - MIDDLE_LINE_Y);
  let tied = false;
  for (let i = 1; i < yValues.length; i++) {
    const d = Math.abs(yValues[i] - MIDDLE_LINE_Y);
    if (d > bestDist) {
      bestDist = d;
      governingY = yValues[i];
      tied = false;
    } else if (d === bestDist && Math.sign(yValues[i] - MIDDLE_LINE_Y) !== Math.sign(governingY - MIDDLE_LINE_Y)) {
      // Equidistant note on the opposite side of the middle line.
      tied = true;
    }
  }
  if (tied || bestDist === 0) {
    const { voiceIndex, voiceCount } = ctx;
    if (typeof voiceIndex === 'number' && typeof voiceCount === 'number' && voiceCount > 1) {
      // Multi-staff: upper staff up, lower staff down.
      return voiceIndex === voiceCount - 1;
    }
    // Single staff: existing high-note rule.
    return governingY <= MIDDLE_LINE_Y;
  }
  // Farthest note below middle (y > middle) → stems up; above → down.
  return governingY < MIDDLE_LINE_Y;
}

/**
 * Compute the beat length in quarter-note-beats for a time signature.
 * Detects compound time (6/8, 9/8, 12/8, 3/8) and uses compound beats.
 */
function getBeatLength(timeSignature) {
  const [beats, beatValue] = timeSignature;
  const baseBeatLength = 4 / beatValue;

  // Compound time: numerator divisible by 3, beat value is 8 or smaller
  if (beats % 3 === 0 && beatValue >= 8) {
    return baseBeatLength * 3;
  }
  return baseBeatLength;
}

/**
 * Get the beat duration for a note element, accounting for dotted flag.
 */
function getElementBeats(element) {
  if (!element.length) return 0;
  let beats = fractionToBeats(element.length);
  if (element.dotted) beats *= 1.5;
  return beats;
}

/**
 * Group notes into beam groups based on time signature and beat boundaries.
 *
 * Rules:
 * - Beam 8th notes and smaller within the same beat
 * - Break beams at beat boundaries
 * - Max 4 notes per beam group
 * - Rests break beams
 * - Unmetered mode (null timeSignature) = no beaming
 *
 * @param {Array} notes - Array of note/rest/chord elements
 * @param {[number, number]|null} timeSignature
 * @returns {Array<Array<number>>} Array of beam groups (each is array of indices)
 */
export function computeBeamGroups(notes, timeSignature) {
  if (!timeSignature) return [];
  if (notes.length === 0) return [];

  const beatLength = getBeatLength(timeSignature);

  // First pass: annotate elements with metadata
  const annotated = [];
  let currentBeat = 0;

  for (let i = 0; i < notes.length; i++) {
    const element = notes[i];

    if (Array.isArray(element)) {
      // Chord — not beamable yet, but advance beat
      const length = element[0]?.length;
      if (length) {
        let beats = fractionToBeats(length);
        if (element[0].dotted) beats *= 1.5;
        currentBeat += beats;
      }
      annotated.push({ index: i, beamable: false });
      continue;
    }

    const isRest = !element.pitch;
    const beats = getElementBeats(element);

    let beamable = false;
    let beatGroup = -1;

    if (!isRest && element.length) {
      const info = getDurationInfo(element.length);
      beamable = info.beams >= 1;
      beatGroup = Math.floor((currentBeat + 0.001) / beatLength);
    }

    annotated.push({ index: i, beamable, beatGroup });
    currentBeat += beats;
  }

  // Second pass: group consecutive beamable notes in the same beat
  const groups = [];
  let currentGroup = [];
  let currentGroupBeat = -1;

  for (const el of annotated) {
    if (el.beamable) {
      if (el.beatGroup !== currentGroupBeat) {
        // New beat — flush current group
        if (currentGroup.length >= 2) {
          groups.push(currentGroup.map((e) => e.index));
        }
        currentGroup = [el];
        currentGroupBeat = el.beatGroup;
      } else if (currentGroup.length >= MAX_GROUP_SIZE) {
        // Same beat but group full — flush and start sub-group
        groups.push(currentGroup.map((e) => e.index));
        currentGroup = [el];
      } else {
        currentGroup.push(el);
      }
    } else {
      // Not beamable — flush
      if (currentGroup.length >= 2) {
        groups.push(currentGroup.map((e) => e.index));
      }
      currentGroup = [];
      currentGroupBeat = -1;
    }
  }

  // Flush final group
  if (currentGroup.length >= 2) {
    groups.push(currentGroup.map((e) => e.index));
  }

  return groups;
}
