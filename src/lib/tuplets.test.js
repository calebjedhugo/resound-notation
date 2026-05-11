/** @jest-environment jsdom */
import { getTupletNoteDuration, getTupletGroupBeats } from './tuplets.js';

describe('getTupletNoteDuration', () => {
  test('triplet eighth: 1/8 written, 3-in-the-space-of-2 → 1/3 beat', () => {
    // faceBeats(1/8) = 0.5; ratio normal/actual = 2/3 → 0.5 * (2/3) = 1/3.
    expect(getTupletNoteDuration('1/8', false, [3, 2])).toBeCloseTo(1 / 3);
  });

  test('quintuplet sixteenth: 1/16 written, 5-in-the-space-of-4', () => {
    // faceBeats(1/16) = 0.25; ratio 4/5 → 0.25 * 0.8 = 0.2.
    expect(getTupletNoteDuration('1/16', false, [5, 4])).toBeCloseTo(0.2);
  });

  test('sextuplet sixteenth: 1/16 written, 6-in-the-space-of-4', () => {
    // faceBeats(1/16) = 0.25; ratio 4/6 → 0.25 * (2/3) = 1/6.
    expect(getTupletNoteDuration('1/16', false, [6, 4])).toBeCloseTo(1 / 6);
  });

  test('dotted faces multiply face beats by 1.5', () => {
    // Dotted eighth, written 1/8 dotted: 0.75 beats face. In a triplet
    // (3:2) the effective duration is 0.75 * (2/3) = 0.5 beats.
    expect(getTupletNoteDuration('1/8', true, [3, 2])).toBeCloseTo(0.5);
  });
});

describe('getTupletGroupBeats', () => {
  test('triplet of three eighths sums to one beat', () => {
    const triplet = {
      tuplet: [3, 2],
      notes: [
        { pitch: 'C4', length: '1/8' },
        { pitch: 'D4', length: '1/8' },
        { pitch: 'E4', length: '1/8' },
      ],
    };
    expect(getTupletGroupBeats(triplet)).toBeCloseTo(1);
  });

  test('chord members inside a tuplet count once (use first note)', () => {
    const triplet = {
      tuplet: [3, 2],
      notes: [
        [{ pitch: 'C4', length: '1/8' }, { pitch: 'E4', length: '1/8' }],
        { pitch: 'D4', length: '1/8' },
        { pitch: 'E4', length: '1/8' },
      ],
    };
    expect(getTupletGroupBeats(triplet)).toBeCloseTo(1);
  });
});
