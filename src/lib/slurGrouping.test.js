/** @jest-environment jsdom */
import { resolveSlurs } from './slurGrouping.js';

describe('resolveSlurs', () => {
  test('returns an empty list when no slur markers exist', () => {
    const notes = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4' },
    ];
    expect(resolveSlurs(notes)).toEqual([]);
  });

  test('groups a single start/stop pair', () => {
    const notes = [
      { pitch: 'C4', length: '1/4', slur: 'start' },
      { pitch: 'D4', length: '1/4' },
      { pitch: 'E4', length: '1/4', slur: 'stop' },
    ];
    expect(resolveSlurs(notes)).toEqual([
      { startIndex: 0, stopIndex: 2, depth: 0 },
    ]);
  });

  test('supports nested slurs via stack', () => {
    const notes = [
      { pitch: 'C4', length: '1/4', slur: 'start' },
      { pitch: 'D4', length: '1/4', slur: 'start' },
      { pitch: 'E4', length: '1/4', slur: 'stop' },
      { pitch: 'F4', length: '1/4', slur: 'stop' },
    ];
    const slurs = resolveSlurs(notes);
    expect(slurs).toHaveLength(2);
    // Inner (depth 1) closes first.
    expect(slurs[0]).toEqual({ startIndex: 1, stopIndex: 2, depth: 1 });
    // Outer (depth 0) closes second.
    expect(slurs[1]).toEqual({ startIndex: 0, stopIndex: 3, depth: 0 });
  });

  test('detects slurs on chord notes', () => {
    const notes = [
      [{ pitch: 'C4', length: '1/4', slur: 'start' }, { pitch: 'E4', length: '1/4' }],
      [{ pitch: 'D4', length: '1/4' }, { pitch: 'F4', length: '1/4', slur: 'stop' }],
    ];
    const slurs = resolveSlurs(notes);
    expect(slurs).toHaveLength(1);
    expect(slurs[0]).toMatchObject({ startIndex: 0, stopIndex: 1 });
  });

  test('a dangling stop without a matching start is ignored', () => {
    const notes = [
      { pitch: 'C4', length: '1/4' },
      { pitch: 'D4', length: '1/4', slur: 'stop' },
    ];
    expect(resolveSlurs(notes)).toEqual([]);
  });
});
