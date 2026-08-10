/**
 * Test context helper for notation renderer tests.
 * Provides a renderer instance, container, query helpers, and cleanup.
 */

import { NotationRenderer } from '../../NotationRenderer.js';
import { injectSmuflDefs } from '../../assets/glyphs.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Resolve the SMuFL glyph def <path>s referenced by the <use> instance(s)
 * at or under `el`, in document order. Materializes defs the same way the
 * renderer does at the end of render(), so tests on detached components
 * can still assert on glyph path data.
 */
export function smuflGlyphPaths(el) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.appendChild(el.cloneNode(true));
  injectSmuflDefs(svg);
  return Array.from(svg.querySelectorAll('use'), (use) => {
    const href = use.getAttribute('href') || '';
    return svg.querySelector(`defs path[id="${href.slice(1)}"]`);
  }).filter(Boolean);
}

export function createNotationContext() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const renderer = new NotationRenderer({ container });

  return {
    renderer,
    container,

    // Render helper
    render(song) {
      return renderer.render(song);
    },

    // Query helpers
    getSvg() {
      return container.querySelector('svg');
    },
    getNotes() {
      return container.querySelectorAll('.note');
    },
    getRests() {
      return container.querySelectorAll('.rest');
    },
    getActiveNote() {
      return container.querySelector('.note-active');
    },
    getClef() {
      return container.querySelector('.clef');
    },
    getKeySignature() {
      return container.querySelector('.key-signature');
    },
    getTimeSignature() {
      return container.querySelector('.time-signature');
    },
    getBarLines() {
      return container.querySelectorAll('.bar-line');
    },
    getBeamGroups() {
      return container.querySelectorAll('.beam-group');
    },
    getLedgerLines() {
      return container.querySelectorAll('.ledger-line');
    },
    getTies() {
      return container.querySelectorAll('.tie');
    },

    // Phase 6 query helpers
    getDynamics() {
      return container.querySelectorAll('.dynamic');
    },
    getHairpins() {
      return container.querySelectorAll('.hairpin');
    },
    getArticulations() {
      return container.querySelectorAll('.articulation');
    },
    getArticulationsByType(type) {
      return container.querySelectorAll(`.articulation-${type}`);
    },
    getSlurs() {
      return container.querySelectorAll('.slur');
    },
    getTupletGroups() {
      return container.querySelectorAll('.tuplet-group');
    },
    getGraceNotes() {
      return container.querySelectorAll('.grace-note');
    },
    getRepeatBarlines() {
      return container.querySelectorAll('[class*="barline-repeat"], .barline-final');
    },
    getEndings() {
      return container.querySelectorAll('.ending');
    },
    getNavigationMarkers() {
      return container.querySelectorAll('.navigation');
    },
    getTempoMarkings() {
      return container.querySelectorAll('.tempo-marking');
    },
    getTempoChanges() {
      return container.querySelectorAll('.tempo-change');
    },
    getExpressionTexts() {
      return container.querySelectorAll('.expression');
    },
    getRehearsalMarks() {
      return container.querySelectorAll('.rehearsal-mark');
    },
    getLyrics() {
      return container.querySelectorAll('.lyric');
    },

    // Cleanup
    destroy() {
      renderer.clear();
      container.remove();
    },
  };
}
