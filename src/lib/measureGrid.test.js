/** @jest-environment jsdom */

/**
 * Unit tests for the centralized measure grid
 * (SPEC-pickup-and-barline-lyrics.md JOB B).
 */

import {
  measureStartBeat,
  measureIndexAt,
  isMeasureBoundary,
  measureFillLength,
  pickupBeamOffset,
  validatePickup,
} from './measureGrid.js';

describe('measureStartBeat', () => {
  it('no pickup: m * L', () => {
    expect(measureStartBeat(0, 4)).toBe(0);
    expect(measureStartBeat(3, 4)).toBe(12);
  });

  it('pickup: measure 0 at 0, measure m at p + (m-1)L', () => {
    expect(measureStartBeat(0, 4, 1)).toBe(0);
    expect(measureStartBeat(1, 4, 1)).toBe(1);
    expect(measureStartBeat(2, 4, 1)).toBe(5);
    expect(measureStartBeat(4, 3, 1.5)).toBe(10.5);
  });
});

describe('measureIndexAt', () => {
  it('no pickup: floor(beat / L) with the legacy epsilon', () => {
    expect(measureIndexAt(0, 4)).toBe(0);
    expect(measureIndexAt(3.999999, 4)).toBe(1); // within 1e-6 of boundary
    expect(measureIndexAt(4, 4)).toBe(1);
    expect(measureIndexAt(7.5, 4)).toBe(1);
  });

  it('pickup: [0,p) is measure 0; boundaries shift by p', () => {
    expect(measureIndexAt(0, 4, 1)).toBe(0);
    expect(measureIndexAt(0.5, 4, 1)).toBe(0);
    expect(measureIndexAt(1, 4, 1)).toBe(1);
    expect(measureIndexAt(4.5, 4, 1)).toBe(1);
    expect(measureIndexAt(5, 4, 1)).toBe(2);
  });

  it('round-trips with measureStartBeat', () => {
    for (const p of [0, 1, 1.5]) {
      for (let m = 0; m < 5; m += 1) {
        expect(measureIndexAt(measureStartBeat(m, 4, p), 4, p)).toBe(m);
      }
    }
  });
});

describe('isMeasureBoundary', () => {
  it('no pickup: multiples of L', () => {
    expect(isMeasureBoundary(0, 4)).toBe(true);
    expect(isMeasureBoundary(4, 4)).toBe(true);
    expect(isMeasureBoundary(5, 4)).toBe(false);
    expect(isMeasureBoundary(8.0000001, 4)).toBe(true);
  });

  it('pickup: p + kL (and beat 0), never bare multiples of L', () => {
    expect(isMeasureBoundary(1, 4, 1)).toBe(true);
    expect(isMeasureBoundary(5, 4, 1)).toBe(true);
    expect(isMeasureBoundary(4, 4, 1)).toBe(false);
    expect(isMeasureBoundary(0.5, 4, 1)).toBe(false);
  });

  it('unmetered: never', () => {
    expect(isMeasureBoundary(4, null)).toBe(false);
  });
});

describe('measureFillLength', () => {
  it('pickup shortens only measure 0', () => {
    expect(measureFillLength(0, 4, 1)).toBe(1);
    expect(measureFillLength(1, 4, 1)).toBe(4);
    expect(measureFillLength(0, 4, 0)).toBe(4);
  });
});

describe('pickupBeamOffset', () => {
  it('maps the pickup onto the tail of a virtual measure', () => {
    expect(pickupBeamOffset(4, 1)).toBe(3);
    expect(pickupBeamOffset(4, 1.5)).toBe(2.5);
    expect(pickupBeamOffset(4, 0)).toBe(0);
  });
});

describe('validatePickup', () => {
  const q = (pitch) => ({ pitch, length: '1/4' });
  const voices = (notes) => [{ id: 'v', notes }];

  it('accepts a voice whose events land exactly on the pickup boundary', () => {
    expect(() =>
      validatePickup(voices([q('C4'), q('D4'), q('E4'), q('F4'), q('G4')]), 1, 4)
    ).not.toThrow();
  });

  it('rejects pickupBeats <= 0, non-numbers, and >= a full measure', () => {
    expect(() => validatePickup(voices([q('C4')]), 0, 4)).toThrow(/positive/);
    expect(() => validatePickup(voices([q('C4')]), -1, 4)).toThrow(/positive/);
    expect(() => validatePickup(voices([q('C4')]), '1', 4)).toThrow(/positive/);
    expect(() => validatePickup(voices([q('C4')]), 4, 4)).toThrow(/shorter than a full measure/);
    expect(() => validatePickup(voices([q('C4')]), 5, 4)).toThrow(/shorter than a full measure/);
  });

  it('rejects a missing time signature', () => {
    expect(() => validatePickup(voices([q('C4')]), 1, null)).toThrow(/timeSignature/);
  });

  it('rejects an element straddling the pickup boundary', () => {
    expect(() =>
      validatePickup(voices([{ pitch: 'C4', length: '1/2' }, q('D4')]), 1, 4)
    ).toThrow(/crosses the pickup boundary/);
  });

  it('rejects a voice shorter than the pickup', () => {
    expect(() =>
      validatePickup(voices([{ pitch: 'C4', length: '1/8' }]), 1, 4)
    ).toThrow(/ends at beat/);
  });

  it('markers occupy no time and do not affect the fill check', () => {
    expect(() =>
      validatePickup(
        voices([{ dynamic: 'mf' }, q('C4'), q('D4'), q('E4'), q('F4'), q('G4')]),
        1,
        4
      )
    ).not.toThrow();
  });

  it('a rest may fill the pickup (converter-style input)', () => {
    expect(() =>
      validatePickup(voices([{ length: '1/4' }, q('C4')]), 1, 4)
    ).not.toThrow();
  });
});
