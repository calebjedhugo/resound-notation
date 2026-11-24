/** @jest-environment jsdom */

/**
 * Double dots (`dotted: 2`, ×1.75) and per-note ties inside chords, through
 * the public render() — what resound-fe's song editor writes.
 */

import { createNotationContext } from './__tests__/helpers/testUtils.js';
import { dotCount, dotFactor } from './lib/durationSymbols.js';
import { createNote } from './components/Note.js';
import { createRest } from './components/Rest.js';
import { pitchToStaffY } from './lib/notePositions.js';

function translateOf(el) {
  const m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(el.getAttribute('transform') || '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** The y where a tie path starts (its first M command). */
function tieStartY(path) {
  const m = /M\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(path.getAttribute('d') || '');
  return m ? Number(m[2]) : NaN;
}

describe('dot count and factor', () => {
  it('reads true / 1 as one dot and 2 as a double dot', () => {
    expect(dotCount(undefined)).toBe(0);
    expect(dotCount(false)).toBe(0);
    expect(dotCount(0)).toBe(0);
    expect(dotCount(true)).toBe(1);
    expect(dotCount(1)).toBe(1);
    expect(dotCount(2)).toBe(2);
    expect(dotFactor(undefined)).toBe(1);
    expect(dotFactor(true)).toBe(1.5);
    expect(dotFactor(2)).toBe(1.75);
  });
});

describe('double dots', () => {
  let ctx;
  beforeEach(() => {
    ctx = createNotationContext();
  });
  afterEach(() => ctx.cleanup && ctx.cleanup());

  it('a lone note and rest draw two dots in a row on the same space', () => {
    const note = createNote({ pitch: 'C5', length: '1/4', x: 0, clef: 'treble', dotted: 2 });
    const dots = [...note.querySelectorAll('.augmentation-dot')].map(translateOf);
    expect(dots).toHaveLength(2);
    expect(dots[1].y).toBe(dots[0].y);
    expect(dots[1].x).toBeGreaterThan(dots[0].x + 8); // clear of the first dot

    const rest = createRest({ length: '1/4', x: 0, dotted: 2 });
    expect(rest.querySelectorAll('.augmentation-dot')).toHaveLength(2);
    const single = createNote({ pitch: 'C5', length: '1/4', x: 0, clef: 'treble', dotted: true });
    expect(single.querySelectorAll('.augmentation-dot')).toHaveLength(1);
  });

  it('a double-dotted half lasts 3.5 beats: the next note starts there, one 4/4 bar holds both', () => {
    ctx.render({
      timeSignature: [4, 4],
      voices: [
        {
          id: 'v',
          clef: 'treble',
          notes: [
            { pitch: 'G4', length: '1/2', dotted: 2 },
            { pitch: 'A4', length: '1/8' },
            { pitch: 'B4', length: '1/4' },
          ],
        },
      ],
    });
    const notes = ctx.getNotes();
    expect(notes[0].querySelectorAll('.augmentation-dot')).toHaveLength(2);
    expect(notes[1].getAttribute('data-beat')).toBe('3.5');
    expect(notes[2].getAttribute('data-beat')).toBe('4');
    expect(ctx.getBarLines().length).toBeGreaterThanOrEqual(1);
  });

  it('a dotted chord dots every head (two dots when double-dotted), in spaces', () => {
    ctx.render({
      timeSignature: null,
      voices: [
        {
          id: 'v',
          clef: 'treble',
          notes: [
            [
              { pitch: 'C4', length: '1/4', dotted: 2 },
              { pitch: 'G4', length: '1/4', dotted: 2 },
            ],
            [
              { pitch: 'E4', length: '1/4', dotted: true },
              { pitch: 'C5', length: '1/4', dotted: true },
            ],
            [
              { pitch: 'E4', length: '1/4' },
              { pitch: 'G4', length: '1/4' },
            ],
          ],
        },
      ],
    });
    const chords = ctx.container.querySelectorAll('.chord');
    const dots = (chord) => [...chord.querySelectorAll('.augmentation-dot')].map(translateOf);
    const first = dots(chords[0]);
    expect(first).toHaveLength(4); // two heads, two dots each
    // C4 and G4 sit on lines: each dot goes to the space above
    const c4 = pitchToStaffY('C4', 'treble');
    const g4 = pitchToStaffY('G4', 'treble');
    expect(first.map((d) => d.y).sort((a, b) => a - b)).toEqual(
      [g4 - 10, g4 - 10, c4 - 10, c4 - 10].sort((a, b) => a - b)
    );
    expect(dots(chords[1])).toHaveLength(2);
    expect(dots(chords[2])).toHaveLength(0);
  });

  it('a second dots its shared space once', () => {
    ctx.render({
      timeSignature: null,
      voices: [
        {
          id: 'v',
          clef: 'treble',
          notes: [
            [
              { pitch: 'E4', length: '1/4', dotted: true }, // line: dot in the space above
              { pitch: 'F4', length: '1/4', dotted: true }, // that space
            ],
          ],
        },
      ],
    });
    const chord = ctx.container.querySelector('.chord');
    expect(chord.querySelectorAll('.augmentation-dot')).toHaveLength(1);
  });
});

describe('per-note ties in chords', () => {
  let ctx;
  beforeEach(() => {
    ctx = createNotationContext();
  });
  afterEach(() => ctx.cleanup && ctx.cleanup());

  it('ties only the chord tone that carries the tie, to the same pitch next', () => {
    ctx.render({
      timeSignature: null,
      voices: [
        {
          id: 'v',
          clef: 'treble',
          notes: [
            [
              { pitch: 'C4', length: '1/4' },
              { pitch: 'G4', length: '1/4', tie: 'start' },
            ],
            [
              { pitch: 'E4', length: '1/4' },
              { pitch: 'G4', length: '1/4', tie: 'stop' },
            ],
          ],
        },
      ],
    });
    const ties = ctx.getTies();
    expect(ties).toHaveLength(1);
    // The arc hangs off G4's head (13 px off its centre, above or below)
    const y = tieStartY(ties[0]);
    expect(Math.abs(Math.abs(y - pitchToStaffY('G4', 'treble')) - 13)).toBeLessThan(0.01);
  });

  it('a tie into an entry without that pitch draws nothing', () => {
    ctx.render({
      timeSignature: null,
      voices: [
        {
          id: 'v',
          clef: 'treble',
          notes: [
            [
              { pitch: 'C4', length: '1/4' },
              { pitch: 'G4', length: '1/4', tie: 'start' },
            ],
            [
              { pitch: 'C4', length: '1/4' },
              { pitch: 'A4', length: '1/4' },
            ],
          ],
        },
      ],
    });
    expect(ctx.getTies()).toHaveLength(0);
  });
});
