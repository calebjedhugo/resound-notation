/**
 * Main notation renderer.
 * Converts musical data to SVG staff notation.
 */

import { createSvgElement, createGroup, createLine } from './lib/svgHelpers.js';
import {
  createSmuflGlyph,
  smuflTip,
  NOTEHEAD_BLACK_GLYPH,
  NOTEHEAD_HALF_GLYPH,
  NOTEHEAD_WHOLE_GLYPH,
  NOTEHEAD_X_BLACK_GLYPH,
} from './assets/glyphs.js';
import { parseNoteData } from './lib/dataParser.js';
import { measureIntrinsicWidths } from './lib/measureIntrinsicWidths.js';
import { inferClef } from './lib/clefInference.js';
import { getDurationInfo, fractionToBeats } from './lib/durationSymbols.js';
import { pitchToStaffY, parsePitch } from './lib/notePositions.js';
import { createStaffLines } from './components/Staff.js';
import { createNote } from './components/Note.js';
import { createClef } from './components/Clef.js';
import { createRest } from './components/Rest.js';
import { createLedgerLines } from './components/LedgerLine.js';
import { createAccidental } from './components/Accidental.js';
import { createKeySignature, keySignatureAdvance } from './components/KeySignature.js';
import { createBarLine } from './components/BarLine.js';
import { createTimeSignature } from './components/TimeSignature.js';
import { getKeySignature } from './lib/keySignatures.js';
import { computeBeamGroups } from './lib/beaming.js';
import {
  createBeams,
  computeBeamLine,
  beamLineYAt,
  BEAM_THICKNESS,
  BEAM_GAP,
} from './components/Beam.js';
import { resolveTies } from './lib/tieResolver.js';
import { createTieArc } from './components/Tie.js';
import {
  renderDynamic,
  dynamicLeftVisualOffset,
  dynamicCenterYOffset,
} from './components/Dynamic.js';
import { renderHairpin } from './components/Hairpin.js';
import { renderArticulations } from './components/Articulation.js';
import { resolveSlurs } from './lib/slurGrouping.js';
import { createSlurArc } from './components/Slur.js';
import { getTupletNoteDuration } from './lib/tuplets.js';
import { renderTupletBracket } from './components/TupletBracket.js';
import { renderGraceNotes, GRACE_LEAD_IN_PAD, GRACE_SPACING } from './components/GraceNote.js';
import { renderRepeatBarline } from './components/RepeatBarline.js';
import {
  REPEAT_BARLINE_DOT_EDGE_OFFSET,
  REPEAT_BARLINE_INNER_PAD,
  THIN_BARLINE_THICKNESS,
} from './lib/engravingDefaults.js';
import { renderEnding } from './components/Ending.js';
import { renderNavigationMarker } from './components/NavigationMarker.js';
import { renderTempoMarking, renderTempoChange } from './components/TempoMarking.js';
import { renderExpressionText } from './components/ExpressionText.js';
import { renderRehearsalMark } from './components/RehearsalMark.js';
import { renderLyric, renderMelisma } from './components/Lyric.js';
import { createBrace, getBraceWidth } from './components/Brace.js';
import { createBracket } from './components/Bracket.js';
import { createSharedBarLine } from './components/SharedBarLine.js';
import { analyzeOttava } from './lib/segmentOttava.js';
import { createOttavaBracket } from './components/OttavaBracket.js';
import { breakIntoSystems, breakIntoSystemsOptimal, justifySystemSpring, LAST_SYSTEM_STRETCH_CAP } from './lib/breakIntoSystems.js';
import { sliceVoiceByMeasure } from './lib/sliceVoiceByMeasure.js';

// Chromatic offsets for converting scientific pitch (C4 = MIDI 60) to MIDI.
const PITCH_CHROMATIC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_CHROMATIC = { '#': 1, b: -1, '': 0 };

function pitchToMidi(pitchString) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitchString);
  if (!m) return null;
  const [, letter, accidental, octaveStr] = m;
  const octave = parseInt(octaveStr, 10);
  return (
    (octave + 1) * 12
    + PITCH_CHROMATIC[letter]
    + ACCIDENTAL_CHROMATIC[accidental || '']
  );
}

function shiftPitchOctave(pitchString, delta) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(pitchString);
  if (!m) return pitchString;
  const [, letter, accidental, octaveStr] = m;
  const newOctave = parseInt(octaveStr, 10) + delta;
  return `${letter}${accidental || ''}${newOctave}`;
}

/**
 * Build the ottava-event stream for a voice. Each event's index matches
 * the index in voice.notes — so segmentation indices can be looked up
 * directly against the original voice.notes array.
 */
function buildOttavaEvents(voiceNotes) {
  const events = [];
  for (let i = 0; i < voiceNotes.length; i += 1) {
    const el = voiceNotes[i];
    if (!el) continue;
    if (Array.isArray(el)) {
      // Chord — use highest MIDI as representative pitch (spec OQ-5)
      const midis = el.filter((n) => n && n.pitch).map((n) => pitchToMidi(n.pitch)).filter((x) => x !== null);
      if (midis.length === 0) continue;
      events.push({ kind: 'note', midi: Math.max(...midis), index: i });
    } else if (el.pitch) {
      const midi = pitchToMidi(el.pitch);
      if (midi !== null) events.push({ kind: 'note', midi, index: i });
    } else if (el.length && !el.pitch) {
      events.push({ kind: 'rest', index: i });
    } else if (el.barline) {
      events.push({ kind: 'barline', index: i });
    }
  }
  return events;
}

/**
 * Apply an octave shift to every pitched element inside [startIndex,
 * endIndex] (inclusive). Returns a shallow clone of voice.notes with the
 * shifted elements replaced.
 */
function applyOttavaShift(voiceNotes, segments) {
  if (!segments || segments.length === 0) return voiceNotes;
  const inSegment = new Map(); // index -> octave delta
  for (const seg of segments) {
    const delta = seg.kind === '8va' ? -1 : +1;
    for (let i = seg.startIndex; i <= seg.endIndex; i += 1) {
      inSegment.set(i, delta);
    }
  }
  if (inSegment.size === 0) return voiceNotes;
  return voiceNotes.map((el, i) => {
    const delta = inSegment.get(i);
    if (delta === undefined || !el) return el;
    if (Array.isArray(el)) {
      return el.map((n) => (n && n.pitch ? { ...n, pitch: shiftPitchOctave(n.pitch, delta) } : n));
    }
    if (el.pitch) {
      return { ...el, pitch: shiftPitchOctave(el.pitch, delta) };
    }
    return el;
  });
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 200;
// Display calibration: scale 1.0 renders a PROFESSIONAL staff size. The
// renderer's internal unit is 20 px per staff space (STAFF_HEIGHT / 4 = 80/4).
// Engraving standard is a staff space ≈ 1.75 mm (LilyPond default global staff
// size 20; MuseScore default spatium ≈ 1.76 mm) — a full 4-space staff ≈ 7 mm.
// At 96 CSS dpi that is (1.75 × 96/25.4) ≈ 6.61 px per space, so the base
// display scale converting internal units to professional output is:
//   6.61 / 20 ≈ 0.331
// The `scale` constructor option multiplies THIS base: scale 1 = professional,
// scale 2 = twice professional, etc.
export const PROFESSIONAL_BASE_SCALE = (1.75 * 96) / 25.4 / 20; // ≈ 0.331
const STAFF_START_X = 20;
const STAFF_TOP_OFFSET = 10;
// Bravura clefs render at ~54px (gClef) to ~56px (cClef). 90 leaves
// ~1 staff space between the clef glyph's visible right edge and the
// first key-sig/time-sig element when one is present. When NEITHER
// sits between the clef and the first note (a continuation system in
// C-major, or any clef-only system start), the head's left edge ends
// up only ~24 px past the clef — visibly tight per Gould "Behind Bars"
// (Spacing). For that one case we add CLEF_ONLY_EXTRA_PAD below.
const CLEF_WIDTH = 90;
// Extra trailing pad (px) applied past the clef when no key-sig and
// no time-sig sits between clef and first note. Computed:
//   gap_target ≈ 2.75 staff spaces = 55 px (visually generous; matches
//                the openness Gould describes as a "clear" prelude→note
//                gap, especially when an accidental sits at the head)
//   gap_current ≈ 24 px (CLEF_WIDTH 90 − gClef right edge 54 − head
//                        half-width 12)
//   delta = 55 − 24 = 31 px
// Applied ONLY when the clef is the rightmost prelude element so other
// header geometries (clef+key-sig, clef+time-sig) are unaffected.
const CLEF_ONLY_EXTRA_PAD = 31;
// Gap (px) between the brace's right edge and the system-start barline
// center. The system-start barline draws at THIN_BARLINE_THICKNESS
// (3.2 px) centered on x=0, so its left face sits at x ≈ -1.6. A gap of
// 8 leaves ~6 px of visible whitespace between brace and barline —
// matches the open feel Gould describes for grand-staff prelude.
const BRACE_TO_BARLINE_GAP = 8;
const VOICE_HEIGHT = 200;
const VOICE_GAP = 40;
const GRAND_STAFF_GAP = 60;
const STAFF_HEIGHT = 80; // 5 lines, 20px apart
// White space between independent (un-braced) staves within one system,
// per Elaine Gould "Behind Bars" p. 488 ("Distance between staves"):
// ~6 staff spaces (120px at 20px/space). Keeps the intra-system gap
// distinguishable from — but tighter than — the inter-system gap,
// without crowding the staves into a grand-staff-like pair.
const INDEPENDENT_STAFF_WHITE_SPACE = 120;
// Vertical gap between systems (Gould "Behind Bars", Systems p.595).
// 6 staff spaces ≈ enough room for cross-system dynamics/lyrics without
// the next system crowding.
const SYSTEM_GAP = 120;
// Distance (px) from notehead center back to accidental center.
// Bravura sharp ≈ 20 wide, head half-width ≈ 12, plus ~5px breathing
// room → 30 keeps the accidental clear of the head.
const ACCIDENTAL_OFFSET = 30;
// When the prior element is a beamed sibling (the same beam group's
// previous note), there's no clef/barline/rest buffer between the two
// noteheads, so the visual gap from the *prior* head to this accidental
// reads tightest. Per Gould "Behind Bars" (Accidentals chapter),
// breathing room from the preceding element is the priority — the
// accidental's gap to its own notehead can shrink toward Gould's
// minimum (~1/4 staff space). Pulling the accidental ~6px closer to
// its own head buys ~6px of breathing room from the prior head.
const ACCIDENTAL_OFFSET_BEAMED_PRIOR = ACCIDENTAL_OFFSET - 6;
// Max center-to-center distance (px) from the prior beamed sibling at
// which the beamed-prior shrink still earns its keep. Beyond this the
// prior head is far enough that the accidental needs no help clearing it,
// so the shrink would only cost the accidental its own-head clearance
// (and, on a ledgered note, push the sharp into the ledger's left
// overhang). 90px = 4.5 staff spaces: comfortably above a packed beam
// (eighths sit ~3.5 sp apart) yet below a justified-wide beam (the
// accidentals-sweep preset stretches to ~5 sp+), so the shrink applies
// to exactly the tight case it was built for.
const ACCIDENTAL_PRIOR_NEAR = 90;
// Trailing padding (px) after the time-sig glyph before the first note.
// Three terms add up here:
//   ~19 — overshoot. createTimeSignature returns width = digit bbox
//         (xMax - xMin) in px and the digits center on that cursor
//         extent, but each digit's visible content extends past the
//         cursor's right edge by ~xMin*scale + half the (xMax+xMin)
//         skew (≈18–19 px for Bravura time-sig digits at scale 0.08).
//   ~12 — notehead half-width. The cursor advance lands at the first
//         note's CENTER (HEAD_TIP_X ≈ 11.8 px).
//    20 — ≥1 staff space of clear visual gap (Gould "Behind Bars",
//         Spacing — prelude→first-note minimum).
// Was 25, which left a visible gap of only ~1 px — the digit's right
// scroll sat almost ON the first notehead. Mirror of
// KEY_SIG_TRAILING_PAD on the right side of the prelude.
const TIME_SIG_PADDING = 51;
// Padding (px) before and after each barline. The cursor advance lands
// at the next/previous note's CENTER, but stems sit ~10px to one side of
// the head (HEAD_TIP_X for stem-up on the right; -HEAD_TIP_X for stem-down
// on the left), so the worst-case gap from the barline to the nearest
// stem is `BAR_LINE_PADDING - 10`. Use 30 to buy ~20px (≈1 staff space)
// of visible clearance between the stem and the barline — enough that a
// stem-down first note in the next measure has clear breathing room.
const BAR_LINE_PADDING = 30;
// Boundary-spring natural length (px) for the spring that crosses an
// interior measure boundary (last-note-of-measure → first-note-of-next-
// measure). Zero: the spring contributes no length of its own; the
// per-system `barlineGap` (computed below from local inter-note gaps)
// is added to `barlineOffset` on both sides of every shared barline,
// producing a symmetric pre/post gap that scales with the rest of the
// music. K=0 keeps the spring out of the slack-distribution math.
const BARLINE_SPRING_NAT_LENGTH = 0;
// Minimum (and natural-width default) note→barline padding, in px,
// measured from the VISIBLE rightmost extent of the last note's glyph
// (notehead right edge, ≈ HEAD_TIP_X from note center; for stem-up
// notes the stem sits at the same x, so notehead-right suffices) to
// the LEFT edge of the barline. Per Gould "Behind Bars" (Spacing) and
// Lilypond's `BarLine.padding` convention, the relevant gap is the
// daylight the eye sees between glyphs — NOT the distance from the
// note's logical x (center) to the barline. Set at 1.5 staff spaces
// — comfortably past Lilypond's 1.0-staff-space default (Dorico's
// too) so the gap never reads cramped even when the system has no
// slack to grow into. LINE_SPACING (= ONE_SPACE) is 20px in this
// codebase.
// 40 = 2 * LINE_SPACING (ONE_SPACE = 20, declared below) — Henle/
// Bärenreiter published-score territory; chosen over the tighter 1.5
// staff-space minimum for visibly more comfortable breathing room.
const MIN_BARLINE_PADDING = 40;
// Target ratio of note→barline gap to median inter-note gap when the
// system has been justified out past natural width. Industry standard
// per Gould "Behind Bars" (Spacing) is a 1.5–2.5× inter-to-barline
// ratio; 0.35 hits the middle of that band (1/0.35 ≈ 2.86×). The actual
// applied padding is `max(MIN_BARLINE_PADDING, BARLINE_GAP_RATIO ×
// medianInterNoteGap)` so at heavy stretch the barline gap grows but
// never drops below the floor.
const BARLINE_GAP_RATIO = 0.35;
const MIDDLE_LINE_Y = 50;
// SMuFL Bravura black notehead stem-up tip (in local pixel coords). All
// chord rendering paths use the black-notehead tip; quarter/8th/16th heads
// share this geometry. Half/whole chord rendering uses the same tip vertex
// (Bravura noteheadHalf has identical max-x at fu (295,42)).
const BLACK_TIP = smuflTip(NOTEHEAD_BLACK_GLYPH);
const HEAD_TIP_X = BLACK_TIP.x;
const HEAD_TIP_Y = BLACK_TIP.y;
const STEM_LENGTH = 70;
// Per Gould "Behind Bars" (Dynamics): point dynamics below the staff
// sit ≥1.5 staff spaces clear of the bottom staff line — measured from
// the TOP of the letter glyph. Bravura's tallest dynamic letter here
// is 'f' with bbox.yMax = 444 fu × SMUFL_SCALE (0.08) = 35.5px above
// the glyph origin (after the inner y-flip). Staff bottom on a single
// staff sits at y = STAFF_TOP_OFFSET + STAFF_HEIGHT = 10 + 80 = 90.
// To clear the 'f'-hood by ≥30px: 90 + 30 + 35.5 = 155.5 → 160 buys
// a small safety margin. Previously 110, which put the 'p' top
// (origin - 21.9) at y≈88 — virtually ON the bottom staff line.
// Floor for the dynamic letter origin — never closer to the staff than this,
// even when the target note sits high. Per-instance computation below may
// push the y LOWER (further from staff) when the target note's lowest
// visual extent reaches near or past this floor.
const DYNAMICS_Y_MIN = 160;
const STAFF_CENTER_Y = STAFF_TOP_OFFSET + 40; // midpoint of 5-line staff
const ONE_SPACE = 20; // LINE_SPACING — one staff space in px.

/**
 * Estimate the lowest visual y of a music element (note/chord) for the
 * purpose of placing point dynamics below it. Per Gould "Behind Bars"
 * (Dynamics): point dynamics sit below the LOWEST point of the music they
 * pertain to, with ≥1 staff space of clearance.
 *
 * Approximate model:
 *   - Single note: lowest is notehead bottom (y + ~5px) when stem-up;
 *     for stem-down, stem bottom = y + STEM_LENGTH.
 *   - Chord: same, but use the chord's max pitch-y (lowest pitch).
 *   - Stem direction here matches the renderer's rule: stemDown when the
 *     governing y ≤ MIDDLE_LINE_Y (high notes get stems down).
 *   - Rests and unknown shapes: return 0 (let DYNAMICS_Y_MIN dominate).
 *
 * Ledger lines below add a small ~5px bonus but the notehead bottom already
 * captures most of the visual extent, so we keep this simple.
 */
function lowestExtentOf(element, clef) {
  if (element == null) return 0;
  if (Array.isArray(element)) {
    const ys = element
      .filter((n) => n && n.pitch)
      .map((n) => pitchToStaffY(n.pitch, clef));
    if (ys.length === 0) return 0;
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    // Renderer picks stem direction from the note furthest from middle line.
    const distMax = Math.abs(maxY - MIDDLE_LINE_Y);
    const distMin = Math.abs(minY - MIDDLE_LINE_Y);
    const governingY = distMax >= distMin ? maxY : minY;
    const stemDown = governingY <= MIDDLE_LINE_Y;
    if (stemDown) return maxY - HEAD_TIP_Y + STEM_LENGTH;
    return maxY + 5; // notehead bottom for stem-up chord
  }
  if (!element.pitch) return 0;
  const y = pitchToStaffY(element.pitch, clef);
  const stemDown = y <= MIDDLE_LINE_Y;
  if (stemDown) return y - HEAD_TIP_Y + STEM_LENGTH;
  return y + 5;
}

/**
 * Topmost y of a single music element (note/chord) — mirror of
 * lowestExtentOf for above-staff layout work (Gould "Behind Bars",
 * Voltas: the volta bracket clears the highest visual element in its
 * span by ≥1 staff space).
 *
 * Returns the smallest (most-negative) y reached by:
 *   - the topmost notehead's TOP edge (y − HEAD_TIP_Y),
 *   - the stem TOP when the chord/note is stem-up
 *     (highestY − HEAD_TIP_Y − STEM_LENGTH; stem-up uses HEAD_TIP_Y as
 *     the attachment offset and STEM_LENGTH as the run, matching the
 *     stem geometry emitted at lines ~1864 / ~2005).
 * Rests / unknown shapes return +Infinity (no contribution).
 */
function topExtentOf(element, clef) {
  // Notehead vertical half-height: a Bravura black notehead is ~1
  // staff space tall, so its top edge sits ONE_SPACE/2 above the
  // note's translate-y center. Using ONE_SPACE keeps this in lockstep
  // with LINE_SPACING (one source of truth for "1 staff space").
  const HEAD_HALF_Y = ONE_SPACE / 2; // 10px
  if (element == null) return Infinity;
  if (Array.isArray(element)) {
    const ys = element
      .filter((n) => n && n.pitch)
      .map((n) => pitchToStaffY(n.pitch, clef));
    if (ys.length === 0) return Infinity;
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    const distMax = Math.abs(maxY - MIDDLE_LINE_Y);
    const distMin = Math.abs(minY - MIDDLE_LINE_Y);
    const governingY = distMax >= distMin ? maxY : minY;
    const stemDown = governingY <= MIDDLE_LINE_Y;
    const headTop = minY - HEAD_HALF_Y;
    if (stemDown) return headTop;
    // Stem-up: stem rises by STEM_LENGTH from the highest notehead.
    return minY - STEM_LENGTH;
  }
  if (!element.pitch) return Infinity;
  const y = pitchToStaffY(element.pitch, clef);
  const stemDown = y <= MIDDLE_LINE_Y;
  const headTop = y - HEAD_HALF_Y;
  if (stemDown) return headTop;
  return y - STEM_LENGTH;
}

/**
 * Walk a voice's notes, emitting (startBeat, endBeat, spacing) events for
 * every note/rest/chord/tuplet element. Used to build a shared beat→x
 * map across voices so notes at the same beat align vertically.
 */
function collectVoiceEvents(voiceNotes) {
  const events = [];
  let beat = 0;

  for (const element of voiceNotes) {
    if (Array.isArray(element)) {
      // Chord — duration from any note's length
      const lengths = element.filter((e) => e && e.length).map((e) => e);
      if (lengths.length === 0) continue;
      const first = lengths[0];
      const info = getDurationInfo(first.length);
      const dur = fractionToBeats(first.length) * (first.dotted ? 1.5 : 1);
      const spacing = info.spacing * (first.dotted ? 1.5 : 1);
      events.push({ startBeat: beat, endBeat: beat + dur, spacing });
      beat += dur;
      continue;
    }

    if (element.tuplet !== undefined && element.notes) {
      // Tuplet: nested notes with a ratio. Pro-rate each sub-note's
      // contribution by ratio[1]/ratio[0] (e.g. triplet = 2/3).
      const [actual, normal] = element.tuplet;
      for (const tEl of element.notes) {
        let length;
        let dotted;
        if (Array.isArray(tEl)) {
          // Chord inside tuplet
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
        const info = getDurationInfo(length);
        const dur = fractionToBeats(length) * (dotted ? 1.5 : 1) * (normal / actual);
        const spacing = info.spacing * (dotted ? 1.5 : 1) * (normal / actual);
        events.push({ startBeat: beat, endBeat: beat + dur, spacing });
        beat += dur;
      }
      continue;
    }

    // Skip non-note markers
    if (element.barline !== undefined) continue;
    if (
      element.ending !== undefined ||
      element.navigation !== undefined ||
      element.tempo !== undefined ||
      element.tempoChange !== undefined ||
      element.expression !== undefined ||
      element.rehearsal !== undefined ||
      element.dynamic !== undefined ||
      element.hairpin !== undefined
    ) continue;

    if (!element.length) continue;

    const info = getDurationInfo(element.length);
    const dur = fractionToBeats(element.length) * (element.dotted ? 1.5 : 1);
    const spacing = info.spacing * (element.dotted ? 1.5 : 1);
    events.push({ startBeat: beat, endBeat: beat + dur, spacing });
    beat += dur;
  }

  return events;
}

/**
 * Build a shared beat → x map from all voices' events. The width of
 * each gap between consecutive layout beats is the maximum width
 * required by any voice covering that gap (pro-rated by event duration).
 */
function computeBeatLayout(voices, startX) {
  const allEvents = [];
  for (const voice of voices) {
    for (const ev of collectVoiceEvents(voice.notes)) {
      allEvents.push(ev);
    }
  }

  const beats = new Set([0]);
  for (const ev of allEvents) {
    beats.add(ev.startBeat);
    beats.add(ev.endBeat);
  }
  const sorted = [...beats].sort((a, b) => a - b);

  const map = new Map([[sorted[0], startX]]);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const z = sorted[i + 1];
    const gap = z - a;
    let maxWidth = 0;
    for (const ev of allEvents) {
      if (ev.startBeat <= a + 0.0001 && ev.endBeat >= z - 0.0001) {
        const evDur = ev.endBeat - ev.startBeat;
        const contribution = ev.spacing * (gap / evDur);
        if (contribution > maxWidth) maxWidth = contribution;
      }
    }
    map.set(z, map.get(a) + maxWidth);
  }

  return map;
}

function chordGlyphFor(info) {
  if (info.name === 'whole') return NOTEHEAD_WHOLE_GLYPH;
  if (info.name === 'half') return NOTEHEAD_HALF_GLYPH;
  return NOTEHEAD_BLACK_GLYPH;
}

/**
 * Check if an element is a non-note marker (dynamic, hairpin, barline, etc.).
 * Returns the marker type string, or null if it's a note/rest/chord.
 */
function getMarkerType(element) {
  if (Array.isArray(element)) return null;
  if (element.tuplet !== undefined) return 'tuplet';
  if (element.barline !== undefined) return 'barline';
  if (element.ending !== undefined) return 'ending';
  if (element.navigation !== undefined) return 'navigation';
  if (element.tempo !== undefined) return 'tempo';
  if (element.tempoChange !== undefined) return 'tempoChange';
  if (element.expression !== undefined) return 'expression';
  if (element.rehearsal !== undefined) return 'rehearsal';
  if (element.dynamic !== undefined) return 'dynamic';
  if (element.hairpin !== undefined) return 'hairpin';
  return null;
}

const ACCIDENTAL_TYPE_MAP = {
  '#': 'sharp',
  b: 'flat',
};

/**
 * Decide which accidental glyph (if any) to draw before a note, given
 * the active key signature for the voice. Implements Gould "Behind
 * Bars" pp. 80-85: an accidental is printed only when the pitch's
 * alteration differs from what the key signature dictates for that
 * letter. A pitch matching the key signature draws no accidental; a
 * natural-letter pitch in a key that would otherwise alter it draws a
 * natural sign to override the key.
 *
 * @param {string} pitchAccidental - "" | "#" | "b" from parsePitch
 * @param {string} pitchLetter - "A".."G"
 * @param {{ type: 'sharp'|'flat'|'none', accidentals: string[] }} keyInfo
 * @returns {'sharp'|'flat'|'natural'|null}
 */
function accidentalGlyphForPitch(pitchAccidental, pitchLetter, keyInfo) {
  const keyAltersLetter =
    keyInfo && keyInfo.type !== 'none' && keyInfo.accidentals.includes(pitchLetter);
  const keyAlteration = keyAltersLetter
    ? (keyInfo.type === 'sharp' ? '#' : 'b')
    : '';
  if (pitchAccidental === keyAlteration) return null;
  if (pitchAccidental === '') return 'natural';
  return ACCIDENTAL_TYPE_MAP[pitchAccidental] || null;
}

/**
 * SHARED NATURAL-WIDTH METRIC + per-system spring layout.
 *
 * THE single source of truth for "how wide is a run of measures laid out as
 * one system, and where does every note land". Both the system BREAKER (to
 * decide break points) and the RENDERER (to lay each system out and to floor
 * justification) call this — so breaking and rendering agree by construction.
 *
 * Estimate ≠ actual was the root-cause bug class: the breaker used to decide
 * breaks from an approximate additive per-measure intrinsic-width table while
 * the renderer laid systems out with this exact spring pipeline (natural
 * `computeBeatLayout` + per-interior-boundary daylight + a trailing gap
 * PROPORTIONAL to the last note's duration + the per-system prelude). Any
 * mismatch overpacked some width; since justification only stretches (never
 * compresses below natural), the last note got crammed under its minimum
 * trailing or pushed past the viewBox. Computing both from this one function
 * removes the mismatch entirely.
 *
 * @param {Array<{notes:Array}>} sliceVoices  the system's voices, notes
 *   already sliced to this system's measure range.
 * @param {Array<Array>} slicedVoiceNotes  per-voice sliced notes (for
 *   leading-marker offset detection).
 * @param {number} perSystemMusicStartX  x where music begins after the
 *   prelude (clef + key sig + time sig). This carries the prelude term.
 * @param {?number} sharedMeasureLength  beats per measure (barline cadence).
 * @param {?number} systemRightX  if null/undefined, returns the NATURAL
 *   (unstretched) layout and `naturalRightX`. If a number > naturalRightX,
 *   the inter-note springs stretch to fill out to it (justified system).
 * @returns {{
 *   naturalRightX: number,        // closing-barline x at natural (= the metric)
 *   stretchedBeatToX: Map<number,number>,
 *   prePadMap: Map<number,number>,
 *   postPadMap: Map<number,number>,
 *   barlineGap: number,
 *   trailingBarlineGap: number,
 *   systemEndBeat: number,
 *   measureCountFromBeats: number,
 * }}
 */
function computeSystemSpringLayout(
  sliceVoices,
  slicedVoiceNotes,
  perSystemMusicStartX,
  sharedMeasureLength,
  systemRightX = null,
) {
  // Natural beat→x for this system (no stretch).
  const naturalBeatToX = computeBeatLayout(sliceVoices, perSystemMusicStartX);

  // Last beat across all voices (system end).
  let systemEndBeat = 0;
  for (const v of sliceVoices) {
    for (const e of collectVoiceEvents(v.notes)) {
      if (e.endBeat > systemEndBeat) systemEndBeat = e.endBeat;
    }
  }

  const sortedBeats = [...naturalBeatToX.keys()].sort((a, b) => a - b);

  // Interior measure boundary: a positive integer multiple of the measure
  // length, strictly before the system's last beat. The spring whose RIGHT
  // endpoint lands here crosses a barline (Gould "Behind Bars", Spacing).
  const isInteriorBoundary = (beat) => {
    if (!sharedMeasureLength) return false;
    if (beat <= 0) return false;
    if (beat >= sortedBeats[sortedBeats.length - 1] - 1e-6) return false;
    const ratio = beat / sharedMeasureLength;
    return Math.abs(ratio - Math.round(ratio)) < 1e-6;
  };

  // Build springs. Barline-crossing springs carry the FULL across-bar
  // daylight (pre + post gap); see the long comment in the renderer.
  const allSprings = [];
  for (let i = 0; i < sortedBeats.length - 1; i += 1) {
    const a = sortedBeats[i];
    const z = sortedBeats[i + 1];
    let natLength = naturalBeatToX.get(z) - naturalBeatToX.get(a);
    if (isInteriorBoundary(z)) {
      const postNat = naturalBeatToX.get(sortedBeats[i + 2]) - naturalBeatToX.get(z);
      natLength += postNat;
    }
    const K = Math.max(natLength, 1);
    allSprings.push({ natLength, K });
  }
  const activeBeats = sortedBeats;

  // Leading-offset: leading repeat-barline markers advance the cursor at
  // music start without updating barlineOffset; the first spring's space is
  // anchored past them. Mirrors the voice-loop's cursorX advances.
  let leadingMusicOffset = 0;
  const firstSliceWithNotes = slicedVoiceNotes.find((n) => n && n.length > 0);
  if (firstSliceWithNotes) {
    for (const el of firstSliceWithNotes) {
      if (getMarkerType(el) === null && el && (el.length || el.position !== undefined || Array.isArray(el))) {
        break;
      }
      if (el && (el.barline === 'repeat-start' || el.barline === 'repeat-both')) {
        leadingMusicOffset +=
          REPEAT_BARLINE_DOT_EDGE_OFFSET + REPEAT_BARLINE_INNER_PAD + HEAD_TIP_X;
      }
    }
  }

  // Per-boundary natural pre/post (last-note duration before the bar, first-
  // note duration after) for duration-proportional gap splits.
  let interiorBoundaryCount = 0;
  const preBarlineNatural = new Map();
  const postBarlineNatural = new Map();
  if (sharedMeasureLength && activeBeats.length > 1) {
    const lastBeat = activeBeats[activeBeats.length - 1];
    for (let i = 1; i < activeBeats.length - 1; i += 1) {
      const b = activeBeats[i];
      if (b > 0 && b < lastBeat &&
          Math.abs((b / sharedMeasureLength) - Math.round(b / sharedMeasureLength)) < 1e-6) {
        interiorBoundaryCount += 1;
        const preNat = naturalBeatToX.get(b) - naturalBeatToX.get(activeBeats[i - 1]);
        const postNat = naturalBeatToX.get(activeBeats[i + 1]) - naturalBeatToX.get(b);
        preBarlineNatural.set(b, preNat);
        postBarlineNatural.set(b, postNat);
      }
    }
  }

  // Each interior boundary needs HEAD_TIP_X on each side (glyph-edge gaps);
  // the trailing barline needs one HEAD_TIP_X on its pre-side.
  const interiorBarlineOffset = 2 * HEAD_TIP_X * interiorBoundaryCount;
  const trailingBarlineOffset = HEAD_TIP_X;
  const measureCountFromBeats = interiorBoundaryCount + 1;

  // Solve the spring stretch toward systemRightX. When systemRightX is null
  // we pass a budget that forces slack ≤ 0, yielding natural lengths — the
  // breaker only needs naturalRightX, and an unjustified system renders at
  // natural too. (We then recompute naturalRightX below and the caller may
  // re-call us with a real systemRightX to justify.)
  const targetRightX = systemRightX == null ? 0 : systemRightX;
  const fixedOffsetSum =
    perSystemMusicStartX
    + leadingMusicOffset
    + trailingBarlineOffset
    + interiorBarlineOffset;
  const stretchableBudget = targetRightX - fixedOffsetSum;

  // LAST-SYSTEM STRETCH CAP (Gould "Behind Bars", Systems; LilyPond/Dorico).
  // The spring solver applies a single force F to every spring, and because
  // each spring's stretchability K ≈ its natural length, the stretch RATIO
  // (natLength + F·K)/natLength ≈ 1 + F is UNIFORM across springs. So the
  // median inter-note gap reaches LAST_SYSTEM_STRETCH_CAP× natural exactly at
  // F = cap − 1. `cappedRightX` is the system right edge at that force:
  //   stretchableBudget = sumNat + (cap−1)·sumK  →  + fixed offsets.
  // The renderer renders a last/only system at min(container, cappedRightX):
  // below cappedRightX it justifies normally; past it the springs freeze at
  // the cap and the system is left RAGGED-LEFT. Continuous — no snap.
  const sumNatForCap = allSprings.reduce((a, s) => a + s.natLength, 0);
  const sumKForCap = allSprings.reduce((a, s) => a + s.K, 0);
  const cappedRightX =
    fixedOffsetSum + sumNatForCap + (LAST_SYSTEM_STRETCH_CAP - 1) * sumKForCap;
  const stretchedGaps = justifySystemSpring(
    allSprings,
    0,
    stretchableBudget,
    { isLast: false, measureCount: measureCountFromBeats },
  );

  // Median inter-note gap from the STRETCHED non-boundary springs — the
  // reference scale for the across-barline cap. Inter-note springs are every
  // spring whose right endpoint is NOT an interior boundary and is NOT the
  // trailing (closing-barline) spring. Per Gould "Behind Bars" (Spacing) and
  // LilyPond/Dorico BarLine.padding (~1 staff space) the across-barline
  // daylight is a modest roughly-fixed gap, NOT a full note allocation.
  const trailingSpringIdxForMedian = sortedBeats.length - 2;
  const interNoteStretched = [];
  for (let i = 0; i < sortedBeats.length - 1; i += 1) {
    const z = sortedBeats[i + 1];
    if (preBarlineNatural.has(z) || i === trailingSpringIdxForMedian) continue;
    interNoteStretched.push(stretchedGaps[i]);
  }
  let medianInterNoteGap = 0;
  if (interNoteStretched.length > 0) {
    const vals = [...interNoteStretched].sort((a, b) => a - b);
    const m = Math.floor(vals.length / 2);
    medianInterNoteGap = vals.length % 2 ? vals[m] : 0.5 * (vals[m - 1] + vals[m]);
  }
  // The documented cap: applied pad = max(MIN_BARLINE_PADDING,
  // BARLINE_GAP_RATIO × medianInterNoteGap). When there are NO inter-note
  // springs to scale against (one note per measure, e.g. whole-note bars)
  // the across-barline spring is the ONLY horizontal spacing mechanism and
  // there is nowhere to redistribute freed slack — so the cap is disabled
  // (Infinity) and the boundary spring stretches freely, exactly as before.
  // Capping it there would cram every whole-note measure to the floor and
  // dump all justification slack onto the trailing spring.
  const barlinePadCap = medianInterNoteGap > 0
    ? Math.max(MIN_BARLINE_PADDING, BARLINE_GAP_RATIO * medianInterNoteGap)
    : Infinity;

  // Build per-boundary pads, splitting each barline-crossing spring's
  // stretched length into pre/post in proportion to the adjacent note
  // durations. The two sides of a barline are NOT symmetric — the barline
  // coincides with the NEXT measure's downbeat (Gould "Behind Bars", Spacing):
  //   • PRE-pad  = last note → barline = TRAILING daylight. The last note
  //     occupies real time UP TO the barline, so this is duration-PROPORTIONAL
  //     (its stretched share), floored at MIN_BARLINE_PADDING. NOT capped — a
  //     half is owed ~1.4× a quarter's trailing.
  //   • POST-pad = barline → first note = LEADING daylight. The first note IS
  //     the downbeat (no duration between it and the barline), so this is a
  //     small FIXED gap — floored at MIN_BARLINE_PADDING and CAPPED at
  //     barlinePadCap (commit 466a53c).
  // Only the LEADING (post) cap frees slack; it is redistributed to the inter-
  // note springs below so the system still justifies fully to its right edge.
  const prePadMap = new Map();
  const postPadMap = new Map();
  let freedBarlineSlack = 0;
  for (let i = 0; i < sortedBeats.length - 1; i += 1) {
    const z = sortedBeats[i + 1];
    if (!preBarlineNatural.has(z)) continue;
    const preNat = preBarlineNatural.get(z);
    const postNat = postBarlineNatural.get(z);
    const span = preNat + postNat;
    const stretched = stretchedGaps[i];
    const preShare = span > 0 ? stretched * (preNat / span) : stretched / 2;
    const postShare = span > 0 ? stretched * (postNat / span) : stretched / 2;
    // TRAILING: proportional, floored only (no cap).
    const prePad = Math.max(MIN_BARLINE_PADDING, preShare);
    // LEADING: floored AND capped.
    const postPad = Math.min(barlinePadCap, Math.max(MIN_BARLINE_PADDING, postShare));
    // Freed slack = ONLY the leading (post) excess; the boundary spring's full
    // stretched length is preShare + postShare, and we now spend prePad (≈
    // preShare, the trailing keeps its proportional length) + postPad (capped),
    // so the released amount is postShare − postPad.
    freedBarlineSlack += Math.max(0, postShare - postPad);
    prePadMap.set(z, prePad);
    postPadMap.set(z, postPad);
  }

  const trailingSpringIdx = sortedBeats.length - 2;
  // Redistribute the freed LEADING across-barline slack across the non-boundary
  // springs (inter-note springs AND the trailing closing-barline spring)
  // PROPORTIONAL to each spring's current stretched length — the leading-cap
  // commit (466a53c). This keeps the system justified to systemRightX and
  // preserves the rhythm-proportional invariant: scaling every recipient by the
  // same factor keeps equal inter-note gaps equal AND lets the trailing
  // (closing-barline) spring keep its duration-proportional length (a half note
  // gets more trailing than a quarter).
  if (freedBarlineSlack > 0) {
    const targetIdx = [];
    let targetTotal = 0;
    for (let i = 0; i < sortedBeats.length - 1; i += 1) {
      const z = sortedBeats[i + 1];
      if (preBarlineNatural.has(z)) continue; // boundary springs stay zeroed
      targetIdx.push(i);
      targetTotal += stretchedGaps[i];
    }
    if (targetTotal > 0) {
      for (const i of targetIdx) {
        stretchedGaps[i] += freedBarlineSlack * (stretchedGaps[i] / targetTotal);
      }
    } else if (targetIdx.length > 0) {
      const perSpring = freedBarlineSlack / targetIdx.length;
      for (const i of targetIdx) stretchedGaps[i] += perSpring;
    }
  }

  // The last measure's trailing (closing-barline) daylight is NOT capped: the
  // barline coincides with the next downbeat, so the last note occupies real
  // time up to it and its trailing is duration-PROPORTIONAL — a half is owed
  // ~1.4× a quarter, a whole ~2×. The trailing spring keeps its
  // natural/stretched length (floored at MIN_BARLINE_PADDING below); on a
  // justified system the spring solver already grew it proportionally, and the
  // breaker reserves only the MIN_BARLINE_PADDING floor in naturalRightX so the
  // run still fits and justification only STRETCHES the trailing from its floor
  // (cram-bug / trailing-clip invariants f6d8426/9ce0b20/102018a).
  //
  // A MEASURE-FILLING lone note (e.g. a single whole note, no inter-note
  // springs in its measure) is NOT special-cased: it falls through to the same
  // path as every other measure's first note. Per Gould "Behind Bars"
  // (Spacing) a whole NOTE — unlike a whole REST — sits at its rhythmic onset
  // (the downbeat), i.e. LEFT-ALIGNED at the small leading-cap daylight, with
  // its duration's worth of space TRAILING to the barline. Centering is only
  // for full-bar rests, not notes. So the LEADING post-pad stays at the
  // 466a53c cap and the TRAILING fills the proportional measure width out to
  // the pinned closing barline — never balanced/centered.

  // Trailing (last) spring → closing-barline pre-gap, floored at
  // MIN_BARLINE_PADDING. PROPORTIONAL to the last note's duration (its
  // stretched spring length).
  const trailingBarlineGap = trailingSpringIdx >= 0
    ? Math.max(MIN_BARLINE_PADDING, stretchedGaps[trailingSpringIdx])
    : MIN_BARLINE_PADDING;

  // Median of pre-pads for the legacy uniform-`barlineGap` API.
  let barlineGap = MIN_BARLINE_PADDING;
  if (prePadMap.size > 0) {
    const vals = [...prePadMap.values()].sort((a, b) => a - b);
    const m = Math.floor(vals.length / 2);
    barlineGap = vals.length % 2 ? vals[m] : 0.5 * (vals[m - 1] + vals[m]);
  }

  // Zero the barline-crossing springs (right endpoint = boundary) and the
  // trailing spring; the render loop re-emits these via barlineOffset.
  for (let i = 0; i < sortedBeats.length - 1; i += 1) {
    const z = sortedBeats[i + 1];
    if (preBarlineNatural.has(z) || i === trailingSpringIdx) {
      stretchedGaps[i] = 0;
    }
  }

  // Build the OFFSET-FREE beat→x map (the render loop adds barlineOffset on
  // top via `xForBeat`, so this must NOT pre-bake the barline pads — doing so
  // would double-count). Anchor the first beat past the leading-barline
  // advance so the first inter-note spring's full length is visible.
  const stretchedBeatToX = new Map();
  let runX = perSystemMusicStartX + leadingMusicOffset;
  if (activeBeats.length > 0) {
    stretchedBeatToX.set(activeBeats[0], runX);
    for (let i = 0; i < stretchedGaps.length; i += 1) {
      runX += stretchedGaps[i];
      stretchedBeatToX.set(activeBeats[i + 1], runX);
    }
  }

  // naturalRightX = the renderer's TRUE MINIMUM rightmost extent (closing
  // barline) — the smallest system width below which the last note would be
  // crammed under its floor or pushed off the staff. It is:
  //   last note's natural x
  //   + the accumulated interior barline daylight (preGap + HEAD_TIP_X +
  //     postGap + HEAD_TIP_X at each interior boundary — proportional to the
  //     surrounding note durations, the across-bar reservation from f6d8426)
  //   + the MINIMUM trailing gap (MIN_BARLINE_PADDING) + the trailing
  //     notehead half-width.
  //
  // The trailing term uses the FLOOR, not the proportional trailing
  // `trailingBarlineGap`: above this width the renderer has slack and the
  // trailing spring grows the trailing gap proportionally (a half note gets
  // MORE than a quarter); AT this width the trailing sits exactly at its
  // floor. Counting the full proportional trailing as required would wrap
  // pieces a whole note-width too early (e.g. two whole notes would never
  // share a system). Because the breaker keeps a run only when this minimum
  // ≤ the system width, justification can only STRETCH the trailing from its
  // floor — so the last note always keeps ≥ MIN_BARLINE_PADDING and never
  // crams or clips. Mirrors the render loop's `xForBeat` + barlineOffset
  // accumulation up to the last note.
  let accumBarlineOffset = 0;
  for (let i = 0; i < activeBeats.length; i += 1) {
    const z = activeBeats[i];
    if (prePadMap.has(z)) {
      accumBarlineOffset += prePadMap.get(z) + HEAD_TIP_X;
      accumBarlineOffset += postPadMap.get(z) + HEAD_TIP_X;
    }
  }
  const lastBeatX = activeBeats.length > 0
    ? stretchedBeatToX.get(activeBeats[activeBeats.length - 1])
    : perSystemMusicStartX;
  const naturalRightX =
    lastBeatX + accumBarlineOffset + MIN_BARLINE_PADDING + trailingBarlineOffset;

  // naturalRenderRightX = the same extent but with the PROPORTIONAL trailing
  // (`trailingBarlineGap`, floored at MIN_BARLINE_PADDING) instead of the bare
  // floor. This is the RENDER right edge for a RAGGED last system: the breaker
  // reserves only `naturalRightX` (the floor) so it never wraps a piece a
  // whole-note-width too early, but once a run is kept ragged the closing
  // barline must sit at the last note's duration-proportional trailing (Gould
  // "Behind Bars", Spacing: the last note keeps its rhythmic space even ragged-
  // right — a half ending gets ~1.4× a quarter's trailing). On a JUSTIFIED
  // system the spring solver already grows the trailing past this; only the
  // ragged path uses it. naturalRenderRightX ≥ naturalRightX always (the gap
  // term is floored at MIN_BARLINE_PADDING), so it never pulls the barline IN.
  const naturalRenderRightX =
    lastBeatX + accumBarlineOffset + trailingBarlineGap + trailingBarlineOffset;

  return {
    naturalRightX,
    naturalRenderRightX,
    cappedRightX,
    stretchedBeatToX,
    prePadMap,
    postPadMap,
    barlineGap,
    trailingBarlineGap,
    systemEndBeat,
    measureCountFromBeats,
  };
}

export class NotationRenderer {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container] - DOM element to append SVG to
   * @param {number} [options.width] - SVG width
   * @param {number} [options.height] - SVG height
   * @param {number} [options.scale] - Display scale. 1.0 (default) renders a
   *   professional staff size (~7 mm / 1.75 mm staff space at 96 dpi); 2.0 is
   *   twice that, etc. Acts on the output width/height only — the viewBox stays
   *   in internal coordinates.
   * @param {boolean} [options.observeContainer] - explicitly opt in/out of
   *   the construction-time ResizeObserver. When omitted, auto-observe
   *   defaults ON if a container is present and no explicit width was given
   *   ("container owns width"), and OFF otherwise (explicit width = fixed).
   * @param {'reflow'|'zoom-to-fit'} [options.responsiveMode='reflow'] -
   *   how the ResizeObserver callback maps container width to render
   *   state. `'reflow'` updates width (more/fewer measures per system);
   *   `'zoom-to-fit'` updates scale (same layout, scaled).
   */
  constructor({
    container,
    width,
    height,
    scale,
    observeContainer,
    responsiveMode = 'reflow',
    breakingStrategy = 'optimal',
  } = {}) {
    this._container = container || null;
    // Record whether the caller pinned an explicit width BEFORE defaulting.
    // Explicit width means "fixed layout" (no auto-observe); a bare
    // { container } means "container owns width" (responsive by default).
    this._widthExplicit = width != null;
    this._width = width != null ? width : DEFAULT_WIDTH;
    this._height = height || DEFAULT_HEIGHT;
    this._scale = scale || 1.0;
    this._breakingStrategy = breakingStrategy;
    this._svg = null;
    this._noteData = [];
    this._intrinsicWidths = null;

    // Reactive layout state.
    this._song = null;
    this._responsiveMode = responsiveMode;
    this._resizeObserver = null;
    this._rafId = null;
    this._pending = false;
    // Natural width for zoom-to-fit reference. Captured on the first
    // render(song) call so subsequent ResizeObserver callbacks can
    // compute scale = container.clientWidth / naturalWidth.
    this._naturalWidth = null;

    // Auto-observe decision. An explicit observeContainer:true/false always
    // wins. Otherwise default ON when a container is present and width was
    // NOT explicit — that's the "container owns width" responsive case.
    const shouldObserve =
      observeContainer != null
        ? observeContainer
        : !!this._container && !this._widthExplicit;
    if (shouldObserve) {
      this.observe();
    }
  }

  /**
   * Layout width that, after the display scale is applied, makes the SVG
   * exactly fill a container of clientWidth `cw`. The on-screen SVG width is
   * `this._width * this._scale * PROFESSIONAL_BASE_SCALE`, so to land at `cw`
   * the layout width must be `cw / (scale * PROFESSIONAL_BASE_SCALE)`.
   * @param {number} cw - container.clientWidth in CSS pixels
   * @returns {number} layout width in internal units
   * @private
   */
  _layoutWidthFor(cw) {
    const eff = (this._scale || 1) * PROFESSIONAL_BASE_SCALE;
    return eff > 0 ? cw / eff : cw;
  }

  /**
   * Compute the intrinsic minimum width of each measure (per voice and
   * combined). Foundation for upcoming responsive system breaking — this
   * iteration only computes/caches the table; layout is unchanged.
   * @private
   */
  _computeIntrinsicWidths(songData) {
    this._intrinsicWidths = measureIntrinsicWidths(songData);
  }

  /**
   * Return the cached intrinsic-width table from the most recent render.
   * @returns {Object|null}
   */
  getIntrinsicWidths() {
    return this._intrinsicWidths;
  }

  /**
   * Render notation from song data. Replaces any previous output.
   * @param {Array|Object} songData - Level 1, 2, or 3 input
   * @returns {SVGElement}
   */
  render(songData) {
    this._removeSvg();
    this._song = songData;
    // Container-owns-width: when no explicit width was given and we're in
    // reflow mode, measure the container and fit on the FIRST paint so there
    // is no 800px flash before the ResizeObserver fires. Idempotent with the
    // observer (both route through _layoutWidthFor). Not done for zoom-to-fit,
    // which keeps the natural layout and only changes scale.
    if (
      this._responsiveMode === 'reflow' &&
      !this._widthExplicit &&
      this._container &&
      this._container.clientWidth > 0
    ) {
      this._width = this._layoutWidthFor(this._container.clientWidth);
    }
    if (this._naturalWidth == null) {
      this._naturalWidth = this._width;
    }
    this._computeIntrinsicWidths(songData);

    const parsed = parseNoteData(songData);
    const voiceCount = parsed.voices.length;
    const staffGroups = parsed.staffGroups || [];

    // Build group lookup: voiceId -> group info. Both brace and bracket
    // groups participate in same-group tight spacing and shared barlines.
    const braceGroups = staffGroups.filter(
      (g) => g.type === 'brace' || g.type === 'bracket',
    );
    const voiceBraceGroup = new Map();
    for (const group of braceGroups) {
      for (const vid of group.voiceIds) {
        voiceBraceGroup.set(vid, group);
      }
    }

    // Bracket hooks curl outward above the top staff and below the
    // bottom staff. When any bracket group exists, reserve vertical
    // headroom at the top so the upper hook doesn't get clipped by
    // SVG y=0. Bottom hook fits in the existing trailing margin.
    const hasBracketGroup = staffGroups.some((g) => g.type === 'bracket');
    const bracketTopMargin = hasBracketGroup ? 35 : 0;

    // Compute Y positions for each voice
    const voiceYPositions = [];
    let currentY = 0;
    for (let vi = 0; vi < voiceCount; vi += 1) {
      const voice = parsed.voices[vi];
      const voiceHeight = voiceCount > 1 ? VOICE_HEIGHT : this._height;
      const yOffset = voiceHeight / 2 - STAFF_CENTER_Y;

      if (vi === 0) {
        voiceYPositions.push(yOffset + bracketTopMargin);
        currentY = yOffset + bracketTopMargin;
      } else {
        const prevVoice = parsed.voices[vi - 1];
        const prevInBrace = voiceBraceGroup.get(prevVoice.id);
        const currInBrace = voiceBraceGroup.get(voice.id);
        const sameGroup = prevInBrace && currInBrace && prevInBrace === currInBrace;
        const gap = sameGroup ? GRAND_STAFF_GAP + STAFF_HEIGHT : VOICE_HEIGHT + VOICE_GAP;
        currentY += gap;
        voiceYPositions.push(currentY);
      }
    }

    const hasBraceGroups = braceGroups.length > 0;
    let totalHeight; // mutable: multi-system rendering grows this below.
    if (voiceCount <= 1) {
      totalHeight = this._height;
    } else if (hasBraceGroups) {
      // Dynamic height for grouped staves. The trailing 40 covers
      // descenders and bracket bottom hooks.
      const lastVoiceBottom =
        voiceYPositions[voiceCount - 1] + STAFF_TOP_OFFSET + STAFF_HEIGHT + 40;
      totalHeight = lastVoiceBottom;
    } else {
      // Legacy formula for independent staves
      totalHeight = voiceCount * VOICE_HEIGHT + (voiceCount - 1) * VOICE_GAP;
    }

    // Extend the viewBox to the left when a bracket OR brace is present so
    // the symbol (which sits entirely outside the staff) isn't clipped.
    //
    // Bracket: trunk's right edge at x = -2, hook tips at x ≈ -39.5.
    // Margin 50 covers it with a hair of headroom.
    //
    // Brace: right edge at x = -2, left edge at x = -2 - braceWidth(h).
    // braceWidth scales sub-linearly with height; at typical grand-staff
    // heights it lands near 8–13 px, so we compute the worst case across
    // brace groups to size the margin.
    const hasBraceGroup = braceGroups.some((g) => g.type !== 'bracket');
    let braceLeftMargin = 0;
    if (hasBraceGroup) {
      let maxBraceWidth = 0;
      for (const group of braceGroups) {
        if (group.type === 'bracket') continue;
        const indices = group.voiceIds
          .map((vid) => parsed.voices.findIndex((v) => v.id === vid))
          .filter((i) => i >= 0);
        if (indices.length < 2) continue;
        const firstIdx = Math.min(...indices);
        const lastIdx = Math.max(...indices);
        const h =
          voiceYPositions[lastIdx] + STAFF_TOP_OFFSET + STAFF_HEIGHT
          - (voiceYPositions[firstIdx] + STAFF_TOP_OFFSET);
        const w = getBraceWidth(h);
        if (w > maxBraceWidth) maxBraceWidth = w;
      }
      // BRACE_TO_BARLINE_GAP + brace width + 4 px viewBox headroom.
      braceLeftMargin = Math.ceil(BRACE_TO_BARLINE_GAP + maxBraceWidth + 4);
    }
    const bracketLeftMargin = hasBracketGroup ? 50 : braceLeftMargin;
    this._svg = createSvgElement('svg', {
      class: 'notation',
      width: this._width + bracketLeftMargin,
      height: totalHeight,
      viewBox: `${-bracketLeftMargin} 0 ${this._width + bracketLeftMargin} ${totalHeight}`,
    });

    // Pre-pass: compute the shared music-start X (max over voices of
    // header end position) and the shared beat → x layout. All voices
    // jump to musicStartX after their per-voice header (clef + key sig
    // + time sig) so notes at the same beat align vertically across
    // staves.
    let musicStartX = STAFF_START_X + CLEF_WIDTH + CLEF_ONLY_EXTRA_PAD;
    for (const voice of parsed.voices) {
      let x = STAFF_START_X + CLEF_WIDTH;
      const keyInfo = getKeySignature(voice.keySignature || 'C');
      const hasKeySig = keyInfo.count > 0;
      if (hasKeySig) {
        x += keySignatureAdvance(keyInfo.count);
      }
      if (voice.timeSignature) {
        const { width: tsWidth } = createTimeSignature(voice.timeSignature);
        x += tsWidth + TIME_SIG_PADDING;
      } else if (!hasKeySig) {
        // Clef is the rightmost prelude element — open gap to ≥1.5 staff
        // spaces past clef's visible right edge.
        x += CLEF_ONLY_EXTRA_PAD;
      }
      if (x > musicStartX) musicStartX = x;
    }
    // Use first voice's measureLength as the shared barline rhythm.
    const sharedTimeSignature = parsed.voices.find((v) => v.timeSignature)
      ?.timeSignature;
    const sharedMeasureLength = sharedTimeSignature
      ? sharedTimeSignature[0] * (4 / sharedTimeSignature[1])
      : null;
    const beatToX = computeBeatLayout(parsed.voices, musicStartX);

    // Track per-voice barline X positions for shared barlines
    const voiceBarlineXPositions = new Map();

    // Pre-pass: compute 8va/8vb segments per voice and clone voice.notes
    // with pitches inside each segment shifted by an octave (down for 8va,
    // up for 8vb). The renderer then lays out the shifted pitches as if
    // they were normal in-staff notes; the bracket itself is appended
    // after note rendering. Bass voices short-circuit to no segments.
    const ottavaInputs = parsed.voices.map((v, vi) => ({
      voiceId: vi,
      clef: v.clef || inferClef(v.notes),
      events: buildOttavaEvents(v.notes),
    }));
    const ottavaSegmentsPerVoice = analyzeOttava(ottavaInputs);
    const shiftedVoiceNotes = parsed.voices.map((v, vi) =>
      applyOttavaShift(v.notes, ottavaSegmentsPerVoice[vi] || [])
    );

    // Track the absolute SVG-space content bbox so we can grow the viewBox
    // after rendering. Starts as the default staff band; min/max get
    // tightened by any content (ledger lines, brackets, stems) that
    // protrudes above/below.
    const systemContext = { contentMinY: 0, contentMaxY: totalHeight };

    // ---- System breaking + justification ---------------------------------
    // Greedy: pack measures left-to-right. Per-system, justify by uniform
    // stretch (Gould "Behind Bars", Spacing chapter). The first system
    // reserves prelude width for clef + key sig + time sig; subsequent
    // systems drop the time sig from the prelude.
    //
    // For accurate breaking, we measure per-measure widths against the
    // ACTUAL rendered beat-layout (durationSymbols.js spacing) rather than
    // the iteration-A intrinsic-widths approximation (which used a flat
    // MIN_NOTE_GAP per event). Otherwise systems greedily pack measures
    // that don't actually fit when laid out.
    // Walk one voice's measure boundaries to count measures. Use the FIRST
    // voice that has a timeSignature for the cadence.
    const rhythmVoice = parsed.voices.find((v) => v.timeSignature) || parsed.voices[0];
    const rhythmMeasureLength = rhythmVoice && rhythmVoice.timeSignature
      ? rhythmVoice.timeSignature[0] * (4 / rhythmVoice.timeSignature[1])
      : null;
    // Measure count: walk the rhythm voice, flushing on explicit barline
    // tokens and time-signature beat-fills (mirrors sliceVoiceByMeasure's
    // measure-splitting semantics). We only need the COUNT now — the per-
    // measure intrinsic-WIDTH estimate is gone, replaced by the shared
    // natural-width metric (`systemNaturalWidth`) below.
    const measureCount = (() => {
      if (!rhythmVoice || !rhythmVoice.notes) return 0;
      let count = 0;
      let beat = 0;
      let measureStartBeat = 0;
      let accumBeats = 0;
      const flush = () => { count += 1; measureStartBeat = beat; accumBeats = 0; };
      for (const el of rhythmVoice.notes) {
        if (!el) continue;
        if (!Array.isArray(el) && el.barline !== undefined) { flush(); continue; }
        if (!Array.isArray(el) && (
          el.ending !== undefined || el.navigation !== undefined
          || el.tempo !== undefined || el.tempoChange !== undefined
          || el.expression !== undefined || el.rehearsal !== undefined
          || el.dynamic !== undefined || el.hairpin !== undefined
        )) continue;
        let evBeats = 0;
        if (Array.isArray(el)) {
          const first = el.find((n) => n && n.length);
          if (!first) continue;
          evBeats = (fractionToBeats(first.length) || 0) * (first.dotted ? 1.5 : 1);
        } else if (el.tuplet && Array.isArray(el.notes)) {
          const [actual, normal] = el.tuplet;
          for (const inner of el.notes) {
            if (Array.isArray(inner)) {
              const f = inner.find((n) => n && n.length);
              if (f) evBeats += (fractionToBeats(f.length) || 0) * (f.dotted ? 1.5 : 1) * (normal / actual);
            } else if (inner && inner.length) {
              evBeats += (fractionToBeats(inner.length) || 0) * (inner.dotted ? 1.5 : 1) * (normal / actual);
            }
          }
        } else if (el.length) {
          evBeats = (fractionToBeats(el.length) || 0) * (el.dotted ? 1.5 : 1);
        } else {
          continue;
        }
        beat += evBeats;
        accumBeats += evBeats;
        if (rhythmMeasureLength && accumBeats >= rhythmMeasureLength - 1e-6) flush();
      }
      if (beat > measureStartBeat) flush();
      return count;
    })();

    // Per-system prelude width: shared across voices (max), since voices
    // sit in the same horizontal coordinate frame. Time sig only on the
    // first system. Music starts after the largest prelude.
    const preludePerSystem = (systemIndex) => {
      let maxPrelude = 0;
      for (const voice of parsed.voices) {
        let p = STAFF_START_X + CLEF_WIDTH;
        const keyInfo = getKeySignature(voice.keySignature || 'C');
        const hasKeySig = keyInfo.count > 0;
        if (hasKeySig) p += keySignatureAdvance(keyInfo.count);
        const hasTimeSig = systemIndex === 0 && voice.timeSignature;
        if (hasTimeSig) {
          const { width: tsWidth } = createTimeSignature(voice.timeSignature);
          p += tsWidth + TIME_SIG_PADDING;
        } else if (!hasKeySig) {
          // Continuation system (or system 0 without a time-sig) where
          // the clef is the rightmost prelude element — see CLEF_ONLY_EXTRA_PAD.
          p += CLEF_ONLY_EXTRA_PAD;
        }
        if (p > maxPrelude) maxPrelude = p;
      }
      return maxPrelude;
    };

    // Per-system music-start X for a given system index (isFirst drives the
    // time-sig term). Mirrors preludePerSystem's per-voice max but anchored
    // at the CLEF_ONLY_EXTRA_PAD default like the inline per-system code.
    const musicStartXForSystem = (systemIndex) => {
      let startX = STAFF_START_X + CLEF_WIDTH + CLEF_ONLY_EXTRA_PAD;
      for (const voice of parsed.voices) {
        let x = STAFF_START_X + CLEF_WIDTH;
        const keyInfo = getKeySignature(voice.keySignature || 'C');
        const hasKeySig = keyInfo.count > 0;
        if (hasKeySig) x += keySignatureAdvance(keyInfo.count);
        const hasTimeSig = systemIndex === 0 && voice.timeSignature;
        if (hasTimeSig) {
          const { width: tsWidth } = createTimeSignature(voice.timeSignature);
          x += tsWidth + TIME_SIG_PADDING;
        } else if (!hasKeySig) {
          x += CLEF_ONLY_EXTRA_PAD;
        }
        if (x > startX) startX = x;
      }
      return startX;
    };

    // THE SHARED NATURAL-WIDTH METRIC. Returns the renderer's TRUE natural
    // (unstretched) extent of laying out measures [start..end] as one system
    // on `systemIndex` — computed by the exact same `computeSystemSpringLayout`
    // the renderer uses below. The breaker decides breaks from this number, so
    // breaking and rendering agree by construction: a run fits iff its natural
    // width ≤ this._width, justification therefore only ever STRETCHES, and
    // the last note always keeps its proportional trailing (never crammed,
    // never clipped). This supersedes the old additive intrinsic-width table
    // plus the f6d8426 daylight array and the 9ce0b20 fixed trailingReserve —
    // three overlapping ESTIMATES collapsed into one source of truth.
    const systemNaturalWidth = (startMeasure, endMeasure, systemIndex) => {
      const slicedNotes = parsed.voices.map((v, vi) => sliceVoiceByMeasure(
        shiftedVoiceNotes[vi], sharedMeasureLength, startMeasure, endMeasure
      ));
      const sliceVoices = parsed.voices.map((v, vi) => ({ ...v, notes: slicedNotes[vi] }));
      const startX = musicStartXForSystem(systemIndex);
      const { naturalRightX } = computeSystemSpringLayout(
        sliceVoices, slicedNotes, startX, sharedMeasureLength, null
      );
      return naturalRightX;
    };

    const breakFn = this._breakingStrategy === 'greedy' ? breakIntoSystems : breakIntoSystemsOptimal;
    const systemPlans = breakFn(
      measureCount,
      this._width,
      systemNaturalWidth,
    );

    // Multi-system tightening: when the piece wraps onto >1 system AND
    // the voices are independent (no brace group), the per-voice Y
    // gaps computed above (VOICE_HEIGHT + VOICE_GAP = 240) are visually
    // too large — adjacent staves end up looking like separate systems
    // rather than a paired system. Compress so intra-system stays
    // smaller than the SYSTEM_GAP visually inserted between systems,
    // but per Elaine Gould "Behind Bars" p. 488 leave ~6 staff spaces
    // (= INDEPENDENT_STAFF_WHITE_SPACE) of empty space between the
    // staff lines so the two staves still read as paired rather than
    // cramped. The original single-system layout is preserved when
    // there's only one system.
    const multiSystem = systemPlans.length > 1;
    let effectiveVoiceYPositions = voiceYPositions;
    if (multiSystem && !hasBraceGroups && voiceCount > 1) {
      effectiveVoiceYPositions = [];
      let y = bracketTopMargin;
      for (let vi = 0; vi < voiceCount; vi += 1) {
        effectiveVoiceYPositions.push(y);
        y += STAFF_HEIGHT + INDEPENDENT_STAFF_WHITE_SPACE;
      }
    }

    // Voice-level slicing prep: shared time-sig drives measure length used
    // by the slicer; voices without their own time sig fall back to this.
    const sliceMeasureLength = sharedMeasureLength;

    let systemYOffset = 0;
    let lastSystemBottomY = totalHeight;
    let maxSystemEndX = 0;

    if (systemPlans.length === 0) {
      // Empty piece — still render one bare system (clefs + staff lines).
      const preludeWidth = preludePerSystem(0);
      this._renderSystem({
        voices: parsed.voices,
        shiftedVoiceNotes,
        ottavaSegmentsPerVoice,
        voiceYPositions,
        voiceBarlineXPositions,
        beatToX,
        musicStartX,
        startMeasure: 0,
        endMeasure: -1,
        isFirstSystem: true,
        isLastSystem: true,
        systemYOffset: 0,
        systemEndX: this._width,
        preludeWidth,
        renderTimeSignature: true,
        systemContext,
        braceGroups,
        systemIndex: 0,
      });
    } else {
      for (let si = 0; si < systemPlans.length; si += 1) {
        const plan = systemPlans[si];
        const isFirst = si === 0;
        const isLast = si === systemPlans.length - 1;
        const preludeWidth = preludePerSystem(si);

        // System slice per voice. Slice indices use the shared measure
        // length (driving the system break). The slicer assigns markers
        // to the next sounding note's measure.
        const slicedVoiceNotes = parsed.voices.map((v, vi) => sliceVoiceByMeasure(
          shiftedVoiceNotes[vi], sliceMeasureLength, plan.startMeasure, plan.endMeasure
        ));
        // Sliced ottava segments: keep only segments whose start lies in
        // this system's range, and clip their endIndex to the slice. The
        // segment indices are into the ORIGINAL pre-slice voice; we'll
        // rebase them after the slice in _renderSystem by passing the
        // sliced segments paired with the sliced notes.
        const slicedOttavaPerVoice = parsed.voices.map((v, vi) => {
          const segs = ottavaSegmentsPerVoice[vi] || [];
          return segs
            .map((seg) => {
              // Rebase: find positions of seg start/end in the original
              // shifted notes, then offset by the slice start index. We
              // compute slice-relative indices below.
              return seg;
            });
        });

        // Per-system Y offsets. We need to know the system's total
        // vertical span (top/bottom from contentMinY/MaxY equivalents).
        // For now, use a fixed estimate: voice band + bracket margins.
        // The per-voice Y positions stay the same shape; we just shift by
        // systemYOffset.
        const shiftedVoiceYPositions = effectiveVoiceYPositions.map((y) => y + systemYOffset);

        // Use the sliced voices for layout. The shared beat→x layout is
        // rebuilt per system from the sliced voice notes.
        const sliceVoices = parsed.voices.map((v, vi) => ({
          ...v,
          notes: slicedVoiceNotes[vi],
        }));

        // Per-system music start: same musicStartX rule, but recompute
        // since later systems skip the time sig.
        const perSystemMusicStartX = musicStartXForSystem(si);

        // ONE SHARED METRIC. Compute this system's TRUE natural extent via
        // the same helper the breaker used to decide breaks. Because the
        // breaker only kept this run if naturalRightX ≤ this._width,
        // justification can only STRETCH from here — never compress below
        // natural — so the last note always keeps its proportional trailing.
        const naturalLayout = computeSystemSpringLayout(
          sliceVoices, slicedVoiceNotes, perSystemMusicStartX, sharedMeasureLength, null
        );
        const naturalRightX = naturalLayout.naturalRightX;
        // RAGGED RENDER edge: the proportional-trailing extent. The breaker
        // decides breaks from naturalRightX (the floor) so it never wraps a
        // run a whole-note-width too early, but a ragged last system must
        // RENDER its closing barline at the last note's duration-proportional
        // trailing (Gould "Behind Bars", Spacing). naturalRenderRightX is
        // floored at MIN_BARLINE_PADDING, so it is always ≥ naturalRightX and
        // never pulls the barline in below the floor.
        const naturalRenderRightX = naturalLayout.naturalRenderRightX;
        // cappedRightX = the system right edge at which the inter-note springs
        // reach LAST_SYSTEM_STRETCH_CAP× natural. Only a LAST/ONLY system caps;
        // interior systems always fully justify to this._width.
        const cappedRightX = naturalLayout.cappedRightX;
        const systemEndBeat = naturalLayout.systemEndBeat;
        const measureCountInSystem = plan.endMeasure - plan.startMeasure + 1;

        // LAST-SYSTEM STRETCH CAP (Gould "Behind Bars", Systems; LilyPond/
        // Dorico): a last/only system is NOT justified to the container at any
        // density. It justifies only up to cappedRightX (springs at 1.5×);
        // past that it freezes at the cap and goes RAGGED-LEFT. Three regimes:
        //   • container ≤ naturalRightX  → ragged at natural (incl. a solo
        //     1-measure final — the cap fires immediately there).
        //   • naturalRightX < container ≤ cappedRightX → justify to container
        //     (stretch ≤ 1.5×). This is CONTINUOUS with the next regime.
        //   • container > cappedRightX   → justify the springs to cappedRightX
        //     (1.5×) and render RAGGED-LEFT: staff lines + closing barline end
        //     at cappedRightX, whitespace fills the rest of the container.
        // Interior systems ignore the cap and justify to this._width.
        const soloFinal = isLast && measureCountInSystem === 1;
        // The right edge the SPRINGS are solved toward (the justify target).
        let springTargetRightX;
        // The right edge the STAFF / closing barline render at (= springs'
        // target when justified-or-capped; the proportional-trailing natural
        // extent when ragged at natural).
        let systemRightX;
        let raggedAtNatural;
        if (isLast && naturalRightX < this._width - 1e-6) {
          // The container is wider than natural — the last system would
          // otherwise justify. Cap it at cappedRightX (springs at 1.5×).
          const cappedTarget = Math.min(this._width, cappedRightX);
          // Never pull the closing barline IN below naturalRenderRightX (the
          // proportional-trailing ragged extent). For a sparse final whose
          // natural render extent already exceeds cappedRightX — e.g. a solo
          // long-note measure whose duration-proportional trailing reaches
          // near the container — the cap would otherwise compress it; instead
          // leave it ragged at natural (preserving the proportional trailing).
          if (cappedTarget > naturalRenderRightX + 1e-6) {
            // Justify the springs out to the capped target, render ragged-left
            // (staff + closing barline end at cappedTarget, whitespace after
            // when cappedTarget < this._width).
            springTargetRightX = cappedTarget;
            systemRightX = cappedTarget;
            raggedAtNatural = false;
          } else {
            // Cap doesn't bind past the natural render extent: ragged at the
            // proportional-trailing natural extent (the pre-cap behavior).
            springTargetRightX = null;
            systemRightX = naturalRenderRightX;
            raggedAtNatural = true;
          }
        } else if (!soloFinal && naturalRightX < this._width - 1e-6) {
          // Interior system with slack: justify fully to the container.
          springTargetRightX = this._width;
          systemRightX = this._width;
          raggedAtNatural = false;
        } else {
          // No slack (or solo final): ragged at the proportional-trailing
          // natural extent.
          springTargetRightX = null;
          systemRightX = naturalRenderRightX;
          raggedAtNatural = true;
        }

        // Lay the system out at the chosen right edge. When justifying (or
        // capping) we pass springTargetRightX and the inter-note springs
        // stretch into the slack; when ragged-at-natural we keep the natural
        // inter-note layout untouched and only push the closing barline
        // (systemEndX) out to naturalRenderRightX — the notes stay at their
        // natural onsets, but the final barline sits at the last note's
        // duration-proportional trailing (floored), not the floor.
        const layout = raggedAtNatural
          ? naturalLayout
          : computeSystemSpringLayout(
              sliceVoices, slicedVoiceNotes, perSystemMusicStartX, sharedMeasureLength, springTargetRightX
            );
        const {
          stretchedBeatToX,
          prePadMap,
          postPadMap,
          barlineGap,
          trailingBarlineGap,
        } = layout;
        // Re-slice ottava segments to be relative to the slice'd voice
        // notes array. Build a mapping from original-index → slice-index
        // using sliceVoiceByMeasure's logic — easiest: re-walk and match
        // by reference identity.
        const slicedOttavaSegs = parsed.voices.map((v, vi) => {
          const origNotes = shiftedVoiceNotes[vi];
          const sliceNotes = slicedVoiceNotes[vi];
          // Build index map by element identity (Array elements unique
          // per measure since they're freshly created clones from the
          // shift step).
          const indexInSlice = new Map();
          let cursor = 0;
          for (let i = 0; i < origNotes.length; i += 1) {
            if (cursor < sliceNotes.length && sliceNotes[cursor] === origNotes[i]) {
              indexInSlice.set(i, cursor);
              cursor += 1;
            }
          }
          const segs = ottavaSegmentsPerVoice[vi] || [];
          const out = [];
          for (const seg of segs) {
            const ns = indexInSlice.get(seg.startIndex);
            const ne = indexInSlice.get(seg.endIndex);
            if (ns !== undefined && ne !== undefined) {
              out.push({ ...seg, startIndex: ns, endIndex: ne });
            } else if (ns !== undefined || ne !== undefined) {
              // Cross-system ottava — split: render the in-system portion
              // up to (or from) the slice boundary as its own bracket
              // with proper hook/glyph. Per Gould, each system gets its
              // own "8" glyph and right-end hook.
              const startInSlice = ns !== undefined
                ? ns
                : 0;
              const endInSlice = ne !== undefined
                ? ne
                : sliceNotes.length - 1;
              if (startInSlice <= endInSlice) {
                out.push({ ...seg, startIndex: startInSlice, endIndex: endInSlice });
              }
            }
          }
          // Suppress unused-binding lint
          void slicedOttavaPerVoice;
          return out;
        });

        // Cross-system tie/slur detection (warn-only this iteration).
        for (let vi = 0; vi < parsed.voices.length; vi += 1) {
          const origNotes = shiftedVoiceNotes[vi];
          const sliceNotes = slicedVoiceNotes[vi];
          if (sliceNotes.length === 0 || sliceNotes.length === origNotes.length) continue;
          // If first/last sliced note has a tie/slur start that resolves
          // outside the slice, it'll silently fail to render. Warn once.
          const last = sliceNotes[sliceNotes.length - 1];
          const first = sliceNotes[0];
          const hasTieOut = last && ((Array.isArray(last)
            ? last.some((n) => n && (n.tie === 'start' || n.tie === 'continue'))
            : last.tie === 'start' || last.tie === 'continue'));
          const hasSlurIn = first && ((Array.isArray(first)
            ? first.some((n) => n && n.slur === 'stop')
            : first.slur === 'stop'));
          if (hasTieOut) {
            // eslint-disable-next-line no-console
            console.warn('Cross-system tie truncated at system boundary (not yet drawn across).');
          }
          if (hasSlurIn) {
            // eslint-disable-next-line no-console
            console.warn('Cross-system slur truncated at system boundary (not yet drawn across).');
          }
        }

        if (systemRightX > maxSystemEndX) maxSystemEndX = systemRightX;

        this._renderSystem({
          voices: sliceVoices,
          shiftedVoiceNotes: slicedVoiceNotes,
          ottavaSegmentsPerVoice: slicedOttavaSegs,
          voiceYPositions: shiftedVoiceYPositions,
          voiceBarlineXPositions,
          beatToX: stretchedBeatToX,
          musicStartX: perSystemMusicStartX,
          startMeasure: plan.startMeasure,
          endMeasure: plan.endMeasure,
          isFirstSystem: isFirst,
          isLastSystem: isLast,
          systemYOffset,
          systemEndX: systemRightX,
          renderTimeSignature: isFirst,
          systemContext,
          braceGroups,
          systemIndex: si,
          barlineGap,
          trailingBarlineGap,
          systemEndBeat,
          prePadMap,
          postPadMap,
        });

        // Advance Y for the next system. Use effectiveVoiceYPositions so
        // the per-system band height matches the rendered staves (matters
        // when multiSystem tightens the intra-system voice gap).
        const systemBandTop = effectiveVoiceYPositions[0];
        const systemBandBottom = effectiveVoiceYPositions[voiceCount - 1] + STAFF_TOP_OFFSET + STAFF_HEIGHT + 40;
        const systemBottom = systemBandBottom + systemYOffset;
        lastSystemBottomY = systemBottom;
        systemYOffset += (systemBandBottom - systemBandTop) + SYSTEM_GAP;
      }
    }

    // Update totalHeight if we have multiple systems.
    if (systemPlans.length > 1) {
      totalHeight = Math.max(totalHeight, lastSystemBottomY + 40);
      systemContext.contentMaxY = Math.max(systemContext.contentMaxY, totalHeight);
    }

    const { contentMinY, contentMaxY } = systemContext;


    // Content-aware viewport grow. We started with [0, totalHeight] and
    // tightened (contentMinY, contentMaxY) to the actual rendered content.
    // Apply a small visual margin and rewrite width/height/viewBox so the
    // SVG itself contains all rendered ink without consumer-side padding.
    const MARGIN = 10;
    const grownTop = Math.min(0, Math.floor(contentMinY - MARGIN));
    const grownBottom = Math.max(totalHeight, Math.ceil(contentMaxY + MARGIN));
    let grownHeight = grownBottom - grownTop;
    const widthAttr = this._svg.getAttribute('width');
    let svgPxWidth = parseFloat(widthAttr);
    // Grow width if a degenerate-overflow system pushed its right edge
    // past this._width. This happens when a single measure's natural
    // rendered width exceeds the available music budget — the system
    // breaker logs a warn and renders it solo.
    if (maxSystemEndX > this._width) {
      const newSvgW = Math.ceil(maxSystemEndX + bracketLeftMargin);
      this._svg.setAttribute('width', newSvgW);
      svgPxWidth = newSvgW;
    }
    if (grownTop < 0 || grownBottom > totalHeight || svgPxWidth !== parseFloat(widthAttr)) {
      this._svg.setAttribute('height', grownHeight);
      this._svg.setAttribute(
        'viewBox',
        `${-bracketLeftMargin} ${grownTop} ${svgPxWidth} ${grownHeight}`
      );
    }

    // Uniform display scale. Internal coordinates stay scale-invariant;
    // the SVG width/height are scaled, and the viewBox is rewritten so the
    // same internal coords now occupy `scale × ` more pixels. This avoids
    // wrapping content in a transform group (which would push it past
    // viewBox edges and complicate clipping).
    // The effective multiplier is the user scale × the professional base, so
    // scale 1.0 yields a standard ~7 mm staff. viewBox stays in internal units,
    // so the consumer sees the SVG scaled since width/height differ from it.
    const effectiveScale = this._scale * PROFESSIONAL_BASE_SCALE;
    if (effectiveScale !== 1.0) {
      const heightAttr = this._svg.getAttribute('height');
      const svgPxHeight = parseFloat(heightAttr);
      this._svg.setAttribute('width', svgPxWidth * effectiveScale);
      this._svg.setAttribute('height', svgPxHeight * effectiveScale);
    }

    if (this._container) {
      this._container.appendChild(this._svg);
    }

    return this._svg;
  }

  /**
   * Render one system: a horizontal slice of the piece spanning a measure
   * range. Currently called once with the entire piece (zero-behavior-change
   * seam); upcoming iterations will call this N times for N systems with
   * justified target widths per measure.
   *
   * The caller owns all piece-wide pre-computed state (parsed voices,
   * shifted-pitch voices for ottava, ottava segments, brace groups, beat→x
   * map, music-start X, per-voice Y positions, per-voice barline-X collector
   * keyed by voice id). This method appends every visible element for the
   * system — staff lines, clefs, key sigs, time sigs, notes, beams, ties,
   * slurs, dynamics, hairpins, ottava brackets, voltas, lyrics, braces,
   * brackets, shared barlines — and updates `systemContext.contentMinY` /
   * `contentMaxY` so the caller can grow the viewBox to fit the content.
   *
   * @private
   */
  _renderSystem({
    voices,
    shiftedVoiceNotes,
    ottavaSegmentsPerVoice,
    voiceYPositions,
    voiceBarlineXPositions,
    beatToX,
    musicStartX,
    startMeasure,
    endMeasure,
    isFirstSystem,
    isLastSystem,
    systemYOffset = 0,
    systemEndX,
    renderTimeSignature = true,
    systemContext,
    braceGroups,
    systemIndex = 0,
    barlineGap = BAR_LINE_PADDING,
    trailingBarlineGap = barlineGap,
    systemEndBeat = null,
    prePadMap = null,
    postPadMap = null,
  }) {
    let contentMinY = systemContext.contentMinY;
    let contentMaxY = systemContext.contentMaxY;

    // Shared barline beats — the set of beat positions where EVERY voice
    // in this system has a measure boundary. Used to gate barlineOffset:
    // a barline at a shared beat may safely push subsequent notes to the
    // right (all voices push together → still aligned). A barline at a
    // voice-specific beat (polymetric: 3/4 voice's bar 1 ending inside a
    // 4/4 voice's bar 1) MUST be drawn in the existing inter-note slack
    // WITHOUT advancing barlineOffset — otherwise that voice's downstream
    // notes drift right of their shared-grid x. See Gould "Behind Bars"
    // on polymetric: coincident beats across voices must coincide in x.
    const voiceBarlineBeatSets = voices.map((v) => {
      const set = new Set();
      const tsig = v.timeSignature;
      if (!tsig) return set;
      const mLen = tsig[0] * (4 / tsig[1]);
      const evs = collectVoiceEvents(shiftedVoiceNotes[voices.indexOf(v)]);
      let cum = 0;
      let lastEnd = 0;
      for (const ev of evs) {
        lastEnd = ev.endBeat;
        cum += ev.endBeat - ev.startBeat;
        while (cum >= mLen - 0.001) {
          set.add(ev.endBeat - (cum - mLen));
          cum -= mLen;
        }
      }
      void lastEnd;
      return set;
    });
    const sharedBarlineBeats = voiceBarlineBeatSets.length === 0
      ? new Set()
      : [...voiceBarlineBeatSets[0]].reduce((acc, b) => {
          if (voiceBarlineBeatSets.every((s) => s.has(b))) acc.add(b);
          return acc;
        }, new Set());

    voices.forEach((voice, index) => {
      // Render against the octave-shifted notes so the heads sit near the
      // staff under the bracket. The original voice.notes is preserved on
      // the model for downstream consumers (playback, serialization).
      voice = { ...voice, notes: shiftedVoiceNotes[index] };
      const clef = voice.clef || inferClef(voice.notes);
      const voiceY = voiceYPositions[index];

      const staffGroup = createGroup(`staff staff-${index}`, {
        'data-voice-id': voice.id,
        'data-clef': clef,
        'data-system-index': String(systemIndex),
        'data-start-measure': String(startMeasure),
        'data-end-measure': String(endMeasure),
        transform: `translate(0, ${voiceY})`,
      });

      // Staff lines — stop at the system's right edge (barline x), not
      // the full SVG width. Per-system the right edge is `systemEndX`.
      const staffLineWidth = systemEndX !== undefined ? systemEndX : this._width;
      const lines = createStaffLines(staffLineWidth);
      lines.setAttribute('transform', `translate(0, ${STAFF_TOP_OFFSET})`);
      staffGroup.appendChild(lines);

      // Clef
      const clefGroup = createClef(clef);
      clefGroup.setAttribute('transform', `translate(${STAFF_START_X}, 0)`);
      staffGroup.appendChild(clefGroup);

      let cursorX = STAFF_START_X + CLEF_WIDTH;

      // Key signature
      const keySignature = voice.keySignature || 'C';
      const keySigGroup = createKeySignature(keySignature, clef);
      if (keySigGroup) {
        keySigGroup.setAttribute('transform', `translate(${cursorX}, 0)`);
        staffGroup.appendChild(keySigGroup);
        const keyInfo = getKeySignature(keySignature);
        cursorX += keySignatureAdvance(keyInfo.count);
      }

      // Time signature — first system only. Subsequent systems use the
      // same measure cadence (passed via measureLength) but omit the
      // redundant glyph.
      const timeSignature = voice.timeSignature;
      if (timeSignature && renderTimeSignature) {
        const { element: timeSigGroup, width: tsWidth } = createTimeSignature(timeSignature);
        // createTimeSignature centers digits on local x=0; offset by half
        // its width so the left edge sits at cursorX.
        timeSigGroup.setAttribute('transform', `translate(${cursorX + tsWidth / 2}, 0)`);
        staffGroup.appendChild(timeSigGroup);
        cursorX += tsWidth + TIME_SIG_PADDING;
      }

      // Beat tracking for bar lines
      const measureLength = timeSignature ? timeSignature[0] * (4 / timeSignature[1]) : null;
      let cumulativeBeats = 0;

      // Jump to shared music-start X. From here on, note positions are
      // looked up in the shared beatToX map (with cumulative barline
      // padding applied per voice as it crosses measure boundaries).
      cursorX = musicStartX;
      let barlineOffset = 0;
      const xForBeat = (beat) => {
        const base = beatToX.get(beat);
        return (base !== undefined ? base : cursorX) + barlineOffset;
      };

      // Track barline X positions for shared barlines in brace groups
      const barlineXs = [];
      voiceBarlineXPositions.set(voice.id, barlineXs);

      // Pre-compute beam groups
      const beamGroups = timeSignature ? computeBeamGroups(voice.notes, timeSignature) : [];
      const beamLookup = new Map();
      beamGroups.forEach((group, gi) => {
        group.forEach((noteIdx, posInGroup) => {
          beamLookup.set(noteIdx, {
            groupIndex: gi,
            isFirst: posInGroup === 0,
            isLast: posInGroup === group.length - 1,
          });
        });
      });

      // Pre-compute stem direction for each beam group
      const beamGroupStemDown = beamGroups.map((group) => {
        const yValues = group.map((idx) => {
          const el = voice.notes[idx];
          return el.pitch ? pitchToStaffY(el.pitch, clef) : MIDDLE_LINE_Y;
        });
        const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
        return avgY <= MIDDLE_LINE_Y;
      });

      let activeBeamGroupEl = null;
      let activeBeamNoteData = [];
      let activeBeamGroupIdx = -1;

      // Track note X positions for tie rendering
      const noteXPositions = new Map();
      let beatPosition = 0;

      // Marker tracking for post-processing
      const pendingDynamics = [];
      const hairpinStarts = [];
      const completedHairpins = [];

      // Ending (volta) tracking
      const endingData = [];
      const activeEndings = new Map();

      // Track the most recently emitted auto-barline so a coincident
      // repeat-end can REPLACE it (Gould "Behind Bars", Repeats: the
      // repeat-end IS the measure barline at that position; never draw
      // both). Reset to null whenever a note/rest/chord renders past it.
      let pendingAutoBarline = null;

      // Emit a closing auto-barline for a measure boundary, clamping it
      // to the system right edge so the closing barline of a wrapped
      // system always aligns with the staff terminus (Gould "Behind
      // Bars", system breaks: every non-final system terminates with a
      // visible barline at the staff right edge — the "system
      // continuation bar"). When an explicit `barline: 'final'` will be
      // drawn at systemEndX on the last system, suppress the auto-bar
      // entirely to avoid a duplicate pair at the same x.
      //
      // SNAP-TO-TERMINUS: on a non-final system, the spring layout
      // targets the last sounding beat at `systemRightX -
      // END_OF_SYSTEM_NOTE_ROOM (= 2*BAR_LINE_PADDING)`. The auto-bar
      // emitted at the end of that measure naturally lands at
      // `xForBeat(endBeat) - BAR_LINE_PADDING`, which (after trailing-
      // spring stretch) sits roughly one BAR_LINE_PADDING short of
      // systemEndX. Snap any auto-bar landing within ~1.5*
      // BAR_LINE_PADDING of systemEndX UP to the terminus — that's the
      // engraving "this bar wraps; here's the visible terminator"
      // glyph. Notes keep their stretched positions; only this final
      // barline glyph moves to the edge.
      const emitAutoBarline = (rawX) => {
        if (
          isLastSystem &&
          systemEndX !== undefined &&
          rawX >= systemEndX - 0.5
        ) {
          // The system-end `final` (renderRepeatBarline at systemEndX)
          // takes over; skip the plain auto-bar.
          return null;
        }
        let clampedX = rawX;
        if (systemEndX !== undefined) {
          // Pull the bar IN by half its stroke width so the glyph's
          // RIGHT EDGE — not its centre — sits flush with the staff
          // terminus. Drawing the line centred on systemEndX clips the
          // outer half against the SVG viewBox boundary, reducing the
          // closing bar to a ~1.6px sliver that reads as absent.
          const halfStroke = THIN_BARLINE_THICKNESS / 2;
          const edgeFlushX = systemEndX - halfStroke;
          if (rawX > systemEndX) {
            clampedX = edgeFlushX;
          } else if (!isLastSystem && systemEndX - rawX <= 1.5 * BAR_LINE_PADDING) {
            // System-final auto-bar — snap to the staff right edge.
            clampedX = edgeFlushX;
          }
        }
        const el = createBarLine(clampedX);
        staffGroup.appendChild(el);
        barlineXs.push(clampedX);
        pendingAutoBarline = { el, x: clampedX };
        return clampedX;
      };
      // Right visual edge (x of notehead's right side) of the most
      // recently rendered note/chord — used to verify repeat-end dot
      // clearance when the barline coincides with a measure boundary.
      let lastNoteRightEdge = -Infinity;

      // Lyric tracking
      const lyricData = [];

      // Notes
      for (let i = 0; i < voice.notes.length; i++) {
        const element = voice.notes[i];

        // Detect inline markers (dynamics, hairpins, etc.)
        const markerType = getMarkerType(element);
        if (markerType === 'dynamic') {
          pendingDynamics.push({ dynamic: element.dynamic, noteIndex: i });
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'hairpin') {
          if (element.start) {
            hairpinStarts.push({ type: element.hairpin, noteIndex: i });
          }
          if (element.stop && hairpinStarts.length > 0) {
            const start = hairpinStarts.pop();
            completedHairpins.push({
              type: start.type,
              startIndex: start.noteIndex,
              stopIndex: i,
              startX: start.startX,
              startY: start.startY,
            });
          }
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'tuplet') {
          // Render tuplet group inline
          const tupletRatio = element.tuplet;
          const tupletNotes = element.notes;
          const [actual, normal] = tupletRatio;

          const tupletGroup = createGroup('tuplet-group', {
            'data-tuplet': `${actual}:${normal}`,
          });

          const startX = cursorX;
          let allBeamable = true;
          let hasRest = false;
          const tupletNoteData = [];
          const tupletYPositions = [];

          for (let ti = 0; ti < tupletNotes.length; ti += 1) {
            const tEl = tupletNotes[ti];

            if (Array.isArray(tEl)) {
              // Chord inside tuplet
              allBeamable = false; // simplify: chords don't beam in tuplets
              const chordNotes = tEl.filter((n) => n.pitch);
              if (chordNotes.length > 0) {
                const chordLength = chordNotes[0].length;
                const info = getDurationInfo(chordLength);
                const yPositions = chordNotes.map((n) => pitchToStaffY(n.pitch, clef));
                const distances = yPositions.map((y) => Math.abs(y - MIDDLE_LINE_Y));
                const maxDistIdx = distances.indexOf(Math.max(...distances));
                const stemDown = yPositions[maxDistIdx] <= MIDDLE_LINE_Y;

                const chordGroup = createGroup(`chord note ${info.cssClass}`, {
                  transform: `translate(${cursorX}, 0)`,
                });
                chordGroup.setAttribute('data-beat', String(beatPosition));

                for (const noteY of yPositions) {
                  const head = createSmuflGlyph(chordGlyphFor(info), 'note-head');
                  head.setAttribute('transform', `translate(0, ${noteY})`);
                  chordGroup.appendChild(head);
                  tupletYPositions.push(noteY);
                }

                if (info.hasStem) {
                  const minY = Math.min(...yPositions);
                  const maxY = Math.max(...yPositions);
                  const stemX = stemDown ? -HEAD_TIP_X : HEAD_TIP_X;
                  const stemY1 = stemDown ? minY - HEAD_TIP_Y : maxY + HEAD_TIP_Y;
                  const stemY2 = stemDown ? maxY - HEAD_TIP_Y + STEM_LENGTH : minY + HEAD_TIP_Y - STEM_LENGTH;
                  chordGroup.appendChild(
                    createLine(stemX, stemY1, stemX, stemY2, {
                      class: 'note-stem',
                      stroke: 'currentColor',
                      'stroke-width': 2.4,
                    })
                  );
                }

                tupletGroup.appendChild(chordGroup);

                const effectiveBeats = getTupletNoteDuration(
                  chordLength,
                  chordNotes[0].dotted || false,
                  tupletRatio
                );
                this._noteData.push({
                  element: chordGroup,
                  beat: beatPosition,
                  duration: effectiveBeats,
                  x: cursorX,
                  voiceId: voice.id,
                });
                beatPosition += effectiveBeats;
                cursorX += info.spacing * (normal / actual);
              }
            } else if (!tEl.pitch && tEl.length) {
              // Rest inside tuplet
              hasRest = true;
              allBeamable = false;
              const restGroup = createRest({ length: tEl.length, x: cursorX });
              restGroup.setAttribute('data-beat', String(beatPosition));
              tupletGroup.appendChild(restGroup);

              const info = getDurationInfo(tEl.length);
              const effectiveBeats = getTupletNoteDuration(
                tEl.length,
                tEl.dotted || false,
                tupletRatio
              );
              this._noteData.push({
                element: restGroup,
                beat: beatPosition,
                duration: effectiveBeats,
                x: cursorX,
                voiceId: voice.id,
              });
              beatPosition += effectiveBeats;
              cursorX += info.spacing * (normal / actual);
            } else if (tEl.pitch) {
              // Note inside tuplet
              const noteY = pitchToStaffY(tEl.pitch, clef);
              tupletYPositions.push(noteY);
              const info = getDurationInfo(tEl.length);

              // Check if beamable
              if (info.beams < 1) allBeamable = false;

              const noteGroup = createNote({
                pitch: tEl.pitch,
                length: tEl.length,
                x: cursorX,
                clef,
                beamed: allBeamable && !hasRest,
                stemDown: undefined,
              });
              noteGroup.setAttribute('data-beat', String(beatPosition));

              // Articulations
              if (tEl.articulation) {
                const noteStemDown = noteY <= MIDDLE_LINE_Y;
                const artGroup = renderArticulations({
                  articulation: tEl.articulation,
                  stemDown: noteStemDown,
                });
                if (artGroup) noteGroup.appendChild(artGroup);
              }

              tupletGroup.appendChild(noteGroup);
              tupletNoteData.push({ x: cursorX, y: noteY, beams: info.beams });

              // Ledger lines
              const ledgerGroup = createLedgerLines({ x: cursorX, y: noteY });
              if (ledgerGroup) tupletGroup.appendChild(ledgerGroup);

              const effectiveBeats = getTupletNoteDuration(
                tEl.length,
                tEl.dotted || false,
                tupletRatio
              );
              this._noteData.push({
                element: noteGroup,
                beat: beatPosition,
                duration: effectiveBeats,
                x: cursorX,
                voiceId: voice.id,
              });
              beatPosition += effectiveBeats;
              cursorX += info.spacing * (normal / actual);
            }
          }

          const endX = cursorX;
          const fullyBeamed = allBeamable && !hasRest && tupletNoteData.length >= 2;

          // Beam tuplet notes as a single group if fully beamable
          if (fullyBeamed && tupletNoteData.length >= 2) {
            const avgY = tupletYPositions.reduce((a, b) => a + b, 0) / tupletYPositions.length;
            const stemDown = avgY <= MIDDLE_LINE_Y;

            const beamPaths = createBeams({
              notes: tupletNoteData,
              stemDown,
            });
            tupletGroup.appendChild(beamPaths);
          }

          // Tuplet bracket and number
          const avgY =
            tupletYPositions.length > 0
              ? tupletYPositions.reduce((a, b) => a + b, 0) / tupletYPositions.length
              : MIDDLE_LINE_Y;
          const stemsDown = avgY <= MIDDLE_LINE_Y;
          // For fully-beamed tuplets the number sits adjacent to the
          // beam stack. Push the bracketY further from the primary beam
          // by the additional thickness contributed by secondary beams
          // (16th = 1 extra level, 32nd = 2). Without this the "6" digit
          // of a 16th sextuplet collides with the lower edge of the
          // double-beam stack (Gould "Behind Bars", Tuplets ch.).
          const maxBeams = fullyBeamed
            ? Math.max(...tupletNoteData.map((n) => n.beams))
            : 1;
          const beamStackExtra = Math.max(0, maxBeams - 1) * (BEAM_THICKNESS + BEAM_GAP);
          const bracketY = stemsDown ? 110 + beamStackExtra : -10 - beamStackExtra;
          const above = !stemsDown;

          // The tuplet number is centered on the bracket/beam span.
          // For a fully-beamed tuplet the visual span is the beam itself,
          // which runs from the first to last *stem-x* (offset from the
          // notehead by HEAD_TIP_X on the flag side; see Beam.js). Using
          // the cursor-after-last-note x biases the number to the side
          // opposite the stem direction. Gould "Behind Bars" (Tuplets ch.)
          // requires horizontal centering on the beam's geometric midpoint.
          let bracketStartX;
          let bracketEndX;
          if (fullyBeamed && tupletNoteData.length >= 2) {
            const firstX = tupletNoteData[0].x;
            const lastX = tupletNoteData[tupletNoteData.length - 1].x;
            const stemOffset = stemsDown ? -HEAD_TIP_X : HEAD_TIP_X;
            bracketStartX = firstX + stemOffset;
            bracketEndX = lastX + stemOffset;
          } else {
            // Bracket case: span the noteheads (first to last), not the
            // cursor position after advancing past the last note.
            bracketStartX = startX;
            bracketEndX =
              tupletNoteData.length > 0
                ? tupletNoteData[tupletNoteData.length - 1].x
                : endX;
          }

          tupletGroup.appendChild(
            renderTupletBracket({
              actual,
              startX: bracketStartX,
              endX: bracketEndX,
              y: bracketY,
              above,
              showBracket: !fullyBeamed,
            })
          );

          staffGroup.appendChild(tupletGroup);

          // Bar line tracking for tuplet
          if (measureLength) {
            const tupletBeats = tupletNotes.reduce((sum, tEl) => {
              if (Array.isArray(tEl)) {
                return (
                  sum + getTupletNoteDuration(tEl[0].length, tEl[0].dotted || false, tupletRatio)
                );
              }
              if (tEl.length) {
                return sum + getTupletNoteDuration(tEl.length, tEl.dotted || false, tupletRatio);
              }
              return sum;
            }, 0);
            cumulativeBeats += tupletBeats;
            while (cumulativeBeats >= measureLength - 0.001) {
              // `barlineGap` is the visible glyph-edge → barline gap
              // (Gould's measurement); the cursor sits at the last
              // note's CENTER, so we add HEAD_TIP_X to step past the
              // notehead's right edge before laying down the visible
              // gap. Symmetric on the post side: HEAD_TIP_X carries us
              // from the barline through to the next note's left edge.
              cursorX += barlineGap + HEAD_TIP_X;
              staffGroup.appendChild(createBarLine(cursorX));
              barlineXs.push(cursorX);
              cursorX += barlineGap + HEAD_TIP_X;
              cumulativeBeats -= measureLength;
            }
            if (Math.abs(cumulativeBeats) < 0.001) {
              cumulativeBeats = 0;
            }
          }

          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'barline') {
          // Repeat-barlines carry dots on their INSIDE — the side facing the
          // music. Gould "Behind Bars" (Repeats) calls for ≥0.5 staff space
          // of clearance between those dots and any adjacent notehead. The
          // dot's visible edge sits REPEAT_BARLINE_DOT_EDGE_OFFSET past the
          // group's transform x; the cursor advance must clear the dot edge
          // *and* leave REPEAT_BARLINE_INNER_PAD beyond it before the next
          // note lands.
          const type = element.barline;
          // A user-input `{ barline: 'final' }` semantically marks the end
          // of the piece; the system-end emit below ALWAYS draws a final
          // barline at systemEndX on the last system (commit 5279a15).
          // Drawing one here too would produce two `.barline-final` groups
          // — one at the natural cursor x (which may sit past the staff
          // right edge after the wider CLEF_ONLY_EXTRA_PAD) and one at
          // systemEndX. Per Gould "Behind Bars", every system terminates
          // with exactly one barline at its right edge; on the final
          // system that closing barline IS the final. Skip the per-voice
          // emit and let the system-end logic place the single final pair
          // at the staff edge.
          if (type === 'final') {
            // eslint-disable-next-line no-continue
            continue;
          }
          const innerAdvance =
            REPEAT_BARLINE_DOT_EDGE_OFFSET + REPEAT_BARLINE_INNER_PAD; // 25.5
          // Pre-pad: a repeat-end (or repeat-both) needs the inner-pad on
          // its left so the closing note of the previous measure clears the
          // dots. BAR_LINE_PADDING (30) is wider than 25.5 so this only
          // matters when the previous element abuts unusually close, but
          // we explicitly take max() to keep the geometry honest.
          //
          // Special case: when this barline is the FIRST music element
          // after the prelude (cursorX still sits at musicStartX), the
          // prelude already opened a note-sized gap (TIME_SIG_PADDING /
          // CLEF_ONLY_EXTRA_PAD include a notehead-half-width term plus
          // ~1 staff space of clearance, sized for a NOTE landing at
          // musicStartX). Stacking another BAR_LINE_PADDING on top would
          // double-pad the prelude→barline gap to ~3.5 staff spaces.
          // Drop the pre-pad so the barline lands at musicStartX itself —
          // its thick stroke's left face then sits ~1 staff space past
          // the prelude's rightmost visible element (Gould "Behind Bars",
          // Repeats: tight-but-clear clearance).
          const atMusicStart = cursorX === musicStartX;
          // Distance from a repeat barline's translate x to the CENTER
          // of the next/prev notehead so the head's left/right edge clears
          // the dot's visible edge by REPEAT_BARLINE_INNER_PAD. The dot
          // edge sits DOT_EDGE_OFFSET (15.5) outside the translate; add a
          // notehead half-width (HEAD_TIP_X) so the EDGE of the head — not
          // its center — measures the clearance. Gould "Behind Bars"
          // (Repeats) wants ≥0.5 staff space between dots and the head.
          const noteCenterAdvance =
            REPEAT_BARLINE_DOT_EDGE_OFFSET + REPEAT_BARLINE_INNER_PAD + HEAD_TIP_X; // 37.3
          // For repeat-end the right side has only the thick stroke
          // (no dots). The thick stroke's outer face sits THICK/2 = 5
          // outside the translate, so the equivalent right-side advance
          // is HEAD_TIP_X + THICK/2 + INNER_PAD ≈ 26.8 → round to 28.
          const thickEdgeAdvance = HEAD_TIP_X + 5 + REPEAT_BARLINE_INNER_PAD; // ~26.8

          // (B) Coincident measure-end + repeat-end: per Gould "Behind
          // Bars" (Repeats) the repeat-end IS the measure barline at
          // that position; never draw both. If the previous element
          // emitted an auto-barline and no note rendered after it,
          // pop that plain barline and reposition the repeat-end at
          // a clearance-respecting x (keeping the measure-boundary x
          // when geometry allows, else nudging right enough to clear
          // the previous notehead's right edge).
          const replaceAutoBarline =
            (type === 'repeat-end' || type === 'repeat-both') &&
            pendingAutoBarline !== null;
          if (replaceAutoBarline) {
            staffGroup.removeChild(pendingAutoBarline.el);
            const idx = barlineXs.lastIndexOf(pendingAutoBarline.x);
            if (idx !== -1) barlineXs.splice(idx, 1);
            const minClearX = lastNoteRightEdge + REPEAT_BARLINE_DOT_EDGE_OFFSET +
              REPEAT_BARLINE_INNER_PAD;
            cursorX = Math.max(pendingAutoBarline.x, minClearX);
            pendingAutoBarline = null;
          } else {
            const prePad = atMusicStart
              ? 0
              : type === 'repeat-end' || type === 'repeat-both'
                ? Math.max(BAR_LINE_PADDING, noteCenterAdvance - HEAD_TIP_X)
                : BAR_LINE_PADDING;
            cursorX += prePad;
          }
          staffGroup.appendChild(renderRepeatBarline({ type, x: cursorX }));
          // Post-advance to next note's CENTER. The right side of the
          // barline has dots (repeat-start / repeat-both) or just the
          // thick stroke (repeat-end). In both cases the next notehead
          // must clear the rightmost visible glyph by INNER_PAD.
          if (type === 'repeat-start' || type === 'repeat-both') {
            cursorX += noteCenterAdvance;
          } else {
            cursorX += thickEdgeAdvance;
          }
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'ending') {
          if (element.ending.type === 'start') {
            // Per Gould "Behind Bars" (Voltas): the bracket's left
            // tick anchors at the first note's LEFT visual edge so
            // the hook visually claims the note. cursorX at the start
            // marker equals the next note's translate-x (center), so
            // subtract a notehead half-width to land on the head's
            // left edge.
            activeEndings.set(element.ending.number, {
              startX: cursorX - HEAD_TIP_X,
              // Per Gould "Behind Bars" (Voltas): the bracket's Y is
              // determined by the topmost visual element in the span
              // (notehead top / stem top / ledger line). Track the
              // smallest (most-negative, highest on the staff) y here;
              // each note rendered while this ending is active will
              // update it (see updateActiveEndingTopY below).
              topY: Infinity,
            });
          } else if (element.ending.type === 'stop') {
            const start = activeEndings.get(element.ending.number);
            if (start) {
              // Per Gould "Behind Bars" (Voltas): the bracket's right
              // tick lands at the closing barline of the ending. The
              // measure-end auto-barline sits at pendingAutoBarline.x;
              // fall back to the last note's right edge + small pad
              // when no barline emitted in this measure.
              const endX = pendingAutoBarline
                ? pendingAutoBarline.x
                : lastNoteRightEdge + REPEAT_BARLINE_INNER_PAD;
              endingData.push({
                number: element.ending.number,
                startX: start.startX,
                endX,
                isClosed: true,
                topY: start.topY,
              });
              activeEndings.delete(element.ending.number);
            }
          }
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'navigation') {
          staffGroup.appendChild(renderNavigationMarker({ type: element.navigation, x: cursorX }));
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'tempo') {
          staffGroup.appendChild(renderTempoMarking({ tempo: element.tempo, x: cursorX }));
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'tempoChange') {
          staffGroup.appendChild(renderTempoChange({ type: element.tempoChange, x: cursorX }));
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'expression') {
          staffGroup.appendChild(renderExpressionText({ text: element.expression, x: cursorX }));
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'rehearsal') {
          staffGroup.appendChild(renderRehearsalMark({ label: element.rehearsal, x: cursorX }));
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // We're past every marker `continue`: the element is a real
        // music event (note/chord/rest). Any auto-barline that just
        // emitted is now "consumed" (no longer immediately followed by
        // a repeat-end barline), so clear the pending-replacement slot.
        pendingAutoBarline = null;

        // Track topmost visible y across every note/chord rendered
        // while a volta ending is active. Gould "Behind Bars" (Voltas)
        // pegs the bracket to ≥1 staff space above the highest element
        // in the ending's span, picking ONE y for the whole bracket.
        if (activeEndings.size > 0) {
          const elementTopY = topExtentOf(element, clef);
          if (Number.isFinite(elementTopY)) {
            for (const data of activeEndings.values()) {
              if (elementTopY < data.topY) data.topY = elementTopY;
            }
          }
        }

        // Associate pending dynamics/hairpins with this note's x position.
        // Per Gould "Behind Bars" (Dynamics): each point dynamic sits below
        // the LOWEST point of its target note (chord/single) with ≥1 staff
        // space of clearance, but never closer to the staff than
        // DYNAMICS_Y_MIN. Compute and pin the y per-instance here so a
        // dynamic under a high note stays at the floor while one under a
        // low note (ledger lines below, or stem-down extending far) drops
        // to clear the music.
        const targetLowestY = lowestExtentOf(element, clef);
        const dynamicY = Math.max(DYNAMICS_Y_MIN, targetLowestY + ONE_SPACE);
        for (const pd of pendingDynamics) {
          if (pd.x === undefined) {
            pd.x = cursorX;
            pd.y = dynamicY;
          }
        }
        for (const hs of hairpinStarts) {
          if (hs.startX === undefined) {
            hs.startX = cursorX;
            hs.startY = dynamicY;
          }
        }
        for (const ch of completedHairpins) {
          if (ch.endX === undefined) {
            ch.endX = cursorX;
            ch.endY = dynamicY;
          }
        }

        if (Array.isArray(element)) {
          const chordNotes = element.filter((n) => n.pitch);
          if (chordNotes.length === 0) {
            beatPosition += 0;
          } else {
            const chordLength = chordNotes[0].length;
            const info = getDurationInfo(chordLength);
            const yPositions = chordNotes.map((n) => pitchToStaffY(n.pitch, clef));

            // Grace notes on chord (from first note that has grace property).
            // Graces render LEFTWARD from the principal at GRACE_SPACING
            // intervals, so push the principal right by the full grace-cluster
            // width PLUS a lead-in pad. The leftmost grace then lands
            // GRACE_LEAD_IN_PAD past the previous element (time sig, barline).
            const chordGrace = chordNotes.find((n) => n.grace);
            if (chordGrace) {
              const graceCount = Array.isArray(chordGrace.grace)
                ? chordGrace.grace.length
                : 1;
              cursorX += graceCount * GRACE_SPACING + GRACE_LEAD_IN_PAD;
              const mainY = Math.min(...yPositions);
              const graceResult = renderGraceNotes({
                grace: chordGrace.grace,
                mainX: cursorX,
                mainY,
                clef,
              });
              staffGroup.appendChild(graceResult.element);
            }

            // Stem direction: note furthest from middle line
            const distances = yPositions.map((y) => Math.abs(y - MIDDLE_LINE_Y));
            const maxDistIdx = distances.indexOf(Math.max(...distances));
            const stemDown = yPositions[maxDistIdx] <= MIDDLE_LINE_Y;

            const chordGroup = createGroup(`chord note ${info.cssClass}`, {
              transform: `translate(${cursorX}, 0)`,
            });

            const currentBeatChord = beatPosition;
            chordGroup.setAttribute('data-beat', String(currentBeatChord));

            // Note heads
            for (const noteY of yPositions) {
              const head = createSmuflGlyph(chordGlyphFor(info), 'note-head');
              head.setAttribute('transform', `translate(0, ${noteY})`);
              chordGroup.appendChild(head);
            }

            // Single shared stem
            if (info.hasStem) {
              const minY = Math.min(...yPositions);
              const maxY = Math.max(...yPositions);
              const stemX = stemDown ? -HEAD_TIP_X : HEAD_TIP_X;
              const stemY1 = stemDown ? minY - HEAD_TIP_Y : maxY + HEAD_TIP_Y;
              const stemY2 = stemDown ? maxY - HEAD_TIP_Y + STEM_LENGTH : minY + HEAD_TIP_Y - STEM_LENGTH;

              chordGroup.appendChild(
                createLine(stemX, stemY1, stemX, stemY2, {
                  class: 'note-stem',
                  stroke: 'currentColor',
                  'stroke-width': 2.4,
                })
              );
            }

            // Articulations on chord (from first note that has the property)
            const chordArticulation = chordNotes.find((n) => n.articulation);
            if (chordArticulation) {
              const artGroup = renderArticulations({
                articulation: chordArticulation.articulation,
                stemDown,
              });
              if (artGroup) {
                const artY = stemDown ? Math.min(...yPositions) : Math.max(...yPositions);
                artGroup.setAttribute('transform', `translate(0, ${artY})`);
                chordGroup.appendChild(artGroup);
              }
            }

            staffGroup.appendChild(chordGroup);

            // Accidentals (on staffGroup with absolute coords). Use the
            // wider beamed-prior offset when this chord is the non-first
            // member of a beam group — same rationale as the single-note
            // path below.
            const chordBeamInfo = beamLookup.get(i);
            const chordPriorBeamedX =
              chordBeamInfo && !chordBeamInfo.isFirst && activeBeamNoteData.length
                ? activeBeamNoteData[activeBeamNoteData.length - 1].x
                : null;
            const chordPriorIsNear =
              chordPriorBeamedX != null &&
              cursorX - chordPriorBeamedX <= ACCIDENTAL_PRIOR_NEAR;
            const chordAccOffset = chordPriorIsNear
              ? ACCIDENTAL_OFFSET_BEAMED_PRIOR
              : ACCIDENTAL_OFFSET;
            const chordKeyInfo = getKeySignature(keySignature);
            for (let j = 0; j < chordNotes.length; j += 1) {
              const { accidental, noteName } = parsePitch(chordNotes[j].pitch);
              const accidentalType = accidentalGlyphForPitch(accidental, noteName, chordKeyInfo);
              if (accidentalType) {
                const accGroup = createAccidental(accidentalType);
                accGroup.setAttribute(
                  'transform',
                  `translate(${cursorX - chordAccOffset}, ${yPositions[j]})`
                );
                staffGroup.appendChild(accGroup);
              }
            }

            // Ledger lines for each note (on staffGroup with absolute coords)
            for (const noteY of yPositions) {
              const ledgerGroup = createLedgerLines({ x: cursorX, y: noteY });
              if (ledgerGroup) {
                staffGroup.appendChild(ledgerGroup);
              }
            }

            // Record positions for ties
            noteXPositions.set(i, cursorX);

            // Store note data for playback
            const chordBeats = fractionToBeats(chordLength) * (chordNotes[0].dotted ? 1.5 : 1);
            this._noteData.push({
              element: chordGroup,
              beat: currentBeatChord,
              duration: chordBeats,
              x: cursorX,
              voiceId: voice.id,
            });

            const chordElementBeats = fractionToBeats(chordLength);
            const chordAdjBeats = chordNotes[0].dotted
              ? chordElementBeats * 1.5
              : chordElementBeats;
            beatPosition += chordAdjBeats;

            // Record the chord's rightmost notehead edge so a
            // coincident repeat-end barline can verify dot clearance.
            lastNoteRightEdge = cursorX + HEAD_TIP_X;

            // Bar line insertion for chords (shared layout: barline x =
            // beatToX(measureEndBeat) + accumulated barlineOffset + padding).
            if (measureLength && chordElementBeats > 0) {
              cumulativeBeats += chordAdjBeats;
              while (cumulativeBeats >= measureLength - 0.001) {
                const isShared = sharedBarlineBeats.has(beatPosition);
                // Per Gould "Behind Bars" (Spacing), Lilypond
                // `Spacing_spanner`, and Dorico, each note's trailing
                // horizontal space is proportional to ITS OWN duration
                // on the rhythmic grid. preGap is keyed by boundary
                // beat to the preceding note's stretched duration. The
                // system-closing barline uses `trailingBarlineGap` (the
                // trailing spring's duration-proportional pre-gap) and
                // has no post-side.
                const isSystemClosing =
                  systemEndBeat !== null &&
                  Math.abs(beatPosition - systemEndBeat) < 1e-6;
                const preGap = isSystemClosing
                  ? trailingBarlineGap
                  : (prePadMap && prePadMap.has(beatPosition)
                      ? prePadMap.get(beatPosition)
                      : barlineGap);
                const postGap = (postPadMap && postPadMap.has(beatPosition))
                  ? postPadMap.get(beatPosition)
                  : barlineGap;
                // HEAD_TIP_X on each side steps over the notehead
                // half-widths so the gap sits between glyph EDGES (per
                // Gould / Lilypond `BarLine.padding`), not centers.
                if (isShared) barlineOffset += preGap + HEAD_TIP_X;
                const barlineX = isShared
                  ? xForBeat(beatPosition)
                  : xForBeat(beatPosition) - BAR_LINE_PADDING;
                emitAutoBarline(barlineX);
                if (isShared && !isSystemClosing) barlineOffset += postGap + HEAD_TIP_X;
                cumulativeBeats -= measureLength;
              }
              if (Math.abs(cumulativeBeats) < 0.001) {
                cumulativeBeats = 0;
              }
            }
            cursorX = xForBeat(beatPosition);
          }
          // eslint-disable-next-line no-continue
          continue;
        }

        const beamInfo = beamLookup.get(i);
        const isBeamed = !!beamInfo;

        // Start new beam group
        if (beamInfo && beamInfo.isFirst) {
          activeBeamGroupEl = createGroup('beam-group');
          activeBeamNoteData = [];
          activeBeamGroupIdx = beamInfo.groupIndex;
        }

        const target = activeBeamGroupEl || staffGroup;
        const beamStemDown = isBeamed ? beamGroupStemDown[beamInfo.groupIndex] : undefined;

        // Record position for tie rendering
        noteXPositions.set(i, cursorX);

        const currentBeat = beatPosition;
        let elementBeats = 0;

        if (element.position !== undefined) {
          // Percussion note (position-based, X notehead)
          const noteY = 100 - element.position * 10;
          const info = getDurationInfo(element.length);

          const noteGroup = createGroup(`note ${info.cssClass}`, {
            transform: `translate(${cursorX}, ${noteY})`,
          });
          noteGroup.setAttribute('data-beat', String(currentBeat));

          // X-shaped notehead — Bravura noteheadXBlack glyph.
          noteGroup.appendChild(createSmuflGlyph(NOTEHEAD_X_BLACK_GLYPH, 'note-head-x'));

          // Stem — anchored at the head's long-axis tip.
          if (info.hasStem) {
            const stemDown = noteY <= MIDDLE_LINE_Y;
            const stemX = stemDown ? -HEAD_TIP_X : HEAD_TIP_X;
            const stemY1 = stemDown ? -HEAD_TIP_Y : HEAD_TIP_Y;
            const stemY2 = stemDown ? -HEAD_TIP_Y + STEM_LENGTH : HEAD_TIP_Y - STEM_LENGTH;

            noteGroup.appendChild(
              createLine(stemX, stemY1, stemX, stemY2, {
                class: 'note-stem',
                stroke: 'currentColor',
                'stroke-width': 2.4,
              })
            );
          }

          target.appendChild(noteGroup);

          this._noteData.push({
            element: noteGroup,
            beat: currentBeat,
            duration: fractionToBeats(element.length) * (element.dotted ? 1.5 : 1),
            x: cursorX,
            voiceId: voice.id,
          });

          elementBeats = fractionToBeats(element.length);
          if (element.dotted) elementBeats *= 1.5;
        } else if (!element.pitch) {
          // Rest (no pitch, has length)
          if (element.length) {
            const restInfo = getDurationInfo(element.length);
            const elemBeats = fractionToBeats(element.length) * (element.dotted ? 1.5 : 1);
            // Center long rests (whole/half) within their full slot;
            // short rests left-align at the beat position.
            const slotEndX = xForBeat(beatPosition + elemBeats);
            const restX = (restInfo.name === 'whole' || restInfo.name === 'half')
              ? (cursorX + slotEndX) / 2
              : cursorX;
            const restGroup = createRest({ length: element.length, x: restX });
            restGroup.setAttribute('data-beat', String(currentBeat));

            // Fermata on rest
            if (element.articulation) {
              const artGroup = renderArticulations({
                articulation: element.articulation,
                stemDown: false,
                isRest: true,
              });
              if (artGroup) {
                artGroup.setAttribute('transform', `translate(${cursorX}, ${MIDDLE_LINE_Y})`);
                staffGroup.appendChild(artGroup);
              }
            }

            target.appendChild(restGroup);
            elementBeats = elemBeats;
          }
        } else {
          const noteY = pitchToStaffY(element.pitch, clef);

          // Grace notes (render before the main note). Graces render
          // LEFTWARD from the principal at GRACE_SPACING intervals, so push
          // the principal right by the full grace-cluster width PLUS a
          // lead-in pad. The leftmost grace lands GRACE_LEAD_IN_PAD past
          // the previous element (time sig, barline, etc.).
          if (element.grace) {
            const graceCount = Array.isArray(element.grace)
              ? element.grace.length
              : 1;
            cursorX += graceCount * GRACE_SPACING + GRACE_LEAD_IN_PAD;
            const graceResult = renderGraceNotes({
              grace: element.grace,
              mainX: cursorX,
              mainY: noteY,
              clef,
            });
            target.appendChild(graceResult.element);
          }

          // Accidental (render before note, to the left). When this note
          // is the non-first member of a beam group, the prior element is
          // a beamed sibling — no clef/barline/rest buffer between the
          // two heads — so the visible gap reads tightest. Bump the
          // offset there to keep ~1.5 staff spaces of breathing room.
          const { accidental, noteName } = parsePitch(element.pitch);
          const accidentalType = accidentalGlyphForPitch(
            accidental,
            noteName,
            getKeySignature(keySignature)
          );
          if (accidentalType) {
            // The beamed-prior shrink trades the accidental's own-head
            // clearance for breathing room from the prior beamed head —
            // but that trade only pays off when the prior head is
            // actually CLOSE. When justification has stretched the beam
            // wide (e.g. the accidentals-sweep preset's ~9-sp eighths),
            // the prior head is far, the shrink buys nothing, and it only
            // robs the accidental of its own-head clearance — pulling the
            // sharp's right edge into a ledgered note's ledger-line left
            // overhang (Bravura legerLineExtension = 0.4 sp), below
            // Gould's ~1/4-sp minimum. Apply the shrink only when the
            // prior beamed sibling is within reach (ACCIDENTAL_PRIOR_NEAR);
            // otherwise use the full offset.
            const priorBeamedX =
              isBeamed && !beamInfo.isFirst && activeBeamNoteData.length
                ? activeBeamNoteData[activeBeamNoteData.length - 1].x
                : null;
            const priorIsNear =
              priorBeamedX != null &&
              cursorX - priorBeamedX <= ACCIDENTAL_PRIOR_NEAR;
            const accOffset = priorIsNear
              ? ACCIDENTAL_OFFSET_BEAMED_PRIOR
              : ACCIDENTAL_OFFSET;
            const accGroup = createAccidental(accidentalType);
            accGroup.setAttribute(
              'transform',
              `translate(${cursorX - accOffset}, ${noteY})`
            );
            target.appendChild(accGroup);
          }

          const noteGroup = createNote({
            pitch: element.pitch,
            length: element.length,
            x: cursorX,
            clef,
            beamed: isBeamed,
            stemDown: beamStemDown,
          });
          noteGroup.setAttribute('data-beat', String(currentBeat));

          // Articulations on note
          if (element.articulation) {
            const noteStemDown = beamStemDown !== undefined ? beamStemDown : noteY <= MIDDLE_LINE_Y;
            const artGroup = renderArticulations({
              articulation: element.articulation,
              stemDown: noteStemDown,
            });
            if (artGroup) noteGroup.appendChild(artGroup);
          }

          target.appendChild(noteGroup);

          // Store note data for playback position
          this._noteData.push({
            element: noteGroup,
            beat: currentBeat,
            duration: fractionToBeats(element.length) * (element.dotted ? 1.5 : 1),
            x: cursorX,
            voiceId: voice.id,
          });

          // Track position for beam rendering
          if (isBeamed) {
            const info = getDurationInfo(element.length);
            activeBeamNoteData.push({
              x: cursorX,
              y: noteY,
              beams: info.beams,
              noteGroup,
            });
          }

          // Ledger lines for notes outside the staff
          const ledgerGroup = createLedgerLines({ x: cursorX, y: noteY });
          if (ledgerGroup) {
            target.appendChild(ledgerGroup);
          }

          // Lyric tracking
          if (element.lyric !== undefined) {
            lyricData.push({ text: element.lyric, x: cursorX, noteIndex: i });
          }

          elementBeats = fractionToBeats(element.length);
          if (element.dotted) elementBeats *= 1.5;
        }

        beatPosition += elementBeats;

        // Close beam group
        if (beamInfo && beamInfo.isLast && activeBeamGroupEl) {
          const beamStemDownClose = beamGroupStemDown[activeBeamGroupIdx];
          // Compute slope-capped beam line and update each note's stem
          // y2 to land on it. Uses the same line createBeams will draw.
          if (activeBeamNoteData.length >= 2) {
            const line = computeBeamLine(activeBeamNoteData, beamStemDownClose);
            for (const noteData of activeBeamNoteData) {
              if (!noteData.noteGroup) continue;
              const stem = noteData.noteGroup.querySelector('.note-stem');
              if (!stem) continue;
              const stemAbsX = beamStemDownClose
                ? noteData.x - HEAD_TIP_X
                : noteData.x + HEAD_TIP_X;
              const targetAbsY = beamLineYAt(line, stemAbsX);
              // Note group has translate(x, noteY), so local y2 = absY - noteY.
              stem.setAttribute('y2', targetAbsY - noteData.y);
            }
          }
          const beamPaths = createBeams({
            notes: activeBeamNoteData,
            stemDown: beamStemDownClose,
          });
          activeBeamGroupEl.appendChild(beamPaths);
          staffGroup.appendChild(activeBeamGroupEl);
          activeBeamGroupEl = null;
          activeBeamNoteData = [];
          activeBeamGroupIdx = -1;
        }

        // Record the just-rendered note's rightmost edge so a coincident
        // repeat-end barline can verify dot clearance (see pendingAutoBarline).
        if (elementBeats > 0) {
          lastNoteRightEdge = cursorX + HEAD_TIP_X;
        }

        // Bar line insertion (shared layout). See chord-path branch
        // above for the duration-proportional preGap / postGap rule.
        if (measureLength && elementBeats > 0) {
          cumulativeBeats += elementBeats;
          while (cumulativeBeats >= measureLength - 0.001) {
            const isShared = sharedBarlineBeats.has(beatPosition);
            const isSystemClosing =
              systemEndBeat !== null &&
              Math.abs(beatPosition - systemEndBeat) < 1e-6;
            const preGap = isSystemClosing
              ? trailingBarlineGap
              : (prePadMap && prePadMap.has(beatPosition)
                  ? prePadMap.get(beatPosition)
                  : barlineGap);
            const postGap = (postPadMap && postPadMap.has(beatPosition))
              ? postPadMap.get(beatPosition)
              : barlineGap;
            if (isShared) barlineOffset += preGap + HEAD_TIP_X;
            const barlineX = isShared
              ? xForBeat(beatPosition)
              : xForBeat(beatPosition) - BAR_LINE_PADDING;
            emitAutoBarline(barlineX);
            if (isShared && !isSystemClosing) barlineOffset += postGap + HEAD_TIP_X;
            cumulativeBeats -= measureLength;
          }
          if (Math.abs(cumulativeBeats) < 0.001) {
            cumulativeBeats = 0;
          }
        }
        // Advance cursor to next beat's shared X (with current barline offset).
        cursorX = xForBeat(beatPosition);
      }

      // Tie rendering pass (after all notes so ties draw on top)
      const tiePairs = resolveTies(voice.notes);
      if (tiePairs.length > 0) {
        const tiesGroup = createGroup('ties');
        for (const pair of tiePairs) {
          const startX = noteXPositions.get(pair.startIndex);
          const endX = noteXPositions.get(pair.endIndex);
          if (startX === undefined || endX === undefined) continue;

          const noteY = pitchToStaffY(pair.pitch, clef);
          const beamInfoStart = beamLookup.get(pair.startIndex);
          const stemDown = beamInfoStart
            ? beamGroupStemDown[beamInfoStart.groupIndex]
            : noteY <= MIDDLE_LINE_Y;
          const direction = stemDown ? 'above' : 'below';

          tiesGroup.appendChild(
            createTieArc({
              x1: startX,
              y1: noteY,
              x2: endX,
              y2: noteY,
              direction,
            })
          );
        }
        staffGroup.appendChild(tiesGroup);
      }

      // Slur rendering pass
      const slurPairs = resolveSlurs(voice.notes);
      if (slurPairs.length > 0) {
        const slursGroup = createGroup('slurs');
        for (const slurPair of slurPairs) {
          const startX = noteXPositions.get(slurPair.startIndex);
          const endX = noteXPositions.get(slurPair.stopIndex);
          if (startX === undefined || endX === undefined) continue;

          // Determine Y positions
          const startEl = voice.notes[slurPair.startIndex];
          const endEl = voice.notes[slurPair.stopIndex];
          const startPitch = Array.isArray(startEl) ? startEl[0].pitch : startEl.pitch;
          const endPitch = Array.isArray(endEl) ? endEl[0].pitch : endEl.pitch;
          const startNoteY = startPitch ? pitchToStaffY(startPitch, clef) : MIDDLE_LINE_Y;
          const endNoteY = endPitch ? pitchToStaffY(endPitch, clef) : MIDDLE_LINE_Y;

          // Determine direction based on stem directions of spanned notes
          let stemsDown = 0;
          let stemsUp = 0;
          for (let si = slurPair.startIndex; si <= slurPair.stopIndex; si += 1) {
            const el = voice.notes[si];
            if (!el || getMarkerType(el)) continue;
            const y = Array.isArray(el)
              ? pitchToStaffY(el[0].pitch, clef)
              : el.pitch
              ? pitchToStaffY(el.pitch, clef)
              : MIDDLE_LINE_Y;
            if (y <= MIDDLE_LINE_Y) stemsDown += 1;
            else stemsUp += 1;
          }
          // Slur curves away from stems (opposite side)
          const direction = stemsDown >= stemsUp ? 'above' : 'below';

          slursGroup.appendChild(
            createSlurArc({
              x1: startX,
              y1: startNoteY,
              x2: endX,
              y2: endNoteY,
              direction,
              depth: slurPair.depth,
            })
          );
        }
        staffGroup.appendChild(slursGroup);
      }

      // Dynamics rendering pass.
      // Per Gould "Behind Bars" (Hairpins): the wedge's vertical center
      // aligns with the dynamic letter's visual centerline (so dynamics
      // and hairpins read as a single horizontal line of music-direction
      // marks), and the wedge tip clears the adjacent dynamic letter by
      // ≥0.5 staff space.
      if (pendingDynamics.length > 0 || completedHairpins.length > 0) {
        const dynamicsGroup = createGroup('dynamics-layer');
        const HAIRPIN_DYNAMIC_GAP = 10; // ≥0.5 staff space @ LINE_SPACING=20.

        for (const pd of pendingDynamics) {
          if (pd.x !== undefined) {
            const pdY = pd.y !== undefined ? pd.y : DYNAMICS_Y_MIN;
            dynamicsGroup.appendChild(
              renderDynamic({ dynamic: pd.dynamic, x: pd.x, y: pdY })
            );
          }
        }

        for (const hp of completedHairpins) {
          let startX = hp.startX !== undefined ? hp.startX : hp.endX;
          let endX = hp.endX !== undefined ? hp.endX : hp.startX;
          if (startX !== undefined && endX !== undefined) {
            // If the closing tip lands on the x of a pending dynamic on the
            // same beat, pull it back past the letter's left visual edge
            // with a 0.5-space gap. (Likewise for the opening side if it
            // collides with a preceding dynamic on the same beat.)
            for (const pd of pendingDynamics) {
              if (pd.x === undefined) continue;
              if (Math.abs(pd.x - endX) < 0.5) {
                const leftOffset = dynamicLeftVisualOffset(pd.dynamic);
                endX = pd.x + leftOffset - HAIRPIN_DYNAMIC_GAP;
              }
              if (Math.abs(pd.x - startX) < 0.5) {
                // Approximate right visual edge ≈ -leftOffset (letters are
                // ~symmetric about anchor; advance is xMax*scale on right,
                // descender extends xMin*scale on left).
                const rightOffset = -dynamicLeftVisualOffset(pd.dynamic);
                startX = pd.x + rightOffset + HAIRPIN_DYNAMIC_GAP;
              }
            }
            // Anchor wedge center to the dynamic letter's visual center.
            // Use the closing dynamic if present; else the opening one;
            // else fall back to the average letter center offset (~-5px).
            let centerYOffset = -5;
            for (const pd of pendingDynamics) {
              if (pd.x === undefined) continue;
              if (
                Math.abs(pd.x - (hp.endX !== undefined ? hp.endX : hp.startX)) <
                0.5
              ) {
                centerYOffset = dynamicCenterYOffset(pd.dynamic);
                break;
              }
            }
            // Hairpin baseline: dynamics now have per-instance y (a low
            // target note pushes its dynamic further below the staff). The
            // hairpin endpoints share a single baseline; pick the LOWER of
            // start/end dynamic y so neither end rises above its target
            // letter. If neither end has a same-x dynamic, fall back to
            // the start-binding y, the end-binding y, then DYNAMICS_Y_MIN.
            let baseY = DYNAMICS_Y_MIN;
            const candidates = [];
            for (const pd of pendingDynamics) {
              if (pd.x === undefined || pd.y === undefined) continue;
              if (Math.abs(pd.x - startX) < 0.5) candidates.push(pd.y);
              if (Math.abs(pd.x - endX) < 0.5) candidates.push(pd.y);
            }
            if (candidates.length > 0) {
              baseY = Math.max(...candidates);
            } else if (hp.startY !== undefined || hp.endY !== undefined) {
              baseY = Math.max(
                hp.startY !== undefined ? hp.startY : DYNAMICS_Y_MIN,
                hp.endY !== undefined ? hp.endY : DYNAMICS_Y_MIN
              );
            }
            dynamicsGroup.appendChild(
              renderHairpin({
                type: hp.type,
                startX,
                endX,
                y: baseY + centerYOffset,
              })
            );
          }
        }

        staffGroup.appendChild(dynamicsGroup);
      }

      // Ending (volta bracket) rendering pass
      // Close any open endings (last ending in group has no stop marker)
      for (const [number, data] of activeEndings) {
        // Open ending (no explicit stop): close at the last note's right
        // edge plus a small pad so the open bracket extends just past
        // the final notehead — not all the way to a (non-existent)
        // barline 30+ px further right.
        const openEndX =
          lastNoteRightEdge > -Infinity
            ? lastNoteRightEdge + REPEAT_BARLINE_INNER_PAD
            : cursorX;
        endingData.push({
          number,
          startX: data.startX,
          endX: openEndX,
          isClosed: false,
          topY: data.topY,
        });
      }
      if (endingData.length > 0) {
        const endingsGroup = createGroup('endings-layer');
        // Per Gould "Behind Bars" (Voltas): bracket clears the topmost
        // visual element in its span by ≥1 staff space. With
        // LINE_SPACING=20 the staff space is 20px → require that gap
        // between the bracket's horizontal line and the highest
        // notehead-top / stem-top within the ending.
        const VOLTA_CLEARANCE = 20;
        for (const ed of endingData) {
          const computedBracketY = Number.isFinite(ed.topY)
            ? ed.topY - VOLTA_CLEARANCE
            : undefined;
          endingsGroup.appendChild(
            renderEnding({
              number: ed.number,
              startX: ed.startX,
              endX: ed.endX,
              open: !ed.isClosed,
              bracketY: computedBracketY,
            })
          );
        }
        staffGroup.appendChild(endingsGroup);
      }

      // Lyrics rendering pass
      if (lyricData.length > 0) {
        const lyricsGroup = createGroup('lyrics-layer');

        for (let li = 0; li < lyricData.length; li += 1) {
          const ld = lyricData[li];
          lyricsGroup.appendChild(renderLyric({ text: ld.text, x: ld.x }));

          // Detect melisma: if this lyric's note is followed by notes without lyrics
          // before the next note with a lyric (or end of piece)
          const nextLyricData = lyricData[li + 1];
          const nextLyricNoteIndex = nextLyricData ? nextLyricData.noteIndex : voice.notes.length;

          // Check if there are notes without lyrics between this note and the next lyric
          let melismaEndX = null;
          for (let mi = ld.noteIndex + 1; mi < nextLyricNoteIndex; mi += 1) {
            const mel = voice.notes[mi];
            if (mel && mel.pitch && mel.lyric === undefined) {
              const mx = noteXPositions.get(mi);
              if (mx !== undefined) melismaEndX = mx;
            }
          }

          if (melismaEndX !== null) {
            lyricsGroup.appendChild(renderMelisma({ startX: ld.x + 10, endX: melismaEndX }));
          }
        }

        staffGroup.appendChild(lyricsGroup);
      }

      // Content bbox tracking: scan the (shifted) voice for min/max pitch
      // Y, plus stem/flag headroom. Bracket positions are folded in below.
      for (const el of voice.notes) {
        const pitches = Array.isArray(el)
          ? el.filter((n) => n && n.pitch).map((n) => n.pitch)
          : (el && el.pitch ? [el.pitch] : []);
        for (const p of pitches) {
          const y = pitchToStaffY(p, clef);
          // Account for stems/flags reaching STEM_LENGTH past the head.
          const above = voiceYPositions[index] + STAFF_TOP_OFFSET + y - STEM_LENGTH - 10;
          const below = voiceYPositions[index] + STAFF_TOP_OFFSET + y + STEM_LENGTH + 10;
          if (above < contentMinY) contentMinY = above;
          if (below > contentMaxY) contentMaxY = below;
        }
      }

      // Ottava brackets for this voice. Per Gould "Behind Bars" (Ottava,
      // p. 75), the bracket sits clear of the highest content within the
      // segment (or lowest, for 8vb), not at a fixed offset from the staff
      // — otherwise high-shifted noteheads (e.g. D7→D6 with two ledger
      // lines) cross through the dashed line. We compute the segment's
      // content extent from the *shifted* pitches and place the bracket
      // ~1 staff space clear, falling back to the previous fixed minimum
      // (~3 spaces from the staff) when the shifted content stays inside
      // the staff.
      // The caller of createOttavaBracket passes `y` as the LINE
      // position, and the component anchors the glyph by direction:
      // 8va puts the line at the top of the "8" (glyph hangs DOWN
      // from the line ~37 px); 8vb puts the line at the bottom of
      // the "8" (glyph rises UP from the line ~37 px). The
      // notehead-clearance math therefore has to add the glyph's
      // overhang on the staff-facing side to the desired visual gap.
      // OTTAVA_GLYPH_OVERHANG ≈ (yMax - yMin) * SMUFL_SCALE for the
      // shared "8va"/"8vb" bbox (473 fu * 0.08 ≈ 37.84 px) — the
      // distance from the line position to the far edge of the digit.
      const VISUAL_GAP = 20; // one staff space between digit edge and notehead
      const OTTAVA_GLYPH_OVERHANG = 38;
      const VA_CLEARANCE = VISUAL_GAP + OTTAVA_GLYPH_OVERHANG; // line above notehead
      const VB_CLEARANCE = VISUAL_GAP + OTTAVA_GLYPH_OVERHANG; // line below notehead
      // Defaults position the LINE (caller's y) so the glyph hangs
      // clear of the staff. With the glyph extending ~38 px toward
      // the staff from the line, the line needs to sit ~38 px
      // farther from the staff than the previous baseline-anchored
      // defaults (which were -50 / +60).
      const DEFAULT_VA_Y = STAFF_TOP_OFFSET - 50 - OTTAVA_GLYPH_OVERHANG;
      const DEFAULT_VB_Y = STAFF_TOP_OFFSET + STAFF_HEIGHT + 60 + OTTAVA_GLYPH_OVERHANG;
      const ottavaSegs = ottavaSegmentsPerVoice[index] || [];
      if (ottavaSegs.length > 0) {
        for (const seg of ottavaSegs) {
          const startX = noteXPositions.get(seg.startIndex);
          const endX = noteXPositions.get(seg.endIndex);
          if (startX === undefined || endX === undefined) continue;
          // Walk the segment's (already shifted) notes and capture the
          // top/bottom pitched-Y. Chords contribute every member.
          let segMinY = Infinity;
          let segMaxY = -Infinity;
          for (let i = seg.startIndex; i <= seg.endIndex; i += 1) {
            const el = voice.notes[i];
            if (!el) continue;
            const pitches = Array.isArray(el)
              ? el.filter((n) => n && n.pitch).map((n) => n.pitch)
              : (el && el.pitch ? [el.pitch] : []);
            for (const p of pitches) {
              const py = pitchToStaffY(p, clef);
              if (py < segMinY) segMinY = py;
              if (py > segMaxY) segMaxY = py;
            }
          }
          const bracketY = seg.kind === '8va'
            ? Math.min(segMinY - VA_CLEARANCE, DEFAULT_VA_Y)
            : Math.max(segMaxY + VB_CLEARANCE, DEFAULT_VB_Y);
          staffGroup.appendChild(
            createOttavaBracket({ kind: seg.kind, startX, endX, y: bracketY })
          );
          // Fold bracket footprint into the content bbox. The line sits
          // at bracketAbs; the glyph hangs ~38px toward the staff (down
          // for 8va, up for 8vb), and the hook on the far end of the
          // line extends ~6px away from the staff.
          const bracketAbs = voiceYPositions[index] + bracketY;
          if (seg.kind === '8va') {
            if (bracketAbs - 6 < contentMinY) contentMinY = bracketAbs - 6;
            if (bracketAbs + 38 > contentMaxY) contentMaxY = bracketAbs + 38;
          } else {
            if (bracketAbs - 38 < contentMinY) contentMinY = bracketAbs - 38;
            if (bracketAbs + 6 > contentMaxY) contentMaxY = bracketAbs + 6;
          }
        }
      }

      // System-end barline: final (thin+thick) on the last system, plain
      // thin elsewhere. The natural voice loop already emits a thin bar-
      // line at each completed measure boundary, so intermediate systems
      // already have their right-edge thin line. For the last system, we
      // emit a `final` barline at systemEndX to mark the piece end. Per
      // Gould "Behind Bars", every system terminates with a barline at
      // its right edge; the final system's is thin-thick.
      //
      // For voices that belong to a brace/bracket group, the per-staff
      // final barline is replaced by a single BRIDGED final barline drawn
      // in the brace-group loop below (so the thick+thin pair runs
      // continuously through the gap between staves — matching the
      // bridged interior barlines). Without this skip, the per-staff
      // pair would still be drawn, leaving a visible gap between staves.
      const voiceInBraceGroup = braceGroups.some((g) =>
        g.voiceIds.includes(voice.id)
      );
      if (isLastSystem && systemEndX !== undefined && !voiceInBraceGroup) {
        staffGroup.appendChild(
          renderRepeatBarline({ type: 'final', x: systemEndX })
        );
      }

      this._svg.appendChild(staffGroup);
    });

    // Render brace and shared barlines for staff groups
    for (const group of braceGroups) {
      const voiceIndices = group.voiceIds
        .map((vid) => voices.findIndex((v) => v.id === vid))
        .filter((i) => i >= 0);
      if (voiceIndices.length < 2) continue;

      const firstIdx = Math.min(...voiceIndices);
      const lastIdx = Math.max(...voiceIndices);
      const topY = voiceYPositions[firstIdx] + STAFF_TOP_OFFSET;
      const bottomY = voiceYPositions[lastIdx] + STAFF_TOP_OFFSET + STAFF_HEIGHT;

      // Group symbol at the left edge: curly brace (single instrument
      // grand staff) or square bracket (ensemble grouping).
      const groupHeight = bottomY - topY;
      let groupEl;
      if (group.type === 'bracket') {
        // Engraver's "contain" layout: trunk sits OUTSIDE the staff with
        // equal 4 px padding on all sides — vertical padding above/below
        // the staff edges, horizontal padding between trunk's right edge
        // and the staff lines' left edge. Hook curls reach RIGHTWARD
        // INTO the staff area to grasp it.
        // Local footprint: trunk x=[0,10], hook tips at x≈37.5. With
        // translate x=-14, the trunk's right edge lands at x=-4 (4 px
        // before staff lines at x=0); hook tips reach x≈23.5 — overlapping.
        const PAD = 4;
        const bracketTopY = topY - PAD;
        const bracketBottomY = bottomY + PAD;
        const bracketHeight = bracketBottomY - bracketTopY;
        groupEl = createBracket({ height: bracketHeight });
        groupEl.setAttribute('transform', `translate(-14, ${bracketTopY})`);
      } else {
        groupEl = createBrace({ height: groupHeight });
        // Brace sits OUTSIDE the staff. Brace local x range is
        // [0, ~braceWidth] (where braceWidth scales sub-linearly with
        // height); position so the brace's right edge lands at
        // x = -BRACE_TO_BARLINE_GAP. The gap accounts for the
        // system-start barline's half-thickness (1.6 px at the current
        // Bravura-spec stroke) plus visible breathing room.
        const braceWidth = getBraceWidth(groupHeight);
        groupEl.setAttribute('transform', `translate(${-BRACE_TO_BARLINE_GAP - braceWidth}, ${topY})`);
      }
      this._svg.appendChild(groupEl);

      // System-start (initial) shared barline: a single tall line at x=0
      // tying all staves of the group together. Uses the staff-aligned
      // top/bottom (NOT bracket-padded) so it matches the staff lines.
      this._svg.appendChild(createSharedBarLine({ x: 0, topY, bottomY }));

      // Shared barlines: collect X positions common across grouped voices
      const allBarlineXSets = voiceIndices.map((vi) => {
        const vid = voices[vi].id;
        return voiceBarlineXPositions.get(vid) || [];
      });
      // Use the first voice's barline positions (voices in a group share time sig)
      const sharedXPositions = allBarlineXSets[0] || [];
      for (const x of sharedXPositions) {
        this._svg.appendChild(createSharedBarLine({ x, topY, bottomY }));
      }

      // Bridged final barline on the last system: a single thin+thick pair
      // at systemEndX whose vertical extent spans from the upper staff's
      // top line to the lower staff's bottom line. Replaces the per-staff
      // pair that was suppressed above. Matches Gould "Behind Bars": on
      // a braced/bracketed system, ALL barlines (including the closing
      // final pair) are drawn through the gap between staves.
      if (isLastSystem && systemEndX !== undefined) {
        this._svg.appendChild(
          renderRepeatBarline({ type: 'final', x: systemEndX, topY, bottomY })
        );
      }
    }

    systemContext.contentMinY = contentMinY;
    systemContext.contentMaxY = contentMaxY;
  }

  /**
   * Set the playback position, highlighting the current note.
   * @param {number|null} beat - Current beat position (null to clear)
   * @param {Object} [options]
   * @param {string} [options.voiceId] - Voice ID to highlight (all if omitted)
   */
  setPlaybackPosition(beat, options = {}) {
    if (!this._svg) return;

    // Remove existing highlights and cursor
    this._svg.querySelectorAll('.note-active').forEach((el) => {
      el.classList.remove('note-active');
    });
    const existingCursor = this._svg.querySelector('.playback-cursor');
    if (existingCursor) existingCursor.remove();

    if (beat === null || beat === undefined) return;

    const candidates = options.voiceId
      ? this._noteData.filter((d) => d.voiceId === options.voiceId)
      : this._noteData;

    // Find the note whose beat range contains the given beat
    for (let i = candidates.length - 1; i >= 0; i--) {
      const d = candidates[i];
      if (beat >= d.beat && beat < d.beat + d.duration) {
        d.element.classList.add('note-active');

        // Add cursor line
        const staff = d.element.closest('.staff') || this._svg;
        staff.appendChild(
          createLine(d.x, 10, d.x, 90, {
            class: 'playback-cursor',
            stroke: 'currentColor',
            'stroke-width': 1,
          })
        );
        break;
      }
    }
  }

  /**
   * Remove just the SVG from the DOM and reset per-render caches.
   * Does NOT detach the ResizeObserver or null out _song — used as
   * the inner pre-render reset from both render() and _flush().
   * @private
   */
  _removeSvg() {
    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }
    this._svg = null;
    this._noteData = [];
    this._intrinsicWidths = null;
  }

  /**
   * Remove the SVG, detach any ResizeObserver, and reset state.
   */
  clear() {
    this.unobserve();
    this._removeSvg();
    this._song = null;
    this._naturalWidth = null;
    if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
    this._pending = false;
  }

  /**
   * Get the current SVG element.
   * @returns {SVGElement|null}
   */
  getSvgElement() {
    return this._svg;
  }

  /**
   * Update the song and schedule a re-render on the next animation frame.
   * Coalesces with any other setSong/setWidth/setScale call in the same tick.
   * @param {Array|Object} songData
   */
  setSong(songData) {
    this._song = songData;
    this._scheduleRender();
  }

  /**
   * Update the SVG width and schedule a batched re-render.
   * @param {number} width
   */
  setWidth(width) {
    this._width = width;
    this._scheduleRender();
  }

  /**
   * Update the scale and schedule a batched re-render.
   * @param {number} scale
   */
  setScale(scale) {
    this._scale = scale;
    this._scheduleRender();
  }

  /**
   * Attach a ResizeObserver to the container. The callback maps
   * container.clientWidth onto the renderer's width or scale according
   * to responsiveMode, then routes through setWidth/setScale which
   * batches via rAF. Safe to call repeatedly — a second call is a no-op.
   */
  observe() {
    if (this._resizeObserver || !this._container) return;
    if (typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(() => {
      if (!this._container) return;
      const cw = this._container.clientWidth;
      if (!cw) return;
      if (this._responsiveMode === 'zoom-to-fit') {
        const ref = this._naturalWidth || this._width;
        if (!ref) return;
        this.setScale(cw / ref);
      } else {
        // 'reflow' (default). Fill the container: the layout width must
        // account for the FULL display scale (user scale × professional
        // base) so svg width == cw. Using cw / scale alone (the old bug)
        // dropped PROFESSIONAL_BASE_SCALE and under-filled to ~1/3.
        this.setWidth(this._layoutWidthFor(cw));
      }
    });
    this._resizeObserver.observe(this._container);
  }

  /**
   * Detach the ResizeObserver, if any.
   */
  unobserve() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  /**
   * Schedule a re-render on the next animation frame, coalescing
   * multiple state changes in the same tick into one render. No-op
   * if there is no song yet (initial render(song) is still required).
   * @private
   */
  _scheduleRender() {
    if (!this._song) return;
    this._pending = true;
    if (this._rafId != null) return;
    if (typeof requestAnimationFrame !== 'function') {
      // Fallback: flush synchronously.
      this._flush();
      return;
    }
    this._rafId = requestAnimationFrame(() => this._flush());
  }

  /**
   * Run the render pipeline using the current state. Called by
   * rAF from _scheduleRender. Idempotent and safe to call manually
   * (tests can drive this directly to avoid timer plumbing).
   * @private
   */
  _flush() {
    this._rafId = null;
    this._pending = false;
    if (!this._song) return;
    this.render(this._song);
  }
}
