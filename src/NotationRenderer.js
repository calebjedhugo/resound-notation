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
import { analyzeOttava } from './lib/segmentOttava.js';
import { createOttavaBracket } from './components/OttavaBracket.js';
import { breakIntoSystems, justifySystem } from './lib/breakIntoSystems.js';
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
const STAFF_START_X = 20;
const STAFF_TOP_OFFSET = 10;
// Bravura clefs render at ~54px (gClef) to ~56px (cClef). 90 leaves
// ~1.5 staff spaces between clef glyph and first note.
const CLEF_WIDTH = 90;
const VOICE_HEIGHT = 200;
const VOICE_GAP = 40;
const GRAND_STAFF_GAP = 60;
const STAFF_HEIGHT = 80; // 5 lines, 20px apart
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
   * @param {boolean} [options.observeContainer=false] - if true, attach
   *   a ResizeObserver to the container at construction time.
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
    observeContainer = false,
    responsiveMode = 'reflow',
  } = {}) {
    this._container = container || null;
    this._width = width || DEFAULT_WIDTH;
    this._height = height || DEFAULT_HEIGHT;
    this._scale = scale || 1.0;
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

    if (observeContainer) {
      this.observe();
    }
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
      // 2 px gap + brace width + 4 px breathing room on the viewBox edge.
      braceLeftMargin = Math.ceil(2 + maxBraceWidth + 4);
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
    const fullBeatToX = computeBeatLayout(parsed.voices, 0);
    // Walk one voice's measure boundaries to bucket beats by measure
    // index. Use the FIRST voice that has a timeSignature for the cadence.
    const rhythmVoice = parsed.voices.find((v) => v.timeSignature) || parsed.voices[0];
    const rhythmMeasureLength = rhythmVoice && rhythmVoice.timeSignature
      ? rhythmVoice.timeSignature[0] * (4 / rhythmVoice.timeSignature[1])
      : null;
    const naturalMeasureWidths = (() => {
      // Walk the rhythm voice element-by-element to match measureIntrinsic
      // Widths's measure-splitting semantics: explicit barline tokens
      // flush a measure (even empty), and time-signature beat-fills do
      // the same. We collect cumulative beats up to each measure boundary
      // and read the corresponding x from the full beat→x map.
      if (!rhythmVoice || !rhythmVoice.notes) return [];
      const widths = [];
      let measureStartBeat = 0;
      let beat = 0;
      let accumBeats = 0;
      const flush = () => {
        const startX = fullBeatToX.get(measureStartBeat) ?? 0;
        const endX = fullBeatToX.get(beat) ?? startX;
        widths.push(endX - startX);
        measureStartBeat = beat;
        accumBeats = 0;
      };
      for (const el of rhythmVoice.notes) {
        if (!el) continue;
        if (!Array.isArray(el) && el.barline !== undefined) {
          flush();
          continue;
        }
        // Skip markers.
        if (!Array.isArray(el) && (
          el.ending !== undefined
          || el.navigation !== undefined
          || el.tempo !== undefined
          || el.tempoChange !== undefined
          || el.expression !== undefined
          || el.rehearsal !== undefined
          || el.dynamic !== undefined
          || el.hairpin !== undefined
        )) continue;
        // Sounding event beat advance.
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
        if (rhythmMeasureLength && accumBeats >= rhythmMeasureLength - 1e-6) {
          flush();
        }
      }
      // Trailing partial measure.
      if (beat > measureStartBeat) flush();
      return widths;
    })();
    const combinedIntrinsics = naturalMeasureWidths;

    // Per-system prelude width: shared across voices (max), since voices
    // sit in the same horizontal coordinate frame. Time sig only on the
    // first system. Music starts after the largest prelude.
    const preludePerSystem = (systemIndex) => {
      let maxPrelude = 0;
      for (const voice of parsed.voices) {
        let p = STAFF_START_X + CLEF_WIDTH;
        const keyInfo = getKeySignature(voice.keySignature || 'C');
        if (keyInfo.count > 0) p += keyInfo.count * KEY_SIG_ACCIDENTAL_WIDTH;
        if (systemIndex === 0 && voice.timeSignature) {
          const { width: tsWidth } = createTimeSignature(voice.timeSignature);
          p += tsWidth + TIME_SIG_PADDING;
        }
        if (p > maxPrelude) maxPrelude = p;
      }
      return maxPrelude;
    };

    const systemPlans = breakIntoSystems(combinedIntrinsics, this._width, preludePerSystem);

    // Multi-system tightening: when the piece wraps onto >1 system AND
    // the voices are independent (no brace group), the per-voice Y
    // gaps computed above (VOICE_HEIGHT + VOICE_GAP = 240) are visually
    // too large — adjacent staves end up looking like separate systems
    // rather than a paired system. Compress to STAFF_HEIGHT + VOICE_GAP
    // (= 120, exactly SYSTEM_GAP) so intra-system stays smaller than
    // the SYSTEM_GAP visually inserted between systems. The original
    // single-system layout is preserved when there's only one system.
    const multiSystem = systemPlans.length > 1;
    let effectiveVoiceYPositions = voiceYPositions;
    if (multiSystem && !hasBraceGroups && voiceCount > 1) {
      effectiveVoiceYPositions = [];
      let y = bracketTopMargin;
      for (let vi = 0; vi < voiceCount; vi += 1) {
        effectiveVoiceYPositions.push(y);
        y += STAFF_HEIGHT + VOICE_GAP;
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
        measureTargetWidths: [],
        isFirstSystem: true,
        isLastSystem: true,
        systemYOffset: 0,
        systemEndX: this._width,
        preludeWidth,
        renderTimeSignature: true,
        systemContext,
        braceGroups,
      });
    } else {
      for (let si = 0; si < systemPlans.length; si += 1) {
        const plan = systemPlans[si];
        const isFirst = si === 0;
        const isLast = si === systemPlans.length - 1;
        const preludeWidth = preludePerSystem(si);
        const availableMusicWidth = this._width - preludeWidth;
        const measureTargetWidths = justifySystem(plan, combinedIntrinsics, availableMusicWidth);
        const justified = measureTargetWidths.reduce((a, b) => a + b, 0) > plan.intrinsicSum + 1e-6;

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
        let perSystemMusicStartX = STAFF_START_X + CLEF_WIDTH;
        for (const voice of parsed.voices) {
          let x = STAFF_START_X + CLEF_WIDTH;
          const keyInfo = getKeySignature(voice.keySignature || 'C');
          if (keyInfo.count > 0) x += keyInfo.count * KEY_SIG_ACCIDENTAL_WIDTH;
          if (isFirst && voice.timeSignature) {
            const { width: tsWidth } = createTimeSignature(voice.timeSignature);
            x += tsWidth + TIME_SIG_PADDING;
          }
          if (x > perSystemMusicStartX) perSystemMusicStartX = x;
        }

        // Natural beat→x for this system (no stretch).
        const naturalBeatToX = computeBeatLayout(sliceVoices, perSystemMusicStartX);

        // Last beat across all voices (system end).
        let systemEndBeat = 0;
        for (const ev of (() => {
          const all = [];
          for (const v of sliceVoices) {
            for (const e of collectVoiceEvents(v.notes)) all.push(e);
          }
          return all;
        })()) {
          if (ev.endBeat > systemEndBeat) systemEndBeat = ev.endBeat;
        }

        // Measure count in this system → barline padding budget.
        const measureCountInSystem = plan.endMeasure - plan.startMeasure + 1;
        const naturalMusicEndX = naturalBeatToX.get(systemEndBeat) || perSystemMusicStartX;
        const naturalMusicWidth = naturalMusicEndX - perSystemMusicStartX;
        // 2 × BAR_LINE_PADDING per measure-boundary the voice loop will
        // insert. The final boundary contributes +12 (pre-barline) and
        // then +12 again (post-barline — but no notes follow so the post
        // doesn't matter for end-x calc). For barline x we need 24*(N-1)+12.
        const barlinePadAtSystemEnd = 24 * (measureCountInSystem - 1) + 12;
        // Choose system right edge:
        //   justified: width
        //   unjustified: musicStartX + naturalMusicWidth + barline pad at end
        const systemRightX = justified
          ? this._width
          : perSystemMusicStartX + naturalMusicWidth + barlinePadAtSystemEnd;
        // Stretch ratio for music portion.
        const stretchRatio = naturalMusicWidth > 0
          ? (systemRightX - perSystemMusicStartX - barlinePadAtSystemEnd) / naturalMusicWidth
          : 1;
        // Build stretched beatToX.
        const stretchedBeatToX = new Map();
        for (const [beat, x] of naturalBeatToX.entries()) {
          stretchedBeatToX.set(
            beat,
            perSystemMusicStartX + (x - perSystemMusicStartX) * stretchRatio
          );
        }

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
          measureTargetWidths,
          isFirstSystem: isFirst,
          isLastSystem: isLast,
          systemYOffset,
          systemEndX: systemRightX,
          renderTimeSignature: isFirst,
          systemContext,
          braceGroups,
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
    if (this._scale !== 1.0) {
      const heightAttr = this._svg.getAttribute('height');
      const svgPxHeight = parseFloat(heightAttr);
      this._svg.setAttribute('width', svgPxWidth * this._scale);
      this._svg.setAttribute('height', svgPxHeight * this._scale);
      // viewBox stays in internal units → consumer sees the SVG scaled
      // up/down by `scale` since width/height differ from viewBox extent.
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
    // eslint-disable-next-line no-unused-vars
    startMeasure,
    // eslint-disable-next-line no-unused-vars
    endMeasure,
    // eslint-disable-next-line no-unused-vars
    measureTargetWidths,
    isFirstSystem,
    isLastSystem,
    systemYOffset = 0,
    systemEndX,
    renderTimeSignature = true,
    systemContext,
    braceGroups,
  }) {
    let contentMinY = systemContext.contentMinY;
    let contentMaxY = systemContext.contentMaxY;

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
        cursorX += keyInfo.count * KEY_SIG_ACCIDENTAL_WIDTH;
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
                barlineOffset += BAR_LINE_PADDING;
                const barlineX = xForBeat(beatPosition);
                staffGroup.appendChild(createBarLine(barlineX));
                barlineXs.push(barlineX);
                barlineOffset += BAR_LINE_PADDING;
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
            barlineOffset += BAR_LINE_PADDING;
            const barlineX = xForBeat(beatPosition);
            staffGroup.appendChild(createBarLine(barlineX));
            barlineXs.push(barlineX);
            barlineOffset += BAR_LINE_PADDING;
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
      const BRACKET_CLEARANCE = 20; // one staff space
      const DEFAULT_VA_Y = STAFF_TOP_OFFSET - 50;
      const DEFAULT_VB_Y = STAFF_TOP_OFFSET + STAFF_HEIGHT + 60;
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
            ? Math.min(segMinY - BRACKET_CLEARANCE, DEFAULT_VA_Y)
            : Math.max(segMaxY + BRACKET_CLEARANCE, DEFAULT_VB_Y);
          staffGroup.appendChild(
            createOttavaBracket({ kind: seg.kind, startX, endX, y: bracketY })
          );
          // Fold bracket footprint into the content bbox (glyph extends
          // ~24px past the bracketY anchor in either direction).
          const bracketAbs = voiceYPositions[index] + bracketY;
          if (bracketAbs - 24 < contentMinY) contentMinY = bracketAbs - 24;
          if (bracketAbs + 24 > contentMaxY) contentMaxY = bracketAbs + 24;
        }
      }

      // System-end barline: final (thin+thick) on the last system, plain
      // thin elsewhere. The natural voice loop already emits a thin bar-
      // line at each completed measure boundary, so intermediate systems
      // already have their right-edge thin line. For the last system, we
      // emit a `final` barline at systemEndX to mark the piece end. Per
      // Gould "Behind Bars", every system terminates with a barline at
      // its right edge; the final system's is thin-thick.
      if (isLastSystem && systemEndX !== undefined) {
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
        const vid = voices[vi].id;
        return voiceBarlineXPositions.get(vid) || [];
      });
      // Use the first voice's barline positions (voices in a group share time sig)
      const sharedXPositions = allBarlineXSets[0] || [];
      for (const x of sharedXPositions) {
        this._svg.appendChild(createSharedBarLine({ x, topY, bottomY }));
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
        // 'reflow' (default)
        const scale = this._scale || 1;
        this.setWidth(cw / scale);
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
