/**
 * resound-notation dev playground entry.
 *
 * Imports the renderer from the local source tree (NOT from the published
 * package). This is what makes HMR work: editing src/components/Note.js
 * triggers a Vite HMR update here.
 *
 * Reactive model: the renderer is created ONCE. Thereafter every change
 * routes through the renderer's batched setters (setSong / setWidth /
 * setScale), which coalesce on the next animation frame. No debounce.
 */

import { NotationRenderer } from '../src/NotationRenderer.js';

// Eagerly import all preset modules. Each preset exports `{ name, group, song }`.
const presetModules = import.meta.glob('./presets/*.js', { eager: true });
const presets = Object.entries(presetModules)
  .map(([path, mod]) => ({ ...mod.default, _path: path }))
  .filter((p) => p && p.name && p.song);

// ---------------------------------------------------------------------------
// DOM handles
// ---------------------------------------------------------------------------
const editor = document.getElementById('editor');
const errorEl = document.getElementById('error');
const container = document.getElementById('notation-container');
const renderHost = document.getElementById('render-host');
const presetBar = document.getElementById('preset-bar');
const gridToggle = document.getElementById('grid-toggle');
const widthInput = document.getElementById('width-input');
const widthValue = document.getElementById('width-value');
const scaleDial = document.getElementById('scale-dial');
const scaleValue = document.getElementById('scale-value');
const scaleIndicator = scaleDial.querySelector('.indicator');
const leftPane = document.getElementById('left-pane');
const splitter = document.getElementById('splitter');

// ---------------------------------------------------------------------------
// Config / state (the canonical view configuration, mirrored to the URL)
// ---------------------------------------------------------------------------
const SCALE_MIN = 0.25;
const SCALE_MAX = 4;

const presetButtons = new Map();

const config = {
  preset: null,
  width: 800,
  scale: 1.0,
  grid: false,
};

let renderer = null;

// ---------------------------------------------------------------------------
// URL <-> config
// ---------------------------------------------------------------------------
function clampScale(s) {
  if (!Number.isFinite(s)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));
}

function readConfigFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const preset = p.get('preset');
  if (preset && presets.find((x) => x.name === preset)) config.preset = preset;

  const w = parseInt(p.get('width'), 10);
  if (Number.isFinite(w) && w > 0) config.width = w;

  const s = parseFloat(p.get('scale'));
  if (Number.isFinite(s)) config.scale = clampScale(s);

  config.grid = p.get('grid') === '1';
}

let urlWriteScheduled = false;
function syncUrl() {
  if (urlWriteScheduled) return;
  urlWriteScheduled = true;
  requestAnimationFrame(() => {
    urlWriteScheduled = false;
    const p = new URLSearchParams();
    if (config.preset) p.set('preset', config.preset);
    p.set('width', String(Math.round(config.width)));
    p.set('scale', config.scale.toFixed(2));
    p.set('grid', config.grid ? '1' : '0');
    window.history.replaceState(null, '', `?${p.toString()}`);
  });
}

// ---------------------------------------------------------------------------
// Error panel
// ---------------------------------------------------------------------------
function showError(msg) {
  errorEl.textContent = msg;
}
function clearError() {
  errorEl.textContent = '';
}

// ---------------------------------------------------------------------------
// Coordinate grid overlay. Redrawn via MutationObserver whenever the SVG
// changes, sized to the current SVG's width/height attributes so it lines
// up at any scale.
// ---------------------------------------------------------------------------
function clearGrid() {
  const old = document.getElementById('grid-overlay');
  if (old) old.remove();
}

// Guard so our own grid DOM edits don't retrigger the MutationObserver
// (which would loop: append overlay -> mutation -> redraw -> append ...).
let gridMutating = false;

function drawGrid() {
  gridMutating = true;
  try {
    drawGridInner();
  } finally {
    // Release after the current microtask batch the observer would see.
    queueMicrotask(() => {
      gridMutating = false;
    });
  }
}

function drawGridInner() {
  clearGrid();
  if (!config.grid) return;
  const svg = renderer && renderer.getSvgElement();
  if (!svg) return;
  const width = parseFloat(svg.getAttribute('width')) || 0;
  const height = parseFloat(svg.getAttribute('height')) || 0;
  if (!width || !height) return;

  // The SVG's pixel size already includes scale; draw the grid in the same
  // pixel space so labels read in *rendered* px and lines align visually.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('id', 'grid-overlay');
  overlay.setAttribute('width', width);
  overlay.setAttribute('height', height);
  overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const step = 10 * config.scale; // 10 layout-px lines, in rendered px
  let i = 0;
  for (let y = 0; y <= height + 0.5; y += step, i++) {
    const layoutY = i * 10;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('x2', width);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', layoutY % 50 === 0 ? '#fcc' : '#fee');
    line.setAttribute('stroke-width', '1');
    overlay.appendChild(line);
    if (layoutY % 20 === 0) {
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', 2);
      label.setAttribute('y', y - 1);
      label.setAttribute('font-size', '8');
      label.setAttribute('fill', '#c66');
      label.textContent = `y=${layoutY}`;
      overlay.appendChild(label);
    }
  }
  container.appendChild(overlay);
}

// MutationObserver keeps the grid in sync with the (async, rAF) re-renders.
// We must ignore mutations caused by our OWN grid edits, otherwise appending
// the overlay would retrigger this callback in an infinite loop.
function mutationTouchesOnlyGrid(records) {
  for (const rec of records) {
    if (rec.target && rec.target.id === 'grid-overlay') continue;
    if (rec.target && rec.target.closest && rec.target.closest('#grid-overlay'))
      continue;
    const nodes = [...rec.addedNodes, ...rec.removedNodes];
    const allGrid =
      nodes.length > 0 && nodes.every((n) => n.id === 'grid-overlay');
    if (allGrid) continue;
    return false; // this record involves real (SVG) content
  }
  return true;
}

const svgObserver = new MutationObserver((records) => {
  if (gridMutating) return;
  if (mutationTouchesOnlyGrid(records)) return;
  drawGrid();
});
svgObserver.observe(container, { childList: true, attributes: true, subtree: true });

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
function buildPresetBar() {
  const apiPresets = presets.filter((p) => p.group === 'api');
  const piecePresets = presets.filter((p) => p.group === 'piece');

  const addGroup = (label, list) => {
    if (!list.length) return;
    const labelEl = document.createElement('span');
    labelEl.className = 'group-label';
    labelEl.textContent = label;
    presetBar.appendChild(labelEl);
    for (const preset of list) {
      const btn = document.createElement('button');
      btn.textContent = preset.name;
      btn.title = preset.description || preset.name;
      btn.addEventListener('click', () => loadPreset(preset));
      presetBar.appendChild(btn);
      presetButtons.set(preset.name, btn);
    }
  };

  addGroup('API', apiPresets);
  addGroup('Pieces', piecePresets);
}

function setActiveButton(name) {
  for (const [n, btn] of presetButtons) {
    btn.classList.toggle('active', n === name);
  }
}

function loadPreset(preset) {
  config.preset = preset.name;
  editor.value = JSON.stringify(preset.song, null, 2);
  setActiveButton(preset.name);
  syncUrl();
  applySongFromEditor();
}

// ---------------------------------------------------------------------------
// Reactive setters → renderer
// ---------------------------------------------------------------------------
function applySongFromEditor() {
  let json;
  try {
    json = JSON.parse(editor.value);
  } catch (err) {
    showError(`JSON parse error: ${err.message}`);
    return;
  }
  clearError();
  try {
    renderer.setSong(json);
  } catch (err) {
    showError(`${err.name}: ${err.message}\n\n${err.stack || ''}`);
  }
}

function applyWidth(px, { fromObserver = false } = {}) {
  const w = Math.round(px);
  if (!Number.isFinite(w) || w <= 0) return;
  config.width = w;
  widthValue.textContent = `${w}px`;
  // The Width box is a live readout of the ACTUAL render width. Whether the
  // change came from the observer (drag/resize) or a direct pin, the box must
  // reflect the real number. Don't overwrite it while the field is focused and
  // mid-edit, so the user's keystrokes aren't yanked out from under them.
  if (!(fromObserver && document.activeElement === widthInput)) {
    widthInput.value = String(w);
  }
  if (renderer) renderer.setWidth(w);
  syncUrl();
}

// Non-content overhead between the `main` row width and the render host's
// inner (content-box) width: splitter + the host's own horizontal padding.
function layoutOverhead() {
  const main = leftPane.parentElement;
  const splitterW = splitter.getBoundingClientRect().width;
  const cs = getComputedStyle(renderHost);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  return { mainWidth: main.getBoundingClientRect().width, splitterW, padL, padR };
}

// Pin the render host's inner width to exactly `targetW` by sizing the left
// pane. Returns the actual (possibly clamped) inner width achieved. The left
// pane is bounded by the same [160, mainWidth - 200] range the splitter uses,
// so an out-of-range request clamps and the box reflects the real result.
function pinWidth(targetW) {
  const { mainWidth, splitterW, padL, padR } = layoutOverhead();
  const overhead = splitterW + padL + padR;
  // leftWidth that would yield exactly targetW
  let leftWidth = mainWidth - overhead - targetW;
  const minLeft = 160;
  const maxLeft = mainWidth - 200;
  leftWidth = Math.max(minLeft, Math.min(maxLeft, leftWidth));
  leftPane.style.width = `${leftWidth}px`;
  // The achieved inner width after clamping.
  return Math.round(mainWidth - overhead - leftWidth);
}

function applyScale(scale) {
  config.scale = clampScale(scale);
  scaleValue.textContent = `${config.scale.toFixed(2)}×`;
  updateDialIndicator();
  if (renderer) renderer.setScale(config.scale);
  syncUrl();
}

function applyGrid(on) {
  config.grid = !!on;
  gridToggle.checked = config.grid;
  drawGrid();
  syncUrl();
}

// ---------------------------------------------------------------------------
// Scale dial. Maps scale (log range) onto a rotation of -135° .. +135°.
// ---------------------------------------------------------------------------
const DIAL_SWEEP = 135; // degrees each way from center

function scaleToAngle(scale) {
  const t =
    (Math.log(scale) - Math.log(SCALE_MIN)) /
    (Math.log(SCALE_MAX) - Math.log(SCALE_MIN));
  return -DIAL_SWEEP + t * (2 * DIAL_SWEEP);
}

function angleToScale(angle) {
  const clamped = Math.min(DIAL_SWEEP, Math.max(-DIAL_SWEEP, angle));
  const t = (clamped + DIAL_SWEEP) / (2 * DIAL_SWEEP);
  return Math.exp(
    Math.log(SCALE_MIN) + t * (Math.log(SCALE_MAX) - Math.log(SCALE_MIN))
  );
}

function updateDialIndicator() {
  scaleIndicator.style.transform = `translate(-50%, -100%) rotate(${scaleToAngle(
    config.scale
  )}deg)`;
  scaleDial.setAttribute('aria-valuenow', config.scale.toFixed(2));
}

let dialDragging = false;
function pointerAngle(ev) {
  const rect = scaleDial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // Angle measured from the "up" direction, clockwise positive (matches the
  // indicator which points up at 0deg).
  const dx = ev.clientX - cx;
  const dy = ev.clientY - cy;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

scaleDial.addEventListener('pointerdown', (ev) => {
  dialDragging = true;
  scaleDial.setPointerCapture(ev.pointerId);
  ev.preventDefault();
  applyScale(angleToScale(pointerAngle(ev)));
});
scaleDial.addEventListener('pointermove', (ev) => {
  if (!dialDragging) return;
  applyScale(angleToScale(pointerAngle(ev)));
});
scaleDial.addEventListener('pointerup', (ev) => {
  dialDragging = false;
  try {
    scaleDial.releasePointerCapture(ev.pointerId);
  } catch {
    /* noop */
  }
});
scaleDial.addEventListener('dblclick', () => applyScale(1.0));
scaleDial.addEventListener(
  'wheel',
  (ev) => {
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? 1.05 : 1 / 1.05;
    applyScale(config.scale * factor);
  },
  { passive: false }
);
scaleDial.addEventListener('keydown', (ev) => {
  let factor = 0;
  if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') factor = 1.05;
  else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') factor = 1 / 1.05;
  if (factor) {
    ev.preventDefault();
    applyScale(config.scale * factor);
  }
});

// ---------------------------------------------------------------------------
// Splitter drag (resizes the left/JSON pane; preview follows via observer)
// ---------------------------------------------------------------------------
let splitDragging = false;
splitter.addEventListener('pointerdown', (ev) => {
  splitDragging = true;
  splitter.classList.add('dragging');
  splitter.setPointerCapture(ev.pointerId);
  ev.preventDefault();
});
splitter.addEventListener('pointermove', (ev) => {
  if (!splitDragging) return;
  const main = leftPane.parentElement;
  const rect = main.getBoundingClientRect();
  let px = ev.clientX - rect.left;
  px = Math.max(160, Math.min(rect.width - 200, px));
  leftPane.style.width = `${px}px`;
  // ResizeObserver on #render-host fires and drives setWidth.
});
splitter.addEventListener('pointerup', (ev) => {
  splitDragging = false;
  splitter.classList.remove('dragging');
  try {
    splitter.releasePointerCapture(ev.pointerId);
  } catch {
    /* noop */
  }
});

// ---------------------------------------------------------------------------
// Dev-side ResizeObserver: width tracks the STABLE scroll host's inner
// content width (excluding padding). Watches #render-host, NOT the
// inline-block #notation-container (which would feedback-loop).
// ---------------------------------------------------------------------------
function hostInnerWidth() {
  const cs = getComputedStyle(renderHost);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  return renderHost.clientWidth - padL - padR;
}

const hostObserver = new ResizeObserver(() => {
  const w = hostInnerWidth();
  if (w > 0) applyWidth(w, { fromObserver: true });
});

// ---------------------------------------------------------------------------
// Static control listeners
// ---------------------------------------------------------------------------
editor.addEventListener('input', applySongFromEditor);
gridToggle.addEventListener('change', () => applyGrid(gridToggle.checked));
// Typing (or stepping) a width PINS it: resize the left pane so the host's
// inner width equals the typed value. The ResizeObserver then reports back the
// same number and nothing fights. If the request is out of pane range, pinWidth
// clamps and we reflect the real achieved width in the box.
function pinWidthFromInput() {
  const v = parseInt(widthInput.value, 10);
  if (!Number.isFinite(v) || v <= 0) return;
  const actual = pinWidth(v);
  applyWidth(actual);
}
widthInput.addEventListener('input', pinWidthFromInput);
widthInput.addEventListener('change', pinWidthFromInput);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
readConfigFromUrl();

// Default render width (when the URL doesn't pin one) is 3/4 of the viewport.
if (!new URLSearchParams(window.location.search).has('width')) {
  config.width = Math.round(window.innerWidth * 0.75);
}

buildPresetBar();

const startPreset =
  (config.preset && presets.find((p) => p.name === config.preset)) ||
  presets.find((p) => p.group === 'api' && p.name === 'single-voice-treble') ||
  presets[0];

// Initialise control widgets to config before first paint.
gridToggle.checked = config.grid;
widthInput.value = String(config.width);
widthValue.textContent = `${config.width}px`;
scaleValue.textContent = `${config.scale.toFixed(2)}×`;

if (startPreset) {
  config.preset = startPreset.name;
  editor.value = JSON.stringify(startPreset.song, null, 2);
  setActiveButton(startPreset.name);
}

// Create the renderer ONCE with the configured width + scale.
renderer = new NotationRenderer({
  container,
  width: config.width,
  scale: config.scale,
});
updateDialIndicator();

// First paint.
try {
  const json = JSON.parse(editor.value);
  renderer.render(json);
  clearError();
  drawGrid();
} catch (err) {
  showError(`${err.name}: ${err.message}\n\n${err.stack || ''}`);
}

syncUrl();

// Realize the configured width as a real pane size so the box, the readout, the
// SVG, and the observer all agree from the first frame — whether the width came
// from the URL or the 3/4-viewport default.
const actual = pinWidth(config.width);
applyWidth(actual);
hostObserver.observe(renderHost);

// HMR: when the renderer module updates, re-render automatically.
if (import.meta.hot) {
  import.meta.hot.accept(['../src/NotationRenderer.js'], () => {
    applySongFromEditor();
  });
  import.meta.hot.accept();
}
