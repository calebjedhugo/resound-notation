/**
 * Duration/length utilities.
 * Maps fraction strings to note type names, visual properties, and beat values.
 */

export const VALID_LENGTHS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'];

const DURATION_MAP = {
  '1/1': {
    name: 'whole',
    cssClass: 'note-whole',
    hasStem: false,
    filledHead: false,
    flags: 0,
    beams: 0,
    // Per-duration horizontal advance. Standard engraving (Gould) uses
    // sub-linear spacing — each doubling in duration gets ~sqrt(2)≈1.4x
    // more horizontal space, not 2x. With 16th=50 as the baseline, this
    // makes proportional-mixed-duration measures feel right: a beat of
    // four 16ths gets ~similar width to a beat of two 8ths or one quarter.
    spacing: 200,
  },
  '1/2': {
    name: 'half',
    cssClass: 'note-half',
    hasStem: true,
    filledHead: false,
    flags: 0,
    beams: 0,
    spacing: 140,
  },
  '1/4': {
    name: 'quarter',
    cssClass: 'note-quarter',
    hasStem: true,
    filledHead: true,
    flags: 0,
    beams: 0,
    spacing: 100,
  },
  '1/8': {
    name: 'eighth',
    cssClass: 'note-eighth',
    hasStem: true,
    filledHead: true,
    flags: 1,
    beams: 1,
    spacing: 70,
  },
  '1/16': {
    name: '16th',
    cssClass: 'note-16th',
    hasStem: true,
    filledHead: true,
    flags: 2,
    beams: 2,
    spacing: 50,
  },
  '1/32': {
    name: '32nd',
    cssClass: 'note-32nd',
    hasStem: true,
    filledHead: true,
    flags: 3,
    beams: 3,
    spacing: 36,
  },
};

const FRACTION_REGEX = /^(\d+)\/(\d+)$/;

// These three parsers sit inside the renderer's hottest loops (the system
// breaker calls them once per note per candidate run), so each memoizes on
// its input string. The key space is tiny — a handful of length strings per
// piece — so the maps stay small for the life of the module.
const fractionCache = new Map();
const beatsCache = new Map();

/**
 * Parse a fraction string into numerator and denominator.
 * The returned object is shared and frozen — treat it as read-only.
 * @param {string} lengthString - e.g. "1/4"
 * @returns {{ numerator: number, denominator: number }}
 */
export function parseFraction(lengthString) {
  let parsed = fractionCache.get(lengthString);
  if (!parsed) {
    const match = lengthString.match(FRACTION_REGEX);
    if (!match) {
      throw new Error(`Invalid fraction: "${lengthString}"`);
    }
    parsed = Object.freeze({
      numerator: parseInt(match[1], 10),
      denominator: parseInt(match[2], 10),
    });
    fractionCache.set(lengthString, parsed);
  }
  return parsed;
}

/**
 * Convert a fraction string to beat count (quarter note = 1 beat).
 * @param {string} lengthString - e.g. "1/4"
 * @returns {number}
 */
export function fractionToBeats(lengthString) {
  let beats = beatsCache.get(lengthString);
  if (beats === undefined) {
    const { numerator, denominator } = parseFraction(lengthString);
    beats = (numerator / denominator) * 4;
    beatsCache.set(lengthString, beats);
  }
  return beats;
}

// Freeze the rows so getDurationInfo can hand out shared references instead
// of cloning one object per note per layout pass.
for (const info of Object.values(DURATION_MAP)) Object.freeze(info);

/**
 * Get visual/rendering properties for a note duration.
 * The returned object is shared and frozen — treat it as read-only.
 * @param {string} lengthString - e.g. "1/4"
 * @returns {{ name, cssClass, hasStem, filledHead, flags, beams, spacing }}
 */
export function getDurationInfo(lengthString) {
  const info = DURATION_MAP[lengthString];
  if (!info) {
    throw new Error(`Unrecognized note length: "${lengthString}"`);
  }
  return info;
}
