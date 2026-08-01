/**
 * Syllable-width-aware note spacing — SPEC-lyric-spacing.md JOB 1.
 *
 * Lyric syllables render centered under their note but historically
 * contributed nothing to horizontal spacing, so adjacent syllables in the
 * same verse line crowded or overlapped when notes were close (short
 * durations, narrow systems).
 *
 * RULE: for each pair of CONSECUTIVE lyric-bearing notes within a voice,
 * for each verse line, the horizontal advance between the two anchors must
 * be at least
 *     (estWidth(sylA) + estWidth(sylB)) / 2 + LYRIC_GAP
 * Estimated widths use the character-count heuristic in components/Lyric.js
 * (jsdom offers no text metrics). The requirement is taken as the max
 * across all verse lines of a voice AND across all voices sharing the
 * system (staves are x-aligned on one beat->x map). Notes between the pair
 * that carry no syllable for that verse (melisma notes) subdivide the
 * requirement naturally — the constraint applies between the two ANCHOR
 * beats, so intervening notes only relax it.
 *
 * INTEGRATION: `applyLyricSpacing` widens the NATURAL beat->x map produced
 * by computeBeatLayout, inside computeSystemSpringLayout — the single
 * shared metric both the system breaker and the renderer consume. The line
 * breaker therefore sees wider measures (fewer per system), and because
 * justification in this architecture only ever STRETCHES from the natural
 * layout (never compresses below it), the minima survive justification by
 * construction. Across-barline anchor pairs are also safe: the rendered
 * across-bar advance (prePad + postPad + 2 x notehead half-width) is
 * always >= the natural map distance the constraint widened.
 *
 * No DOM, no I/O.
 */

import { fractionToBeats } from './durationSymbols.js';
import {
  estimateLyricWidth,
  VERSE_NUMBER_FONT_SIZE,
} from '../components/Lyric.js';

// Minimum visible daylight (px) between two adjacent syllables' estimated
// edges on the same verse line (SPEC-lyric-spacing.md: LYRIC_GAP ≈ 8).
export const LYRIC_GAP = 8;

// Gap (px) between a verse number's right edge and its syllable's
// estimated left edge — mirrors the renderer's placement offset.
export const VERSE_NUMBER_GAP = 4;

// Minimum daylight (px) the prelude paddings guarantee between the
// rightmost prelude INK (clef / key-sig / time-sig glyph edge) and the
// first note's CENTER. The tightest prelude is the time-sig case:
// TIME_SIG_PADDING's composition (see NotationRenderer.js) is ~19px glyph
// overshoot + 12px notehead half-width + 20px visible gap, i.e. 32px of
// true daylight to the note center. Key-sig-only and clef-only preludes
// guarantee more. A verse number extending further left than this from the
// first note's center would collide with prelude ink.
export const PRELUDE_NOTE_MIN_DAYLIGHT = 32;

// Clear air (px) to preserve between prelude ink and the verse number's
// left edge when reserving leading space (≈0.4 staff space).
export const VERSE_NUMBER_LEAD_CLEARANCE = 8;

/**
 * The syllable a `lyric` value contributes to verse `v` (0-based), or null
 * when that verse has no syllable on this note (melisma / verse ended).
 * A bare string is verse 1 (SPEC-multi-verse-lyrics.md: mixed usage allowed).
 */
export function lyricSyllableForVerse(lyric, v) {
  if (lyric === undefined || lyric === null) return null;
  if (Array.isArray(lyric)) {
    const s = lyric[v];
    return s === undefined || s === null ? null : s;
  }
  return v === 0 ? lyric : null;
}

/**
 * Number of lyric verses a voice carries: max over its notes of the lyric
 * array length (a bare string counts as 1 verse). 0 = no lyrics.
 */
export function maxLyricVerseCount(notes) {
  let n = 0;
  for (const el of notes || []) {
    if (!el || Array.isArray(el)) continue; // chords carry no lyric
    if (el.lyric === undefined) continue;
    n = Math.max(n, Array.isArray(el.lyric) ? el.lyric.length : 1);
  }
  return n;
}

/** Non-sounding inline marker (mirrors the renderer's getMarkerType). */
function isMarker(element) {
  if (Array.isArray(element)) return false;
  return (
    element.barline !== undefined ||
    element.ending !== undefined ||
    element.navigation !== undefined ||
    element.tempo !== undefined ||
    element.tempoChange !== undefined ||
    element.expression !== undefined ||
    element.rehearsal !== undefined ||
    element.dynamic !== undefined ||
    element.hairpin !== undefined
  );
}

/**
 * Walk a voice's notes with EXACTLY the beat arithmetic of the renderer's
 * collectVoiceEvents (same operations in the same order, so accumulated
 * float beats are bit-identical and can key the shared beat->x map).
 * Emits { startBeat, lyric } for every lyric-bearing sounding note.
 * Lyrics live on single pitched notes only (chords and tuplet-inner notes
 * carry no lyric in the render path).
 */
function walkLyricAnchors(voiceNotes) {
  const anchors = [];
  let beat = 0;

  for (const element of voiceNotes || []) {
    if (!element) continue;

    if (Array.isArray(element)) {
      const lengths = element.filter((e) => e && e.length);
      if (lengths.length === 0) continue;
      const first = lengths[0];
      beat += fractionToBeats(first.length) * (first.dotted ? 1.5 : 1);
      continue;
    }

    if (element.tuplet !== undefined && element.notes) {
      const [actual, normal] = element.tuplet;
      for (const tEl of element.notes) {
        let length;
        let dotted;
        if (Array.isArray(tEl)) {
          const first = tEl.find((e) => e && e.length);
          if (!first) continue;
          length = first.length;
          dotted = first.dotted;
        } else if (tEl && tEl.length) {
          length = tEl.length;
          dotted = tEl.dotted;
        } else {
          continue;
        }
        beat += fractionToBeats(length) * (dotted ? 1.5 : 1) * (normal / actual);
      }
      continue;
    }

    if (isMarker(element)) continue;
    if (!element.length) continue;

    if (element.pitch && element.lyric !== undefined) {
      anchors.push({ startBeat: beat, lyric: element.lyric });
    }
    beat += fractionToBeats(element.length) * (element.dotted ? 1.5 : 1);
  }

  return anchors;
}

/**
 * Collect every lyric minimum-advance constraint across the given voices.
 *
 * @param {Array<{notes: Array}>} voices
 * @returns {Array<{fromBeat: number, toBeat: number, minAdvance: number}>}
 */
export function computeLyricConstraints(voices) {
  const out = [];
  for (const voice of voices || []) {
    const anchors = walkLyricAnchors(voice.notes);
    if (anchors.length < 2) continue;
    let verseCount = 0;
    for (const a of anchors) {
      verseCount = Math.max(
        verseCount,
        Array.isArray(a.lyric) ? a.lyric.length : 1
      );
    }
    for (let v = 0; v < verseCount; v += 1) {
      let prev = null;
      for (const a of anchors) {
        const text = lyricSyllableForVerse(a.lyric, v);
        if (text === null) continue;
        if (prev !== null) {
          out.push({
            fromBeat: prev.beat,
            toBeat: a.startBeat,
            minAdvance:
              (estimateLyricWidth(prev.text) + estimateLyricWidth(text)) / 2 +
              LYRIC_GAP,
          });
        }
        prev = { beat: a.startBeat, text };
      }
    }
  }
  return out;
}

/** Tolerant lookup of a beat key's index (guards float drift). */
function beatIndex(sortedBeats, beat) {
  let lo = 0;
  let hi = sortedBeats.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = sortedBeats[mid];
    if (Math.abs(b - beat) < 1e-6) return mid;
    if (b < beat) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/**
 * Enforce the lyric minimum advances on a natural beat->x map (in place).
 *
 * For each deficient anchor interval, the gaps inside the interval are
 * scaled up proportionally (so intervening melisma notes keep their
 * rhythm-proportional shares) and every later beat shifts right. Widening
 * an interval can only INCREASE any other interval's advance, so a single
 * pass over the constraints reaches a state where all are satisfied.
 *
 * Lyric-free input takes the `constraints.length === 0` early return and
 * the map is untouched — byte-identical output guaranteed.
 *
 * @param {Map<number, number>} beatToX - natural beat->x map (mutated)
 * @param {Array<{notes: Array}>} voices
 * @returns {Map<number, number>} the same map
 */
export function applyLyricSpacing(beatToX, voices) {
  const constraints = computeLyricConstraints(voices);
  if (constraints.length === 0) return beatToX;

  const beats = [...beatToX.keys()].sort((a, b) => a - b);
  if (beats.length < 2) return beatToX;
  const gaps = [];
  for (let i = 0; i < beats.length - 1; i += 1) {
    gaps.push(beatToX.get(beats[i + 1]) - beatToX.get(beats[i]));
  }

  let changed = false;
  for (const c of constraints) {
    const i0 = beatIndex(beats, c.fromBeat);
    const i1 = beatIndex(beats, c.toBeat);
    if (i0 < 0 || i1 < 0 || i1 <= i0) continue;
    let sum = 0;
    for (let i = i0; i < i1; i += 1) sum += gaps[i];
    if (sum >= c.minAdvance - 1e-9) continue;
    changed = true;
    if (sum > 1e-9) {
      const factor = c.minAdvance / sum;
      for (let i = i0; i < i1; i += 1) gaps[i] *= factor;
    } else {
      const add = c.minAdvance / (i1 - i0);
      for (let i = i0; i < i1; i += 1) gaps[i] += add;
    }
  }
  if (!changed) return beatToX;

  let x = beatToX.get(beats[0]);
  for (let i = 1; i < beats.length; i += 1) {
    x += gaps[i - 1];
    beatToX.set(beats[i], x);
  }
  return beatToX;
}

/**
 * Leading-space reservation for verse numbers (SPEC-lyric-spacing.md
 * JOB 1): when a system's FIRST sounding note is lyric-bearing on a
 * multi-verse voice, its verse numbers render END-ANCHORED left of the
 * first syllable — the number must neither collide with the
 * clef/key-signature prelude block nor protrude past the system's left
 * edge. The prelude guarantees only PRELUDE_NOTE_MIN_DAYLIGHT px of
 * daylight from its ink to the first note's center; reserve the excess of
 *     estWidth(firstSyl)/2 + VERSE_NUMBER_GAP + estWidth("N.")
 *     + VERSE_NUMBER_LEAD_CLEARANCE
 * over that daylight. Returns the max over voices (0 when nothing to do,
 * so lyric-free and single-verse systems are untouched).
 *
 * Scope note: numbers anchored to a first lyric-bearing note that is NOT
 * the system's first note already sit over inter-note space and are not
 * handled here (per spec).
 *
 * @param {Array<{notes: Array}>} voices - this system's (sliced) voices
 * @param {?Array<number>} voiceVerseCounts - WHOLE-VOICE verse counts
 *   (numbers render only for multi-verse voices, decided piece-wide)
 * @returns {number} extra leading px to reserve before the first note
 */
export function verseNumberLeadReservation(voices, voiceVerseCounts) {
  let reservation = 0;
  (voices || []).forEach((voice, vi) => {
    const wholeVerses = voiceVerseCounts
      ? voiceVerseCounts[vi]
      : maxLyricVerseCount(voice.notes);
    if (!(wholeVerses > 1)) return;

    // First sounding element of the slice.
    let first = null;
    for (const el of voice.notes || []) {
      if (!el) continue;
      if (!Array.isArray(el) && isMarker(el)) continue;
      if (!Array.isArray(el) && el.tuplet !== undefined) { first = el; break; }
      if (Array.isArray(el) || el.length) { first = el; break; }
    }
    if (!first || Array.isArray(first) || !first.pitch) return;
    if (first.lyric === undefined) return;

    const sliceVerses = Array.isArray(first.lyric) ? first.lyric.length : 1;
    for (let v = 0; v < sliceVerses; v += 1) {
      const syl = lyricSyllableForVerse(first.lyric, v);
      if (syl === null) continue;
      const needed =
        estimateLyricWidth(syl) / 2 +
        VERSE_NUMBER_GAP +
        estimateLyricWidth(`${v + 1}.`, VERSE_NUMBER_FONT_SIZE) +
        VERSE_NUMBER_LEAD_CLEARANCE -
        PRELUDE_NOTE_MIN_DAYLIGHT;
      if (needed > reservation) reservation = needed;
    }
  });
  return Math.max(0, reservation);
}
