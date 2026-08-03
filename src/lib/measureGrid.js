/**
 * THE measure grid (SPEC-pickup-and-barline-lyrics.md JOB B).
 *
 * One home for the beat↔measure mapping, including pickup (anacrusis)
 * support. With an optional `pickupBeats` p (0 = no pickup):
 *   - measure 0 spans beats [0, p)            (the pickup), else [0, L)
 *   - measure m ≥ 1 spans [p + (m-1)·L, p + m·L)
 * Every site that computes measure boundaries — the system breaker, voice
 * slicing, barline emission, shared barlines, accidental memory, beam
 * grouping — derives its arithmetic from these helpers so the whole
 * pipeline shifts together.
 *
 * With pickupBeats = 0 each helper reduces to the exact floating-point
 * operations the renderer used before pickup support existed, keeping
 * pickup-free output byte-identical.
 *
 * No DOM, no I/O.
 */

import { elementBeats } from './sliceVoiceByMeasure.js';

/**
 * First beat of measure `m`.
 * @param {number} m - measure index (pickup counts as measure 0)
 * @param {number} measureLength - beats per FULL measure
 * @param {number} [pickupBeats=0]
 * @returns {number}
 */
export function measureStartBeat(m, measureLength, pickupBeats = 0) {
  if (!pickupBeats) return m * measureLength;
  return m === 0 ? 0 : pickupBeats + (m - 1) * measureLength;
}

/**
 * Index of the measure containing `beat` (a beat exactly on a boundary
 * belongs to the measure it OPENS). Callers guarantee measureLength > 0.
 * @param {number} beat
 * @param {number} measureLength
 * @param {number} [pickupBeats=0]
 * @returns {number}
 */
export function measureIndexAt(beat, measureLength, pickupBeats = 0) {
  if (!pickupBeats) return Math.floor((beat + 1e-6) / measureLength);
  if (beat < pickupBeats - 1e-6) return 0;
  return 1 + Math.floor((beat - pickupBeats + 1e-6) / measureLength);
}

/**
 * Is `beat` on a measure boundary (the END of one measure / start of the
 * next)? beat 0 counts as a boundary; callers exclude it where needed.
 * @param {number} beat
 * @param {?number} measureLength
 * @param {number} [pickupBeats=0]
 * @returns {boolean}
 */
export function isMeasureBoundary(beat, measureLength, pickupBeats = 0) {
  if (!measureLength) return false;
  const shifted = pickupBeats ? beat - pickupBeats : beat;
  if (pickupBeats && shifted < -1e-6) return false;
  const ratio = shifted / measureLength;
  return Math.abs(ratio - Math.round(ratio)) < 1e-6;
}

/**
 * The number of beats that fill measure `m`: the pickup length for
 * measure 0 when a pickup exists, the full measure length otherwise.
 * @param {number} m
 * @param {number} measureLength
 * @param {number} [pickupBeats=0]
 * @returns {number}
 */
export function measureFillLength(m, measureLength, pickupBeats = 0) {
  return m === 0 && pickupBeats ? pickupBeats : measureLength;
}

/**
 * Beat-cursor offset that makes auto-beaming group a pickup against the
 * measure's END (standard engraving: anacrusis beats are counted from the
 * barline backwards). Adding L − p to every beat maps the pickup span
 * [0, p) onto the TAIL [L−p, L) of a virtual full measure and lands every
 * later downbeat on a beat-group boundary. 0 without a pickup.
 * @param {number} measureLength
 * @param {number} [pickupBeats=0]
 * @returns {number}
 */
export function pickupBeamOffset(measureLength, pickupBeats = 0) {
  return pickupBeats ? measureLength - pickupBeats : 0;
}

/**
 * Validate a `pickupBeats` declaration against the piece
 * (SPEC-pickup-and-barline-lyrics.md JOB B):
 *   - 0 < pickupBeats < measure length,
 *   - requires a time signature (measureLength),
 *   - every voice's content must fill the pickup exactly: no sounding
 *     element may straddle the pickup boundary, and no voice may end
 *     before it.
 * Throws on violation; returns undefined when valid.
 *
 * @param {Array<{id?: string, notes: Array}>} voices - parsed voices
 * @param {number} pickupBeats
 * @param {?number} measureLength - beats per full measure (shared)
 */
export function validatePickup(voices, pickupBeats, measureLength) {
  if (typeof pickupBeats !== 'number' || !Number.isFinite(pickupBeats) || pickupBeats <= 0) {
    throw new Error(`pickupBeats must be a positive number of beats; got ${pickupBeats}.`);
  }
  if (!measureLength) {
    throw new Error('pickupBeats requires a timeSignature (unmetered pieces have no measures).');
  }
  if (pickupBeats >= measureLength - 1e-9) {
    throw new Error(
      `pickupBeats (${pickupBeats}) must be shorter than a full measure (${measureLength} beats).`
    );
  }
  for (const voice of voices || []) {
    let beat = 0;
    for (const el of voice.notes || []) {
      const b = elementBeats(el);
      if (b <= 0) continue;
      if (beat < pickupBeats - 1e-6 && beat + b > pickupBeats + 1e-6) {
        throw new Error(
          `Voice "${voice.id}" does not fill the ${pickupBeats}-beat pickup exactly: `
          + `an element spanning beats ${beat}–${beat + b} crosses the pickup boundary.`
        );
      }
      beat += b;
      if (beat >= pickupBeats - 1e-6) break;
    }
    if (beat < pickupBeats - 1e-6) {
      throw new Error(
        `Voice "${voice.id}" does not fill the ${pickupBeats}-beat pickup exactly: `
        + `its content ends at beat ${beat}.`
      );
    }
  }
}
