/** @jest-environment jsdom */

import { createNotationContext } from './__tests__/helpers/testUtils.js';

describe('NotationRenderer', () => {
  let ctx;

  beforeEach(() => {
    ctx = createNotationContext();
  });

  afterEach(() => {
    ctx.destroy();
  });

  describe('SVG root element', () => {
    it('creates an SVG element with class "notation"', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const svg = ctx.getSvg();
      expect(svg).not.toBeNull();
      expect(svg.tagName).toBe('svg');
      expect(svg.getAttribute('class')).toBe('notation');
    });

    it('appends the SVG to the container', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(ctx.container.querySelector('svg')).not.toBeNull();
    });

    it('returns the SVG element from render()', () => {
      const svg = ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(svg).toBe(ctx.getSvg());
    });
  });

  describe('getSvgElement', () => {
    it('returns null before rendering', () => {
      expect(ctx.renderer.getSvgElement()).toBeNull();
    });

    it('returns the SVG element after rendering', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(ctx.renderer.getSvgElement()).toBe(ctx.getSvg());
    });
  });

  describe('clear', () => {
    it('removes the SVG from the container', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(ctx.getSvg()).not.toBeNull();

      ctx.renderer.clear();
      expect(ctx.getSvg()).toBeNull();
    });

    it('sets getSvgElement to null after clearing', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      ctx.renderer.clear();
      expect(ctx.renderer.getSvgElement()).toBeNull();
    });
  });

  describe('render replaces previous output', () => {
    it('removes old SVG when render is called again', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      ctx.render([
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      expect(ctx.container.querySelectorAll('svg')).toHaveLength(1);
      expect(ctx.getNotes()).toHaveLength(2);
    });
  });

  describe('rendering notes', () => {
    it('renders one note per pitched element', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      expect(ctx.getNotes()).toHaveLength(3);
    });

    it('renders rests alongside notes', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      expect(ctx.getNotes()).toHaveLength(2);
      expect(ctx.getRests()).toHaveLength(1);
    });

    it('spaces notes horizontally', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);

      const notes = ctx.getNotes();
      const x0 = notes[0].getAttribute('transform');
      const x1 = notes[1].getAttribute('transform');
      expect(x0).not.toBe(x1);
    });

    it('renders notes with correct duration classes', () => {
      ctx.render([
        { pitch: 'C4', length: '1/2' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/8' },
      ]);

      const notes = ctx.getNotes();
      expect(notes[0].classList.contains('note-half')).toBe(true);
      expect(notes[1].classList.contains('note-quarter')).toBe(true);
      expect(notes[2].classList.contains('note-eighth')).toBe(true);
    });

    // Standard engraving (Gould, "Behind Bars"; Lilypond / Dorico defaults):
    // for notes within the staff, stems extend one octave (3.5 staff spaces)
    // from the notehead. Staff line spacing is 20px, so the stem length must
    // be 70px. Pin the value: shorter stems read as stubby/childlike
    // (regression caught visually in the dev playground), longer stems
    // collide with adjacent staves in multi-voice/grand-staff layouts.
    it('renders quarter-note stems one octave (70px / 3.5 spaces) long for notes near the staff', () => {
      ctx.render([{ pitch: 'E4', length: '1/4' }]);
      const stem = ctx.container.querySelector('.note-stem');
      const y1 = parseFloat(stem.getAttribute('y1'));
      const y2 = parseFloat(stem.getAttribute('y2'));
      expect(Math.abs(y2 - y1)).toBe(70);
    });

    // SMuFL Bravura noteheads are path glyphs, not stroked ellipses. The
    // path is pre-tilted in the font (no rotate transform needed). Black
    // notehead bbox is 295 × 250 font units → 23.6 × 20 px at scale 0.08
    // (LINE_SPACING/250). Inner <path> contains the Bravura signature
    // vertex 'C295' on its rightmost outline.
    it('renders noteheads as Bravura path glyphs', () => {
      ctx.render([{ pitch: 'E4', length: '1/4' }]);
      const head = ctx.container.querySelector('.note-head');
      expect(head.tagName.toLowerCase()).not.toBe('ellipse');
      const path = head.querySelector('path');
      expect(path).not.toBeNull();
      // Stable Bravura noteheadBlack signature: max-x vertex at (295, 42).
      expect(path.getAttribute('d')).toContain('295');
    });

    // Standard engraving (Gould "Behind Bars"): adjacent quarter notes need
    // at least one full notehead-width of clearance between heads. SMuFL
    // Bravura noteheadBlack is 23.6 px wide (295 fu × 0.08). Pin advance
    // ≥ 2× head-width.
    it('spaces adjacent quarter notes at least 2 notehead-widths apart', () => {
      ctx.render([
        { pitch: 'E4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);
      const notes = ctx.getNotes();
      const xOf = (n) => parseFloat(n.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
      const advance = xOf(notes[1]) - xOf(notes[0]);
      const headWidth = 23.6; // Bravura noteheadBlack
      expect(advance).toBeGreaterThanOrEqual(headWidth * 2);
    });

    // SMuFL Bravura noteheadBlack stem-up tip: the path's max-x vertex sits
    // at font-units (295, 42). The stem anchor is pulled ~1px toward the
    // head's center so the stem overlaps the outline rather than butting
    // up against it (standard engraving — without overlap the stem reads
    // as "stuck on" the head edge instead of joining cleanly).
    it('attaches the quarter-note stem ~1px inside the head outline', () => {
      ctx.render([{ pitch: 'E4', length: '1/4' }]);
      const stem = ctx.container.querySelector('.note-stem');
      const x = parseFloat(stem.getAttribute('x1'));
      // E4 is below middle line → stem-up → right side of head, pulled inward.
      expect(x).toBeLessThan(11.8);
      expect(x).toBeGreaterThan(10);
    });

    // Per Gould "Behind Bars" (Stems): the stem's lower endpoint should sit
    // near the notehead's vertical center so the stem visually pierces the
    // head rather than perching on its top edge. With the SMuFL anchor at
    // y_fu=42 (top-right of head), the stem bottom landed ~3.4px above
    // center on a 10px-tall head — visually reading as a gap. Pin the
    // stem-up stem-bottom to fall WITHIN the notehead's inner half, i.e.
    // |y1| < HEAD_HALF_HEIGHT / 2 (5px), so the stem reliably overlaps the
    // head body across renderers.
    it('lands the stem-up stem bottom inside the notehead body (no perched gap)', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]); // low C, stem-up
      const note = ctx.container.querySelector('.note');
      const stem = note.querySelector('.note-stem');
      const y1 = parseFloat(stem.getAttribute('y1'));
      // Notehead spans local y in [-10, +10] (NOTEHEAD_BLACK bbox 125 fu *
      // SMUFL_SCALE 0.08 = 10 px each side of midline). Stem y1 must land
      // near the head's vertical center — |y1| < 2 px (~0.1 staff space) —
      // so the stem visibly overlaps the head body, not its top outline.
      expect(Math.abs(y1)).toBeLessThan(2);
    });

    // Same pullback applies to the SMuFL noteheadHalf glyph.
    it('attaches the half-note stem ~1px inside the head outline', () => {
      ctx.render([{ pitch: 'E4', length: '1/2' }]);
      const stem = ctx.container.querySelector('.note-stem');
      const x = parseFloat(stem.getAttribute('x1'));
      expect(x).toBeLessThan(11.8);
      expect(x).toBeGreaterThan(10);
    });

    // Half-note heads in standard engraving have a distinct hollow shape:
    // outer notehead outline + inner cutout (drawn via even-odd fill rule),
    // not a stroked ellipse. Pin via the path glyph rather than the ellipse
    // so the half note reads as engraved, not a duplicate of the quarter
    // with fill=none.
    it('renders half-note heads as path glyphs (not stroked ellipses)', () => {
      ctx.render([{ pitch: 'E4', length: '1/2' }]);
      const note = ctx.container.querySelector('.note-half');
      expect(note).not.toBeNull();
      const head = note.querySelector('.note-head');
      expect(head).not.toBeNull();
      // The head wrapper should contain a <path>, not be an <ellipse>.
      expect(head.querySelector('path')).not.toBeNull();
    });

    it('renders accidentals as path glyphs, not Unicode text', () => {
      // Sharps and flats appear inline from the pitch spelling. Naturals
      // surface when a pitch contradicts the prevailing key signature; we
      // force one by setting key signature G (one sharp on F) and writing
      // an explicit F-natural.
      ctx.render({
        voices: [
          {
            keySignature: 'G',
            notes: [
              { pitch: 'C#4', length: '1/4' },
              { pitch: 'Db4', length: '1/4' },
              { pitch: 'F4', length: '1/4' },
            ],
          },
        ],
      });
      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals.length).toBeGreaterThan(0);
      for (const acc of accidentals) {
        expect(acc.querySelector('path')).not.toBeNull();
        expect(acc.querySelector('text')).toBeNull();
      }
    });

    // Standard engraving leaves ~1 staff space between the clef glyph's
    // visual right edge and the first notehead's left edge so the clef
    // doesn't crowd the music. The treble-clef SVG path's max x is ~39 in
    // clef-local coordinates; the test reads that as a documented constant.
    // If the clef glyph is ever replaced, update CLEF_GLYPH_MAX_X — the
    // test's job is to pin the visible gap, not the glyph itself.
    it('leaves at least one staff space between the clef and the first note', () => {
      ctx.render([{ pitch: 'E4', length: '1/4' }]);
      const clef = ctx.container.querySelector('.clef-treble');
      const note = ctx.container.querySelector('.note');
      const head = note.querySelector('.note-head');
      const clefTx = parseFloat(clef.getAttribute('transform').match(/translate\((\d+)/)[1]);
      const noteTx = parseFloat(note.getAttribute('transform').match(/translate\((\d+)/)[1]);
      // Bravura noteheadBlack half-width: 295 fu / 2 × 0.08 = 11.8 px.
      const headHalfWidth = 11.8;
      // Bravura gClef visible width: 671 fu × 0.08 = 53.68 px.
      const CLEF_GLYPH_MAX_X = 54;
      const gap = (noteTx - headHalfWidth) - (clefTx + CLEF_GLYPH_MAX_X);
      expect(gap).toBeGreaterThanOrEqual(20);
    });

    // Time signatures must render as Bravura SMuFL path glyphs, not as
    // <text> elements. Native text renders inconsistently across
    // browsers, has no engraved feel, and ignores the staff-space size
    // convention. Pin: a 4/4 time-sig produces 2 path glyphs (one each
    // for numerator and denominator) and zero <text> children.
    it('renders time-sig digits as Bravura path glyphs, not text', () => {
      ctx.render({ timeSignature: [4, 4], notes: [{ pitch: 'C4', length: '1/4' }] });
      const sig = ctx.container.querySelector('.time-signature');
      expect(sig).not.toBeNull();
      expect(sig.querySelector('text')).toBeNull();
      // Numerator + denominator each render at least one <path>.
      const numerator = sig.querySelector('.time-numerator');
      const denominator = sig.querySelector('.time-denominator');
      expect(numerator.querySelector('path')).not.toBeNull();
      expect(denominator.querySelector('path')).not.toBeNull();
    });

    // Clefs must render as Bravura SMuFL path glyphs. Pin via path
    // d-string signatures unique to each Bravura clef.
    it('renders treble + bass clefs as Bravura path glyphs', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });
      const treble = ctx.container.querySelector('.clef-treble path');
      const bass = ctx.container.querySelector('.clef-bass path');
      expect(treble).not.toBeNull();
      expect(bass).not.toBeNull();
      // Bravura gClef path begins with M376; fClef begins with M252.
      expect(treble.getAttribute('d').startsWith('M376')).toBe(true);
      expect(bass.getAttribute('d').startsWith('M252')).toBe(true);
    });

    // Rests must render as Bravura SMuFL path glyphs, not hand-rolled
    // squiggles. Pin via path d-string signature unique to Bravura's
    // rest16th: it contains the substring 'C292' from one of its bezier
    // control points which our hand-rolled path does not.
    it('renders 16th rests as Bravura path glyphs', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [{ length: '1/16' }, { pitch: 'C4', length: '1/4' }],
      });
      const rest = ctx.container.querySelector('.rest-16th .rest-symbol');
      expect(rest).not.toBeNull();
      const path = rest.querySelector('path') || rest;
      // Bravura rest16th signature: bbox max-x is 320 fu.
      expect(path.getAttribute('d')).toContain('320');
    });

    // Standard engraving (Gould): beamed-note stems pass *through* the
    // beam, terminating at its outer edge — not at the inner edge where
    // the beam first contacts the stem. Pin: render two same-pitch 8ths,
    // compare stem y2 (absolute) against the beam path's outer Y vertex.
    it('extends beamed stems through the beam to its far edge', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C5', length: '1/8' },
          { pitch: 'C5', length: '1/8' },
        ],
      });
      const note = ctx.container.querySelector('.note');
      const stem = note.querySelector('.note-stem');
      const beam = ctx.container.querySelector('.beam');
      const noteY = parseFloat(note.getAttribute('transform').match(/translate\([-\d.]+,\s*([-\d.]+)\)/)[1]);
      const stemY2Abs = noteY + parseFloat(stem.getAttribute('y2'));
      const beamYs = beam.getAttribute('d').match(/-?[\d.]+/g).map(Number)
        .filter((_, i) => i % 2 === 1);
      // C5 in treble is above middle line → stem-down → beam below stems
      // → far edge = max Y of beam path.
      const beamFarY = Math.max(...beamYs);
      expect(stemY2Abs).toBeCloseTo(beamFarY, 0);
    });

    // Standard engraving (Gould, Bravura): beams are ~0.5 staff space
    // thick — half the height of a notehead, so they read as a strong
    // horizontal/diagonal mark. With LINE_SPACING=20px that's ~10px;
    // thinner beams (e.g. 4px) read as wireframes. Pin via path geometry:
    // render two same-pitch 8ths, expect the (flat) beam parallelogram to
    // span ≥ 8px vertically.
    it('renders beams at ~0.5 staff space thickness', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'C4', length: '1/8' },
        ],
      });
      const beam = ctx.container.querySelector('.beam');
      expect(beam).not.toBeNull();
      const yValues = beam.getAttribute('d').match(/-?[\d.]+/g).map(Number)
        .filter((_, i) => i % 2 === 1); // every other = Y
      const thickness = Math.max(...yValues) - Math.min(...yValues);
      expect(thickness).toBeGreaterThanOrEqual(8);
    });

    // Multi-digit time signatures (e.g. 12/8) render one glyph per digit.
    it('renders one glyph per digit in multi-digit time signatures', () => {
      ctx.render({ timeSignature: [12, 8], notes: [{ pitch: 'C4', length: '1/4' }] });
      const numerator = ctx.container.querySelector('.time-numerator');
      // "12" → two digit glyphs.
      expect(numerator.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('staff lines', () => {
    it('renders staff lines for each voice', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const staffLines = ctx.container.querySelector('.staff-lines');
      expect(staffLines).not.toBeNull();
      expect(staffLines.querySelectorAll('.staff-line')).toHaveLength(5);
    });

    // Pin the STAFF_TOP_OFFSET site: the offset is applied to .staff-lines
    // only — never duplicated on a parent — otherwise components get a double
    // offset (see resound-fe/CLAUDE.md "Notation Coordinate System"). Note
    // y-positions are computed independently of where staff lines render, so
    // a misplaced offset is a visual-only bug the suite's other position
    // assertions can't catch. Pinning the exact .staff-lines transform value
    // catches the regression class in either direction (offset removed from
    // .staff-lines, or duplicated on parent + child).
    it('applies STAFF_TOP_OFFSET to .staff-lines and only to .staff-lines', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);

      const staffLines = ctx.container.querySelector('.staff-lines');
      expect(staffLines.getAttribute('transform')).toBe('translate(0, 10)');
    });

    // Staff lines must be visibly rendered. SVG <line> defaults to stroke="none",
    // so without an explicit stroke attribute (or a stylesheet the consumer must
    // remember to ship), the staff is invisible in any environment that just
    // mounts the SVG and renders. Sibling primitives (note-stem, ledger-line)
    // already use inline stroke="currentColor"; staff lines should match so the
    // library renders correctly out of the box and themes via CSS color.
    it('renders staff lines with a visible stroke', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const lines = ctx.container.querySelectorAll('.staff-line');
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const stroke = line.getAttribute('stroke');
        expect(stroke).toBeTruthy();
        expect(stroke).not.toBe('none');
      }
    });
  });

  describe('staff groups', () => {
    it('creates a staff group with voice data attribute', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const staff = ctx.container.querySelector('.staff');
      expect(staff).not.toBeNull();
      expect(staff.getAttribute('data-voice-id')).toBe('0');
    });

    it('creates a staff group per voice in multi-voice input', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const staves = ctx.container.querySelectorAll('.staff');
      expect(staves).toHaveLength(2);
      expect(staves[0].getAttribute('data-voice-id')).toBe('0');
      expect(staves[1].getAttribute('data-voice-id')).toBe('1');
    });

    it('uses custom voice ids in multi-voice input', () => {
      ctx.render({
        voices: [
          { id: 'melody', clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { id: 'bass', clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const staves = ctx.container.querySelectorAll('.staff');
      expect(staves[0].getAttribute('data-voice-id')).toBe('melody');
      expect(staves[1].getAttribute('data-voice-id')).toBe('bass');
    });
  });

  describe('clef inference', () => {
    it('infers treble clef for notes at or above C4', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      const staff = ctx.container.querySelector('.staff');
      expect(staff.getAttribute('data-clef')).toBe('treble');
    });

    it('infers bass clef for notes below C4', () => {
      ctx.render([
        { pitch: 'C3', length: '1/4' },
        { pitch: 'E3', length: '1/4' },
        { pitch: 'G3', length: '1/4' },
      ]);

      const staff = ctx.container.querySelector('.staff');
      expect(staff.getAttribute('data-clef')).toBe('bass');
    });

    it('uses explicit clef when provided', () => {
      ctx.render({
        clef: 'bass',
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      });

      const staff = ctx.container.querySelector('.staff');
      expect(staff.getAttribute('data-clef')).toBe('bass');
    });
  });

  describe('rest rendering', () => {
    it('renders rest elements when pitch is omitted', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      expect(ctx.getRests()).toHaveLength(1);
    });

    it('renders rest with correct duration class', () => {
      ctx.render([{ length: '1/2' }]);
      const rest = ctx.getRests()[0];
      expect(rest.classList.contains('rest-half')).toBe(true);
    });

    it('renders multiple rests', () => {
      ctx.render([
        { length: '1/4' },
        { pitch: 'C4', length: '1/4' },
        { length: '1/8' },
        { length: '1/8' },
      ]);

      expect(ctx.getRests()).toHaveLength(3);
      expect(ctx.getNotes()).toHaveLength(1);
    });

    it('advances cursor past rests correctly', () => {
      ctx.render([{ length: '1/4' }, { pitch: 'C4', length: '1/4' }]);

      // The note should be positioned after the rest
      const note = ctx.getNotes()[0];
      const rest = ctx.getRests()[0];
      const noteX = parseFloat(note.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const restX = parseFloat(rest.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      expect(noteX).toBeGreaterThan(restX);
    });
  });

  describe('clef rendering', () => {
    it('renders a clef element for each staff', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const clef = ctx.getClef();
      expect(clef).not.toBeNull();
    });

    it('renders treble clef with correct class', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);
      const clef = ctx.getClef();
      expect(clef.classList.contains('clef-treble')).toBe(true);
    });

    it('renders bass clef with correct class', () => {
      ctx.render([
        { pitch: 'C3', length: '1/4' },
        { pitch: 'E3', length: '1/4' },
      ]);
      const clef = ctx.getClef();
      expect(clef.classList.contains('clef-bass')).toBe(true);
    });

    it('renders a clef for each voice in multi-voice input', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const clefs = ctx.container.querySelectorAll('.clef');
      expect(clefs).toHaveLength(2);
      expect(clefs[0].classList.contains('clef-treble')).toBe(true);
      expect(clefs[1].classList.contains('clef-bass')).toBe(true);
    });

    it('places the clef before notes (notes start after clef width)', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);

      const clef = ctx.getClef();
      const note = ctx.getNotes()[0];
      const clefTransform = clef.getAttribute('transform');
      const noteTransform = note.getAttribute('transform');

      // Extract x values from translate(x, y)
      const clefX = parseFloat(clefTransform.match(/translate\(([^,]+)/)[1]);
      const noteX = parseFloat(noteTransform.match(/translate\(([^,]+)/)[1]);
      expect(noteX).toBeGreaterThan(clefX);
    });
  });

  describe('ledger lines', () => {
    it('renders ledger lines for middle C in treble clef', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      // C4 in treble is at y=110 — needs one ledger line
      expect(ctx.getLedgerLines().length).toBeGreaterThan(0);
    });

    it('does not render ledger lines for notes within the staff', () => {
      ctx.render([
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
        { pitch: 'B4', length: '1/4' },
      ]);
      // E4=y90, G4=y70, B4=y50 — all on staff lines
      expect(ctx.getLedgerLines()).toHaveLength(0);
    });

    it('renders ledger lines for notes above the staff', () => {
      ctx.render([{ pitch: 'A5', length: '1/4' }]);
      // A5 in treble is at y=-10 — needs one ledger line
      expect(ctx.getLedgerLines().length).toBeGreaterThan(0);
    });

    it('renders multiple ledger lines for extreme notes', () => {
      ctx.render([{ pitch: 'C6', length: '1/4' }]);
      // C6 in treble is at y=-30 — needs two ledger lines
      const ledgerLines = ctx.getLedgerLines();
      expect(ledgerLines.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('accidental rendering', () => {
    it('renders a sharp accidental for F#4', () => {
      ctx.render([{ pitch: 'F#4', length: '1/4' }]);
      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(1);
      expect(accidentals[0].classList.contains('sharp')).toBe(true);
    });

    it('renders a flat accidental for Bb3', () => {
      ctx.render([{ pitch: 'Bb3', length: '1/4' }]);
      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(1);
      expect(accidentals[0].classList.contains('flat')).toBe(true);
    });

    it('does not render accidentals for natural notes', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);
      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(0);
    });

    it('renders accidentals for each note that has one', () => {
      ctx.render([
        { pitch: 'F#4', length: '1/4' },
        { pitch: 'C4', length: '1/4' },
        { pitch: 'Bb4', length: '1/4' },
      ]);
      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(2);
    });

    it('positions accidental to the left of the note', () => {
      ctx.render([{ pitch: 'F#4', length: '1/4' }]);
      const accidental = ctx.container.querySelector('.accidental');
      const note = ctx.getNotes()[0];

      const accX = parseFloat(accidental.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const noteX = parseFloat(note.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      expect(accX).toBeLessThan(noteX);
    });

    // Per Gould "Behind Bars" (Accidentals chapter): an accidental needs
    // legible breathing room from the preceding element. When the prior
    // element is a beamed sibling (no clef/barline buffer in between), the
    // gap looks tightest, so we require an extra-wide offset there — at
    // least ~1.5 staff spaces (30px @ 20px/sp) between the prior
    // notehead's right edge and the accidental's left edge. Notehead
    // half-width ≈ 6px (SMuFL noteheadBlack); sharp glyph half-width
    // ≈ 10px (bbox 0..249 × SMUFL_SCALE 0.08).
    it('leaves a legible gap between a beamed note and the next note\'s accidental', () => {
      // Pack the measure with 8 beamed eighths (matching the
      // accidentals-sweep preset density) so the spacing between beamed
      // siblings is tight — that's where the gap regression shows up.
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'C#4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'Eb4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'F#4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
        ],
      });

      const notes = ctx.getNotes();
      const accidental = ctx.container.querySelector('.accidental.sharp');
      expect(accidental).not.toBeNull();

      const prevNoteX = parseFloat(
        notes[0].getAttribute('transform').match(/translate\(([^,]+)/)[1]
      );
      const accX = parseFloat(
        accidental.getAttribute('transform').match(/translate\(([^,]+)/)[1]
      );

      const NOTEHEAD_HALF = 6;
      const SHARP_HALF = 10;
      const MIN_GAP = 30;
      const prevRightEdge = prevNoteX + NOTEHEAD_HALF;
      const accLeftEdge = accX - SHARP_HALF;
      expect(accLeftEdge - prevRightEdge).toBeGreaterThanOrEqual(MIN_GAP);
    });
  });

  describe('Level 2 input', () => {
    it('renders notes from Level 2 input format', () => {
      ctx.render({
        clef: 'treble',
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      });

      expect(ctx.getNotes()).toHaveLength(3);
    });
  });

  describe('Level 3 input', () => {
    it('renders notes from each voice', () => {
      ctx.render({
        voices: [
          {
            clef: 'treble',
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'E5', length: '1/4' },
            ],
          },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/2' }] },
        ],
      });

      expect(ctx.getNotes()).toHaveLength(3);
    });
  });

  describe('containerless rendering', () => {
    it('works without a container', () => {
      const { NotationRenderer } = require('./NotationRenderer.js');
      const renderer = new NotationRenderer({});
      const svg = renderer.render([{ pitch: 'C4', length: '1/4' }]);

      expect(svg).not.toBeNull();
      expect(svg.tagName).toBe('svg');
      expect(renderer.getSvgElement()).toBe(svg);

      renderer.clear();
    });
  });

  describe('beam rendering', () => {
    it('does not create beam groups in unmetered mode', () => {
      ctx.render([
        { pitch: 'C4', length: '1/8' },
        { pitch: 'D4', length: '1/8' },
      ]);
      expect(ctx.getBeamGroups()).toHaveLength(0);
    });

    it('creates a beam group for two eighth notes in the same beat', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/4' },
        ],
      });
      expect(ctx.getBeamGroups()).toHaveLength(1);
    });

    it('creates two beam groups for eighth notes across two beats', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
        ],
      });
      expect(ctx.getBeamGroups()).toHaveLength(2);
    });

    it('beam groups contain the beamed notes', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
        ],
      });
      const beamGroup = ctx.getBeamGroups()[0];
      const notes = beamGroup.querySelectorAll('.note');
      expect(notes).toHaveLength(2);
    });

    it('beam groups contain beam path elements', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
        ],
      });
      const beamGroup = ctx.getBeamGroups()[0];
      const beams = beamGroup.querySelectorAll('.beam');
      expect(beams.length).toBeGreaterThanOrEqual(1);
    });

    it('beamed notes do not have flags', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
        ],
      });
      const beamGroup = ctx.getBeamGroups()[0];
      const flags = beamGroup.querySelectorAll('.note-flag');
      expect(flags).toHaveLength(0);
    });

    it('non-beamed eighth notes still have flags', () => {
      // In unmetered mode, all notes get individual flags
      ctx.render([
        { pitch: 'C4', length: '1/8' },
        { pitch: 'D4', length: '1/8' },
      ]);
      const flags = ctx.container.querySelectorAll('.note-flag');
      expect(flags).toHaveLength(2);
    });

    it('renders beam groups alongside non-beamed notes', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
        ],
      });
      expect(ctx.getBeamGroups()).toHaveLength(1);
      expect(ctx.getNotes()).toHaveLength(4);
    });

    it('beams 16th notes with two beam levels', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/16' },
          { pitch: 'D4', length: '1/16' },
          { pitch: 'E4', length: '1/16' },
          { pitch: 'F4', length: '1/16' },
        ],
      });
      const beamGroup = ctx.getBeamGroups()[0];
      const beams = beamGroup.querySelectorAll('.beam');
      expect(beams).toHaveLength(2); // primary + secondary
    });

    it('groups three eighth notes in 6/8 compound time', () => {
      ctx.render({
        timeSignature: [6, 8],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
        ],
      });
      expect(ctx.getBeamGroups()).toHaveLength(2);
      const firstGroup = ctx.getBeamGroups()[0];
      expect(firstGroup.querySelectorAll('.note')).toHaveLength(3);
    });
  });

  describe('bar line rendering', () => {
    // Counts in this block include the auto-appended thin final barline at
    // the end of the system (Gould "Behind Bars": every system terminates
    // at a barline, so the staff lines don't trail off into empty space).
    // Internal/measure-boundary barlines are unchanged.
    it('does not render bar lines when no time signature is set', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
        { pitch: 'C5', length: '1/4' },
      ]);
      // Just the final barline (no measure boundaries without a time sig).
      expect(ctx.getBarLines()).toHaveLength(1);
    });

    it('renders a bar line after one complete measure in 4/4', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          // bar line here
          { pitch: 'G4', length: '1/4' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('renders two bar lines for two complete measures', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          // bar line
          { pitch: 'G4', length: '1/4' },
          { pitch: 'A4', length: '1/4' },
          { pitch: 'B4', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
          // bar line
          { pitch: 'D5', length: '1/4' },
        ],
      });
      // 2 measure-boundaries + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(3);
    });

    it('renders bar lines in 3/4 time', () => {
      ctx.render({
        timeSignature: [3, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          // bar line after 3 beats
          { pitch: 'F4', length: '1/4' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('handles half notes in bar line tracking', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/2' },
          { pitch: 'E4', length: '1/2' },
          // bar line after 4 beats (2 half notes)
          { pitch: 'G4', length: '1/4' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('handles whole notes in bar line tracking', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/1' },
          // bar line after 4 beats (1 whole note)
          { pitch: 'G4', length: '1/4' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('handles eighth notes in bar line tracking', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
          { pitch: 'B4', length: '1/8' },
          { pitch: 'C5', length: '1/8' },
          // bar line after 8 eighth notes = 4 beats
          { pitch: 'D5', length: '1/4' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('tracks rests for bar line calculation', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { length: '1/4' },
          // bar line
          { pitch: 'G4', length: '1/4' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('renders no bar lines if music does not fill a complete measure', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
        ],
      });
      // No measure-boundaries (incomplete measure) but the final barline
      // still terminates the system.
      expect(ctx.getBarLines()).toHaveLength(1);
    });

    it('handles 6/8 time signature', () => {
      ctx.render({
        timeSignature: [6, 8],
        notes: [
          // 6 eighth notes = 1 measure of 6/8
          { pitch: 'C4', length: '1/8' },
          { pitch: 'D4', length: '1/8' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
          // bar line
          { pitch: 'B4', length: '1/8' },
        ],
      });
      // 1 measure-boundary + 1 final barline.
      expect(ctx.getBarLines()).toHaveLength(2);
    });
  });

  describe('time signature rendering', () => {
    it('does not render a time signature when not specified', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(ctx.getTimeSignature()).toBeNull();
    });

    it('renders a time signature when specified', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [{ pitch: 'C4', length: '1/4' }],
      });
      expect(ctx.getTimeSignature()).not.toBeNull();
    });

    it('renders correct numerator and denominator', () => {
      ctx.render({
        timeSignature: [3, 4],
        notes: [{ pitch: 'C4', length: '1/4' }],
      });
      const timeSig = ctx.getTimeSignature();
      expect(timeSig.getAttribute('data-beats')).toBe('3');
      expect(timeSig.getAttribute('data-beat-value')).toBe('4');
    });

    it('positions time signature after key signature', () => {
      ctx.render({
        keySignature: 'G',
        timeSignature: [4, 4],
        notes: [{ pitch: 'C4', length: '1/4' }],
      });

      const keySig = ctx.getKeySignature();
      const timeSig = ctx.getTimeSignature();
      const keySigX = parseFloat(keySig.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const timeSigX = parseFloat(timeSig.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      expect(timeSigX).toBeGreaterThan(keySigX);
    });

    it('positions time signature after clef when no key signature', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [{ pitch: 'C4', length: '1/4' }],
      });

      const clef = ctx.getClef();
      const timeSig = ctx.getTimeSignature();
      const clefX = parseFloat(clef.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const timeSigX = parseFloat(timeSig.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      expect(timeSigX).toBeGreaterThan(clefX);
    });

    it('positions notes after time signature', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [{ pitch: 'C4', length: '1/4' }],
      });

      const timeSig = ctx.getTimeSignature();
      const note = ctx.getNotes()[0];
      const timeSigX = parseFloat(timeSig.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const noteX = parseFloat(note.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      expect(noteX).toBeGreaterThan(timeSigX);
    });

    it('renders time signature per voice in multi-voice input', () => {
      ctx.render({
        timeSignature: [4, 4],
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const timeSigs = ctx.container.querySelectorAll('.time-signature');
      expect(timeSigs).toHaveLength(2);
    });

    it('allows per-voice time signature override', () => {
      ctx.render({
        timeSignature: [4, 4],
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', timeSignature: [3, 4], notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const timeSigs = ctx.container.querySelectorAll('.time-signature');
      expect(timeSigs).toHaveLength(2);
      expect(timeSigs[0].getAttribute('data-beats')).toBe('4');
      expect(timeSigs[1].getAttribute('data-beats')).toBe('3');
    });
  });

  describe('key signature rendering', () => {
    it('does not render a key signature for key of C', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(ctx.getKeySignature()).toBeNull();
    });

    it('does not render a key signature when no key is specified (defaults to C)', () => {
      ctx.render({
        notes: [{ pitch: 'C4', length: '1/4' }],
      });
      expect(ctx.getKeySignature()).toBeNull();
    });

    it('renders a key signature when key is specified', () => {
      ctx.render({
        keySignature: 'G',
        notes: [{ pitch: 'C4', length: '1/4' }],
      });
      expect(ctx.getKeySignature()).not.toBeNull();
    });

    it('positions key signature after clef', () => {
      ctx.render({
        keySignature: 'G',
        notes: [{ pitch: 'C4', length: '1/4' }],
      });

      const clef = ctx.getClef();
      const keySig = ctx.getKeySignature();
      const clefX = parseFloat(clef.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const keySigX = parseFloat(keySig.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      expect(keySigX).toBeGreaterThan(clefX);
    });

    it('positions notes after key signature', () => {
      ctx.render({
        keySignature: 'D',
        notes: [{ pitch: 'C4', length: '1/4' }],
      });

      const keySig = ctx.getKeySignature();
      const note = ctx.getNotes()[0];
      const keySigX = parseFloat(keySig.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      const noteX = parseFloat(note.getAttribute('transform').match(/translate\(([^,]+)/)[1]);
      // D major has 2 sharps, key sig at x=50, width=20, so note should start at x=70
      expect(noteX).toBeGreaterThan(keySigX);
    });

    it('renders key signature per voice in multi-voice input', () => {
      ctx.render({
        keySignature: 'G',
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const keySigs = ctx.container.querySelectorAll('.key-signature');
      expect(keySigs).toHaveLength(2);
    });

    it('allows per-voice key signature override', () => {
      ctx.render({
        keySignature: 'G',
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', keySignature: 'F', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const keySigs = ctx.container.querySelectorAll('.key-signature');
      expect(keySigs).toHaveLength(2);
      // First voice: G major (1 sharp), second voice: F major (1 flat)
      const firstAccidentals = keySigs[0].querySelectorAll('.accidental');
      const secondAccidentals = keySigs[1].querySelectorAll('.accidental');
      expect(firstAccidentals).toHaveLength(1);
      expect(firstAccidentals[0].classList.contains('sharp')).toBe(true);
      expect(secondAccidentals).toHaveLength(1);
      expect(secondAccidentals[0].classList.contains('flat')).toBe(true);
    });
  });

  describe('tie rendering', () => {
    it('does not render ties when no tie properties are present', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'C4', length: '1/4' },
      ]);
      expect(ctx.getTies()).toHaveLength(0);
    });

    it('renders a tie arc between two tied notes', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      expect(ctx.getTies()).toHaveLength(1);
    });

    it('renders both noteheads even when tied', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      expect(ctx.getNotes()).toHaveLength(2);
      expect(ctx.getTies()).toHaveLength(1);
    });

    it('renders two arcs for a three-note tie chain', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'continue' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      expect(ctx.getTies()).toHaveLength(2);
    });

    it('renders three arcs for a four-note tie chain', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'continue' },
        { pitch: 'C4', length: '1/4', tie: 'continue' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      expect(ctx.getTies()).toHaveLength(3);
    });

    it('places tie arcs inside a .ties container', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      const tiesGroup = ctx.container.querySelector('.ties');
      expect(tiesGroup).not.toBeNull();
      expect(tiesGroup.querySelectorAll('.tie')).toHaveLength(1);
    });

    it('tie arc has a valid path with cubic bezier', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      const tie = ctx.getTies()[0];
      const d = tie.getAttribute('d');
      expect(d).toMatch(/^M\s/);
      expect(d).toMatch(/C\s/);
    });

    it('tie arc uses filled styling (engraver-quality variable thickness)', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'C4', length: '1/4', tie: 'stop' },
      ]);
      const tie = ctx.getTies()[0];
      expect(tie.getAttribute('fill')).toBe('currentColor');
      expect(tie.getAttribute('stroke')).toBe('none');
    });

    it('renders tie across a bar line', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
          { pitch: 'G4', length: '1/4', tie: 'start' },
          { pitch: 'G4', length: '1/4', tie: 'stop' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'C4', length: '1/2' },
        ],
      });
      expect(ctx.getTies()).toHaveLength(1);
      expect(ctx.getBarLines().length).toBeGreaterThan(0);
    });

    it('renders tie with dotted notes', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', dotted: true, tie: 'start' },
        { pitch: 'C4', length: '1/8', tie: 'stop' },
      ]);
      expect(ctx.getTies()).toHaveLength(1);
      expect(ctx.getNotes()).toHaveLength(2);
    });

    it('does not render tie when pitches do not match', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', tie: 'start' },
        { pitch: 'D4', length: '1/4', tie: 'stop' },
      ]);
      expect(ctx.getTies()).toHaveLength(0);
    });

    it('does not render .ties container when there are no ties', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);
      const tiesGroup = ctx.container.querySelector('.ties');
      expect(tiesGroup).toBeNull();
    });
  });

  describe('data-beat attributes', () => {
    it('assigns data-beat to each note based on cumulative beats', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      const notes = ctx.getNotes();
      expect(notes[0].dataset.beat).toBe('0');
      expect(notes[1].dataset.beat).toBe('1');
      expect(notes[2].dataset.beat).toBe('2');
    });

    it('assigns data-beat to rests', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      const rests = ctx.getRests();
      expect(rests[0].dataset.beat).toBe('1');

      const notes = ctx.getNotes();
      expect(notes[1].dataset.beat).toBe('2');
    });

    it('accounts for different note durations in beat calculation', () => {
      ctx.render([
        { pitch: 'C4', length: '1/2' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/8' },
      ]);

      const notes = ctx.getNotes();
      expect(notes[0].dataset.beat).toBe('0');
      expect(notes[1].dataset.beat).toBe('2');
      expect(notes[2].dataset.beat).toBe('3');
    });

    it('accounts for dotted note durations in beat calculation', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4', dotted: true },
        { pitch: 'E4', length: '1/8' },
      ]);

      const notes = ctx.getNotes();
      expect(notes[0].dataset.beat).toBe('0');
      expect(notes[1].dataset.beat).toBe('1.5');
    });
  });

  describe('playback position', () => {
    it('highlights the note at the given beat', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(1);
      const active = ctx.getActiveNote();
      expect(active).not.toBeNull();
      expect(active.dataset.beat).toBe('1');
    });

    it('highlights the first note at beat 0', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(0);
      const active = ctx.getActiveNote();
      expect(active).not.toBeNull();
      expect(active.dataset.beat).toBe('0');
    });

    it('removes highlight when position is set to null', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(0);
      expect(ctx.getActiveNote()).not.toBeNull();

      ctx.renderer.setPlaybackPosition(null);
      expect(ctx.getActiveNote()).toBeNull();
    });

    it('moves highlight when position changes', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(0);
      expect(ctx.getActiveNote().dataset.beat).toBe('0');

      ctx.renderer.setPlaybackPosition(2);
      expect(ctx.getActiveNote().dataset.beat).toBe('2');

      // Only one note should be active at a time
      const allActive = ctx.container.querySelectorAll('.note-active');
      expect(allActive).toHaveLength(1);
    });

    it('highlights a note when beat falls within its duration', () => {
      ctx.render([
        { pitch: 'C4', length: '1/2' },
        { pitch: 'E4', length: '1/4' },
      ]);

      // Beat 0.5 falls within the half note (beats 0-2)
      ctx.renderer.setPlaybackPosition(0.5);
      const active = ctx.getActiveNote();
      expect(active).not.toBeNull();
      expect(active.dataset.beat).toBe('0');
    });

    it('renders a playback cursor line', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(0);
      const cursor = ctx.container.querySelector('.playback-cursor');
      expect(cursor).not.toBeNull();
    });

    it('removes cursor line when position is null', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(0);
      expect(ctx.container.querySelector('.playback-cursor')).not.toBeNull();

      ctx.renderer.setPlaybackPosition(null);
      expect(ctx.container.querySelector('.playback-cursor')).toBeNull();
    });

    it('does nothing when called before render', () => {
      expect(() => ctx.renderer.setPlaybackPosition(0)).not.toThrow();
    });

    it('highlights note in specific voice with voiceId option', () => {
      ctx.render({
        voices: [
          {
            id: 'melody',
            clef: 'treble',
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'E5', length: '1/4' },
            ],
          },
          { id: 'bass', clef: 'bass', notes: [{ pitch: 'C3', length: '1/2' }] },
        ],
      });

      ctx.renderer.setPlaybackPosition(1, { voiceId: 'melody' });
      const active = ctx.container.querySelectorAll('.note-active');
      expect(active).toHaveLength(1);
      expect(active[0].dataset.beat).toBe('1');
    });
  });

  describe('chord rendering', () => {
    it('renders a chord as a single .note element with .chord class', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
        ],
      ]);

      const notes = ctx.getNotes();
      expect(notes).toHaveLength(1);
      expect(notes[0].classList.contains('chord')).toBe(true);
    });

    it('renders a note head for each pitch in the chord', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
        ],
      ]);

      const heads = ctx.container.querySelectorAll('.note-head');
      expect(heads).toHaveLength(3);
    });

    it('renders a single stem for the chord', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'G4', length: '1/4' },
        ],
      ]);

      const stems = ctx.container.querySelectorAll('.note-stem');
      expect(stems).toHaveLength(1);
    });

    it('assigns data-beat to chord', () => {
      ctx.render([
        { pitch: 'D4', length: '1/4' },
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      ]);

      const notes = ctx.getNotes();
      expect(notes[1].dataset.beat).toBe('1');
    });

    it('uses the correct duration class from the chord notes', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/2' },
          { pitch: 'E4', length: '1/2' },
          { pitch: 'G4', length: '1/2' },
        ],
      ]);

      const note = ctx.getNotes()[0];
      expect(note.classList.contains('note-half')).toBe(true);
    });

    it('advances cursor correctly after a chord', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
        { pitch: 'G4', length: '1/4' },
      ]);

      const notes = ctx.getNotes();
      expect(notes).toHaveLength(2);
      // Second note should be after the chord's spacing
      expect(notes[1].dataset.beat).toBe('1');
    });

    it('renders accidentals for chord notes', () => {
      ctx.render([
        [
          { pitch: 'C#4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      ]);

      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(1);
    });

    it('renders multiple accidentals for chord notes', () => {
      ctx.render([
        [
          { pitch: 'F#4', length: '1/4' },
          { pitch: 'Bb4', length: '1/4' },
        ],
      ]);

      const accidentals = ctx.container.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(2);
    });

    it('renders ledger lines for chord notes outside the staff', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      ]);

      // C4 in treble needs a ledger line
      const ledgerLines = ctx.getLedgerLines();
      expect(ledgerLines.length).toBeGreaterThan(0);
    });

    it('renders chords alongside regular notes', () => {
      ctx.render([
        { pitch: 'D4', length: '1/4' },
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
        { pitch: 'G4', length: '1/4' },
      ]);

      const notes = ctx.getNotes();
      expect(notes).toHaveLength(3);
      expect(notes[1].classList.contains('chord')).toBe(true);
      expect(notes[0].classList.contains('chord')).toBe(false);
    });

    it('renders ties for chord notes', () => {
      ctx.render([
        [
          { pitch: 'C4', length: '1/4', tie: 'start' },
          { pitch: 'E4', length: '1/4', tie: 'start' },
        ],
        [
          { pitch: 'C4', length: '1/4', tie: 'stop' },
          { pitch: 'E4', length: '1/4', tie: 'stop' },
        ],
      ]);

      expect(ctx.getTies()).toHaveLength(2);
    });

    it('tracks bar lines correctly with chords', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          [
            { pitch: 'C4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
          ],
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          // bar line after 4 beats
          { pitch: 'G4', length: '1/4' },
        ],
      });

      // 1 measure-boundary + 1 final barline (auto-appended).
      expect(ctx.getBarLines()).toHaveLength(2);
    });

    it('highlights chord during playback', () => {
      ctx.render([
        { pitch: 'D4', length: '1/4' },
        [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
        ],
      ]);

      ctx.renderer.setPlaybackPosition(1);
      const active = ctx.getActiveNote();
      expect(active).not.toBeNull();
      expect(active.classList.contains('chord')).toBe(true);
    });
  });

  describe('percussion notes', () => {
    it('infers percussion clef when all notes use position', () => {
      ctx.render([
        { position: 5, length: '1/4' },
        { position: 1, length: '1/4' },
      ]);

      const staff = ctx.container.querySelector('.staff');
      expect(staff.getAttribute('data-clef')).toBe('percussion');
    });

    it('renders percussion clef symbol', () => {
      ctx.render([{ position: 5, length: '1/4' }]);

      const clef = ctx.getClef();
      expect(clef).not.toBeNull();
      expect(clef.classList.contains('clef-percussion')).toBe(true);
    });

    it('renders percussion notes as .note elements', () => {
      ctx.render([
        { position: 5, length: '1/4' },
        { position: 1, length: '1/4' },
        { position: 9, length: '1/4' },
      ]);

      expect(ctx.getNotes()).toHaveLength(3);
    });

    it('renders X-shaped noteheads for percussion notes', () => {
      ctx.render([{ position: 5, length: '1/4' }]);

      const xHeads = ctx.container.querySelectorAll('.note-head-x');
      expect(xHeads).toHaveLength(1);
    });

    it('does not render ellipse noteheads for percussion notes', () => {
      ctx.render([{ position: 5, length: '1/4' }]);

      const ellipseHeads = ctx.container.querySelectorAll('.note-head');
      expect(ellipseHeads).toHaveLength(0);
    });

    it('positions percussion notes on correct staff positions', () => {
      ctx.render([
        { position: 1, length: '1/4' },
        { position: 9, length: '1/4' },
      ]);

      const notes = ctx.getNotes();
      // Position 1 = bottom line (y=90), position 9 = top line (y=10)
      const y1 = parseFloat(notes[0].getAttribute('transform').match(/,\s*([^)]+)/)[1]);
      const y9 = parseFloat(notes[1].getAttribute('transform').match(/,\s*([^)]+)/)[1]);
      expect(y1).toBeGreaterThan(y9);
    });

    it('assigns data-beat to percussion notes', () => {
      ctx.render([
        { position: 5, length: '1/4' },
        { position: 1, length: '1/4' },
      ]);

      const notes = ctx.getNotes();
      expect(notes[0].dataset.beat).toBe('0');
      expect(notes[1].dataset.beat).toBe('1');
    });

    it('renders percussion notes with stems', () => {
      ctx.render([{ position: 5, length: '1/4' }]);

      const stems = ctx.container.querySelectorAll('.note-stem');
      expect(stems).toHaveLength(1);
    });

    it('renders rests between percussion notes', () => {
      ctx.render([
        { position: 5, length: '1/4' },
        { length: '1/4' },
        { position: 1, length: '1/4' },
      ]);

      expect(ctx.getNotes()).toHaveLength(2);
      expect(ctx.getRests()).toHaveLength(1);
    });

    it('renders percussion notes with explicit percussion clef', () => {
      ctx.render({
        clef: 'percussion',
        notes: [
          { position: 5, length: '1/8' },
          { position: 5, length: '1/8' },
          { position: 1, length: '1/4' },
        ],
      });

      const xHeads = ctx.container.querySelectorAll('.note-head-x');
      expect(xHeads).toHaveLength(3);
      expect(ctx.getNotes()).toHaveLength(3);
    });

    it('supports percussion in multi-voice input', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'percussion', notes: [{ position: 5, length: '1/4' }] },
        ],
      });

      const staves = ctx.container.querySelectorAll('.staff');
      expect(staves).toHaveLength(2);
      expect(staves[0].getAttribute('data-clef')).toBe('treble');
      expect(staves[1].getAttribute('data-clef')).toBe('percussion');

      // Treble voice has ellipse head, percussion has X head
      const ellipseHeads = staves[0].querySelectorAll('.note-head');
      const xHeads = staves[1].querySelectorAll('.note-head-x');
      expect(ellipseHeads).toHaveLength(1);
      expect(xHeads).toHaveLength(1);
    });

    it('highlights percussion note during playback', () => {
      ctx.render([
        { position: 5, length: '1/4' },
        { position: 1, length: '1/4' },
      ]);

      ctx.renderer.setPlaybackPosition(1);
      const active = ctx.getActiveNote();
      expect(active).not.toBeNull();
      expect(active.dataset.beat).toBe('1');
    });
  });

  describe('multi-voice rendering', () => {
    it('offsets voices vertically with correct spacing', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const staves = ctx.container.querySelectorAll('.staff');
      const transform0 = staves[0].getAttribute('transform');
      const transform1 = staves[1].getAttribute('transform');

      // Voices centered vertically, spaced by VOICE_HEIGHT + VOICE_GAP (240)
      expect(transform0).toContain('translate(0, 50)');
      expect(transform1).toMatch(/translate\(0, 290\)/);
    });

    it('sizes SVG height for multiple voices', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const svg = ctx.getSvg();
      const height = parseInt(svg.getAttribute('height'), 10);
      // 2 voices * 200 + 1 gap * 40 = 440
      expect(height).toBe(440);
    });

    it('renders voices with different note counts independently', () => {
      ctx.render({
        voices: [
          {
            clef: 'treble',
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'D5', length: '1/4' },
              { pitch: 'E5', length: '1/4' },
            ],
          },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/2' }] },
        ],
      });

      // Total notes across both voices
      expect(ctx.getNotes()).toHaveLength(4);

      // Each voice has its own staff lines
      const staffLines = ctx.container.querySelectorAll('.staff-lines');
      expect(staffLines).toHaveLength(2);
    });

    it('renders bar lines independently per voice', () => {
      ctx.render({
        timeSignature: [4, 4],
        voices: [
          {
            clef: 'treble',
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'D5', length: '1/4' },
              { pitch: 'E5', length: '1/4' },
              { pitch: 'F5', length: '1/4' },
              // bar line
              { pitch: 'G5', length: '1/4' },
            ],
          },
          {
            clef: 'bass',
            notes: [
              { pitch: 'C3', length: '1/1' },
              // bar line
              { pitch: 'D3', length: '1/4' },
            ],
          },
        ],
      });

      // Each voice generates its own measure-boundary bar line plus the
      // auto-appended final barline (Gould "Behind Bars": every system
      // terminates at a barline) → 2 voices × 2 barlines = 4.
      const barLines = ctx.getBarLines();
      expect(barLines).toHaveLength(4);
    });

    it('renders chords in a multi-voice context', () => {
      ctx.render({
        voices: [
          {
            clef: 'treble',
            notes: [
              [
                { pitch: 'C5', length: '1/4' },
                { pitch: 'E5', length: '1/4' },
              ],
            ],
          },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      const notes = ctx.getNotes();
      expect(notes).toHaveLength(2);
    });

    it('highlights correct voice with voiceId option on multi-voice', () => {
      ctx.render({
        voices: [
          {
            id: 'melody',
            clef: 'treble',
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'D5', length: '1/4' },
            ],
          },
          {
            id: 'bass',
            clef: 'bass',
            notes: [
              { pitch: 'C3', length: '1/4' },
              { pitch: 'D3', length: '1/4' },
            ],
          },
        ],
      });

      // Highlight beat 0 in bass voice only
      ctx.renderer.setPlaybackPosition(0, { voiceId: 'bass' });
      const active = ctx.container.querySelectorAll('.note-active');
      expect(active).toHaveLength(1);

      // The active note should be in the bass staff
      const bassStaff = ctx.container.querySelectorAll('.staff')[1];
      expect(bassStaff.contains(active[0])).toBe(true);
    });

    it('highlights all voices when no voiceId is specified', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });

      // Without voiceId, both voices get checked
      ctx.renderer.setPlaybackPosition(0);
      const active = ctx.container.querySelectorAll('.note-active');
      // setPlaybackPosition finds the LAST matching note (iterates backwards)
      expect(active).toHaveLength(1);
    });
  });

  describe('grand staff rendering (staffGroups with brace)', () => {
    const grandStaffInput = {
      voices: [
        {
          id: 'treble',
          clef: 'treble',
          notes: [
            { pitch: 'C5', length: '1/4' },
            { pitch: 'E5', length: '1/4' },
          ],
        },
        {
          id: 'bass',
          clef: 'bass',
          notes: [
            { pitch: 'C3', length: '1/4' },
            { pitch: 'E3', length: '1/4' },
          ],
        },
      ],
      staffGroups: [{ type: 'brace', voiceIds: ['treble', 'bass'] }],
    };

    it('renders a brace element when staffGroups contains a brace', () => {
      ctx.render(grandStaffInput);
      const brace = ctx.container.querySelector('.brace');
      expect(brace).not.toBeNull();
    });

    it('does not render a brace when staffGroups is empty', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });
      const brace = ctx.container.querySelector('.brace');
      expect(brace).toBeNull();
    });

    it('renders two staff groups for a grand staff', () => {
      ctx.render(grandStaffInput);
      const staves = ctx.container.querySelectorAll('.staff');
      expect(staves).toHaveLength(2);
    });

    it('uses tighter spacing between grouped staves than independent staves', () => {
      // Grand staff (with brace grouping)
      ctx.render(grandStaffInput);
      const grandStaves = ctx.container.querySelectorAll('.staff');
      const grandY0 = parseFloat(
        grandStaves[0].getAttribute('transform').match(/translate\(0, ([^)]+)\)/)[1]
      );
      const grandY1 = parseFloat(
        grandStaves[1].getAttribute('transform').match(/translate\(0, ([^)]+)\)/)[1]
      );
      const grandGap = grandY1 - grandY0;

      ctx.renderer.clear();

      // Independent staves (no grouping)
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });
      const indStaves = ctx.container.querySelectorAll('.staff');
      const indY0 = parseFloat(
        indStaves[0].getAttribute('transform').match(/translate\(0, ([^)]+)\)/)[1]
      );
      const indY1 = parseFloat(
        indStaves[1].getAttribute('transform').match(/translate\(0, ([^)]+)\)/)[1]
      );
      const indGap = indY1 - indY0;

      expect(grandGap).toBeLessThan(indGap);
    });

    it('renders a bracket element when staffGroups contains a bracket', () => {
      ctx.render({
        voices: [
          { id: 'a', clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { id: 'b', clef: 'treble', notes: [{ pitch: 'G4', length: '1/4' }] },
          { id: 'c', clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
        staffGroups: [{ type: 'bracket', voiceIds: ['a', 'b', 'c'] }],
      });
      const bracket = ctx.container.querySelector('.bracket');
      expect(bracket).not.toBeNull();
      // Bracket should not also be rendered as a brace.
      expect(ctx.container.querySelector('.brace')).toBeNull();
    });

    it('renders shared bar lines for a bracket group', () => {
      ctx.render({
        voices: [
          {
            id: 'a',
            clef: 'treble',
            timeSignature: [4, 4],
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'D5', length: '1/4' },
              { pitch: 'E5', length: '1/4' },
              { pitch: 'F5', length: '1/4' },
              { pitch: 'G5', length: '1/4' },
            ],
          },
          {
            id: 'b',
            clef: 'bass',
            timeSignature: [4, 4],
            notes: [
              { pitch: 'C3', length: '1/1' },
              { pitch: 'D3', length: '1/4' },
            ],
          },
        ],
        staffGroups: [{ type: 'bracket', voiceIds: ['a', 'b'] }],
      });
      const sharedBarLines = ctx.container.querySelectorAll('.shared-bar-line');
      expect(sharedBarLines.length).toBeGreaterThan(0);
    });

    it('renders shared bar lines spanning both staves in a brace group', () => {
      ctx.render({
        voices: [
          {
            id: 'treble',
            clef: 'treble',
            timeSignature: [4, 4],
            notes: [
              { pitch: 'C5', length: '1/4' },
              { pitch: 'D5', length: '1/4' },
              { pitch: 'E5', length: '1/4' },
              { pitch: 'F5', length: '1/4' },
              { pitch: 'G5', length: '1/4' },
            ],
          },
          {
            id: 'bass',
            clef: 'bass',
            timeSignature: [4, 4],
            notes: [
              { pitch: 'C3', length: '1/1' },
              { pitch: 'D3', length: '1/4' },
            ],
          },
        ],
        staffGroups: [{ type: 'brace', voiceIds: ['treble', 'bass'] }],
      });

      const sharedBarLines = ctx.container.querySelectorAll('.shared-bar-line');
      expect(sharedBarLines.length).toBeGreaterThan(0);
    });

    it('renders notes correctly in both voices of a grand staff', () => {
      ctx.render(grandStaffInput);
      expect(ctx.getNotes()).toHaveLength(4);
    });

    it('renders a clef for each staff in the grand staff', () => {
      ctx.render(grandStaffInput);
      const clefs = ctx.container.querySelectorAll('.clef');
      expect(clefs).toHaveLength(2);
      expect(clefs[0].classList.contains('clef-treble')).toBe(true);
      expect(clefs[1].classList.contains('clef-bass')).toBe(true);
    });

    it('sets SVG height to accommodate the grand staff layout', () => {
      ctx.render(grandStaffInput);
      const svg = ctx.getSvg();
      const height = parseInt(svg.getAttribute('height'), 10);
      // Grand staff should be taller than single staff (200) but possibly
      // different from normal multi-voice height (440)
      expect(height).toBeGreaterThan(200);
    });
  });

  describe('system-start (initial) barline', () => {
    it('renders a per-staff system-start line at x=0 for a single voice', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const initials = ctx.container.querySelectorAll(
        '.staff-lines .system-start-bar-line'
      );
      expect(initials).toHaveLength(1);
      const line = initials[0];
      expect(line.getAttribute('x1')).toBe('0');
      expect(line.getAttribute('x2')).toBe('0');
      // Spans the staff (0..80 in staff-local coords)
      expect(line.getAttribute('y1')).toBe('0');
      expect(line.getAttribute('y2')).toBe('80');
    });

    it('renders one per-staff system-start line per staff for multi-voice independent', () => {
      ctx.render({
        voices: [
          { clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
      });
      const initials = ctx.container.querySelectorAll(
        '.staff-lines .system-start-bar-line'
      );
      expect(initials).toHaveLength(2);
    });

    it('renders a single tall shared system-start barline at x=0 for a brace group', () => {
      ctx.render({
        voices: [
          {
            id: 'treble',
            clef: 'treble',
            notes: [{ pitch: 'C5', length: '1/4' }],
          },
          {
            id: 'bass',
            clef: 'bass',
            notes: [{ pitch: 'C3', length: '1/4' }],
          },
        ],
        staffGroups: [{ type: 'brace', voiceIds: ['treble', 'bass'] }],
      });
      // Shared barlines at x=0 — there should be exactly one (the
      // system-start). Per-measure shared barlines won't land at x=0.
      const sharedLines = Array.from(
        ctx.container.querySelectorAll('.shared-bar-line line')
      ).filter((l) => l.getAttribute('x1') === '0');
      expect(sharedLines).toHaveLength(1);
      const y1 = parseFloat(sharedLines[0].getAttribute('y1'));
      const y2 = parseFloat(sharedLines[0].getAttribute('y2'));
      // The line spans from top of the first staff to bottom of the last
      // staff — taller than a single staff's 80px range.
      expect(y2 - y1).toBeGreaterThan(80);
    });

    it('renders a single tall shared system-start barline at x=0 for a bracket group', () => {
      ctx.render({
        voices: [
          { id: 'v1', clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { id: 'v2', clef: 'treble', notes: [{ pitch: 'C5', length: '1/4' }] },
          { id: 'v3', clef: 'bass', notes: [{ pitch: 'C3', length: '1/4' }] },
        ],
        staffGroups: [{ type: 'bracket', voiceIds: ['v1', 'v2', 'v3'] }],
      });
      const sharedLines = Array.from(
        ctx.container.querySelectorAll('.shared-bar-line line')
      ).filter((l) => l.getAttribute('x1') === '0');
      expect(sharedLines).toHaveLength(1);
      const y1 = parseFloat(sharedLines[0].getAttribute('y1'));
      const y2 = parseFloat(sharedLines[0].getAttribute('y2'));
      // Spans 3 staves — much taller than 80
      expect(y2 - y1).toBeGreaterThan(160);
    });
  });

  describe('tuplet number / beam clearance', () => {
    // Helper: parse the max Y coordinate present in an SVG path's `d`
    // attribute (treating each pair as x,y after the M/L command letter).
    function maxYInPath(d) {
      const tokens = d.split(/[\s,MLZ]+/).filter(Boolean).map(Number);
      let maxY = -Infinity;
      // tokens are alternating x,y after splitting out command letters.
      for (let i = 1; i < tokens.length; i += 2) {
        if (Number.isFinite(tokens[i]) && tokens[i] > maxY) maxY = tokens[i];
      }
      return maxY;
    }

    it('keeps the sextuplet "6" digit clear of the 16th-note double-beam stack', () => {
      // High-pitched 16th-note sextuplet → stems down, beam stack and
      // tuplet number both sit *below* the notes. With two beam levels the
      // beam stack outer (lower) edge extends BEAM_THICKNESS + (numBeams-1)
      // * (BEAM_THICKNESS + BEAM_GAP) below the primary-beam y. The tuplet
      // number's Y offset must account for that thickness or it collides.
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          {
            tuplet: [6, 4],
            notes: [
              { pitch: 'A5', length: '1/16' },
              { pitch: 'G5', length: '1/16' },
              { pitch: 'F5', length: '1/16' },
              { pitch: 'E5', length: '1/16' },
              { pitch: 'D5', length: '1/16' },
              { pitch: 'C5', length: '1/16' },
            ],
          },
        ],
      });

      const tupletGroup = ctx.container.querySelector(
        '[data-tuplet="6:4"]'
      );
      expect(tupletGroup).not.toBeNull();

      // Outer (lower) edge of the beam stack within this tuplet group.
      const beamPaths = tupletGroup.querySelectorAll('path.beam');
      expect(beamPaths.length).toBeGreaterThanOrEqual(2); // two beam levels for 16ths
      let beamOuterY = -Infinity;
      beamPaths.forEach((p) => {
        const m = maxYInPath(p.getAttribute('d'));
        if (m > beamOuterY) beamOuterY = m;
      });
      expect(Number.isFinite(beamOuterY)).toBe(true);

      // The tuplet-number group contains one transformed glyph per digit.
      // Each child's transform is `translate(cx, cy)` where cy is the
      // digit's visible vertical center. Take the topmost (smallest y)
      // child as a conservative proxy for the digit's vertical placement.
      const numberGroup = tupletGroup.querySelector('.tuplet-number');
      expect(numberGroup).not.toBeNull();
      const digits = numberGroup.children;
      expect(digits.length).toBeGreaterThan(0);
      let digitTopCenterY = Infinity;
      for (const d of digits) {
        const tr = d.getAttribute('transform') || '';
        const match = tr.match(/translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/);
        expect(match).not.toBeNull();
        const cy = parseFloat(match[1]);
        if (cy < digitTopCenterY) digitTopCenterY = cy;
      }

      // The digit visible top sits roughly half a glyph height above its
      // visible center. Bravura tuplet digits are ~375 fu × SMUFL_SCALE
      // (0.08) ≈ 30px tall, so half-height ≈ 15px. Per Gould "Behind
      // Bars" (Tuplets ch.) we want roughly ½ staff space (≈ 10px in
      // this codebase) of clear space between the beam outer edge and
      // the digit; a 9px floor here catches the prior bug (which yielded
      // a -5px overlap on 16th sextuplets) while tolerating the digit
      // glyph's slightly asymmetric bbox.
      const halfDigitHeight = 15;
      const minBreathingRoom = 9;
      const digitTopY = digitTopCenterY - halfDigitHeight;
      expect(digitTopY - beamOuterY).toBeGreaterThanOrEqual(minBreathingRoom);
    });
  });

  // Per Gould "Behind Bars" (Barlines / Systems): a system terminates with a
  // barline and the staff lines should end at that barline — the staff must
  // not trail off into empty space past the last note. The default for an
  // excerpt is a thin final barline (Bravura `barlineSingle`); a complete
  // piece would use `barlineFinal`. These dev presets are excerpts, so the
  // renderer auto-appends a thin final barline just past the last element
  // and clips the 5 staff lines to that x.
  describe('final barline + staff right-edge', () => {
    it('appends a final thin barline just past the last note and clips the staff to it', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'F4', length: '1/4' },
      ]);

      // Find the rightmost note (transform translate-x is the head x).
      const noteGroups = ctx.container.querySelectorAll('.note');
      expect(noteGroups.length).toBeGreaterThan(0);
      let lastNoteX = -Infinity;
      noteGroups.forEach((n) => {
        const tr = n.getAttribute('transform') || '';
        const m = tr.match(/translate\(\s*([-\d.]+)/);
        if (m) {
          const x = parseFloat(m[1]);
          if (x > lastNoteX) lastNoteX = x;
        }
      });
      expect(Number.isFinite(lastNoteX)).toBe(true);

      // Internal/measure barlines + the new final barline are all `.bar-line`
      // groups. The rightmost one should be the auto-appended final barline,
      // sitting just past (within ~1.5 staff spaces / ~30px of) the last
      // note's head x.
      const barLines = ctx.container.querySelectorAll('.bar-line line');
      expect(barLines.length).toBeGreaterThan(0);
      let finalBarX = -Infinity;
      barLines.forEach((bl) => {
        const x = parseFloat(bl.getAttribute('x1'));
        if (x > finalBarX) finalBarX = x;
      });
      expect(finalBarX).toBeGreaterThan(lastNoteX);
      expect(finalBarX - lastNoteX).toBeLessThanOrEqual(30);

      // Staff's 5 lines must terminate AT the final-barline x, not at the
      // SVG's full width — otherwise the staff trails off meaninglessly.
      const staffLines = ctx.container.querySelectorAll('.staff-lines .staff-line');
      expect(staffLines).toHaveLength(5);
      staffLines.forEach((line) => {
        const x2 = parseFloat(line.getAttribute('x2'));
        expect(x2).toBeCloseTo(finalBarX, 0);
      });
    });
  });

  // Per Gould "Behind Bars" (Systems chapter): when music exceeds the
  // available staff width, it must break onto a new staff system at a
  // barline (never mid-measure). Each system gets its own clef and a fresh
  // run of staff lines, stacked below the previous one.
  describe('system wrapping (long pieces)', () => {
    it('wraps long pieces onto multiple staff systems at measure boundaries', () => {
      // Build a single-voice piece long enough that at width=400 it must
      // break onto multiple systems. Eight 4/4 measures of quarter notes.
      const notes = [];
      for (let m = 0; m < 8; m += 1) {
        notes.push({ pitch: 'C5', length: '1/4' });
        notes.push({ pitch: 'D5', length: '1/4' });
        notes.push({ pitch: 'E5', length: '1/4' });
        notes.push({ pitch: 'F5', length: '1/4' });
      }
      // Shrink the renderer's width so wrapping is forced.
      ctx.renderer._width = 400;
      ctx.render({
        timeSignature: [4, 4],
        keySignature: 'C',
        notes,
      });

      // (a) More than one .staff-lines element means we got more than one
      // system (with a single voice, each system contributes one staff).
      const staffLines = ctx.container.querySelectorAll('.staff-lines');
      expect(staffLines.length).toBeGreaterThan(1);

      // (c) Each system has its own clef.
      const clefs = ctx.container.querySelectorAll('.clef');
      expect(clefs.length).toBe(staffLines.length);

      // (b) Later notes should appear at smaller X (the wrap reset cursorX)
      // OR at a larger Y (stacked below). Read all .note groups, sort by
      // DOM order (== render order == musical order), and assert that the
      // last note has a Y strictly greater than the first note's Y — this
      // proves at least one system break translated content downward.
      const noteGroups = Array.from(ctx.container.querySelectorAll('.note'));
      expect(noteGroups.length).toBe(32);

      // Each note lives inside a `.staff` group whose transform carries
      // the system's Y offset (notes' own transforms are pitch-dependent
      // Y, so we read the staff group's Y rather than walking the whole
      // ancestor chain). Read the system index off `data-system-index`.
      const noteSystem = (n) => {
        const staff = n.closest('.staff');
        return parseInt(staff.getAttribute('data-system-index') || '0', 10);
      };
      const noteX = (n) => {
        const tr = n.getAttribute('transform') || '';
        const m = tr.match(/translate\(\s*([-\d.]+)/);
        return m ? parseFloat(m[1]) : 0;
      };

      // (b) Last note's system index must be greater than first note's.
      const firstSys = noteSystem(noteGroups[0]);
      const lastSys = noteSystem(noteGroups[noteGroups.length - 1]);
      expect(lastSys).toBeGreaterThan(firstSys);

      // The last system must have reset its X cursor: notes in the
      // final system should land at smaller X than notes in the first
      // system (proving the wrap pulled content back left rather than
      // just continuing rightward).
      const firstSystemNoteXs = Array.from(noteGroups)
        .filter((n) => noteSystem(n) === firstSys)
        .map(noteX);
      const lastSystemNoteXs = Array.from(noteGroups)
        .filter((n) => noteSystem(n) === lastSys)
        .map(noteX);
      expect(Math.min(...lastSystemNoteXs)).toBeLessThan(
        Math.max(...firstSystemNoteXs),
      );
    });
  });
});
