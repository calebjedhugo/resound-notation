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
import { createBeams, computeBeamLine, beamLineYAt } from './components/Beam.js';
import { resolveTies } from './lib/tieResolver.js';
import { createTieArc } from './components/Tie.js';
import { renderDynamic } from './components/Dynamic.js';
import { renderHairpin } from './components/Hairpin.js';
import { renderArticulations } from './components/Articulation.js';
import { resolveSlurs } from './lib/slurGrouping.js';
import { createSlurArc } from './components/Slur.js';
import { getTupletNoteDuration } from './lib/tuplets.js';
import { renderTupletBracket } from './components/TupletBracket.js';
import { renderGraceNotes } from './components/GraceNote.js';
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
// Distance (px) from notehead center back to accidental center.
// Bravura sharp ≈ 20 wide, head half-width ≈ 12, plus ~5px breathing
// room → 30 keeps the accidental clear of the head.
const ACCIDENTAL_OFFSET = 30;
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
    const bracketTopMargin = hasBracketGroup ? 24 : 0;

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
    let totalHeight;
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

    parsed.voices.forEach((voice, index) => {
      const clef = voice.clef || inferClef(voice.notes);
      const voiceY = voiceYPositions[index];

      const staffGroup = createGroup(`staff staff-${index}`, {
        'data-voice-id': voice.id,
        'data-clef': clef,
        transform: `translate(0, ${voiceY})`,
      });

      // Staff lines
      const lines = createStaffLines(this._width);
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
          const bracketY = stemsDown ? 110 : -10;
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

            // Grace notes on chord (from first note that has grace property)
            const chordGrace = chordNotes.find((n) => n.grace);
            if (chordGrace) {
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

            // Accidentals (on staffGroup with absolute coords)
            for (let j = 0; j < chordNotes.length; j += 1) {
              const { accidental } = parsePitch(chordNotes[j].pitch);
              const accidentalType = ACCIDENTAL_TYPE_MAP[accidental];
              if (accidentalType) {
                const accGroup = createAccidental(accidentalType);
                accGroup.setAttribute(
                  'transform',
                  `translate(${cursorX - ACCIDENTAL_OFFSET}, ${yPositions[j]})`
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

          // Grace notes (render before the main note)
          if (element.grace) {
            const graceResult = renderGraceNotes({
              grace: element.grace,
              mainX: cursorX,
              mainY: noteY,
              clef,
            });
            target.appendChild(graceResult.element);
          }

          // Accidental (render before note, to the left)
          const { accidental } = parsePitch(element.pitch);
          const accidentalType = ACCIDENTAL_TYPE_MAP[accidental];
          if (accidentalType) {
            const accGroup = createAccidental(accidentalType);
            accGroup.setAttribute(
              'transform',
              `translate(${cursorX - ACCIDENTAL_OFFSET}, ${noteY})`
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

      this._svg.appendChild(staffGroup);
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
        groupEl = createBracket({ height: groupHeight });
        // Bracket sits entirely OUTSIDE the staff area. Local footprint:
        // trunk x=[0,10] (left vertical line), hook tips reach x≈37.5
        // (right, curling toward the staff). With translate x=-39.5, the
        // hook tips land at x=-2 — a 2 px gap before staff lines at x=0 —
        // and the trunk's left edge sits at x=-39.5.
        groupEl.setAttribute('transform', `translate(-39.5, ${topY})`);
      } else {
        groupEl = createBrace({ height: groupHeight });
        // Brace sits OUTSIDE the staff with a ~2 px gap. Brace local x
        // range is [0, ~braceWidth] (where braceWidth scales sub-linearly
        // with height); position so the brace's right edge lands at x=-2.
        const braceWidth = getBraceWidth(groupHeight);
        groupEl.setAttribute('transform', `translate(${-2 - braceWidth}, ${topY})`);
      }
      this._svg.appendChild(groupEl);

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
