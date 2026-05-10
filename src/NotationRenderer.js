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
import { inferClef } from './lib/clefInference.js';
import { getDurationInfo, fractionToBeats } from './lib/durationSymbols.js';
import { pitchToStaffY, parsePitch } from './lib/notePositions.js';
import { createStaffLines } from './components/Staff.js';
import { createNote } from './components/Note.js';
import { createClef } from './components/Clef.js';
import { createRest } from './components/Rest.js';
import { createLedgerLines } from './components/LedgerLine.js';
import { createAccidental } from './components/Accidental.js';
import { createKeySignature } from './components/KeySignature.js';
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
import { renderDynamic } from './components/Dynamic.js';
import { renderHairpin } from './components/Hairpin.js';
import { renderArticulations } from './components/Articulation.js';
import { resolveSlurs } from './lib/slurGrouping.js';
import { createSlurArc } from './components/Slur.js';
import { getTupletNoteDuration } from './lib/tuplets.js';
import { renderTupletBracket } from './components/TupletBracket.js';
import { renderGraceNotes, GRACE_LEAD_IN_PAD, GRACE_SPACING } from './components/GraceNote.js';
import { renderRepeatBarline } from './components/RepeatBarline.js';
import { renderEnding } from './components/Ending.js';
import { renderNavigationMarker } from './components/NavigationMarker.js';
import { renderTempoMarking, renderTempoChange } from './components/TempoMarking.js';
import { renderExpressionText } from './components/ExpressionText.js';
import { renderRehearsalMark } from './components/RehearsalMark.js';
import { renderLyric, renderMelisma } from './components/Lyric.js';
import { createBrace, getBraceWidth } from './components/Brace.js';
import { createBracket } from './components/Bracket.js';
import { createSharedBarLine } from './components/SharedBarLine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 200;
const STAFF_START_X = 20;
const STAFF_TOP_OFFSET = 10;
// Bravura clefs render at ~54px (gClef) to ~56px (cClef). 90 leaves
// ~1.5 staff spaces between clef glyph and first note.
const CLEF_WIDTH = 90;
const VOICE_HEIGHT = 200;
const VOICE_GAP = 40;
const GRAND_STAFF_GAP = 60;
const STAFF_HEIGHT = 80; // 5 lines, 20px apart
// Vertical gap between stacked staff systems when long pieces wrap onto
// multiple systems. Per Gould "Behind Bars" (Systems chapter), a
// system break must read as MORE separation than between voices within
// a system — otherwise consecutive systems blur into one tightly-spaced
// stack. The within-system voice gap (with VOICE_HEIGHT=200,
// VOICE_GAP=40) is 160 px from staff bottom to next-staff top; a
// 320 px system gap doubles that, giving an unambiguous "new system"
// read at standard widths.
const SYSTEM_GAP = 320;
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
// Per-accidental cursor advance for the key signature. Matches
// ACCIDENTAL_SPACING in KeySignature.js plus a little trailing room
// before the time-signature.
const KEY_SIG_ACCIDENTAL_WIDTH = 14;
// Trailing padding (px) after the time-sig glyph before the first note —
// ~1 staff space of clearance so the digits don't crowd the music.
const TIME_SIG_PADDING = 25;
// Padding (px) before and after each barline. ~1 staff space gives the
// barline room to read as a measure boundary instead of crowding the
// last/first notes of adjacent measures.
const BAR_LINE_PADDING = 12;
// Padding (px) between the rightmost note/element and the final barline at
// the end of the system. Per Gould "Behind Bars" (Barlines / Systems), the
// staff terminates at a barline rather than trailing off into empty space;
// ~1 staff space of breathing room past the last head reads as a measure
// boundary without crowding it. Mirrors BAR_LINE_PADDING for visual symmetry
// with internal barlines.
const FINAL_BARLINE_PADDING = 12;
const MIDDLE_LINE_Y = 50;
// SMuFL Bravura black notehead stem-up tip (in local pixel coords). All
// chord rendering paths use the black-notehead tip; quarter/8th/16th heads
// share this geometry. Half/whole chord rendering uses the same tip vertex
// (Bravura noteheadHalf has identical max-x at fu (295,42)).
const BLACK_TIP = smuflTip(NOTEHEAD_BLACK_GLYPH);
const HEAD_TIP_X = BLACK_TIP.x;
const HEAD_TIP_Y = BLACK_TIP.y;
const STEM_LENGTH = 70;
const DYNAMICS_Y = 110;
const STAFF_CENTER_Y = STAFF_TOP_OFFSET + 40; // midpoint of 5-line staff

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

export class NotationRenderer {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.container] - DOM element to append SVG to
   * @param {number} [options.width] - SVG width
   * @param {number} [options.height] - SVG height
   * @param {number} [options.scale] - Scaling factor
   */
  constructor({ container, width, height, scale } = {}) {
    this._container = container || null;
    this._width = width || DEFAULT_WIDTH;
    this._height = height || DEFAULT_HEIGHT;
    this._scale = scale || 1.0;
    this._svg = null;
    this._noteData = [];
  }

  /**
   * Render notation from song data. Replaces any previous output.
   * @param {Array|Object} songData - Level 1, 2, or 3 input
   * @returns {SVGElement}
   */
  render(songData) {
    this.clear();

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
    let baseTotalHeight;
    if (voiceCount <= 1) {
      baseTotalHeight = this._height;
    } else if (hasBraceGroups) {
      // Dynamic height for grouped staves. The trailing 40 covers
      // descenders and bracket bottom hooks.
      const lastVoiceBottom =
        voiceYPositions[voiceCount - 1] + STAFF_TOP_OFFSET + STAFF_HEIGHT + 40;
      baseTotalHeight = lastVoiceBottom;
    } else {
      // Legacy formula for independent staves
      baseTotalHeight = voiceCount * VOICE_HEIGHT + (voiceCount - 1) * VOICE_GAP;
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
      // 2 px gap + brace width + 4 px breathing room on the viewBox edge.
      braceLeftMargin = Math.ceil(2 + maxBraceWidth + 4);
    }
    const bracketLeftMargin = hasBracketGroup ? 50 : braceLeftMargin;
    // SVG dimensions are finalized below, once we know how many staff
    // systems the music wraps onto. Initial values use baseTotalHeight
    // (single-system height); we patch height/viewBox after computing
    // systemBreakBeats.
    this._svg = createSvgElement('svg', {
      class: 'notation',
      width: this._width + bracketLeftMargin,
      height: baseTotalHeight,
      viewBox: `${-bracketLeftMargin} 0 ${this._width + bracketLeftMargin} ${baseTotalHeight}`,
    });

    // Pre-pass: compute the shared music-start X (max over voices of
    // header end position) and the shared beat → x layout. All voices
    // jump to musicStartX after their per-voice header (clef + key sig
    // + time sig) so notes at the same beat align vertically across
    // staves.
    let musicStartX = STAFF_START_X + CLEF_WIDTH;
    for (const voice of parsed.voices) {
      let x = STAFF_START_X + CLEF_WIDTH;
      const keyInfo = getKeySignature(voice.keySignature || 'C');
      if (keyInfo.count > 0) {
        x += keyInfo.count * KEY_SIG_ACCIDENTAL_WIDTH;
      }
      if (voice.timeSignature) {
        const { width: tsWidth } = createTimeSignature(voice.timeSignature);
        x += tsWidth + TIME_SIG_PADDING;
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

    // Compute system breaks (Gould "Behind Bars", Systems chapter): when
    // music exceeds the configured width, wrap onto a new staff system at
    // a measure boundary. Decision made globally so multi-voice scores
    // wrap as a synchronized group (all voices break at the same barline).
    //
    // Algorithm: walk measure boundaries left-to-right, tracking the
    // running "right edge" of each measure (= beatToX(measureEnd) +
    // accumulated barline padding). When the next measure's right edge
    // would exceed width, that measure starts a new system.
    //
    // `systemBreakBeats` is a Set of beat values AT WHICH a new system
    // begins (i.e., measure-start beats that should land on a fresh
    // staff). The first measure (beat 0) is implicitly a system start.
    const systemBreakBeats = new Set();
    if (sharedMeasureLength) {
      const allBeats = [...beatToX.keys()].sort((a, b) => a - b);
      const totalBeats = allBeats.length > 0 ? allBeats[allBeats.length - 1] : 0;
      // Build the list of completed-measure boundary beats. We include
      // the final boundary even if it equals totalBeats — its right
      // edge needs to be tested against the available width to decide
      // whether the LAST measure wraps onto a new system. The wrap
      // itself never targets the final boundary (no music after it),
      // only earlier boundaries.
      const measureBoundaryBeats = [];
      for (let b = sharedMeasureLength; b <= totalBeats + 0.001; b += sharedMeasureLength) {
        measureBoundaryBeats.push(b);
      }
      // Available width per system: the SVG width, minus the header
      // (which is reprised at the start of every system) and minus
      // breathing room for the final barline.
      const headerWidth = musicStartX; // STAFF_START_X + CLEF + keysig + timesig
      const availableMusicWidth = this._width - headerWidth - FINAL_BARLINE_PADDING - 4;
      let systemStartLayoutX = musicStartX;
      let cumulativeBarlinePadding = 0;
      let measuresOnCurrentSystem = 0;
      for (let mi = 0; mi < measureBoundaryBeats.length; mi += 1) {
        const measureEndBeat = measureBoundaryBeats[mi];
        // Right edge of this measure in single-line layout coords:
        // beatToX(measureEnd) plus accumulated barline padding plus
        // half a barline-padding allowance for the barline itself.
        const measureEndLayoutX = (beatToX.get(measureEndBeat) || 0)
          + cumulativeBarlinePadding + BAR_LINE_PADDING;
        const widthFromSystemStart = measureEndLayoutX - systemStartLayoutX;
        if (
          measuresOnCurrentSystem > 0
          && widthFromSystemStart > availableMusicWidth
        ) {
          // Wrap: the previous measure was the last that fit. Break at
          // its boundary (= measureBoundaryBeats[mi-1]).
          const wrapBeat = measureBoundaryBeats[mi - 1];
          systemBreakBeats.add(wrapBeat);
          systemStartLayoutX = (beatToX.get(wrapBeat) || 0)
            + cumulativeBarlinePadding;
          measuresOnCurrentSystem = 1;
        } else {
          measuresOnCurrentSystem += 1;
        }
        cumulativeBarlinePadding += BAR_LINE_PADDING * 2;
      }
    }

    const totalSystems = systemBreakBeats.size + 1;

    // Per-voice stride between successive systems: the height of the
    // voice's own staff allocation plus SYSTEM_GAP. For multi-voice
    // pieces, each system stacks ALL voices before the next system
    // begins, so the per-system stride is the full multi-voice block.
    const lastVoiceBottomY = voiceCount > 0
      ? voiceYPositions[voiceCount - 1] + STAFF_TOP_OFFSET + STAFF_HEIGHT
      : STAFF_HEIGHT;
    const firstVoiceTopY = voiceCount > 0
      ? voiceYPositions[0] + STAFF_TOP_OFFSET
      : 0;
    const systemBlockHeight = lastVoiceBottomY - firstVoiceTopY;
    const systemStride = systemBlockHeight + SYSTEM_GAP;

    // Now that we know totalSystems, patch the SVG to fit them.
    if (totalSystems > 1) {
      const finalHeight = baseTotalHeight + (totalSystems - 1) * systemStride;
      this._svg.setAttribute('height', String(finalHeight));
      this._svg.setAttribute(
        'viewBox',
        `${-bracketLeftMargin} 0 ${this._width + bracketLeftMargin} ${finalHeight}`,
      );
    }

    // Track per-voice barline X positions for shared barlines
    const voiceBarlineXPositions = new Map();
    // Track per-voice, per-system barline X positions and topY/bottomY,
    // so brace and shared-barline rendering can repeat per system.
    const voiceSystemData = new Map(); // voiceId -> [{ barlineXs, topY, bottomY }, ...]

    parsed.voices.forEach((voice, index) => {
      const clef = voice.clef || inferClef(voice.notes);
      const voiceY = voiceYPositions[index];

      // System-tracking state. Each voice may render across multiple
      // staff systems if the music exceeds the configured width. Per
      // Gould "Behind Bars" (Systems chapter), wraps happen at measure
      // boundaries; voices in a multi-voice score wrap as a synchronized
      // group (driven by the shared systemBreakBeats set computed above).
      let currentSystemIndex = 0;
      const systemRecords = []; // { staffGroup, lines, lastElementX, finalBarlineX, barlineXs, systemY }
      const allBarlineXs = []; // flattened across systems for legacy callers

      const makeSystem = (sysIdx) => {
        const sysY = voiceY + sysIdx * systemStride;
        const sg = createGroup(`staff staff-${index}`, {
          'data-voice-id': voice.id,
          'data-clef': clef,
          'data-system-index': String(sysIdx),
          transform: `translate(0, ${sysY})`,
        });
        const ln = createStaffLines(this._width);
        ln.setAttribute('transform', `translate(0, ${STAFF_TOP_OFFSET})`);
        sg.appendChild(ln);
        const cg = createClef(clef);
        cg.setAttribute('transform', `translate(${STAFF_START_X}, 0)`);
        sg.appendChild(cg);
        return { staffGroup: sg, lines: ln, systemY: sysY, barlineXs: [] };
      };

      const initial = makeSystem(0);
      let staffGroup = initial.staffGroup;
      let lines = initial.lines;
      systemRecords.push({
        staffGroup,
        lines,
        systemY: initial.systemY,
        barlineXs: initial.barlineXs,
      });

      let cursorX = STAFF_START_X + CLEF_WIDTH;

      // Key signature
      const keySignature = voice.keySignature || 'C';
      const keySigGroup = createKeySignature(keySignature, clef);
      if (keySigGroup) {
        keySigGroup.setAttribute('transform', `translate(${cursorX}, 0)`);
        staffGroup.appendChild(keySigGroup);
        const keyInfo = getKeySignature(keySignature);
        cursorX += keyInfo.count * KEY_SIG_ACCIDENTAL_WIDTH;
      }

      // Time signature
      const timeSignature = voice.timeSignature;
      if (timeSignature) {
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
      // Per-system X shift: the absolute layout-X at which the current
      // system started. Subtracted from beatToX values so that, after a
      // system wrap, beats look up their position relative to the new
      // system's left edge instead of the original single-line layout.
      let systemXShift = 0;
      const xForBeat = (beat) => {
        const base = beatToX.get(beat);
        return (base !== undefined ? base : cursorX) + barlineOffset - systemXShift;
      };

      // Track barline X positions for shared barlines in brace groups.
      // Pushes record to both the current system's array (for per-
      // system shared-barline rendering) and a flat list (legacy).
      const pushBarlineX = (x) => {
        systemRecords[currentSystemIndex].barlineXs.push(x);
        allBarlineXs.push(x);
      };
      // Legacy single-array reference for callers that read X positions.
      // Since wrap behavior splits these across systems, the flat
      // allBarlineXs is what multi-system consumers actually want.
      const barlineXs = { push: pushBarlineX };
      voiceBarlineXPositions.set(voice.id, allBarlineXs);

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
      // Track the rightmost rendered visible-element x (note/rest/chord/
      // tuplet member). Used to anchor the final barline at the end of the
      // system so the staff doesn't trail off past the music. Updated at
      // each cursorX-advance where a head/rest/chord/tuplet sub-note was
      // just placed (NOT after barline padding, which would push past the
      // last note).
      let lastElementX = -Infinity;
      let beatPosition = 0;

      // Finalize the current system: append a barline at the system's
      // right edge and clip the 5 staff lines to it. Per Gould "Behind
      // Bars" (Barlines / Systems), every system terminates at a
      // barline rather than trailing off into empty staff.
      //
      // For the FINAL system (no `barlineX` override), anchor the
      // barline at lastElementX + FINAL_BARLINE_PADDING — this hugs
      // the last note since there's no next-measure beat to align to.
      //
      // For NON-FINAL systems, callers pass an explicit `barlineX`
      // computed from the shared beat layout (= xForBeat(wrapBeat) -
      // BAR_LINE_PADDING). That value is identical across voices in
      // the same system, so all voices terminate at the SAME x and
      // their staff lines visually align — fixing the per-voice drift
      // that lastElementX-based anchoring caused (each voice's last
      // rendered head is at a different x).
      const finalizeCurrentSystem = (cursorXAtEnd, opts = {}) => {
        let finalBarlineX;
        if (typeof opts.barlineX === 'number') {
          finalBarlineX = opts.barlineX;
        } else {
          const finalAnchorX = Number.isFinite(lastElementX) ? lastElementX : cursorXAtEnd;
          finalBarlineX = finalAnchorX + FINAL_BARLINE_PADDING;
        }
        staffGroup.appendChild(createBarLine(finalBarlineX));
        pushBarlineX(finalBarlineX);
        lines.querySelectorAll('.staff-line').forEach((line) => {
          line.setAttribute('x2', String(finalBarlineX));
        });
        return finalBarlineX;
      };

      // Switch to a new staff system. Called when the renderer crosses
      // a measure boundary listed in systemBreakBeats. Effects: closes
      // out the current system (final barline + staff-line clipping),
      // creates a new staffGroup at +systemStride Y, renders fresh
      // staff-lines + clef, and resets cursorX to musicStartX while
      // accumulating systemXShift so xForBeat returns positions
      // relative to the new system's left edge.
      const wrapToNewSystem = () => {
        // System-end barline X = the position one BAR_LINE_PADDING
        // before cursorX. cursorX has just been set to xForBeat(
        // wrapBeat), and `barlineOffset` already includes both the
        // trailing-padding for the just-finished measure AND the
        // leading-padding for the upcoming first measure of the next
        // system; subtracting one BAR_LINE_PADDING lands the barline
        // between them (i.e., at the trailing edge of the just-
        // finished measure). All voices share `beatToX` and accumulate
        // the same `barlineOffset` to this point, so they emit
        // identical sysEndX values — the staves line up at the
        // system break.
        const sysEndX = cursorX - BAR_LINE_PADDING;
        finalizeCurrentSystem(cursorX, { barlineX: sysEndX });
        this._svg.appendChild(staffGroup);

        currentSystemIndex += 1;
        const next = makeSystem(currentSystemIndex);
        staffGroup = next.staffGroup;
        lines = next.lines;
        systemRecords.push({
          staffGroup,
          lines,
          systemY: next.systemY,
          barlineXs: next.barlineXs,
        });

        // Subtract everything to the left of where the new system
        // resumes, so xForBeat lands at musicStartX again. cursorX is
        // currently the absolute layout-X of the just-drawn measure
        // barline (the wrap point, in old-coords) + barlineOffset; for
        // the new system we want it at musicStartX (header-relative).
        const wrapAbsX = cursorX; // already in the OLD system's local coord (== absolute layout-X minus prior systemXShift, plus barlineOffset)
        const targetX = musicStartX;
        const delta = wrapAbsX - targetX;
        systemXShift += delta;
        cursorX = targetX;
        lastElementX = -Infinity;
      };

      // Marker tracking for post-processing
      const pendingDynamics = [];
      const hairpinStarts = [];
      const completedHairpins = [];

      // Ending (volta) tracking
      const endingData = [];
      const activeEndings = new Map();

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
                    })
                  );
                }

                tupletGroup.appendChild(chordGroup);
                if (cursorX > lastElementX) lastElementX = cursorX;

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
              if (cursorX > lastElementX) lastElementX = cursorX;

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
              if (cursorX > lastElementX) lastElementX = cursorX;

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

          tupletGroup.appendChild(
            renderTupletBracket({
              actual,
              startX,
              endX,
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
              cursorX += BAR_LINE_PADDING;
              staffGroup.appendChild(createBarLine(cursorX));
              barlineXs.push(cursorX);
              cursorX += BAR_LINE_PADDING;
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
          cursorX += BAR_LINE_PADDING;
          staffGroup.appendChild(renderRepeatBarline({ type: element.barline, x: cursorX }));
          cursorX += element.barline === 'repeat-both' ? 20 : 15;
          // eslint-disable-next-line no-continue
          continue;
        }
        if (markerType === 'ending') {
          if (element.ending.type === 'start') {
            activeEndings.set(element.ending.number, { startX: cursorX });
          } else if (element.ending.type === 'stop') {
            const start = activeEndings.get(element.ending.number);
            if (start) {
              endingData.push({
                number: element.ending.number,
                startX: start.startX,
                endX: cursorX,
                isClosed: true,
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

        // Associate pending dynamics/hairpins with this note's x position
        for (const pd of pendingDynamics) {
          if (pd.x === undefined) pd.x = cursorX;
        }
        for (const hs of hairpinStarts) {
          if (hs.startX === undefined) hs.startX = cursorX;
        }
        for (const ch of completedHairpins) {
          if (ch.endX === undefined) ch.endX = cursorX;
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
            const chordAccOffset = chordBeamInfo && !chordBeamInfo.isFirst
              ? ACCIDENTAL_OFFSET_BEAMED_PRIOR
              : ACCIDENTAL_OFFSET;
            for (let j = 0; j < chordNotes.length; j += 1) {
              const { accidental } = parsePitch(chordNotes[j].pitch);
              const accidentalType = ACCIDENTAL_TYPE_MAP[accidental];
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
            if (cursorX > lastElementX) lastElementX = cursorX;

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

            // Bar line insertion for chords (shared layout: barline x =
            // beatToX(measureEndBeat) + accumulated barlineOffset + padding).
            if (measureLength && chordElementBeats > 0) {
              cumulativeBeats += chordAdjBeats;
              while (cumulativeBeats >= measureLength - 0.001) {
                const isWrapPoint = systemBreakBeats.has(beatPosition)
                  && Math.abs(cumulativeBeats - measureLength) < 0.001;
                if (!isWrapPoint) {
                  barlineOffset += BAR_LINE_PADDING;
                  const barlineX = xForBeat(beatPosition);
                  staffGroup.appendChild(createBarLine(barlineX));
                  barlineXs.push(barlineX);
                  barlineOffset += BAR_LINE_PADDING;
                } else {
                  barlineOffset += BAR_LINE_PADDING * 2;
                }
                cumulativeBeats -= measureLength;
              }
              if (Math.abs(cumulativeBeats) < 0.001) {
                cumulativeBeats = 0;
              }
            }
            if (systemBreakBeats.has(beatPosition)) {
              cursorX = xForBeat(beatPosition);
              wrapToNewSystem();
            } else {
              cursorX = xForBeat(beatPosition);
            }
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
        if (cursorX > lastElementX) lastElementX = cursorX;

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
          const { accidental } = parsePitch(element.pitch);
          const accidentalType = ACCIDENTAL_TYPE_MAP[accidental];
          if (accidentalType) {
            const accOffset = isBeamed && !beamInfo.isFirst
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

        // Bar line insertion (shared layout)
        if (measureLength && elementBeats > 0) {
          cumulativeBeats += elementBeats;
          while (cumulativeBeats >= measureLength - 0.001) {
            // If THIS measure boundary is a system break, skip emitting
            // the internal barline — the finalizeCurrentSystem call
            // inside wrapToNewSystem will emit the system-end barline.
            const isWrapPoint = systemBreakBeats.has(beatPosition)
              && Math.abs(cumulativeBeats - measureLength) < 0.001;
            if (!isWrapPoint) {
              barlineOffset += BAR_LINE_PADDING;
              const barlineX = xForBeat(beatPosition);
              staffGroup.appendChild(createBarLine(barlineX));
              barlineXs.push(barlineX);
              barlineOffset += BAR_LINE_PADDING;
            } else {
              // Still account for the barline padding in the layout so
              // post-wrap beats stay aligned with the original beatToX
              // map. (The actual barline glyph for this measure is the
              // finalize-emitted one in finalizeCurrentSystem.)
              barlineOffset += BAR_LINE_PADDING * 2;
            }
            cumulativeBeats -= measureLength;
          }
          if (Math.abs(cumulativeBeats) < 0.001) {
            cumulativeBeats = 0;
          }
        }
        // System wrap: when this measure boundary is a system break,
        // close out the current system and start a fresh one with its
        // own staff lines + clef. Driven by the global systemBreakBeats
        // set so multi-voice scores stay synchronized.
        if (systemBreakBeats.has(beatPosition)) {
          cursorX = xForBeat(beatPosition);
          wrapToNewSystem();
        } else {
          // Advance cursor to next beat's shared X (with current barline offset).
          cursorX = xForBeat(beatPosition);
        }
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

      // Dynamics rendering pass
      if (pendingDynamics.length > 0 || completedHairpins.length > 0) {
        const dynamicsGroup = createGroup('dynamics-layer');

        for (const pd of pendingDynamics) {
          if (pd.x !== undefined) {
            dynamicsGroup.appendChild(
              renderDynamic({ dynamic: pd.dynamic, x: pd.x, y: DYNAMICS_Y })
            );
          }
        }

        for (const hp of completedHairpins) {
          const startX = hp.startX !== undefined ? hp.startX : hp.endX;
          const endX = hp.endX !== undefined ? hp.endX : hp.startX;
          if (startX !== undefined && endX !== undefined) {
            dynamicsGroup.appendChild(
              renderHairpin({ type: hp.type, startX, endX, y: DYNAMICS_Y })
            );
          }
        }

        staffGroup.appendChild(dynamicsGroup);
      }

      // Ending (volta bracket) rendering pass
      // Close any open endings (last ending in group has no stop marker)
      for (const [number, data] of activeEndings) {
        endingData.push({
          number,
          startX: data.startX,
          endX: cursorX,
          isClosed: false,
        });
      }
      if (endingData.length > 0) {
        const endingsGroup = createGroup('endings-layer');
        for (const ed of endingData) {
          endingsGroup.appendChild(
            renderEnding({
              number: ed.number,
              startX: ed.startX,
              endX: ed.endX,
              open: !ed.isClosed,
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

      // Final barline for the LAST system. (Earlier systems were
      // finalized by wrapToNewSystem.) Per Gould "Behind Bars"
      // (Barlines / Systems), every system terminates at a barline so
      // the staff lines don't trail off past the music.
      finalizeCurrentSystem(cursorX);

      this._svg.appendChild(staffGroup);

      // Record per-system data for brace / shared-barline rendering.
      voiceSystemData.set(voice.id, systemRecords.map((r) => ({
        barlineXs: r.barlineXs,
        systemY: r.systemY,
      })));
    });

    // Render brace and shared barlines for staff groups
    for (const group of braceGroups) {
      const voiceIndices = group.voiceIds
        .map((vid) => parsed.voices.findIndex((v) => v.id === vid))
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
        // Brace sits OUTSIDE the staff with a ~2 px gap. Brace local x
        // range is [0, ~braceWidth] (where braceWidth scales sub-linearly
        // with height); position so the brace's right edge lands at x=-2.
        const braceWidth = getBraceWidth(groupHeight);
        groupEl.setAttribute('transform', `translate(${-2 - braceWidth}, ${topY})`);
      }
      this._svg.appendChild(groupEl);

      // System-start (initial) shared barline: a single tall line at x=0
      // tying all staves of the group together. Uses the staff-aligned
      // top/bottom (NOT bracket-padded) so it matches the staff lines.
      this._svg.appendChild(createSharedBarLine({ x: 0, topY, bottomY }));

      // Shared barlines: collect X positions common across grouped voices
      const allBarlineXSets = voiceIndices.map((vi) => {
        const vid = parsed.voices[vi].id;
        return voiceBarlineXPositions.get(vid) || [];
      });
      // Use the first voice's barline positions (voices in a group share time sig)
      const sharedXPositions = allBarlineXSets[0] || [];
      for (const x of sharedXPositions) {
        this._svg.appendChild(createSharedBarLine({ x, topY, bottomY }));
      }
    }

    if (this._container) {
      this._container.appendChild(this._svg);
    }

    return this._svg;
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
   * Remove the SVG and reset state.
   */
  clear() {
    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }
    this._svg = null;
    this._noteData = [];
  }

  /**
   * Get the current SVG element.
   * @returns {SVGElement|null}
   */
  getSvgElement() {
    return this._svg;
  }
}
