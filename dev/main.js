/**
 * resound-notation dev playground entry.
 *
 * Imports the renderer from the local source tree (NOT from the published
 * package). This is what makes HMR work: editing src/components/Note.js
 * triggers a Vite HMR update here.
 */

import { NotationRenderer } from '../src/NotationRenderer.js';

// Eagerly import all preset modules. Each preset exports `{ name, group, song }`.
// `group` is one of: 'api' | 'piece'. `song` is the input JSON.
const presetModules = import.meta.glob('./presets/*.js', { eager: true });
const presets = Object.entries(presetModules)
  .map(([path, mod]) => ({ ...mod.default, _path: path }))
  .filter((p) => p && p.name && p.song);

// Default preset = first API-coverage preset, fallback to first overall.
// Honor ?preset=<name> in the URL so a refresh sticks on the current sample.
const urlPreset = new URLSearchParams(window.location.search).get('preset');
const defaultPreset =
  (urlPreset && presets.find((p) => p.name === urlPreset)) ||
  presets.find((p) => p.group === 'api' && p.name === 'single-voice-treble') ||
  presets[0];

const editor = document.getElementById('editor');
const errorEl = document.getElementById('error');
const container = document.getElementById('notation-container');
const presetBar = document.getElementById('preset-bar');
const gridToggle = document.getElementById('grid-toggle');
const widthSlider = document.getElementById('width-slider');
const widthValue = document.getElementById('width-value');

const presetButtons = new Map();

// Build preset buttons grouped by category.
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
  editor.value = JSON.stringify(preset.song, null, 2);
  const params = new URLSearchParams(window.location.search);
  if (params.get('preset') !== preset.name) {
    params.set('preset', preset.name);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }
  setActiveButton(preset.name);
  scheduleRender();
}

let renderer = null;
let renderTimer = null;

function getWidth() {
  return parseInt(widthSlider.value, 10);
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(doRender, 150);
}

function clearGrid() {
  const old = document.getElementById('grid-overlay');
  if (old) old.remove();
}

function drawGrid(width, height) {
  clearGrid();
  if (!gridToggle.checked) return;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('id', 'grid-overlay');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  for (let y = 0; y <= height; y += 10) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('x2', width);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', y % 50 === 0 ? '#fcc' : '#fee');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
    if (y % 20 === 0) {
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', 2);
      label.setAttribute('y', y - 1);
      label.setAttribute('font-size', '8');
      label.setAttribute('fill', '#c66');
      label.textContent = `y=${y}`;
      svg.appendChild(label);
    }
  }
  container.appendChild(svg);
}

function doRender() {
  let json;
  try {
    json = JSON.parse(editor.value);
  } catch (err) {
    showError(`JSON parse error: ${err.message}`);
    return;
  }

  // Drop and rebuild renderer each time so the container is clean and width
  // updates apply.
  if (renderer) renderer.clear();
  clearGrid();

  const width = getWidth();
  renderer = new NotationRenderer({ container, width });

  try {
    const svg = renderer.render(json);
    const height = parseInt(svg.getAttribute('height'), 10) || 200;
    drawGrid(width, height);
    clearError();
  } catch (err) {
    showError(`${err.name}: ${err.message}\n\n${err.stack || ''}`);
  }
}

function showError(msg) {
  errorEl.textContent = msg;
}
function clearError() {
  errorEl.textContent = '';
}

editor.addEventListener('input', scheduleRender);
gridToggle.addEventListener('change', doRender);
widthSlider.addEventListener('input', () => {
  widthValue.textContent = widthSlider.value;
  scheduleRender();
});

buildPresetBar();
if (defaultPreset) loadPreset(defaultPreset);

// HMR: when the renderer module updates, re-render automatically.
if (import.meta.hot) {
  import.meta.hot.accept(['../src/NotationRenderer.js'], () => {
    doRender();
  });
  // Accept updates anywhere under ../src by re-rendering on full module reload.
  import.meta.hot.accept();
}
