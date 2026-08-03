/** @jest-environment jsdom */

/**
 * Renderer-level tests for pickup (anacrusis) measures
 * (SPEC-pickup-and-barline-lyrics.md JOB B).
 *
 * `pickupBeats` (top-level, quarter-note beats) makes measure 0 span
 * [0, pickupBeats) and shifts every later measure boundary by pickupBeats.
 * data-beat stays system-relative; data-start-measure counts the pickup as
 * measure 0; the barline after the pickup is a normal thin barline; no
 * time-signature re-print.
 */

import { NotationRenderer } from './NotationRenderer.js';
import americaPickup from './__tests__/fixtures/america-the-beautiful-pickup.json';

function renderSong(song, width = 800) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const renderer = new NotationRenderer({ container, width });
  renderer.render(song);
  return {
    container,
    cleanup() {
      renderer.clear();
      container.remove();
    },
  };
}

function translateOf(el) {
  const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(
    el.getAttribute('transform') || ''
  );
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

/** Sounding .note/.rest x positions within one staff group, DOM order. */
function noteXs(scope) {
  return [...scope.querySelectorAll('.note')]
    .filter((g) => !g.closest('.grace-note'))
    .map((g) => translateOf(g).x);
}

function barlineXs(scope) {
  return [...scope.querySelectorAll('.bar-line line')].map((l) =>
    parseFloat(l.getAttribute('x1'))
  );
}

// A one-voice 4/4 phrase with a 1-beat pickup and two full measures.
// Lyric-free so JOB-1/JOB-A lyric widening can't push it onto two systems
// at the test width — these tests are about the measure GRID.
const pickupSong = (extra = {}) => ({
  timeSignature: [4, 4],
  pickupBeats: 1,
  notes: [
    { pitch: 'G4', length: '1/4' }, // pickup
    { pitch: 'C5', length: '1/4' },
    { pitch: 'B4', length: '1/4' },
    { pitch: 'A4', length: '1/4' },
    { pitch: 'G4', length: '1/4' },
    { pitch: 'A4', length: '1/4' },
    { pitch: 'B4', length: '1/4' },
    { pitch: 'C5', length: '1/4' },
    { pitch: 'D5', length: '1/4' },
  ],
  ...extra,
});

describe('pickup measures (JOB B)', () => {
  it('renders a short first measure: the first barline sits between the pickup note and the downbeat', () => {
    const { container, cleanup } = renderSong(pickupSong(), 1400);
    expect(container.querySelectorAll('[data-voice-id]').length).toBe(1);
    const staff = container.querySelector('[data-voice-id]');
    const xs = noteXs(staff);
    const bars = barlineXs(staff).sort((a, b) => a - b);
    // Boundaries at beats 1 and 5 → two interior auto-barlines (the closing
    // beat-9 barline is the system-end final pair).
    expect(bars.length).toBe(2);
    expect(bars[0]).toBeGreaterThan(xs[0]);
    expect(bars[0]).toBeLessThan(xs[1]);
    expect(bars[1]).toBeGreaterThan(xs[4]);
    expect(bars[1]).toBeLessThan(xs[5]);
    cleanup();
  });

  it('keeps data-beat system-relative and unshifted (pickup note at beat 0)', () => {
    const { container, cleanup } = renderSong(pickupSong(), 1400);
    expect(container.querySelectorAll('[data-voice-id]').length).toBe(1);
    const beats = [...container.querySelectorAll('.note')].map((g) =>
      parseFloat(g.getAttribute('data-beat'))
    );
    expect(beats).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    cleanup();
  });

  it('prints the time signature once and no special barline after the pickup', () => {
    const { container, cleanup } = renderSong(pickupSong(), 1400);
    expect(container.querySelectorAll('.time-signature').length).toBe(1);
    // The pickup's closing barline is a plain thin auto-barline: no repeat/
    // final barline group left of the first downbeat.
    const staff = container.querySelector('[data-voice-id]');
    const downbeatX = noteXs(staff)[1];
    for (const bl of staff.querySelectorAll('.barline')) {
      expect(translateOf(bl).x).toBeGreaterThan(downbeatX);
    }
    cleanup();
  });

  it('counts the pickup as measure 0 in data-start/end-measure and slices multi-system pieces on the shifted grid', () => {
    // 1-beat pickup + 12 full measures of quarters — wraps at width 800.
    const notes = [{ pitch: 'G4', length: '1/4' }];
    for (let m = 0; m < 12; m += 1) {
      for (let i = 0; i < 4; i += 1) {
        notes.push({ pitch: ['C5', 'B4', 'A4', 'G4'][i], length: '1/4' });
      }
    }
    const song = { timeSignature: [4, 4], pickupBeats: 1, notes };
    const { container, cleanup } = renderSong(song, 800);

    const systems = [...container.querySelectorAll('[data-voice-id]')];
    expect(systems.length).toBeGreaterThan(1);
    expect(systems[0].getAttribute('data-start-measure')).toBe('0');
    // Measure ranges are contiguous and cover pickup + 12 measures = 13.
    let expectedStart = 0;
    for (const sys of systems) {
      expect(parseInt(sys.getAttribute('data-start-measure'), 10)).toBe(expectedStart);
      expectedStart = parseInt(sys.getAttribute('data-end-measure'), 10) + 1;
    }
    expect(expectedStart).toBe(13);
    // Every note renders exactly once across systems.
    expect(container.querySelectorAll('.note').length).toBe(notes.length);
    // System 0 holds the pickup: its note count is 1 + 4·k.
    const sys0Notes = noteXs(systems[0]).length;
    expect((sys0Notes - 1) % 4).toBe(0);
    // Continuation systems hold whole measures: multiples of 4.
    for (const sys of systems.slice(1)) {
      expect(noteXs(sys).length % 4).toBe(0);
    }
    cleanup();
  });

  it('throws when a voice does not fill the pickup exactly', () => {
    const song = {
      timeSignature: [4, 4],
      pickupBeats: 1,
      notes: [
        { pitch: 'G4', length: '1/2' }, // crosses the 1-beat pickup boundary
        { pitch: 'C5', length: '1/2' },
        { pitch: 'B4', length: '1/1' },
      ],
    };
    const renderer = new NotationRenderer({ width: 800 });
    expect(() => renderer.render(song)).toThrow(/pickup/);
  });

  it('throws for pickupBeats >= the measure length and for unmetered input', () => {
    const notes = [{ pitch: 'G4', length: '1/1' }];
    expect(() =>
      new NotationRenderer({ width: 800 }).render({
        timeSignature: [4, 4],
        pickupBeats: 4,
        notes,
      })
    ).toThrow(/shorter than a full measure/);
    expect(() =>
      new NotationRenderer({ width: 800 }).render({
        pickupBeats: 1,
        notes,
      })
    ).toThrow(/timeSignature/);
  });

  it('beams a 1.5-beat pickup against the measure END (last two eighths beam; the off-beat first eighth stands alone)', () => {
    const song = {
      timeSignature: [4, 4],
      pickupBeats: 1.5,
      notes: [
        { pitch: 'E4', length: '1/8' }, // virtual beat 2.5 — alone
        { pitch: 'F4', length: '1/8' }, // virtual beat 3.0 ┐ beam
        { pitch: 'G4', length: '1/8' }, // virtual beat 3.5 ┘
        { pitch: 'A4', length: '1/4' },
        { pitch: 'B4', length: '1/4' },
        { pitch: 'A4', length: '1/4' },
        { pitch: 'G4', length: '1/4' },
      ],
    };
    const { container, cleanup } = renderSong(song, 1200);
    const groups = [...container.querySelectorAll('.beam-group')];
    expect(groups.length).toBe(1);
    expect(groups[0].querySelectorAll('.note').length).toBe(2);
    const beamedBeats = [...groups[0].querySelectorAll('.note')].map((g) =>
      parseFloat(g.getAttribute('data-beat'))
    );
    expect(beamedBeats).toEqual([0.5, 1]);
    cleanup();
  });

  it('resets accidental memory at the pickup barline', () => {
    const song = {
      timeSignature: [4, 4],
      pickupBeats: 1,
      notes: [
        { pitch: 'F#4', length: '1/4' }, // pickup: prints #
        { pitch: 'F#4', length: '1/4' }, // new measure: prints # again
        { pitch: 'F#4', length: '1/4' }, // same measure: suppressed
        { pitch: 'G4', length: '1/4' },
        { pitch: 'A4', length: '1/4' },
      ],
    };
    const { container, cleanup } = renderSong(song, 1200);
    expect(container.querySelectorAll('.accidental').length).toBe(2);
    cleanup();
  });

  it('draws shared (bridged) barlines on the shifted grid for braced staves', () => {
    const mkNotes = (p1, p2) => [
      { pitch: p1, length: '1/4' },
      ...Array.from({ length: 8 }, (_, i) => ({
        pitch: i % 2 ? p1 : p2,
        length: '1/4',
      })),
    ];
    const song = {
      timeSignature: [4, 4],
      pickupBeats: 1,
      voices: [
        { id: 's', clef: 'treble', notes: mkNotes('C5', 'A4') },
        { id: 'b', clef: 'bass', notes: mkNotes('C3', 'E3') },
      ],
      staffGroups: [{ type: 'brace', voiceIds: ['s', 'b'] }],
    };
    const { container, cleanup } = renderSong(song, 1200);
    // Interior boundaries at beats 1 and 5 → shared barlines at the same x
    // as each voice's auto-barlines (plus the x=0 system-start line).
    const staff = container.querySelector('[data-voice-id]');
    const perVoiceBars = barlineXs(staff).sort((a, b) => a - b);
    const sharedXs = [...container.querySelectorAll('.shared-bar-line line')]
      .map((l) => parseFloat(l.getAttribute('x1')))
      .filter((x) => x > 0)
      .sort((a, b) => a - b);
    expect(perVoiceBars.length).toBe(2);
    expect(sharedXs).toEqual(perVoiceBars);
    // The first bridged barline closes the 1-beat pickup: it sits between
    // the pickup note and the first downbeat.
    const xs = noteXs(staff);
    expect(perVoiceBars[0]).toBeGreaterThan(xs[0]);
    expect(perVoiceBars[0]).toBeLessThan(xs[1]);
    cleanup();
  });

  describe('singHarmony2 fixture (America the Beautiful, real 1-beat pickup)', () => {
    it('renders 17 measures (pickup + 16) with contiguous system ranges and a short pickup measure', () => {
      // Width 1600 (internal units) gives multi-measure systems so system 0
      // holds the pickup PLUS full measures; at 800 this dense 4-verse SATB
      // engraving legitimately fits only ~one measure per system.
      const { container, cleanup } = renderSong(americaPickup, 1600);
      const systems = [...container.querySelectorAll('[data-voice-id="soprano"]')];
      expect(systems.length).toBeGreaterThan(1);
      let expectedStart = 0;
      for (const sys of systems) {
        expect(parseInt(sys.getAttribute('data-start-measure'), 10)).toBe(expectedStart);
        expectedStart = parseInt(sys.getAttribute('data-end-measure'), 10) + 1;
      }
      expect(expectedStart).toBe(17);
      // The pickup barline closes measure 0 right after the first soprano
      // note ("O" — beat 0..1); the first barline of system 0 must sit
      // between the first and second notes.
      const xs = noteXs(systems[0]);
      const bars = barlineXs(systems[0]).sort((a, b) => a - b);
      expect(bars[0]).toBeGreaterThan(xs[0]);
      expect(bars[0]).toBeLessThan(xs[1]);
      cleanup();
    });

    it('renders every soprano note exactly once across systems', () => {
      const { container, cleanup } = renderSong(americaPickup, 1600);
      const sopranoNotes = [
        ...container.querySelectorAll('[data-voice-id="soprano"] .note'),
      ];
      const expected = americaPickup.voices[0].notes.filter((n) => n.pitch).length;
      expect(sopranoNotes.length).toBe(expected);
      cleanup();
    });
  });
});
