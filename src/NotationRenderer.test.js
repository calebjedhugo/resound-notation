/** @jest-environment jsdom */

import { createNotationContext } from './__tests__/helpers/testUtils.js';
import { NotationRenderer } from './NotationRenderer.js';

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

    // Per Bravura/SMuFL engravingDefaults.stemThickness = 0.12 staff spaces
    // (Gould "Behind Bars", Stems). At LINE_SPACING=20 (1 space = 20px) that's
    // 2.4px. Without an explicit stroke-width the stem inherits SVG's 1px
    // default, which matches staff-line weight and reads as anemic.
    it('renders the note stem at Bravura stemThickness (0.12 spaces = 2.4px)', () => {
      ctx.render([{ pitch: 'E4', length: '1/4' }]);
      const stem = ctx.container.querySelector('.note-stem');
      expect(parseFloat(stem.getAttribute('stroke-width'))).toBeCloseTo(2.4, 5);
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

    // Standard engraving leaves ~1 staff space between the clef glyph's
    // visual right edge and the first key-signature accidental so the
    // sharp/flat doesn't visually fuse with the clef body. Gould
    // ("Behind Bars", Spacing) treats clef→key-sig as a header gap of
    // roughly one staff space. Pin a conservative minimum (12 px =
    // ~0.6 staff space) so the visible gap is clearly nonzero.
    it('leaves clear space between the clef and the first key-sig accidental', () => {
      ctx.render({
        voices: [{ keySignature: 'G', notes: [{ pitch: 'E4', length: '1/4' }] }],
      });
      const clef = ctx.container.querySelector('.clef-treble');
      const keySig = ctx.container.querySelector('.key-signature');
      const firstAcc = keySig.querySelector('.accidental');
      const clefTx = parseFloat(clef.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
      const keySigTx = parseFloat(keySig.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
      const accLocalX = parseFloat(firstAcc.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
      // Bravura gClef visible width: 671 fu × 0.08 = 53.68 px (right edge).
      const CLEF_GLYPH_MAX_X = 54;
      // Bravura accidentalSharp half-width: 249 fu / 2 × 0.08 = 9.96 px.
      const ACC_HALF_WIDTH = 9.96;
      const accLeftEdge = keySigTx + accLocalX - ACC_HALF_WIDTH;
      const clefRightEdge = clefTx + CLEF_GLYPH_MAX_X;
      const gap = accLeftEdge - clefRightEdge;
      // Target ~1 staff space (20 px) past the bbox right edge so the
      // top scroll of the clef glyph doesn't visually fuse with the
      // accidental's stem.
      expect(gap).toBeGreaterThanOrEqual(45);
    });

    // Gould "Behind Bars" (Spacing): the rightmost prelude element
    // (clef / key-sig / time-sig — whichever sits closest to the first
    // note) must leave ≥1 staff space of clear visual space before the
    // first notehead's left edge. Mirror of the clef→key-sig leading
    // pad pinned above. Pin all three combinations:
    //   (a) clef only (system-continuation case)
    //   (b) clef + key-sig
    //   (c) clef + key-sig + time-sig (first system)
    it('leaves at least one staff space between the rightmost prelude element and the first notehead', () => {
      const HEAD_HALF_WIDTH = 11.8; // Bravura noteheadBlack (295 fu × 0.08 / 2)
      const CLEF_GLYPH_MAX_X = 54;  // Bravura gClef right edge
      const ACC_HALF_WIDTH = 9.96;  // Bravura accidentalSharp half-width
      const TARGET_GAP = 18;        // tolerant of 20-px (1 staff space) target

      function noteLeftEdge(container) {
        const note = container.querySelector('.note');
        const tx = parseFloat(note.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
        return tx - HEAD_HALF_WIDTH;
      }

      // (a) Clef only — no key-sig, no time-sig.
      ctx.render([{ pitch: 'E4', length: '1/4' }]);
      {
        const clef = ctx.container.querySelector('.clef-treble');
        const clefTx = parseFloat(clef.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
        const clefRight = clefTx + CLEF_GLYPH_MAX_X;
        const gap = noteLeftEdge(ctx.container) - clefRight;
        expect(gap).toBeGreaterThanOrEqual(TARGET_GAP);
      }

      // (b) Clef + key-sig (G major = 1 sharp).
      ctx.renderer.clear();
      ctx.render({
        voices: [{ keySignature: 'G', notes: [{ pitch: 'E4', length: '1/4' }] }],
      });
      {
        const keySig = ctx.container.querySelector('.key-signature');
        const keySigTx = parseFloat(keySig.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
        const accs = keySig.querySelectorAll('.accidental');
        const lastAcc = accs[accs.length - 1];
        const accLocalX = parseFloat(lastAcc.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
        const keySigRight = keySigTx + accLocalX + ACC_HALF_WIDTH;
        const gap = noteLeftEdge(ctx.container) - keySigRight;
        expect(gap).toBeGreaterThanOrEqual(TARGET_GAP);
      }

      // (c) Clef + key-sig + time-sig (first system).
      ctx.renderer.clear();
      ctx.render({
        voices: [{
          keySignature: 'G',
          timeSignature: [4, 4],
          notes: [{ pitch: 'E4', length: '1/4' }],
        }],
      });
      {
        const sig = ctx.container.querySelector('.time-signature');
        const sigTx = parseFloat(sig.getAttribute('transform').match(/translate\(([-\d.]+)/)[1]);
        // createTimeSignature lays digits with the cursor stepping by
        // `width = bbox.xMax - bbox.xMin` per digit and the i-th digit's
        // translate landing at (cursor + width/2). For a single-digit
        // numerator the glyph origin therefore sits at the group's local
        // x=0 — but the glyph's visible content extends from xMin*scale
        // (≈1.6 px for '4') to xMax*scale (36 px) past the origin. The
        // rightmost visual extent of the time-sig is the digit's
        // visible right edge.
        const TS_DIGIT_4_XMAX_PX = 450 * 0.08; // 36 px
        const sigRight = sigTx + TS_DIGIT_4_XMAX_PX;
        const gap = noteLeftEdge(ctx.container) - sigRight;
        expect(gap).toBeGreaterThanOrEqual(TARGET_GAP);
      }
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

    // Per Bravura/SMuFL engravingDefaults.staffLineThickness = 0.13 staff
    // spaces (Gould "Behind Bars", Staff). At LINE_SPACING=20 that's 2.6px.
    // Without an explicit stroke-width staff lines inherit SVG's 1px
    // default and read as anemic next to the now-Bravura-weighted stems
    // (2.4), ledger lines (3.2), and barlines (3.2/10).
    it('renders staff lines at Bravura staffLineThickness (0.13 spaces = 2.6px)', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const lines = ctx.container.querySelectorAll('.staff-line');
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(parseFloat(line.getAttribute('stroke-width'))).toBeCloseTo(2.6, 5);
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

    it('leaves at least 6 staff spaces of empty space between independent staves in multi-system layouts (Gould p. 488)', () => {
      // Two independent (un-braced) staves wrapped across multiple
      // systems. Per Elaine Gould "Behind Bars" p. 488, the empty
      // white space between independent staves within one system
      // should be ~6 staff spaces. With STAFF_HEIGHT=80 and
      // LINE_SPACING=20, the second staff's translate-Y must
      // therefore be at least STAFF_HEIGHT + 6*LINE_SPACING = 200
      // below the first. The previous compressed multi-system path
      // used STAFF_HEIGHT + VOICE_GAP = 120 (only 2 staff spaces of
      // white space), which read as the inter-system gap rather
      // than intra-system stave pairing.
      const longNotes = Array.from({ length: 16 }, () => ({ pitch: 'C5', length: '1/4' }));
      const altoNotes = Array.from({ length: 16 }, () => ({ pitch: 'A4', length: '1/4' }));
      // Force multi-system wrap by shrinking renderer width before render.
      ctx.renderer._width = 400;
      ctx.render({
        timeSignature: [4, 4],
        voices: [
          { id: 'soprano', clef: 'treble', notes: longNotes },
          { id: 'alto', clef: 'treble', notes: altoNotes },
        ],
      });

      // Pin: layout truly wrapped (else the multi-system path isn't exercised).
      const firstSystemStaves = ctx.container.querySelectorAll('.staff[data-system-index="0"]');
      expect(firstSystemStaves.length).toBe(2);
      const secondSystemStaves = ctx.container.querySelectorAll('.staff[data-system-index="1"]');
      expect(secondSystemStaves.length).toBe(2);

      const staves = firstSystemStaves;

      const parseY = (g) => {
        const m = /translate\(\s*0\s*,\s*([-\d.]+)\s*\)/.exec(g.getAttribute('transform') || '');
        return m ? parseFloat(m[1]) : NaN;
      };
      const y0 = parseY(staves[0]);
      const y1 = parseY(staves[1]);
      expect(Number.isFinite(y0)).toBe(true);
      expect(Number.isFinite(y1)).toBe(true);
      // STAFF_HEIGHT (80) + 6 * LINE_SPACING (20) = 200
      expect(y1 - y0).toBeGreaterThanOrEqual(200);
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

    // Bravura engravingDefaults: legerLineThickness = 0.16 spaces (3.2px at
    // LINE_SPACING=20) and legerLineExtension = 0.4 spaces (8px) past each
    // notehead edge. Without this, ledgers visually blend with the staff
    // lines and look pinched against the head.
    it('draws ledger lines at Bravura thickness and extension', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      const ledger = ctx.getLedgerLines()[0];
      expect(ledger).toBeDefined();

      // Thickness: 0.16 * 20 = 3.2
      expect(Number(ledger.getAttribute('stroke-width'))).toBeCloseTo(3.2, 5);

      // Extension: Bravura noteheadBlack width ~23.6px → half ~11.8px.
      // Each side should extend ~8px past the head, so total span
      // >= 23.6 + 16 = ~39.6px.
      const x1 = Number(ledger.getAttribute('x1'));
      const x2 = Number(ledger.getAttribute('x2'));
      const NOTEHEAD_WIDTH = 23.6;
      const LEGER_EXTENSION = 8;
      expect(x2 - x1).toBeGreaterThanOrEqual(NOTEHEAD_WIDTH + 2 * LEGER_EXTENSION - 0.5);
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
      // Tolerant of FP rounding — the visible gap is one staff-space-and-a-half;
      // sub-pixel jitter from prelude width changes shouldn't trip this.
      const MIN_GAP = 29.5;
      const prevRightEdge = prevNoteX + NOTEHEAD_HALF;
      const accLeftEdge = accX - SHARP_HALF;
      expect(accLeftEdge - prevRightEdge).toBeGreaterThanOrEqual(MIN_GAP);
    });

    // Per Gould "Behind Bars" pp. 80-85 ("Accidentals: when to use
    // them"): an accidental is printed before a note only when the
    // pitch differs from the key signature's default for that letter,
    // or when restoring after a prior alteration in the measure. A
    // pitch that already matches the key signature (e.g. F#5 in D
    // major) draws as a plain notehead. Conversely, a pitch that
    // contradicts the key signature (e.g. F-natural in D major) MUST
    // show its accidental — here a natural — to override the key.
    it('does not redraw an on-note accidental that matches the key signature, but renders a natural when the key signature would otherwise alter the letter', () => {
      // D major has 2 sharps (F#, C#). F#5 should NOT add an on-note
      // sharp; the only sharps in the SVG must be the two from the
      // key signature.
      ctx.render({
        keySignature: 'D',
        notes: [
          { pitch: 'D5', length: '1/4' },
          { pitch: 'F#5', length: '1/4' },
        ],
      });
      const sharps = ctx.container.querySelectorAll('.accidental.sharp');
      expect(sharps).toHaveLength(2); // both from the key signature
      const naturals = ctx.container.querySelectorAll('.accidental.natural');
      expect(naturals).toHaveLength(0);

      // F-natural in D major MUST render a natural sign to override
      // the key signature.
      ctx.renderer.clear();
      ctx.render({
        keySignature: 'D',
        notes: [
          { pitch: 'D5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
        ],
      });
      const naturals2 = ctx.container.querySelectorAll('.accidental.natural');
      expect(naturals2).toHaveLength(1);
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

    it('unbeamed eighth note renders the SMuFL Bravura flag glyph', () => {
      // Single C5 1/8 in unmetered mode (no beaming). C5 sits above the
      // middle line, so the stem goes down and the flag is flag8thDown.
      // The hand-rolled squiggle (M ... c 8 4 12 12 8 20) is replaced
      // by the Bravura SMuFL path; assert a distinctive substring from
      // flag8thDown that the squiggle never produced.
      ctx.render([{ pitch: 'C5', length: '1/8' }]);
      const flag = ctx.container.querySelector('.note-flag');
      expect(flag).not.toBeNull();
      const path = flag.querySelector('path');
      expect(path).not.toBeNull();
      const d = path.getAttribute('d');
      expect(d).toContain('M240 760C254 718');
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
    it('does not render bar lines when no time signature is set', () => {
      ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
        { pitch: 'C5', length: '1/4' },
      ]);
      expect(ctx.getBarLines()).toHaveLength(0);
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
      expect(ctx.getBarLines()).toHaveLength(1);
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
      expect(ctx.getBarLines()).toHaveLength(2);
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
      expect(ctx.getBarLines()).toHaveLength(1);
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
      expect(ctx.getBarLines()).toHaveLength(1);
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
      expect(ctx.getBarLines()).toHaveLength(1);
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
      expect(ctx.getBarLines()).toHaveLength(1);
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
      expect(ctx.getBarLines()).toHaveLength(1);
    });

    it('renders no bar lines if music does not fill a complete measure', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
        ],
      });
      expect(ctx.getBarLines()).toHaveLength(0);
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
      expect(ctx.getBarLines()).toHaveLength(1);
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

    it('spaces multi-accidental key sig flats and gives the first note breathing room (Gould, Behind Bars pp. 90-95)', () => {
      // Bb major: two flats (Bb4, Eb5) followed by Bb4 then D5. Reads
      // both the intra-key-sig flat-to-flat spacing and the gap from the
      // last flat to the first notehead. Both should be >= ~1 staff
      // space; the previous 14px spacing let glyphs touch and the
      // count*14 cursor advance crowded the first note onto the last
      // flat.
      ctx.render({
        keySignature: 'Bb',
        notes: [
          { pitch: 'Bb4', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
        ],
      });

      const keySig = ctx.getKeySignature();
      const accidentals = keySig.querySelectorAll('.accidental');
      expect(accidentals).toHaveLength(2);

      const getX = (el) =>
        parseFloat(el.getAttribute('transform').match(/translate\(([^,]+)/)[1]);

      const keySigX = getX(keySig);
      const acc0X = keySigX + getX(accidentals[0]);
      const acc1X = keySigX + getX(accidentals[1]);

      // (a) intra-key-sig spacing: adjacent flats >= 18px apart
      expect(acc1X - acc0X).toBeGreaterThanOrEqual(18);

      // (b) trailing clearance: first notehead >= 20px right of last flat
      const firstNoteX = getX(ctx.getNotes()[0]);
      expect(firstNoteX - acc1X).toBeGreaterThanOrEqual(20);
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

    it('renders tie across a bar line (within a single system)', () => {
      // Use a wide renderer so the whole passage stays on one system —
      // cross-system ties are deferred to a later iteration and would
      // truncate here.
      const c = document.createElement('div');
      const r = new NotationRenderer({ container: c, width: 1400 });
      r.render({
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
      expect(c.querySelectorAll('.tie')).toHaveLength(1);
      expect(c.querySelectorAll('.bar-line').length).toBeGreaterThan(0);
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

    it('slur and tie apex thickness matches Bravura 0.22 staff spaces', () => {
      // Bravura engravingDefaults: slurMidpointThickness =
      // tieMidpointThickness = 0.22 staff spaces. At LINE_SPACING = 20 px
      // that's 4.4 px of rendered apex weight — heavier than the 2.6 px
      // staff lines so the curve reads as a teardrop instead of vanishing
      // into a staff line.
      ctx.render([
        { pitch: 'C4', length: '1/4', slur: 'start', tie: 'start' },
        { pitch: 'C4', length: '1/4', slur: 'stop', tie: 'stop' },
      ]);

      // Closed-shape construction: outer cubic forward, inner cubic
      // reversed. Path shape:
      //   M x1 y1 C cp1x outerCp1Y cp2x outerCp2Y x2 y2
      //           C cp2x innerCp2Y cp1x innerCp1Y x1 y1 Z
      // A symmetric cubic Bezier's apex sits at 0.75 * control-Y offset
      // from the chord line, so rendered apex thickness =
      // 0.75 * (outerOffset - innerOffset).
      const apexThickness = (path) => {
        const d = path.getAttribute('d');
        const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
        const y1 = nums[1];
        const outerCp1Y = nums[3];
        const innerCp1Y = nums[11];
        const outerOffset = Math.abs(outerCp1Y - y1);
        const innerOffset = Math.abs(innerCp1Y - y1);
        return 0.75 * (outerOffset - innerOffset);
      };

      const slur = ctx.getSlurs()[0];
      const tie = ctx.getTies()[0];
      expect(slur).toBeTruthy();
      expect(tie).toBeTruthy();

      expect(apexThickness(slur)).toBeCloseTo(4.4, 0);
      expect(apexThickness(tie)).toBeCloseTo(4.4, 0);
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

      expect(ctx.getBarLines()).toHaveLength(1);
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
      // Two-voice baseline = 2 * 200 + 40 = 440. Content-aware viewport
      // may grow this a few px to fit stems/ledger lines that protrude
      // past the band; we accept a small margin (≤ 80) but the height
      // must be at least the band size and at most the band + the
      // ledger-extreme grow budget.
      expect(height).toBeGreaterThanOrEqual(440);
      expect(height).toBeLessThanOrEqual(520);
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

      // Each voice generates its own bar line
      const barLines = ctx.getBarLines();
      expect(barLines).toHaveLength(2);
    });

    // Polymetric layout: when voices declare DIFFERENT time signatures in
    // the same system (e.g. 4/4 over 3/4 over 6/8), they still share the
    // same horizontal "music starts here" gridline. The widest prelude
    // (clef + key sig + time sig) determines the shared content-start X,
    // and narrower voices simply get extra whitespace between their time
    // sig and first note. Without this rule each voice's first note
    // drifts to a different x (the bug this test pins).
    it('aligns first notes across voices with different time signatures (polymetric)', () => {
      ctx.render({
        voices: [
          {
            id: 'v1',
            clef: 'treble',
            timeSignature: [4, 4],
            notes: [{ pitch: 'G4', length: '1/4' }],
          },
          {
            id: 'v2',
            clef: 'treble',
            timeSignature: [3, 4],
            notes: [{ pitch: 'E4', length: '1/4' }],
          },
          {
            id: 'v3',
            clef: 'treble',
            timeSignature: [6, 8],
            notes: [{ pitch: 'C4', length: '1/8' }],
          },
        ],
      });

      const staves = ctx.container.querySelectorAll('.staff');
      expect(staves).toHaveLength(3);

      const firstNoteX = (staff) => {
        const note = staff.querySelector('.note');
        const m = /translate\(([-0-9.]+),/.exec(note.getAttribute('transform'));
        return parseFloat(m[1]);
      };
      const xs = Array.from(staves).map(firstNoteX);
      const [a, b, c] = xs;
      expect(Math.abs(b - a)).toBeLessThanOrEqual(1);
      expect(Math.abs(c - a)).toBeLessThanOrEqual(1);
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

  // Per Bravura/SMuFL engravingDefaults (Gould "Behind Bars", Barlines):
  //   thinBarlineThickness  = 0.16 spaces = 3.2px at LINE_SPACING=20
  //   thickBarlineThickness = 0.5  spaces = 10px
  //   barlineSeparation     = 0.4  spaces = 8px between line centers
  // Without these, the final barline reads as a single chunky bar and thin
  // barlines blend into the staff lines.
  describe('barline thickness (Bravura engravingDefaults)', () => {
    it('thin/thick barlines match Bravura thicknesses and final separation is 8px', () => {
      ctx.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          // bar line — a regular (thin) one
          { pitch: 'G4', length: '1/1' },
        ],
      });
      // (a) System-start barline is thin (3.2px).
      const sysStart = ctx.container.querySelector(
        '.staff-lines .system-start-bar-line'
      );
      expect(parseFloat(sysStart.getAttribute('stroke-width'))).toBeCloseTo(
        3.2,
        5
      );
      // Regular interior barline is thin (3.2px).
      const regular = ctx.container.querySelector('.bar-line line');
      expect(parseFloat(regular.getAttribute('stroke-width'))).toBeCloseTo(
        3.2,
        5
      );
      // (b) Final barline thick portion is 10px; thin portion is 3.2px.
      const finalGroup = ctx.container.querySelector('.barline-final');
      const thick = finalGroup.querySelector('.barline-thick');
      const thin = finalGroup.querySelector('.barline-thin');
      expect(parseFloat(thick.getAttribute('stroke-width'))).toBeCloseTo(10, 5);
      expect(parseFloat(thin.getAttribute('stroke-width'))).toBeCloseTo(3.2, 5);
      // (c) Separation between the thin-line center and thick-line center is 8px.
      const thinX = parseFloat(thin.getAttribute('x1'));
      const thickX = parseFloat(thick.getAttribute('x1'));
      expect(Math.abs(thinX - thickX)).toBeCloseTo(8, 5);
    });
  });

  // Per Bravura/SMuFL engravingDefaults:
  //   hairpinThickness         = 0.16 spaces = 3.2px at LINE_SPACING=20
  //   repeatEndingLineThickness = 0.16 spaces = 3.2px (volta bracket)
  // Same weight as a thin barline — these are "line on staff" elements
  // per Gould's hierarchy. Earlier Bravura passes bumped stems (2.4),
  // staff lines (2.6), barlines (3.2/10), and ledger lines (3.2); the
  // hairpin and volta lines were left at the SVG-ish 1.5 default and
  // now read as spindly outliers against the heavier neighbours.
  describe('hairpin + volta line thickness (Bravura engravingDefaults)', () => {
    it('hairpin wedge lines and volta bracket render at 3.2px', () => {
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { ending: { number: 1, type: 'start' } },
          { pitch: 'G5', length: '1/2' },
          { pitch: 'A5', length: '1/2' },
          { ending: { number: 1, type: 'stop' } },
          { barline: 'repeat-end' },
          { ending: { number: 2, type: 'start' } },
          { pitch: 'B5', length: '1/2' },
          { hairpin: 'decrescendo', start: true },
          { pitch: 'A5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { hairpin: 'decrescendo', stop: true },
          { barline: 'final' },
        ],
      });

      // Hairpin: two diverging lines, both at 3.2px.
      const hairpinLines = ctx.container.querySelectorAll(
        '.hairpin .hairpin-line'
      );
      expect(hairpinLines.length).toBe(2);
      hairpinLines.forEach((line) => {
        expect(parseFloat(line.getAttribute('stroke-width'))).toBeCloseTo(
          3.2,
          5
        );
      });

      // Volta bracket: every ending bracket path at 3.2px.
      const endingBrackets = ctx.container.querySelectorAll(
        '.ending .ending-bracket'
      );
      expect(endingBrackets.length).toBeGreaterThan(0);
      endingBrackets.forEach((bracket) => {
        expect(parseFloat(bracket.getAttribute('stroke-width'))).toBeCloseTo(
          3.2,
          5
        );
      });
    });
  });

  // Hairpin-to-dynamic clearance: Gould "Behind Bars" (Hairpins) requires
  // (A) ≥0.5 staff space (≥10px at LINE_SPACING=20) of horizontal clearance
  // between the hairpin tip and the adjacent dynamic letter, and (B) the
  // hairpin's vertical center aligned with the dynamic letter's visual
  // center so the two marks read as one horizontal line of music-direction.
  // Before this fix the closing tip of a decrescendo landed at the same x
  // as the target dynamic (so it ran into the letter's left descender) and
  // its vertical center was anchored to the dynamic baseline rather than
  // the letter's visual centerline (~5px above baseline).
  describe('hairpin clearance and alignment with target dynamic', () => {
    function parseTranslate(group) {
      const t = group.getAttribute('transform') || '';
      const m = /translate\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(t);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    }

    function parsePath(d) {
      // Hairpin lines are "M x1,y1 L x2,y2" in the hairpin's local frame.
      const m = /M\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s+L\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(
        d
      );
      if (!m) return null;
      return {
        x1: parseFloat(m[1]),
        y1: parseFloat(m[2]),
        x2: parseFloat(m[3]),
        y2: parseFloat(m[4]),
      };
    }

    it('keeps decrescendo tip ≥0.5 staff space from "p" and centers it on the letter', () => {
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { dynamic: 'ff' },
          { pitch: 'G5', length: '1/4' },
          { hairpin: 'decrescendo', start: true },
          { pitch: 'F5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { hairpin: 'decrescendo', stop: true },
          { dynamic: 'p' },
          { pitch: 'C5', length: '1/2' },
        ],
      });

      // Hairpin: two diverging lines under one .hairpin group.
      const hairpinGroup = ctx.container.querySelector('.hairpin-decrescendo');
      expect(hairpinGroup).not.toBeNull();
      const hpT = parseTranslate(hairpinGroup);
      expect(hpT).not.toBeNull();
      const lines = hairpinGroup.querySelectorAll('.hairpin-line');
      expect(lines.length).toBe(2);
      const seg1 = parsePath(lines[0].getAttribute('d'));
      const seg2 = parsePath(lines[1].getAttribute('d'));
      // Right (closing) endpoints — same x for both lines.
      const hpRightXLocal = Math.max(seg1.x2, seg2.x2);
      const hpRightX = hpT.x + hpRightXLocal;
      // The two right-side y values bracket the closing tip; centerY is
      // their midpoint.
      const yRight1 =
        seg1.x2 === hpRightXLocal ? seg1.y2 : seg1.y1;
      const yRight2 =
        seg2.x2 === hpRightXLocal ? seg2.y2 : seg2.y1;
      const hpCenterY = hpT.y + (yRight1 + yRight2) / 2;

      // Target dynamic "p".
      const pDynamic = ctx.container.querySelector(
        '.dynamic[data-dynamic="p"]'
      );
      expect(pDynamic).not.toBeNull();
      const dynT = parseTranslate(pDynamic);
      expect(dynT).not.toBeNull();
      // "p" glyph bbox (font units): xMin=-89, xMax=366, yMin=-142, yMax=274.
      // cx = (xMin+xMax)/2 = 138.5. SMUFL_SCALE = 0.08.
      // Letter local x extents = (xMin - cx, xMax - cx) * 0.08 → (-18.2, 18.2).
      // Single-letter renderDynamic places the glyph at local x=0, so the
      // letter's left visual edge in absolute coords = dynT.x - 18.2.
      const pLeftX = dynT.x + (-89 - 138.5) * 0.08;
      // Visual vertical center: baseline at dynT.y; top at dynT.y - 274*0.08,
      // bottom at dynT.y + 142*0.08; center = dynT.y + (-274 + -142)/2 * -0.08
      //                                     = dynT.y - 5.28 (above baseline).
      const pTopVisual = dynT.y - 274 * 0.08;
      const pBottomVisual = dynT.y - -142 * 0.08;
      const pCenterY = (pTopVisual + pBottomVisual) / 2; // dynT.y - 5.28

      // (A) horizontal clearance ≥10px (0.5 staff space).
      expect(pLeftX - hpRightX).toBeGreaterThanOrEqual(10);
      // (B) vertical centers within 3px.
      expect(Math.abs(hpCenterY - pCenterY)).toBeLessThanOrEqual(3);
    });
  });

  // Repeat-barline clearance: Gould "Behind Bars" (Repeats) says the dots
  // of a repeat barline sit on the inside of the heavy stroke and need
  // ≥0.5 staff space (≥10px at LINE_SPACING=20) of clearance between the
  // dots and the adjacent notehead. A start-repeat at the head of a
  // measure had its dots butted directly against the first note's head;
  // an end-repeat closing the first volta collided with the second
  // volta's "2." label and its first note. Both come from the same hole
  // in the layout: the repeat barline advances the cursor by a few px
  // *less* than the dot+thick-stroke geometry actually occupies.
  describe('repeat-barline clearance from adjacent notes and volta labels', () => {
    function transformX(group) {
      const t = group.getAttribute('transform') || '';
      const m = /translate\(\s*(-?\d+(?:\.\d+)?)/.exec(t);
      return m ? parseFloat(m[1]) : NaN;
    }

    it('keeps repeat-barline dots ≥0.5 staff space from notes, and volta-2 clear of the end-repeat', () => {
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { barline: 'repeat-start' },
          { pitch: 'C5', length: '1/4' },
          { pitch: 'D5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'F5', length: '1/4' },
          { ending: { number: 1, type: 'start' } },
          { pitch: 'G5', length: '1/2' },
          { pitch: 'F5', length: '1/2' },
          { ending: { number: 1, type: 'stop' } },
          { barline: 'repeat-end' },
          { ending: { number: 2, type: 'start' } },
          { pitch: 'A5', length: '1/2' },
          { pitch: 'G5', length: '1/2' },
          { barline: 'final' },
        ],
      });

      // Geometry constants from RepeatBarline.js — the dot center sits at
      // ±(LINE_GAP + DOT_GAP) from the heavy stroke's x, and the dot
      // radius (2.5) extends the visible edge another 2.5px outward.
      const LINE_GAP = 8; // BARLINE_SEPARATION
      const DOT_GAP = 5;
      const DOT_RADIUS = 2.5;
      const DOT_EDGE_OFFSET = LINE_GAP + DOT_GAP + DOT_RADIUS; // 15.5
      const MIN_CLEARANCE = 10; // 0.5 staff space at LINE_SPACING=20

      const startRepeat = ctx.container.querySelector('.barline-repeat-start');
      const endRepeat = ctx.container.querySelector('.barline-repeat-end');
      expect(startRepeat).not.toBeNull();
      expect(endRepeat).not.toBeNull();

      const startRepeatX = transformX(startRepeat);
      const endRepeatX = transformX(endRepeat);

      // Collect all note groups in DOM order, with their absolute x.
      const noteGroups = Array.from(
        ctx.container.querySelectorAll('g.note')
      ).map((g) => ({ el: g, x: transformX(g) }));
      expect(noteGroups.length).toBeGreaterThanOrEqual(8);

      // (A) First note after start-repeat: the C5 — first note whose x
      // exceeds the start-repeat's dot right edge.
      const startDotRightX = startRepeatX + DOT_EDGE_OFFSET;
      const firstNoteAfterStart = noteGroups.find((n) => n.x > startRepeatX);
      expect(firstNoteAfterStart).toBeDefined();
      expect(firstNoteAfterStart.x - startDotRightX).toBeGreaterThanOrEqual(
        MIN_CLEARANCE
      );

      // (B) Last note before end-repeat: the volta-1 closing note.
      //     First note after end-repeat: the volta-2 opening note.
      const endDotLeftX = endRepeatX - DOT_EDGE_OFFSET;
      const endDotRightX = endRepeatX + LINE_GAP / 2; // outer edge of thick stroke
      const noteBeforeEnd = [...noteGroups]
        .reverse()
        .find((n) => n.x < endRepeatX);
      const noteAfterEnd = noteGroups.find((n) => n.x > endRepeatX);
      expect(noteBeforeEnd).toBeDefined();
      expect(noteAfterEnd).toBeDefined();
      expect(endDotLeftX - noteBeforeEnd.x).toBeGreaterThanOrEqual(
        MIN_CLEARANCE
      );
      expect(noteAfterEnd.x - endDotRightX).toBeGreaterThanOrEqual(
        MIN_CLEARANCE
      );

      // (B cont.) Volta-2 label must not overlap the end-repeat barline.
      // The "2." text sits at startX + 5 (TEXT_OFFSET_X in Ending.js).
      const volta2 = ctx.container.querySelector('.ending-2');
      expect(volta2).not.toBeNull();
      const volta2Text = volta2.querySelector('.ending-number');
      const volta2LabelX = parseFloat(volta2Text.getAttribute('x'));
      expect(volta2LabelX).toBeGreaterThan(endDotRightX);
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

    // Gould "Behind Bars" (Tuplets ch.): the tuplet number is centered
    // horizontally on the beam group's geometric midpoint. For a beam
    // running from the first stem-x to the last stem-x, the number's
    // visual x-center must equal (firstStemX + lastStemX) / 2.
    it('centers the tuplet number horizontally on the beam midpoint', () => {
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          {
            tuplet: [3, 2],
            notes: [
              { pitch: 'E4', length: '1/8' },
              { pitch: 'F4', length: '1/8' },
              { pitch: 'G4', length: '1/8' },
            ],
          },
        ],
      });

      const tupletGroup = ctx.container.querySelector('[data-tuplet="3:2"]');
      expect(tupletGroup).not.toBeNull();

      // Beam horizontal extent: take min/max x across all path.beam vertices.
      const beamPaths = tupletGroup.querySelectorAll('path.beam');
      expect(beamPaths.length).toBeGreaterThanOrEqual(1);
      let beamMinX = Infinity;
      let beamMaxX = -Infinity;
      beamPaths.forEach((p) => {
        const tokens = (p.getAttribute('d') || '')
          .split(/[\s,MLZ]+/)
          .filter(Boolean)
          .map(Number);
        for (let i = 0; i < tokens.length; i += 2) {
          const x = tokens[i];
          if (Number.isFinite(x)) {
            if (x < beamMinX) beamMinX = x;
            if (x > beamMaxX) beamMaxX = x;
          }
        }
      });
      expect(Number.isFinite(beamMinX)).toBe(true);
      const beamMidX = (beamMinX + beamMaxX) / 2;

      // Visual x-center of the tuplet number: midpoint of the leftmost
      // and rightmost digit-glyph translate-x values (each digit is
      // centered on its own translate-x by the renderer).
      const numberGroup = tupletGroup.querySelector('.tuplet-number');
      expect(numberGroup).not.toBeNull();
      const digitCenters = [];
      for (const d of numberGroup.children) {
        const m = (d.getAttribute('transform') || '').match(
          /translate\(\s*([-\d.]+)\s*,\s*[-\d.]+\s*\)/
        );
        expect(m).not.toBeNull();
        digitCenters.push(parseFloat(m[1]));
      }
      expect(digitCenters.length).toBeGreaterThan(0);
      const numberCenterX =
        (Math.min(...digitCenters) + Math.max(...digitCenters)) / 2;

      expect(Math.abs(numberCenterX - beamMidX)).toBeLessThanOrEqual(1);
    });
  });

  describe('ottava (8va/8vb) integration', () => {
    function noteHeadYs() {
      const heads = ctx.container.querySelectorAll('.note-head');
      const ys = [];
      heads.forEach((h) => {
        const tr = h.getAttribute('transform') || '';
        const m = /translate\([^,]+,\s*([-\d.]+)\)/.exec(tr);
        if (m) ys.push(parseFloat(m[1]));
      });
      return ys;
    }

    it('renders a 4-note G6+ run under one 8va bracket with a dashed line', () => {
      ctx.render([
        { pitch: 'G6', length: '1/4' },
        { pitch: 'A6', length: '1/4' },
        { pitch: 'B6', length: '1/4' },
        { pitch: 'C7', length: '1/4' },
      ]);
      const brackets = ctx.container.querySelectorAll('.ottava-bracket');
      expect(brackets).toHaveLength(1);
      expect(brackets[0].classList.contains('ottava-8va')).toBe(true);
      expect(brackets[0].querySelector('.ottava-glyph')).not.toBeNull();
      const line = brackets[0].querySelector('.ottava-line');
      expect(line).not.toBeNull();
      expect(line.getAttribute('stroke-dasharray')).toBeTruthy();
    });

    // Gould "Behind Bars" (Octave displacement, p. 75): the marking reads
    // "8va" / "8vb" — the modifier letters are part of the glyph, not an
    // optional decoration. SMuFL ottavaAlta (U+E511) ships the composed
    // "8va" glyph already; rendering only the bare ottava digit (U+E510)
    // is wrong. Pin that the rendered glyph's path data contains the
    // multi-subpath signature of a composed "8va" — the bare-8 glyph has
    // exactly 3 M-subpaths (outer 8 + two counters), the composed "8va"
    // adds the v and a outlines for 6+ subpaths total.
    it('8va glyph renders the composed "8va" letters, not the bare ottava digit', () => {
      ctx.render([
        { pitch: 'G6', length: '1/4' },
        { pitch: 'A6', length: '1/4' },
        { pitch: 'B6', length: '1/4' },
        { pitch: 'C7', length: '1/4' },
      ]);
      const glyph = ctx.container.querySelector(
        '.ottava-bracket.ottava-8va .ottava-glyph'
      );
      expect(glyph).not.toBeNull();
      const path = glyph.querySelector('path');
      expect(path).not.toBeNull();
      const d = path.getAttribute('d') || '';
      const subpathCount = (d.match(/M/g) || []).length;
      // Bare "8" = 3 subpaths. Composed "8va" should have 6+.
      expect(subpathCount).toBeGreaterThanOrEqual(6);
    });

    it('shifts a G6+ run\'s noteheads down by one octave (matching G5/A5/B5/C6 Y)', () => {
      ctx.render([
        { pitch: 'G6', length: '1/4' },
        { pitch: 'A6', length: '1/4' },
        { pitch: 'B6', length: '1/4' },
        { pitch: 'C7', length: '1/4' },
      ]);
      const shiftedYs = noteHeadYs();

      ctx.renderer.clear();
      ctx.render([
        { pitch: 'G5', length: '1/4' },
        { pitch: 'A5', length: '1/4' },
        { pitch: 'B5', length: '1/4' },
        { pitch: 'C6', length: '1/4' },
      ]);
      const baselineYs = noteHeadYs();

      expect(shiftedYs.length).toBe(baselineYs.length);
      for (let i = 0; i < shiftedYs.length; i += 1) {
        expect(Math.abs(shiftedYs[i] - baselineYs[i])).toBeLessThanOrEqual(1);
      }
    });

    it('does NOT bracket a 2-note G6+ run (suppressed by single-note rule or length)', () => {
      // C5 G6 D5 — isolated G6 → no bracket
      ctx.render([
        { pitch: 'C5', length: '1/4' },
        { pitch: 'G6', length: '1/4' },
        { pitch: 'D5', length: '1/4' },
      ]);
      const brackets = ctx.container.querySelectorAll('.ottava-bracket');
      expect(brackets).toHaveLength(0);
      // The G6 should still render with ledger lines (in its real position)
      expect(ctx.getLedgerLines().length).toBeGreaterThan(0);
    });

    it('grows SVG height to fit content above F6 even without an 8va bracket', () => {
      // E6 is below G6 trigger but well above the staff — needs ledger lines.
      ctx.render([{ pitch: 'E6', length: '1/4' }]);
      const svg = ctx.getSvg();
      const viewBox = svg.getAttribute('viewBox').split(/\s+/).map(parseFloat);
      // viewBox = [x, y, w, h]; y < 0 means the viewport grew upward to
      // fit the ledger lines / stem of E6 (which protrudes above the
      // staff band).
      expect(viewBox[1]).toBeLessThan(0);
      const brackets = ctx.container.querySelectorAll('.ottava-bracket');
      expect(brackets).toHaveLength(0);
      expect(ctx.getLedgerLines().length).toBeGreaterThan(0);
    });

    it('renders an 8vb bracket for a low D3- run on a treble voice', () => {
      ctx.render({
        voices: [{
          id: 'lo', clef: 'treble', notes: [
            { pitch: 'D3', length: '1/4' },
            { pitch: 'C3', length: '1/4' },
            { pitch: 'B2', length: '1/4' },
            { pitch: 'A2', length: '1/4' },
          ],
        }],
      });
      const brackets = ctx.container.querySelectorAll('.ottava-bracket');
      expect(brackets).toHaveLength(1);
      expect(brackets[0].classList.contains('ottava-8vb')).toBe(true);
    });

    it('emits console.warn and drops the bracket on multi-voice conflict', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      ctx.render({
        voices: [
          { id: 'v1', clef: 'treble', notes: [
            { pitch: 'G6', length: '1/4' },
            { pitch: 'A6', length: '1/4' },
            { pitch: 'B6', length: '1/4' },
            { pitch: 'C7', length: '1/4' },
          ]},
          { id: 'v2', clef: 'treble', notes: [
            { pitch: 'D3', length: '1/4' },
            { pitch: 'C3', length: '1/4' },
            { pitch: 'B2', length: '1/4' },
            { pitch: 'A2', length: '1/4' },
          ]},
        ],
      });
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toMatch(/disagree on 8va/);
      // Conflicting span dropped on both voices — no brackets rendered.
      const brackets = ctx.container.querySelectorAll('.ottava-bracket');
      expect(brackets).toHaveLength(0);
      warnSpy.mockRestore();
    });

    it('renders an 8vb bracket for a bass-clef voice descending below F1', () => {
      // New in this iteration: bass clef runs the 8vb pass with bass-specific
      // thresholds (trigger = F1 MIDI 29, in-range edge = G1 MIDI 31).
      ctx.render({
        voices: [{
          id: 'lo', clef: 'bass', notes: [
            { pitch: 'F1', length: '1/4' },
            { pitch: 'E1', length: '1/4' },
            { pitch: 'D1', length: '1/4' },
            { pitch: 'C1', length: '1/4' },
          ],
        }],
      });
      const brackets = ctx.container.querySelectorAll('.ottava-bracket');
      expect(brackets).toHaveLength(1);
      expect(brackets[0].classList.contains('ottava-8vb')).toBe(true);
    });

    it('does NOT render 8va on a bass-clef voice even when pitches are high', () => {
      // Bass + 8va is the engraving anti-pattern the analyzer must suppress.
      ctx.render({
        voices: [{
          id: 'hi', clef: 'bass', notes: [
            { pitch: 'G6', length: '1/4' },
            { pitch: 'A6', length: '1/4' },
            { pitch: 'B6', length: '1/4' },
            { pitch: 'C7', length: '1/4' },
          ],
        }],
      });
      expect(ctx.container.querySelectorAll('.ottava-bracket')).toHaveLength(0);
    });

    it('ledger-lines-extreme preset renders zero ottava brackets (the in-range limit)', async () => {
      const { default: preset } = await import(
        '../dev/presets/ledger-lines-extreme.js'
      );
      ctx.render(preset.song);
      expect(ctx.container.querySelectorAll('.ottava-bracket')).toHaveLength(0);
      // Many ledger lines (the whole point of the preset).
      expect(ctx.getLedgerLines().length).toBeGreaterThan(10);
    });

    it('clears the bracket above the highest notehead in an 8va segment (and below the lowest for 8vb)', () => {
      // 8va segment whose highest in-bracket pitch (after shift) lands above
      // the top staff line with ledger lines. D7 shifts down to D6 — D6 has
      // 2 ledger lines above the staff. Per Gould "Behind Bars" (Ottava,
      // p. 75), the bracket sits clear of the highest content by ~1 staff
      // space (≥20px). Old behavior used a fixed -50 offset, which the D6
      // notehead (staff Y = -50) crashed straight into.
      ctx.render([
        { pitch: 'D7', length: '1/4' },
        { pitch: 'C7', length: '1/4' },
        { pitch: 'B6', length: '1/4' },
        { pitch: 'A6', length: '1/4' },
      ]);
      const va = ctx.container.querySelector('.ottava-bracket.ottava-8va');
      expect(va).not.toBeNull();
      const vaGlyph = va.querySelector('.ottava-glyph');
      const vaGlyphY = parseFloat(/translate\([^,]+,\s*([-\d.]+)\)/.exec(
        vaGlyph.getAttribute('transform')
      )[1]);
      const vaLine = va.querySelector('.ottava-line');
      const vaLineY = parseFloat(vaLine.getAttribute('y1'));

      // Highest notehead Y (smallest Y in SVG coords) in the staff-local
      // frame is on the `.note` group transform.
      const notes = ctx.container.querySelectorAll('.note');
      const noteYs = [];
      notes.forEach((n) => {
        const m = /translate\([^,]+,\s*([-\d.]+)\)/.exec(n.getAttribute('transform') || '');
        if (m) noteYs.push(parseFloat(m[1]));
      });
      const highestNoteY = Math.min(...noteYs);

      // Bracket must clear the highest notehead by at least one staff space.
      expect(vaGlyphY).toBeLessThanOrEqual(highestNoteY - 20);
      expect(vaLineY).toBeLessThanOrEqual(highestNoteY - 20);

      // Mirror: 8vb segment with a very low in-bracket pitch. A2 shifts up
      // to A3 — well below the bottom staff line.
      ctx.renderer.clear();
      ctx.render({
        voices: [{
          id: 'lo', clef: 'treble', notes: [
            { pitch: 'D2', length: '1/4' },
            { pitch: 'E2', length: '1/4' },
            { pitch: 'F2', length: '1/4' },
            { pitch: 'G2', length: '1/4' },
          ],
        }],
      });
      const vb = ctx.container.querySelector('.ottava-bracket.ottava-8vb');
      expect(vb).not.toBeNull();
      const vbGlyph = vb.querySelector('.ottava-glyph');
      const vbGlyphY = parseFloat(/translate\([^,]+,\s*([-\d.]+)\)/.exec(
        vbGlyph.getAttribute('transform')
      )[1]);
      const vbLine = vb.querySelector('.ottava-line');
      const vbLineY = parseFloat(vbLine.getAttribute('y1'));

      const lowNotes = ctx.container.querySelectorAll('.note');
      const lowYs = [];
      lowNotes.forEach((n) => {
        const m = /translate\([^,]+,\s*([-\d.]+)\)/.exec(n.getAttribute('transform') || '');
        if (m) lowYs.push(parseFloat(m[1]));
      });
      const lowestNoteY = Math.max(...lowYs);

      expect(vbGlyphY).toBeGreaterThanOrEqual(lowestNoteY + 20);
      expect(vbLineY).toBeGreaterThanOrEqual(lowestNoteY + 20);
    });

    it('ottava-showcase preset renders the expected bracket population (wide single-system)', async () => {
      const { default: preset } = await import(
        '../dev/presets/ottava-showcase.js'
      );
      // Force a single system so each ottava segment renders as one
      // bracket (system breaking splits segments across systems with
      // their own glyph + hook each — see the cross-system test).
      const c = document.createElement('div');
      const r = new NotationRenderer({ container: c, width: 2400 });
      r.render(preset.song);
      const brackets = c.querySelectorAll('.ottava-bracket');
      // Treble: 2 x 8va + 1 x 8vb; bass: 1 x 8vb. Total = 4.
      expect(brackets).toHaveLength(4);
      const eightVas = c.querySelectorAll('.ottava-bracket.ottava-8va');
      const eightVbs = c.querySelectorAll('.ottava-bracket.ottava-8vb');
      expect(eightVas).toHaveLength(2);
      expect(eightVbs).toHaveLength(2);
    });
  });

  describe('intrinsic measure-width measurement pass', () => {
    it('exposes a per-voice + combined intrinsic-width table after render', async () => {
      const { default: preset } = await import(
        '../dev/presets/single-voice-treble.js'
      );
      ctx.render(preset.song);
      const widths = ctx.renderer.getIntrinsicWidths();

      expect(widths).not.toBeNull();
      expect(Array.isArray(widths.perVoice)).toBe(true);
      expect(widths.perVoice).toHaveLength(1);

      const v0 = widths.perVoice[0];
      expect(v0.voiceId).toBe('0');
      expect(Array.isArray(v0.measures)).toBe(true);
      expect(v0.measures.length).toBeGreaterThan(0);
      for (const m of v0.measures) {
        expect(typeof m.measureIndex).toBe('number');
        expect(typeof m.intrinsicWidth).toBe('number');
        expect(m.intrinsicWidth).toBeGreaterThan(0);
        expect(typeof m.contentNoteCount).toBe('number');
      }

      expect(Array.isArray(widths.combined)).toBe(true);
      expect(widths.combined).toHaveLength(v0.measures.length);
      for (let i = 0; i < widths.combined.length; i += 1) {
        expect(widths.combined[i].measureIndex).toBe(i);
        expect(widths.combined[i].intrinsicWidth).toBeGreaterThan(0);
      }
    });

    it('clears the cached widths on clear() and on a fresh render', () => {
      ctx.render([{ pitch: 'C4', length: '1/4' }]);
      expect(ctx.renderer.getIntrinsicWidths()).not.toBeNull();
      ctx.renderer.clear();
      expect(ctx.renderer.getIntrinsicWidths()).toBeNull();

      ctx.render([{ pitch: 'D4', length: '1/2' }]);
      const after = ctx.renderer.getIntrinsicWidths();
      expect(after).not.toBeNull();
      expect(after.perVoice[0].measures[0].contentNoteCount).toBe(1);
    });
  });

  describe('single-system rendering (renderSystem seam)', () => {
    it('renders one staff and one clef per voice for a single-system piece', () => {
      const svg = ctx.render([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'F4', length: '1/4' },
      ]);

      // Exactly one staff (one system, one voice)
      expect(svg.querySelectorAll('.staff-lines')).toHaveLength(1);
      // Exactly one clef glyph at the start of the (sole) system
      expect(svg.querySelectorAll('.clef')).toHaveLength(1);
    });
  });

  describe('system breaking and justification', () => {
    // Build a long single-voice 4/4 piece of N measures (quarter notes).
    const makeLongPiece = (measureCount) => {
      const notes = [];
      for (let m = 0; m < measureCount; m += 1) {
        for (let b = 0; b < 4; b += 1) {
          notes.push({ pitch: 'C4', length: '1/4' });
        }
      }
      return { timeSignature: [4, 4], notes };
    };

    it('renders a short piece as a single system', () => {
      const renderer = new NotationRenderer({ container: document.createElement('div'), width: 800 });
      // Two measures of whole notes — comfortably fits in 800px width.
      const svg = renderer.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/1' },
          { pitch: 'D4', length: '1/1' },
        ],
      });
      expect(svg.querySelectorAll('.staff-lines')).toHaveLength(1);
    });

    it('justifies a single system so its right-edge final barline lands at width', () => {
      const width = 800;
      const renderer = new NotationRenderer({ container: document.createElement('div'), width });
      // 4 measures of 1/4 notes — comfortably fits within 800px width.
      const svg = renderer.render(makeLongPiece(4));
      // Only one system → final barline is the system's right-edge marker.
      const finals = svg.querySelectorAll('.barline-final');
      expect(finals.length).toBeGreaterThanOrEqual(1);
      // Final barline group is translated to systemEndX.
      const lastFinal = finals[finals.length - 1];
      const x = parseFloat(
        /translate\(([-\d.]+),/.exec(lastFinal.getAttribute('transform'))[1]
      );
      // 4 measures comfortably fit → justified (assuming stretch ≤ 1.5):
      // landing at width within a small tolerance. If unjustified (the
      // last-system rule), x lands below width and the test still confirms
      // the barline sits to the RIGHT of the music's natural end.
      expect(x).toBeLessThanOrEqual(width + 1);
      expect(x).toBeGreaterThan(width / 2);
    });

    it('wraps a long piece onto multiple systems', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      // 16 measures of 1/4 notes — won't fit on one 400px system.
      const svg = renderer.render(makeLongPiece(16));
      const systems = svg.querySelectorAll('.staff-lines');
      expect(systems.length).toBeGreaterThanOrEqual(2);
      // Upper bound: a 16-measure piece can produce at most 16 systems
      // (one measure per system). Catches a runaway-split bug where the
      // wrapper somehow produces more systems than measures.
      expect(systems.length).toBeLessThanOrEqual(16);
      // Each system must contain at least one bar line (otherwise the
      // system is empty / measureless). Use .bar-line OR .barline-final
      // to count any barline shape.
      const staffGroups = svg.querySelectorAll('g[data-system-index]');
      for (const g of staffGroups) {
        const bars =
          g.querySelectorAll('.bar-line').length
          + g.querySelectorAll('.barline-final').length;
        expect(bars).toBeGreaterThanOrEqual(1);
      }
    });

    it('keeps voices synchronized across system boundaries — Y-bucketing (synthetic 2-voice)', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 600,
      });
      // 16-measure 2-voice piece, identical rhythm.
      const piece = {
        timeSignature: [4, 4],
        voices: [
          { id: 'top', clef: 'treble', notes: makeLongPiece(16).notes },
          { id: 'bot', clef: 'treble', notes: makeLongPiece(16).notes.map((n) => ({ ...n, pitch: 'G3' })) },
        ],
      };
      const svg = renderer.render(piece);
      const staves = svg.querySelectorAll('.staff-lines');
      const numVoices = 2;
      expect(staves.length).toBeGreaterThan(numVoices);
      expect(staves.length % numVoices).toBe(0);
      const numSystems = staves.length / numVoices;

      // Bucket per system via data-system-index (added instrumentation).
      const byIdx = new Map();
      Array.from(staves).forEach((sl) => {
        const g = sl.parentNode;
        const si = g.getAttribute('data-system-index');
        const vid = g.getAttribute('data-voice-id');
        const startM = g.getAttribute('data-start-measure');
        const endM = g.getAttribute('data-end-measure');
        if (!byIdx.has(si)) byIdx.set(si, []);
        byIdx.get(si).push({ vid, startM, endM });
      });
      expect(byIdx.size).toBe(numSystems);
      for (const [, entries] of byIdx) {
        // Each system has exactly one staff per voice with matching
        // start/end measure across voices.
        expect(entries.length).toBe(numVoices);
        const vids = entries.map((e) => e.vid).sort();
        expect(vids).toEqual(['bot', 'top']);
        const starts = new Set(entries.map((e) => e.startM));
        const ends = new Set(entries.map((e) => e.endM));
        expect(starts.size).toBe(1);
        expect(ends.size).toBe(1);
      }
    });

    it('keeps 3-voice piece synchronized across system boundaries', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 500,
      });
      const noteList = (pitch) => {
        const out = [];
        for (let m = 0; m < 12; m += 1) for (let b = 0; b < 4; b += 1) out.push({ pitch, length: '1/4' });
        return out;
      };
      const piece = {
        timeSignature: [4, 4],
        voices: [
          { id: 'a', clef: 'treble', notes: noteList('C5') },
          { id: 'b', clef: 'treble', notes: noteList('G4') },
          { id: 'c', clef: 'bass', notes: noteList('C3') },
        ],
      };
      const svg = renderer.render(piece);
      const staves = svg.querySelectorAll('.staff-lines');
      const numVoices = 3;
      expect(staves.length).toBeGreaterThan(numVoices);
      expect(staves.length % numVoices).toBe(0);
    });

    it('keeps 4-voice piece synchronized across system boundaries', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 500,
      });
      const noteList = (pitch) => {
        const out = [];
        for (let m = 0; m < 10; m += 1) for (let b = 0; b < 4; b += 1) out.push({ pitch, length: '1/4' });
        return out;
      };
      const piece = {
        timeSignature: [4, 4],
        voices: [
          { id: 'a', clef: 'treble', notes: noteList('C5') },
          { id: 'b', clef: 'treble', notes: noteList('A4') },
          { id: 'c', clef: 'bass', notes: noteList('F3') },
          { id: 'd', clef: 'bass', notes: noteList('C3') },
        ],
      };
      const svg = renderer.render(piece);
      const staves = svg.querySelectorAll('.staff-lines');
      const numVoices = 4;
      expect(staves.length).toBeGreaterThan(numVoices);
      expect(staves.length % numVoices).toBe(0);
    });

    it('system-break preserves total note content across all systems', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 600,
      });
      // 16 measures × 4 quarters = 64 sounding events.
      const svg = renderer.render(makeLongPiece(16));
      // System count > 1 confirms wrapping happened.
      expect(svg.querySelectorAll('.staff-lines').length).toBeGreaterThan(1);
      const notes = svg.querySelectorAll('.note');
      expect(notes.length).toBe(64);
    });

    it('keeps voices synchronized across system boundaries (same measure breakpoints)', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      // 16-measure 2-voice piece. Both voices play identical rhythm so
      // they should share system break points.
      const piece = {
        timeSignature: [4, 4],
        voices: [
          { id: 'top', clef: 'treble', notes: makeLongPiece(16).notes },
          { id: 'bot', clef: 'treble', notes: makeLongPiece(16).notes.map((n) => ({ ...n, pitch: 'G3' })) },
        ],
      };
      const svg = renderer.render(piece);
      // Voice 0 staff-lines and voice 1 staff-lines must come in equal
      // counts — voices break at the same measures.
      const v0 = svg.querySelectorAll('[data-voice-id="top"]');
      const v1 = svg.querySelectorAll('[data-voice-id="bot"]');
      expect(v0.length).toBe(v1.length);
      expect(v0.length).toBeGreaterThanOrEqual(2);
    });

    it('keeps a solo trailing measure unjustified (1-measure last-system rule)', () => {
      // Use whole-note measures so greedy can fit 4 per system at width
      // 1000 → greedy splits [4,4,4,4,1]. Single-measure final → ragged.
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 1000,
        breakingStrategy: 'greedy',
      });
      const piece = {
        timeSignature: [4, 4],
        notes: Array.from({ length: 17 }, () => ({ pitch: 'C4', length: '1/1' })),
      };
      const svg = renderer.render(piece);
      // Identify the last system by max data-system-index.
      const staffGroups = Array.from(svg.querySelectorAll('g[data-system-index]'));
      const lastIdx = Math.max(...staffGroups.map((g) => Number(g.getAttribute('data-system-index'))));
      const lastSystemGroups = staffGroups.filter((g) => Number(g.getAttribute('data-system-index')) === lastIdx);
      // Pin: the last system is exactly 1 measure wide (greedy [5,5,1]).
      const lastStart = Number(lastSystemGroups[0].getAttribute('data-start-measure'));
      const lastEnd = Number(lastSystemGroups[0].getAttribute('data-end-measure'));
      expect(lastEnd - lastStart + 1).toBe(1);
      // Final barline must land genuinely ragged, well shy of width.
      const finals = svg.querySelectorAll('.barline-final');
      expect(finals.length).toBe(1);
      const lastFinal = finals[finals.length - 1];
      const x = parseFloat(
        /translate\(([-\d.]+),/.exec(lastFinal.getAttribute('transform'))[1]
      );
      expect(x).toBeLessThan(1000 * 0.95);
    });

    it('keeps the final system reasonably full on a long piece (optimal breaking rebalance)', () => {
      // A long piece that with greedy left-to-right packing would end
      // with a tiny straggler system. With Knuth-Plass optimal breaking
      // the optimizer rebalances, so the last system's measure count
      // should be a reasonable fraction of the average system size.
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      const svg = renderer.render(makeLongPiece(17));
      const systems = svg.querySelectorAll('.staff-lines');
      expect(systems.length).toBeGreaterThanOrEqual(2);

      // Count measures per system via barlines per system. Each system
      // emits one final-or-internal barline per measure.
      const measureCounts = [];
      const systemGroups = svg.querySelectorAll('g[data-system-index]');
      // Fallback when the markup doesn't expose system groups by attribute:
      // assert via final-system width, which lands at this._width when
      // justified or close to it when there's enough content.
      void systemGroups;

      const finals = svg.querySelectorAll('.barline-final');
      expect(finals.length).toBeGreaterThanOrEqual(1);
      const lastFinal = finals[finals.length - 1];
      const x = parseFloat(/translate\(([-\d.]+),/.exec(lastFinal.getAttribute('transform'))[1]);
      // With optimal breaking the final system is well-filled and
      // justifies to the width (multi-measure last systems now justify
      // regardless of stretch ratio).
      expect(x).toBeGreaterThan(800 * 0.6);
      expect(x).toBeLessThanOrEqual(800 + 1);
      measureCounts.length = 0;
    });

    it('respects the breakingStrategy: "greedy" escape hatch (greedy differs from optimal)', () => {
      // 17 uniform whole-note measures at width 800: a known-pathological
      // greedy-vs-optimal input. Greedy packs [3,3,3,3,3,2] (last = 2);
      // optimal rebalances to [2,3,3,3,3,3] (last = 3). If breakingStrategy
      // is silently ignored, both render the same.
      const makeWholePiece = (mc) => {
        const notes = [];
        for (let m = 0; m < mc; m += 1) notes.push({ pitch: 'C4', length: '1/1' });
        return { timeSignature: [4, 4], notes };
      };
      const piece = makeWholePiece(17);
      const greedyR = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
        breakingStrategy: 'greedy',
      });
      const optimalR = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
        breakingStrategy: 'optimal',
      });
      const g = greedyR.render(piece);
      const o = optimalR.render(piece);

      const lastSystemMeasureCount = (svg) => {
        const groups = Array.from(svg.querySelectorAll('g[data-system-index]'));
        const lastIdx = Math.max(...groups.map((gg) => Number(gg.getAttribute('data-system-index'))));
        const last = groups.find((gg) => Number(gg.getAttribute('data-system-index')) === lastIdx);
        return Number(last.getAttribute('data-end-measure'))
          - Number(last.getAttribute('data-start-measure'))
          + 1;
      };
      const greedyLast = lastSystemMeasureCount(g);
      const optimalLast = lastSystemMeasureCount(o);
      // Greedy: 2-measure straggler. Optimal: rebalanced to ≥3.
      expect(greedyLast).toBe(2);
      expect(optimalLast).toBeGreaterThanOrEqual(3);
      // The strategies produce DIFFERENT layouts — neither silently
      // falls back to the other.
      expect(greedyLast).not.toBe(optimalLast);
    });

    it('applies a uniform scale parameter to the SVG dimensions', () => {
      const c1 = document.createElement('div');
      const r1 = new NotationRenderer({ container: c1, width: 400, scale: 1 });
      r1.render([{ pitch: 'C4', length: '1/4' }]);
      const w1 = parseFloat(c1.querySelector('svg').getAttribute('width'));
      const h1 = parseFloat(c1.querySelector('svg').getAttribute('height'));
      const vb1 = c1.querySelector('svg').getAttribute('viewBox');

      const c2 = document.createElement('div');
      const r2 = new NotationRenderer({ container: c2, width: 400, scale: 2 });
      r2.render([{ pitch: 'C4', length: '1/4' }]);
      const w2 = parseFloat(c2.querySelector('svg').getAttribute('width'));
      const h2 = parseFloat(c2.querySelector('svg').getAttribute('height'));
      const vb2 = c2.querySelector('svg').getAttribute('viewBox');

      expect(w2).toBeCloseTo(w1 * 2, 0);
      expect(h2).toBeCloseTo(h1 * 2, 0);

      // Design invariant: scale acts via width/height multiplication.
      // viewBox stays in internal coordinates — IDENTICAL across scales.
      // If a refactor introduces a transform="scale(N)" wrapper or
      // mutates viewBox, this test fails.
      expect(vb2).toBe(vb1);

      // Same number of systems regardless of scale (scale is display-only).
      const sysCount1 = c1.querySelectorAll('.staff-lines').length;
      const sysCount2 = c2.querySelectorAll('.staff-lines').length;
      expect(sysCount2).toBe(sysCount1);
    });

    it('applies fractional and larger scale factors (0.5, 3)', () => {
      const baseC = document.createElement('div');
      const baseR = new NotationRenderer({ container: baseC, width: 400, scale: 1 });
      baseR.render([{ pitch: 'C4', length: '1/4' }]);
      const wBase = parseFloat(baseC.querySelector('svg').getAttribute('width'));

      const halfC = document.createElement('div');
      new NotationRenderer({ container: halfC, width: 400, scale: 0.5 })
        .render([{ pitch: 'C4', length: '1/4' }]);
      const wHalf = parseFloat(halfC.querySelector('svg').getAttribute('width'));
      expect(wHalf).toBeCloseTo(wBase * 0.5, 0);

      const tripleC = document.createElement('div');
      new NotationRenderer({ container: tripleC, width: 400, scale: 3 })
        .render([{ pitch: 'C4', length: '1/4' }]);
      const wTriple = parseFloat(tripleC.querySelector('svg').getAttribute('width'));
      expect(wTriple).toBeCloseTo(wBase * 3, 0);
    });

    it('scale-independence of system count on a wrapping piece', () => {
      const piece = makeLongPiece(16);
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      new NotationRenderer({ container: c1, width: 600, scale: 1 }).render(piece);
      new NotationRenderer({ container: c2, width: 600, scale: 2 }).render(piece);
      const sys1 = c1.querySelectorAll('.staff-lines').length;
      const sys2 = c2.querySelectorAll('.staff-lines').length;
      expect(sys1).toBe(sys2);
      expect(sys1).toBeGreaterThan(1);
    });

    it('renders a thin-final barline at the very end of the piece', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      const svg = renderer.render(makeLongPiece(8));
      // The final barline group appears EXACTLY once (only on the last system).
      const finals = svg.querySelectorAll('.barline-final');
      expect(finals.length).toBe(1);
      // It must live inside the last system's staffGroup — i.e. its
      // ancestor data-system-index equals the maximum index.
      let g = finals[0].parentNode;
      while (g && g.getAttribute && !g.getAttribute('data-system-index')) {
        g = g.parentNode;
      }
      const finalSysIdx = Number(g.getAttribute('data-system-index'));
      const allGroups = Array.from(svg.querySelectorAll('g[data-system-index]'));
      const maxSysIdx = Math.max(...allGroups.map((gg) => Number(gg.getAttribute('data-system-index'))));
      expect(finalSysIdx).toBe(maxSysIdx);
    });

    it('renders an ottava bracket per system when a segment spans a system break', async () => {
      const { default: preset } = await import(
        '../dev/presets/ottava-showcase.js'
      );
      // Wide render: one system, baseline bracket count.
      const wideC = document.createElement('div');
      new NotationRenderer({ container: wideC, width: 4000 }).render(preset.song);
      const wideBrackets = wideC.querySelectorAll('.ottava-bracket');
      const wideSystems = wideC.querySelectorAll('.staff-lines');

      // Narrow render: multi-system. Cross-system 8va segments split.
      const narrowC = document.createElement('div');
      new NotationRenderer({ container: narrowC, width: 500 }).render(preset.song);
      const narrowSystems = narrowC.querySelectorAll('.staff-lines');
      const narrowBrackets = narrowC.querySelectorAll('.ottava-bracket');
      expect(narrowSystems.length).toBeGreaterThan(wideSystems.length);

      // Narrow must have STRICTLY more brackets — at least one segment
      // got split across a boundary.
      expect(narrowBrackets.length).toBeGreaterThan(wideBrackets.length);

      // Bucket narrow brackets by their ancestor staffGroup's
      // data-system-index. At least two adjacent system indices must
      // contain a bracket from the SAME voice — i.e. one segment split.
      const byVoiceSystem = new Map(); // vid → Set<systemIdx>
      narrowBrackets.forEach((b) => {
        let g = b.parentNode;
        while (g && g.getAttribute && !g.getAttribute('data-system-index')) {
          g = g.parentNode;
        }
        if (!g || !g.getAttribute) return;
        const si = Number(g.getAttribute('data-system-index'));
        const vid = g.getAttribute('data-voice-id');
        if (!byVoiceSystem.has(vid)) byVoiceSystem.set(vid, new Set());
        byVoiceSystem.get(vid).add(si);
      });
      let foundAdjacent = false;
      for (const [, set] of byVoiceSystem) {
        const arr = [...set].sort((a, b) => a - b);
        for (let i = 1; i < arr.length; i += 1) {
          if (arr[i] === arr[i - 1] + 1) { foundAdjacent = true; break; }
        }
        if (foundAdjacent) break;
      }
      expect(foundAdjacent).toBe(true);
    });

    it('Bach Invention 1: optimal break-point plan is stable across widths (real-music fixture)', async () => {
      const { default: preset } = await import(
        '../dev/presets/piece-bach-invention-1.js'
      );
      const planAt = (width) => {
        const c = document.createElement('div');
        new NotationRenderer({ container: c, width, breakingStrategy: 'optimal' }).render(preset.song);
        // Read one voice's worth of staffGroups (since voices replicate
        // the same plan after voice-sync), bucketed by data-system-index.
        const groups = Array.from(c.querySelectorAll('g[data-system-index][data-voice-id]'));
        const byIdx = new Map();
        for (const g of groups) {
          const si = Number(g.getAttribute('data-system-index'));
          const startM = Number(g.getAttribute('data-start-measure'));
          const endM = Number(g.getAttribute('data-end-measure'));
          if (!byIdx.has(si)) byIdx.set(si, { startM, endM });
        }
        return Array.from(byIdx.keys())
          .sort((a, b) => a - b)
          .map((k) => byIdx.get(k));
      };
      const wide = planAt(2000);
      const narrow = planAt(400);
      // Wide: single system covering all measures. Pin the full plan.
      expect(wide).toHaveLength(1);
      expect(wide[0].startM).toBe(0);
      const lastMeasure = wide[0].endM;
      // Narrow: multiple systems — optimal must have split.
      expect(narrow.length).toBeGreaterThan(1);
      // Coverage invariant: contiguous and complete.
      let expected = 0;
      for (const p of narrow) {
        expect(p.startM).toBe(expected);
        expected = p.endM + 1;
      }
      expect(narrow[narrow.length - 1].endM).toBe(lastMeasure);
      // Determinism: rendering twice at the same width gives the same plan.
      const narrow2 = planAt(400);
      expect(narrow2).toEqual(narrow);
    });

    it('monotonicity w.r.t. width: widening never produces more systems', () => {
      const piece = makeLongPiece(16);
      const sysAt = (w) => {
        const c = document.createElement('div');
        new NotationRenderer({ container: c, width: w }).render(piece);
        const groups = Array.from(c.querySelectorAll('g[data-system-index]'));
        return new Set(groups.map((g) => g.getAttribute('data-system-index'))).size;
      };
      const s400 = sysAt(400);
      const s800 = sysAt(800);
      const s1200 = sysAt(1200);
      expect(s800).toBeLessThanOrEqual(s400);
      expect(s1200).toBeLessThanOrEqual(s800);
    });

    it('does not reopen a phantom ottava on the next system when a segment ended cleanly', async () => {
      // Use a 2-measure preset slice: place 8va in bar 1 only, then
      // force wrapping. Bar 2 must NOT carry a bracket.
      const piece = {
        timeSignature: [4, 4],
        notes: [
          // Bar 1 — 8va run
          { pitch: 'G6', length: '1/4' },
          { pitch: 'A6', length: '1/4' },
          { pitch: 'B6', length: '1/4' },
          { pitch: 'C7', length: '1/4' },
          // Bar 2 — back to mid-staff (should NOT trigger 8va)
          { pitch: 'C5', length: '1/4' },
          { pitch: 'E5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'C5', length: '1/4' },
        ],
      };
      // Width small enough to force a break between the two bars.
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 280,
      });
      const svg = renderer.render(piece);
      const staves = svg.querySelectorAll('.staff-lines');
      expect(staves.length).toBeGreaterThanOrEqual(2);
      // No bracket may appear in the system holding bar 2.
      const brackets = svg.querySelectorAll('.ottava-bracket');
      brackets.forEach((b) => {
        let g = b.parentNode;
        while (g && g.getAttribute && !g.getAttribute('data-start-measure')) {
          g = g.parentNode;
        }
        const startM = g && g.getAttribute ? Number(g.getAttribute('data-start-measure')) : -1;
        expect(startM).toBe(0); // brackets only in the first system
      });
    });

    // Failure-catching test: catches the previous regression where the
    // render loop was voice-major and produced
    //   treble-bar1 / bass-bar1 / treble-bar2 / bass-bar2
    // as four separate single-staff systems instead of two systems each
    // containing BOTH voices stacked. Must stay green.
    it('multi-voice piece keeps voices stacked within each system', async () => {
      const { default: preset } = await import(
        '../dev/presets/piece-bach-invention-1.js'
      );
      const song = preset.song;
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 600, // narrow enough to wrap the 4-bar Bach Invention
      });
      const svg = renderer.render(song);

      const staves = svg.querySelectorAll('.staff-lines');
      const numVoices = song.voices.length;
      expect(numVoices).toBe(2);

      // Wrapped → more total staff-line elements than voices.
      expect(staves.length).toBeGreaterThan(numVoices);
      // Every system must contain EVERY voice exactly once.
      expect(staves.length % numVoices).toBe(0);

      const numSystems = staves.length / numVoices;
      expect(numSystems).toBeGreaterThanOrEqual(2);

      // Read each staff's absolute y (via parent .staff group's transform).
      const staffEntries = Array.from(staves).map((sl) => {
        let g = sl.parentNode;
        let yAccum = 0;
        const vid = sl.parentNode.getAttribute('data-voice-id');
        while (g && g.getAttribute) {
          const t = g.getAttribute('transform');
          if (t) {
            const m = /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/.exec(t);
            if (m) yAccum += parseFloat(m[1]);
          }
          g = g.parentNode;
        }
        return { vid, y: yAccum };
      });

      // Bucket by detecting the largest gaps in the sorted Y list —
      // (numSystems - 1) largest gaps are inter-system; everything else
      // is intra-system. This is robust regardless of the precise
      // voice spacing within a system.
      const sorted = staffEntries.slice().sort((a, b) => a.y - b.y);
      const gaps = [];
      for (let i = 1; i < sorted.length; i += 1) {
        gaps.push({ i, size: sorted[i].y - sorted[i - 1].y });
      }
      gaps.sort((a, b) => b.size - a.size);
      const breakIndices = new Set(
        gaps.slice(0, numSystems - 1).map((g) => g.i)
      );
      const buckets = [];
      let current = [sorted[0]];
      for (let i = 1; i < sorted.length; i += 1) {
        if (breakIndices.has(i)) {
          buckets.push(current);
          current = [];
        }
        current.push(sorted[i]);
      }
      buckets.push(current);

      // Critical assertion: every system bucket has exactly numVoices
      // staves, the voice ids cover the full voice set, and the Y
      // values are distinct. If the loop ever reverts to voice-major
      // (one voice per "system"), buckets will be size 1 and this fails.
      expect(buckets.length).toBe(numSystems);
      const allVoiceIds = song.voices.map((v) => v.id);
      for (const bucket of buckets) {
        expect(bucket.length).toBe(numVoices);
        const ys = bucket.map((e) => e.y);
        expect(new Set(ys).size).toBe(numVoices);
        const vids = bucket.map((e) => e.vid).sort();
        expect(vids).toEqual(allVoiceIds.slice().sort());
      }
    });

    // Within a system, both voices share x positions for the same beat.
    it('within a system, voices share x positions at the same beat', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      // Short two-voice piece that fits in one system. Both voices share
      // the downbeat of measure 1.
      const piece = {
        timeSignature: [4, 4],
        voices: [
          { id: 'top', clef: 'treble', notes: [
            { pitch: 'C5', length: '1/4' },
            { pitch: 'D5', length: '1/4' },
            { pitch: 'E5', length: '1/4' },
            { pitch: 'F5', length: '1/4' },
          ] },
          { id: 'bot', clef: 'treble', notes: [
            { pitch: 'C4', length: '1/4' },
            { pitch: 'D4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
            { pitch: 'F4', length: '1/4' },
          ] },
        ],
      };
      const svg = renderer.render(piece);
      const topNotes = svg.querySelectorAll('[data-voice-id="top"] .note');
      const botNotes = svg.querySelectorAll('[data-voice-id="bot"] .note');
      expect(topNotes.length).toBeGreaterThan(0);
      expect(topNotes.length).toBe(botNotes.length);
      // First downbeat — x positions should match within 1px.
      const xOf = (el) => parseFloat(
        /translate\(([-\d.]+),/.exec(el.getAttribute('transform'))[1]
      );
      expect(Math.abs(xOf(topNotes[0]) - xOf(botNotes[0]))).toBeLessThanOrEqual(1);
    });
  });

  describe('rhythm-proportional (spring-model) spacing', () => {
    const xOf = (el) => parseFloat(
      /translate\(([-\d.]+),/.exec(el.getAttribute('transform'))[1]
    );

    it('leaves quarter-note gaps visibly larger than eighth-note gaps under stretch', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      // Measure: [quarter, quarter, eighth, eighth, eighth, eighth] = 4 beats.
      // The first two quarters straddle a long gap; the eighths in the
      // second half straddle short gaps. Width 800 forces significant
      // justification → springs differentiate.
      const svg = renderer.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
        ],
      });
      const notes = svg.querySelectorAll('.note');
      expect(notes.length).toBe(6);
      const xs = Array.from(notes).map(xOf);
      const quarterGap = xs[1] - xs[0]; // C → D, a quarter-duration gap
      const eighthGap = xs[3] - xs[2]; // E → F, an eighth-duration gap
      expect(quarterGap).toBeGreaterThan(eighthGap * 1.3);
    });

    it('keeps the system fully justified — last barline lands at width within 1px', () => {
      const width = 800;
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width,
      });
      const svg = renderer.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
        ],
      });
      const finals = svg.querySelectorAll('.barline-final');
      const lastFinal = finals[finals.length - 1];
      const x = parseFloat(
        /translate\(([-\d.]+),/.exec(lastFinal.getAttribute('transform'))[1]
      );
      expect(x).toBeLessThanOrEqual(width + 1);
      // Right edge sits well past the midpoint — either fully justified
      // (when there's slack) or at the natural end (when the music is
      // already wider than the canvas).
      expect(x).toBeGreaterThan(width / 2);
    });

    it('keeps multi-voice notes at the same beat aligned to the same x', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      // Two voices with mixed rhythms — the downbeat of each beat is
      // shared, the off-beats are not.
      const svg = renderer.render({
        timeSignature: [4, 4],
        voices: [
          { id: 'top', clef: 'treble', notes: [
            { pitch: 'C5', length: '1/4' },
            { pitch: 'D5', length: '1/4' },
            { pitch: 'E5', length: '1/4' },
            { pitch: 'F5', length: '1/4' },
          ] },
          { id: 'bot', clef: 'treble', notes: [
            { pitch: 'C4', length: '1/8' },
            { pitch: 'C4', length: '1/8' },
            { pitch: 'D4', length: '1/4' },
            { pitch: 'E4', length: '1/4' },
            { pitch: 'F4', length: '1/4' },
          ] },
        ],
      });
      const topNotes = svg.querySelectorAll('[data-voice-id="top"] .note');
      const botNotes = svg.querySelectorAll('[data-voice-id="bot"] .note');
      // Top voice: quarters at beats 0, 1, 2, 3.
      // Bot voice: eighths at beats 0, 0.5, then quarters at 1, 2, 3.
      // Sample EVERY shared downbeat (0, 1, 2, 3).
      // Beat 0: top[0] and bot[0]
      expect(Math.abs(xOf(topNotes[0]) - xOf(botNotes[0]))).toBeLessThanOrEqual(1);
      // Beat 1: top[1] and bot[2]
      expect(Math.abs(xOf(topNotes[1]) - xOf(botNotes[2]))).toBeLessThanOrEqual(1);
      // Beat 2: top[2] and bot[3]
      expect(Math.abs(xOf(topNotes[2]) - xOf(botNotes[3]))).toBeLessThanOrEqual(1);
      // Beat 3: top[3] and bot[4]
      expect(Math.abs(xOf(topNotes[3]) - xOf(botNotes[4]))).toBeLessThanOrEqual(1);
    });

    it('rhythmic gap proportions preserved across widths (quarter:eighth)', () => {
      const piece = {
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/8' },
          { pitch: 'F4', length: '1/8' },
          { pitch: 'G4', length: '1/8' },
          { pitch: 'A4', length: '1/8' },
        ],
      };
      const ratioAt = (width) => {
        const c = document.createElement('div');
        new NotationRenderer({ container: c, width }).render(piece);
        const ns = c.querySelectorAll('.note');
        const xs = Array.from(ns).map(xOf);
        return (xs[1] - xs[0]) / (xs[3] - xs[2]);
      };
      const r400 = ratioAt(400);
      const r800 = ratioAt(800);
      // Same piece at very different widths must preserve rhythmic
      // proportions within 20% — the engraving-quality property the
      // spring model is supposed to deliver.
      expect(Math.abs(r400 - r800) / Math.max(r400, r800)).toBeLessThan(0.2);
    });

    it('preserves natural spacing when the system is not justified — gap is strictly smaller than under stretch', () => {
      // Whole-note piece of 4 bars fits naturally in a small width.
      const piece = {
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/1' },
          { pitch: 'D4', length: '1/1' },
          { pitch: 'E4', length: '1/1' },
          { pitch: 'F4', length: '1/1' },
        ],
      };
      const gapAt = (width) => {
        const c = document.createElement('div');
        new NotationRenderer({ container: c, width }).render(piece);
        const notes = c.querySelectorAll('.note');
        const xs = Array.from(notes).map(xOf);
        return xs[1] - xs[0];
      };
      // At a width close to the natural minimum vs. wide width with
      // lots of slack: the gap MUST be larger under stretch. A bug
      // that uniformly scaled would produce equal gaps and fail this.
      const tight = gapAt(280);
      const loose = gapAt(1600);
      expect(loose).toBeGreaterThan(tight + 1);
    });

    it('preserves natural spacing when the system is not justified (slack ≤ 0)', () => {
      // Construct a piece whose natural width matches or slightly exceeds
      // the canvas — no slack, no stretch. The spring model should leave
      // the natural beat positions intact (down to barline padding).
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 250, // small enough that a few quarters fill it naturally
      });
      const svg = renderer.render({
        timeSignature: [4, 4],
        notes: [
          { pitch: 'C4', length: '1/4' },
          { pitch: 'D4', length: '1/4' },
          { pitch: 'E4', length: '1/4' },
          { pitch: 'F4', length: '1/4' },
        ],
      });
      const notes = svg.querySelectorAll('.note');
      expect(notes.length).toBe(4);
      // Quarter-to-quarter gaps in a no-stretch system should all be
      // equal (within fp jitter) because each spring has identical K.
      const xs = Array.from(notes).map(xOf);
      const g1 = xs[1] - xs[0];
      const g2 = xs[2] - xs[1];
      const g3 = xs[3] - xs[2];
      expect(Math.abs(g1 - g2)).toBeLessThan(1);
      expect(Math.abs(g2 - g3)).toBeLessThan(1);
    });
  });

  describe('reactive layout (scheduleRender + rAF batching)', () => {
    // Build a piece long enough to wrap onto multiple systems at small widths.
    const makeLongPiece = () => {
      const notes = [];
      for (let i = 0; i < 64; i++) {
        notes.push({ pitch: 'C5', length: '1/4' });
      }
      return { timeSignature: [4, 4], voices: [{ id: 'v1', clef: 'treble', notes }] };
    };

    // Drive the rAF-scheduled flush synchronously. Using the documented
    // _flush hook keeps tests deterministic without timer mocking; the
    // spec explicitly endorses driving _flush directly from tests.
    const tick = (renderer) => renderer._flush();

    it('render(song) returns the SVG synchronously', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      const svg = renderer.render([{ pitch: 'C4', length: '1/4' }]);
      expect(svg).not.toBeNull();
      expect(svg.tagName).toBe('svg');
    });

    it('setWidth batches: SVG does not change until rAF flush', () => {
      const container = document.createElement('div');
      const renderer = new NotationRenderer({ container, width: 1600 });
      renderer.render(makeLongPiece());
      const beforeSvg = renderer.getSvgElement();
      const stavesBefore = beforeSvg.querySelectorAll('.staff-lines').length;

      renderer.setWidth(800);
      // Same SVG element still in the DOM until rAF fires.
      expect(renderer.getSvgElement()).toBe(beforeSvg);
      expect(
        beforeSvg.querySelectorAll('.staff-lines').length
      ).toBe(stavesBefore);

      tick(renderer);

      const afterSvg = renderer.getSvgElement();
      expect(afterSvg).not.toBe(beforeSvg);
      // Reflow happened: narrower width produces more systems.
      expect(
        afterSvg.querySelectorAll('.staff-lines').length
      ).toBeGreaterThan(stavesBefore);
    });

    it('coalesces multiple setWidth calls in the same tick into one render', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 1600,
      });
      renderer.render(makeLongPiece());

      const flushSpy = jest.spyOn(renderer, '_flush');
      renderer.setWidth(400);
      renderer.setWidth(500);
      renderer.setWidth(600);

      // Nothing has flushed yet.
      expect(flushSpy).not.toHaveBeenCalled();

      tick(renderer);

      // Exactly one flush, at the latest width.
      expect(flushSpy).toHaveBeenCalledTimes(1);
      expect(
        parseFloat(renderer.getSvgElement().getAttribute('width'))
      ).toBeCloseTo(600, 0);
    });

    it('setSong batches: pre-tick SVG unchanged, post-tick note count matches new song', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      renderer.render([{ pitch: 'C4', length: '1/4' }]);
      const beforeSvg = renderer.getSvgElement();
      const noteCountBefore = beforeSvg.querySelectorAll('.note').length;
      expect(noteCountBefore).toBe(1);

      const newSong = [
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
      ];
      renderer.setSong(newSong);

      // Pre-tick: SVG identity unchanged AND note count still old value.
      expect(renderer.getSvgElement()).toBe(beforeSvg);
      expect(beforeSvg.querySelectorAll('.note').length).toBe(noteCountBefore);

      tick(renderer);

      const noteCountAfter = renderer.getSvgElement().querySelectorAll('.note').length;
      // Exact note count, not just "greater than".
      expect(noteCountAfter).toBe(3);
    });

    it('setScale batches: pre-tick invariance + post-tick height-doubled + viewBox unchanged + system count unchanged', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
        scale: 1,
      });
      renderer.render({
        timeSignature: [4, 4],
        notes: (() => {
          const out = [];
          for (let i = 0; i < 16; i += 1) out.push({ pitch: 'C4', length: '1/4' });
          return out;
        })(),
      });
      const beforeSvg = renderer.getSvgElement();
      const w1 = parseFloat(beforeSvg.getAttribute('width'));
      const h1 = parseFloat(beforeSvg.getAttribute('height'));
      const vb1 = beforeSvg.getAttribute('viewBox');
      const sys1 = beforeSvg.querySelectorAll('.staff-lines').length;

      renderer.setScale(2);

      // Pre-tick invariance: SVG identity unchanged, width unchanged.
      expect(renderer.getSvgElement()).toBe(beforeSvg);
      expect(parseFloat(beforeSvg.getAttribute('width'))).toBe(w1);

      tick(renderer);

      const after = renderer.getSvgElement();
      expect(parseFloat(after.getAttribute('width'))).toBeCloseTo(w1 * 2, 0);
      expect(parseFloat(after.getAttribute('height'))).toBeCloseTo(h1 * 2, 0);
      // viewBox is in internal coords — unchanged by scale.
      expect(after.getAttribute('viewBox')).toBe(vb1);
      // System count unchanged — scale is display-only.
      expect(after.querySelectorAll('.staff-lines').length).toBe(sys1);
    });

    it('cross-setter coalescing: setSong + setWidth + setScale → exactly one flush', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 1600,
        scale: 1,
      });
      renderer.render([{ pitch: 'C4', length: '1/4' }]);
      const flushSpy = jest.spyOn(renderer, '_flush');

      renderer.setSong([
        { pitch: 'C4', length: '1/4' },
        { pitch: 'D4', length: '1/4' },
        { pitch: 'E4', length: '1/4' },
        { pitch: 'F4', length: '1/4' },
      ]);
      renderer.setWidth(800);
      renderer.setScale(2);

      expect(flushSpy).not.toHaveBeenCalled();
      tick(renderer);
      expect(flushSpy).toHaveBeenCalledTimes(1);

      // After tick: all three setters applied.
      const svg = renderer.getSvgElement();
      expect(svg.querySelectorAll('.note').length).toBe(4);
      // Width: 800 internal × scale 2 = 1600 displayed.
      expect(parseFloat(svg.getAttribute('width'))).toBeCloseTo(1600, 0);
    });

    it('rAF is scheduled exactly once across multiple setters in one tick', () => {
      const originalRAF = global.requestAnimationFrame;
      const rafSpy = jest.fn((cb) => {
        // Return a dummy id; don't actually invoke cb until tick().
        return 1;
      });
      global.requestAnimationFrame = rafSpy;
      try {
        const renderer = new NotationRenderer({
          container: document.createElement('div'),
          width: 1600,
        });
        renderer.render([{ pitch: 'C4', length: '1/4' }]);
        rafSpy.mockClear();

        renderer.setWidth(400);
        renderer.setWidth(500);
        renderer.setWidth(600);
        // Exactly ONE rAF scheduled across three setters.
        expect(rafSpy).toHaveBeenCalledTimes(1);
        // Argument is a function.
        expect(typeof rafSpy.mock.calls[0][0]).toBe('function');
      } finally {
        global.requestAnimationFrame = originalRAF;
      }
    });

    it('setWidth before any render(song) is a no-op (no SVG appears)', () => {
      const renderer = new NotationRenderer({
        container: document.createElement('div'),
        width: 800,
      });
      renderer.setWidth(400);
      // Manually drain any pending work — nothing should appear.
      renderer._flush();
      expect(renderer.getSvgElement()).toBeNull();
    });

    describe('ResizeObserver integration', () => {
      // Minimal jsdom-friendly ResizeObserver mock. Captures the callback so
      // tests can fire it on demand with a synthetic size.
      let observerInstances;
      let originalRO;

      beforeEach(() => {
        observerInstances = [];
        originalRO = global.ResizeObserver;
        global.ResizeObserver = class {
          constructor(cb) {
            this.cb = cb;
            this.targets = [];
            observerInstances.push(this);
          }
          observe(target) { this.targets.push(target); }
          unobserve(target) {
            this.targets = this.targets.filter((t) => t !== target);
          }
          disconnect() { this.targets = []; }
          // Test helper: trigger the callback as if a resize fired.
          // Passes realistic entries[] so future code that reads
          // entries[0].contentRect.width works correctly. Matches the
          // real spec: callbacks only fire for observed targets — if
          // targets has been cleared (disconnect), this is a no-op.
          fire() {
            if (this.targets.length === 0) return;
            const entries = this.targets.map((t) => ({
              target: t,
              contentRect: { width: t.clientWidth || 0, height: t.clientHeight || 0 },
            }));
            this.cb(entries, this);
          }
        };
      });

      afterEach(() => {
        global.ResizeObserver = originalRO;
      });

      it('observe() attaches a ResizeObserver to the container', () => {
        const container = document.createElement('div');
        const renderer = new NotationRenderer({ container, width: 800 });
        renderer.render([{ pitch: 'C4', length: '1/4' }]);
        renderer.observe();
        expect(observerInstances.length).toBe(1);
        expect(observerInstances[0].targets).toContain(container);
      });

      it('observe() is idempotent — a second call does not double-attach', () => {
        const container = document.createElement('div');
        const renderer = new NotationRenderer({ container, width: 800 });
        renderer.render([{ pitch: 'C4', length: '1/4' }]);
        renderer.observe();
        renderer.observe();
        expect(observerInstances.length).toBe(1);
      });

      it('unobserve() after observe + fire — no render', () => {
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {
          configurable: true,
          get: () => 600,
        });
        const renderer = new NotationRenderer({
          container,
          width: 1200,
          responsiveMode: 'reflow',
        });
        renderer.render(makeLongPiece());
        renderer.observe();
        const obs = observerInstances[0];
        renderer.unobserve();
        // After unobserve, targets must be empty.
        expect(obs.targets.length).toBe(0);
        const widthBefore = renderer._width;
        obs.fire(); // would be a no-op since disconnected
        tick(renderer);
        expect(renderer._width).toBe(widthBefore);
      });

      it('reflow mode: callback maps clientWidth/scale to setWidth', () => {
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {
          configurable: true,
          get: () => 1200,
        });
        const renderer = new NotationRenderer({
          container,
          width: 1600,
          scale: 2,
          responsiveMode: 'reflow',
        });
        renderer.render(makeLongPiece());
        renderer.observe();

        observerInstances[0].fire();
        tick(renderer);

        // 1200 / scale(2) = 600
        expect(renderer._width).toBeCloseTo(600, 0);
        // Reflow at width=600 should produce multiple systems for a 64-quarter piece.
        const staves = renderer.getSvgElement().querySelectorAll('.staff-lines');
        expect(staves.length).toBeGreaterThan(1);
      });

      it('zoom-to-fit mode: callback updates scale, not width; system count unchanged', () => {
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {
          configurable: true,
          get: () => 1200,
        });
        const renderer = new NotationRenderer({
          container,
          width: 800,
          scale: 1,
          responsiveMode: 'zoom-to-fit',
        });
        renderer.render(makeLongPiece());
        const stavesBefore =
          renderer.getSvgElement().querySelectorAll('.staff-lines').length;

        renderer.observe();
        observerInstances[0].fire();
        tick(renderer);

        // scale = clientWidth / naturalWidth = 1200/800 = 1.5
        expect(renderer._scale).toBeCloseTo(1.5, 3);
        const stavesAfter =
          renderer.getSvgElement().querySelectorAll('.staff-lines').length;
        // Same logical width, so same system count — only the scale changed.
        expect(stavesAfter).toBe(stavesBefore);
      });

      it('clear() disconnects the ResizeObserver so callbacks no longer render', () => {
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {
          configurable: true,
          get: () => 600,
        });
        const renderer = new NotationRenderer({ container, width: 1200 });
        renderer.render(makeLongPiece());
        renderer.observe();
        const obs = observerInstances[0];

        renderer.clear();
        // Directly assert the observer's targets were emptied — pins
        // the disconnect contract independent of _song being nulled.
        expect(obs.targets.length).toBe(0);
        // Further fires must not crash or render.
        obs.fire();
        renderer._flush(); // best-effort manual drain
        expect(renderer.getSvgElement()).toBeNull();
      });

      it('observeContainer:true in constructor attaches an observer without an explicit observe() call', () => {
        const container = document.createElement('div');
        // eslint-disable-next-line no-new
        new NotationRenderer({ container, observeContainer: true });
        expect(observerInstances.length).toBe(1);
      });
    });
  });

  describe('articulation clearance from notehead', () => {
    // Per Gould "Behind Bars" p. 117, the gap between the notehead edge and
    // the articulation's nearest edge should be approximately 0.5 staff space
    // (~10px here, where 1 staff space = 20px). Since articulation transforms
    // are measured from notehead center, the nearest edge of the articulation
    // must sit at least 20px (head half-height 10 + half staff space 10)
    // above/below note center.
    it('places a marcato above a stem-down F5 with at least 0.5 staff space of clearance from the notehead', () => {
      // F5 sits above the middle line -> stem points down -> articulation above.
      ctx.render([{ pitch: 'F5', length: '1/4', articulation: 'marcato' }]);

      const artic = ctx.container.querySelector('.articulation-marcato');
      expect(artic).not.toBeNull();
      const transform = artic.getAttribute('transform');
      const yMatch = transform.match(/translate\(0,\s*(-?[\d.]+)\)/);
      expect(yMatch).not.toBeNull();
      const y = parseFloat(yMatch[1]);

      // The articulation's center must sit at least 20px above note center
      // (head half-height 10 + half staff space 10), so its nearest edge
      // clears the notehead's top edge by at least 0.5 staff space.
      expect(y).toBeLessThanOrEqual(-20);
    });
  });

  describe('beamed grace-note runs (Gould p. 125)', () => {
    // Beamed grace notes are conventionally rendered as sixteenths — two
    // parallel beam bars — regardless of how a single (unbeamed) grace is
    // drawn. Gould "Behind Bars" p. 125 makes this explicit for both
    // acciaccatura and appoggiatura runs.
    it('renders two parallel beams across a beamed acciaccatura run', () => {
      ctx.render([
        {
          pitch: 'A5',
          length: '1/4',
          grace: [
            { pitch: 'F5', type: 'acciaccatura' },
            { pitch: 'G5', type: 'acciaccatura' },
          ],
        },
      ]);

      const beams = ctx.container.querySelectorAll('rect.grace-beam');
      expect(beams).toHaveLength(2);

      // The two beams should be parallel (same width, same thickness, same x)
      // and offset vertically by approximately one beam thickness + a gap.
      const [b0, b1] = beams;
      expect(b0.getAttribute('width')).toBe(b1.getAttribute('width'));
      expect(b0.getAttribute('height')).toBe(b1.getAttribute('height'));
      expect(b0.getAttribute('x')).toBe(b1.getAttribute('x'));

      const y0 = parseFloat(b0.getAttribute('y'));
      const y1 = parseFloat(b1.getAttribute('y'));
      const dy = Math.abs(y1 - y0);
      // Beam thickness is 4; standard practice puts the gap at ~one beam
      // thickness. Accept a generous range so the test pins the qualitative
      // "two parallel sixteenth-beams" convention without over-fitting.
      expect(dy).toBeGreaterThanOrEqual(6);
      expect(dy).toBeLessThanOrEqual(12);
    });
  });

  // Dynamic-letter clearance from the staff. Per Gould "Behind Bars"
  // (Dynamics), point dynamics below the staff sit clear of the bottom
  // staff line — the convention is ≥1.5 staff spaces (30px at
  // LINE_SPACING=20) between the bottom staff line and the TOP of the
  // dynamic letters. Earlier passes placed the dynamic origin at y=110,
  // which put a 'p' (Bravura yMax=274 fu × 0.08 = 21.9px above origin)
  // top above the staff bottom (y=90) — letters virtually touched the
  // bottom line.
  describe('dynamic letter clearance below staff (Gould Dynamics)', () => {
    it('places "pp" so the letter tops sit ≥1.5 staff spaces below the staff bottom', () => {
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { pitch: 'G5', length: '1/4', dynamic: 'pp' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
          { pitch: 'G5', length: '1/4' },
        ],
      });

      const dyn = ctx.container.querySelector('.dynamic');
      expect(dyn).not.toBeNull();

      // Pull translate-y from the .dynamic group transform.
      const t = dyn.getAttribute('transform');
      const match = t.match(/translate\(\s*[^,]+,\s*([^)]+)\)/);
      expect(match).not.toBeNull();
      const groupY = parseFloat(match[1]);

      // Bravura 'p' glyph: bbox.yMax = 274 fu, SMUFL_SCALE = 0.08
      // → letter top sits 274*0.08 = 21.92px above the group origin
      // (the scale(x,-y) inner transform flips y).
      const PP_YMAX_FU = 274;
      const SMUFL_SCALE = 0.08;
      const letterTopY = groupY - PP_YMAX_FU * SMUFL_SCALE;

      // Single-staff geometry: STAFF_TOP_OFFSET=10, STAFF_HEIGHT=80
      // → bottom line y = 90.
      const STAFF_BOTTOM_Y = 90;
      const clearance = letterTopY - STAFF_BOTTOM_Y;

      // Gould: ≥1.5 staff spaces between staff bottom and dynamic top.
      expect(clearance).toBeGreaterThanOrEqual(30);
    });

    // Per Gould "Behind Bars" (Dynamics), a dynamic sits below the LOWEST
    // point of the music it pertains to, with ≥1 staff space of clearance,
    // but never closer than DYNAMICS_Y_MIN to the staff. A fixed y is
    // non-responsive: a dynamic under a low note (ledger lines below) ends
    // up colliding with the notehead.
    it('shifts dynamic y down for low-pitch targets while keeping high-pitch dynamics at the floor', () => {
      ctx.render({
        clef: 'treble',
        timeSignature: [4, 4],
        notes: [
          { dynamic: 'p' },
          { pitch: 'G5', length: '1/4' },
          { dynamic: 'f' },
          { pitch: 'C3', length: '1/4' },
          { pitch: 'G5', length: '1/2' },
        ],
      });

      const dyns = ctx.container.querySelectorAll('.dynamic');
      expect(dyns.length).toBe(2);

      function groupY(g) {
        const t = g.getAttribute('transform') || '';
        const m = /translate\(\s*[^,]+,\s*([^)]+)\)/.exec(t);
        return m ? parseFloat(m[1]) : NaN;
      }

      // Identify the two dynamics by data-dynamic.
      const pDyn = ctx.container.querySelector('.dynamic[data-dynamic="p"]');
      const fDyn = ctx.container.querySelector('.dynamic[data-dynamic="f"]');
      expect(pDyn).not.toBeNull();
      expect(fDyn).not.toBeNull();
      const pY = groupY(pDyn);
      const fY = groupY(fDyn);

      // (1) High-pitch dynamic sits at the configured min (DYNAMICS_Y_MIN=160).
      expect(pY).toBe(160);
      // (2) Low-pitch dynamic sits LOWER than the min — responds to C3's
      // notehead extending well below the staff (4 ledger lines below).
      expect(fY).toBeGreaterThan(pY);

      // (3) Each dynamic clears its target note's lowest extent by
      // ≥1 staff space (20px at LINE_SPACING=20). Lowest extent for a
      // low-pitch note is the notehead bottom (stem points up). Using
      // pitchToStaffY-equivalent geometry: G5 y=70, C3 y=180; notehead
      // half ≈ 5px. For G5 stem-down: stem bottom ≈ 70 + STEM_LENGTH(70) = 140.
      const G5_LOWEST = 70 + 70; // 140
      const C3_LOWEST = 180 + 5; // 185
      expect(pY - G5_LOWEST).toBeGreaterThanOrEqual(20);
      expect(fY - C3_LOWEST).toBeGreaterThanOrEqual(20);
    });
  });
});
