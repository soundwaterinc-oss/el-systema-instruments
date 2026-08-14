import { ensureAudioContext, resumeAudioContext, suspendAudioContext, getAudioContext } from "./audio/context.js?v=20260524-cellnoise-02";
import { createMasterGraph, setMasterBus } from "./audio/master.js?v=20260524-cellnoise-02";
import { GeometryOsc } from "./audio/geometry-osc.js?v=20260524-cellnoise-02";
import { PulseEngine } from "./audio/pulse-engine.js?v=20260524-cellnoise-02";
import { NoiseEngine } from "./audio/noise-engine.js?v=20260524-cellnoise-02";
import { Degradation } from "./audio/degradation.js?v=20260524-cellnoise-02";
import { PatternSource } from "./geometry/pattern-source.js?v=20260524-cellnoise-02";
import { ScanEngine } from "./geometry/scan-engine.js?v=20260524-cellnoise-03";
import { extractFeatures } from "./geometry/feature-extractor.js?v=20260524-cellnoise-02";
import { bindRange, bindSelect, bindButtonGroup, bindButton, bindFileInput } from "./ui/bindings.js?v=20260524-cellnoise-02";

const FIELD_ON = /[?&#]field/.test(location.href);

if (typeof window.registerElSystemaInstrument !== "function") {
  window.registerElSystemaInstrument = function () {};
}

const SOURCE_PRESETS = [
  { label: "cell2.vector.svg", url: "./assets/cell2.vector.svg" },
  { label: "cells_lithocyst_001.svg", url: "./assets/cells_lithocyst_001.svg" },
];

const SCAN_COLORS = ["0, 255, 136", "255, 80, 180", "80, 200, 255"];
const SCAN_LABELS = ["A", "B", "C"];
const DEFAULT_PRESET = SOURCE_PRESETS[0].url;
const MAX_RENDER_FPS = 30;
const MAX_CANVAS_DPR = 1.25;
const PARAM_ALIASES = {
  master: "masterGain",
  root: "pitchBase",
  rootHz: "pitchBase",
  rate: "pulseRate",
  density: "burstDensity",
  brightness: "noiseBandFreq",
  resonance: "noiseQ",
  color: "noiseColor",
};

const elements = {
  startAudioButton: document.querySelector("#startAudioButton"),
  startScanButton: document.querySelector("#startScanButton"),
  startAllButton: document.querySelector("#startAllButton"),
  stopButton: document.querySelector("#stopButton"),
  stopAllButton: document.querySelector("#stopAllButton"),
  presetStrip: document.querySelector("#presetStrip"),
  imageUpload: document.querySelector("#imageUpload"),
  sourceLabel: document.querySelector("#sourceLabel"),
  sourceLabelPreview: document.querySelector("#sourceLabelPreview"),
  sourceLabelInline: document.querySelector("#sourceLabelInline"),
  sourcePreviewImage: document.querySelector("#sourcePreviewImage"),
  statusValue: document.querySelector("#statusValue"),
  scanAValue: document.querySelector("#scanAValue"),
  scanBValue: document.querySelector("#scanBValue"),
  scanCValue: document.querySelector("#scanCValue"),
  featureDensityValue: document.querySelector("#featureDensityValue"),
  featureToggleRateValue: document.querySelector("#featureToggleRateValue"),
  featureComplexityValue: document.querySelector("#featureComplexityValue"),
  featureEdgeIntensityValue: document.querySelector("#featureEdgeIntensityValue"),
  featureLocalContrastValue: document.querySelector("#featureLocalContrastValue"),
  featureEdgeCountValue: document.querySelector("#featureEdgeCountValue"),
  scanCanvas: document.querySelector("#scanCanvas"),
  scanSpeed: document.querySelector("#scanSpeed"),
  scanSpeedValue: document.querySelector("#scanSpeedValue"),
  scanAngle: document.querySelector("#scanAngle"),
  scanAngleValue: document.querySelector("#scanAngleValue"),
  pitchBase: document.querySelector("#pitchBase"),
  pitchBaseValue: document.querySelector("#pitchBaseValue"),
  sineMix: document.querySelector("#sineMix"),
  sineMixValue: document.querySelector("#sineMixValue"),
  pulseMix: document.querySelector("#pulseMix"),
  pulseMixValue: document.querySelector("#pulseMixValue"),
  noiseMix: document.querySelector("#noiseMix"),
  noiseMixValue: document.querySelector("#noiseMixValue"),
  masterGain: document.querySelector("#masterGain"),
  masterGainValue: document.querySelector("#masterGainValue"),
  clickGain: document.querySelector("#clickGain"),
  clickGainValue: document.querySelector("#clickGainValue"),
  pulseRate: document.querySelector("#pulseRate"),
  pulseRateValue: document.querySelector("#pulseRateValue"),
  pulseWidth: document.querySelector("#pulseWidth"),
  pulseWidthValue: document.querySelector("#pulseWidthValue"),
  burstDensity: document.querySelector("#burstDensity"),
  burstDensityValue: document.querySelector("#burstDensityValue"),
  noiseGain: document.querySelector("#noiseGain"),
  noiseGainValue: document.querySelector("#noiseGainValue"),
  noiseBandFreq: document.querySelector("#noiseBandFreq"),
  noiseBandFreqValue: document.querySelector("#noiseBandFreqValue"),
  noiseQ: document.querySelector("#noiseQ"),
  noiseQValue: document.querySelector("#noiseQValue"),
  noiseColor: document.querySelector("#noiseColor"),
  noiseColorValue: document.querySelector("#noiseColorValue"),
  bitDepth: document.querySelector("#bitDepth"),
  bitDepthValue: document.querySelector("#bitDepthValue"),
  sampleRateReduction: document.querySelector("#sampleRateReduction"),
  sampleRateReductionValue: document.querySelector("#sampleRateReductionValue"),
  clipAmount: document.querySelector("#clipAmount"),
  clipAmountValue: document.querySelector("#clipAmountValue"),
};

const state = {
  audioContext: null,
  masterGraph: null,
  degradation: null,
  source: null,
  scans: [],
  engines: null,
  running: false,
  rafId: 0,
  lastStamp: 0,
  lastRenderStamp: 0,
  elSystemaRegistered: false,
  relayRamps: {},
  controls: null,
  presetButtons: [],
};

const presetGroup = bindButtonGroup(elements.presetStrip, {
  onSelect: (preset) => {
    void loadPreset(preset);
  },
});
state.presetButtons = presetGroup.buttons;
presetGroup.setActive(DEFAULT_PRESET);

bindFileInput(elements.imageUpload, (file) => {
  void loadFile(file);
});

bindButton(elements.startAudioButton, () => {
  void startAudio();
});
bindButton(elements.startScanButton, () => {
  void startScan();
});
bindButton(elements.startAllButton, () => {
  void startAll();
});
bindButton(elements.stopButton, () => {
  stop();
});
bindButton(elements.stopAllButton, () => {
  void stopAll();
});

const reapply = () => {
  applyControls();
  renderUI(false);
};

bindRange(elements.scanSpeed, elements.scanSpeedValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.scanAngle, elements.scanAngleValue, {
  format: (value) => `${value.toFixed(0)}°`,
  onChange: reapply,
});
bindRange(elements.pitchBase, elements.pitchBaseValue, {
  format: (value) => `${value.toFixed(0)}Hz`,
  onChange: reapply,
});
bindRange(elements.sineMix, elements.sineMixValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.pulseMix, elements.pulseMixValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.noiseMix, elements.noiseMixValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.masterGain, elements.masterGainValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.clickGain, elements.clickGainValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.pulseRate, elements.pulseRateValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.pulseWidth, elements.pulseWidthValue, {
  format: (value) => `${value.toFixed(1)}ms`,
  onChange: reapply,
});
bindRange(elements.burstDensity, elements.burstDensityValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.noiseGain, elements.noiseGainValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindRange(elements.noiseBandFreq, elements.noiseBandFreqValue, {
  format: formatHz,
  onChange: reapply,
});
bindRange(elements.noiseQ, elements.noiseQValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});
bindSelect(elements.noiseColor, elements.noiseColorValue, {
  onChange: reapply,
});
bindRange(elements.bitDepth, elements.bitDepthValue, {
  format: (value) => `${Math.round(value)}`,
  onChange: reapply,
});
bindRange(elements.sampleRateReduction, elements.sampleRateReductionValue, {
  format: (value) => `${Math.round(value)}`,
  onChange: reapply,
});
bindRange(elements.clipAmount, elements.clipAmountValue, {
  format: (value) => value.toFixed(2),
  onChange: reapply,
});

window.addEventListener("resize", () => {
  resizeCanvas();
  renderFrame();
});

initialize().catch(reportError);

async function initialize() {
  ensureSource();
  buildAudioGraph();
  resizeCanvas();
  renderUI(true);
  await loadPreset(DEFAULT_PRESET, { quiet: true });
  setStatus("Ready");
}

function ensureSource() {
  if (!state.source) {
    state.source = new PatternSource();
    state.source.generateDefaultPattern();
  }
  if (state.scans.length === 0) {
    state.scans = SCAN_COLORS.map((color) => new ScanEngine({ color }));
  }
}

function buildAudioGraph() {
  if (state.masterGraph) return;

  const context = ensureAudioContext();
  state.audioContext = context;
  state.masterGraph = createMasterGraph(context);
  state.degradation = new Degradation();
  state.degradation.getOutput().connect(state.masterGraph.input);
  setMasterBus({
    getInput: () => state.degradation.getInput(),
    setGain: (value) => state.masterGraph.setGain(value),
  });

  state.engines = {
    sine: new GeometryOsc(),
    pulse: new PulseEngine(),
    noise: new NoiseEngine(),
  };

  state.engines.sine.setParam("pitchBase", 80);
  state.engines.sine.setParam("pitchRange", 880);
  state.engines.sine.setParam("fmAmount", 30);
  state.engines.sine.setParam("densitySensitivity", 0.72);

  refreshScansFromSource();
  applyControls();
  ensureElSystemaRegistration();
}

async function startAudio() {
  buildAudioGraph();
  await resumeAudioContext();
  setStatus("Audio ready");
  renderFrame();
}

async function startScan() {
  await startAudio();
  startEngines();
  startLoop();
  setStatus("Scanning");
}

async function startAll() {
  await startScan();
}

function startEngines() {
  state.engines?.sine?.start();
  state.engines?.pulse?.start();
  state.engines?.noise?.start();
}

function stopEngines() {
  state.engines?.sine?.stop();
  state.engines?.pulse?.stop();
  state.engines?.noise?.stop();
}

function startLoop() {
  if (state.running) return;
  state.running = true;
  state.lastStamp = performance.now();
  state.lastRenderStamp = 0;
  for (const scan of state.scans) {
    scan.advance(0);
  }
  const frame = (stamp) => {
    if (!state.running) return;
    const dt = Math.min(0.05, (stamp - state.lastStamp) / 1000 || 0.016);
    state.lastStamp = stamp;
    stepScans(dt);
    if (stamp - state.lastRenderStamp >= 1000 / MAX_RENDER_FPS) {
      renderFrame();
      state.lastRenderStamp = stamp;
    }
    state.rafId = requestAnimationFrame(frame);
  };
  state.rafId = requestAnimationFrame(frame);
}

function stop() {
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = 0;
  stopEngines();
  setStatus("Stopped");
  renderFrame();
}

async function stopAll() {
  stop();
  await suspendAudioContext();
  setStatus("Suspended");
}

function stepScans(dt) {
  if (!state.scans.length) return;

  const mappedFeatures = [];
  for (let index = 0; index < state.scans.length; index++) {
    const scan = state.scans[index];
    scan.advance(dt);
    const pixels = scan.getScanLine();
    const raw = extractFeatures(pixels);
    const mapped = mapFeaturesForEngine(raw, scan, index);
    mappedFeatures.push({ raw, mapped, scan });
  }

  state.engines?.sine?.update(mappedFeatures[0]?.mapped ?? emptyFeatures());
  state.engines?.pulse?.update(mappedFeatures[1]?.mapped ?? emptyFeatures());
  state.engines?.noise?.update(mappedFeatures[2]?.mapped ?? emptyFeatures());

  const aggregate = aggregateFeatures(mappedFeatures.map((entry) => entry?.mapped ?? emptyFeatures()));
  state.degradation?.update(aggregate);
  renderStats(mappedFeatures, aggregate);
}

function mapFeaturesForEngine(features, scan, index) {
  const strength = scan?.strength ?? 1;
  const speedFactor = clamp01((state.controls?.scanSpeed ?? Number(elements.scanSpeed.value)) / 2.2);
  const angleFactor = 0.9 + 0.1 * Math.abs(Math.sin((state.controls?.scanAngle ?? 0) + index));
  const drive = 0.6 + strength * 0.7 + speedFactor * 0.4;

  return {
    density: clamp01(features.density * drive),
    toggleRate: clamp01(features.toggleRate * (0.7 + strength * 0.8 + speedFactor * 0.2)),
    complexity: clamp01(features.complexity * (0.65 + strength * 0.9) * angleFactor),
    edgeIntensity: clamp01(features.edgeIntensity * (0.75 + strength * 0.7)),
    localContrast: clamp01(features.localContrast * (0.7 + strength * 0.6 + speedFactor * 0.2)),
    edgeCount: clamp01(features.edgeCount * (0.6 + strength * 0.8)),
    scanPhase: scan?.position ?? 0,
  };
}

function aggregateFeatures(list) {
  if (!list.length) return emptyFeatures();
  let density = 0;
  let toggleRate = 0;
  let complexity = 0;
  let edgeIntensity = 0;
  let localContrast = 0;
  let edgeCount = 0;
  let scanPhase = 0;

  for (const item of list) {
    density += item.density;
    toggleRate += item.toggleRate;
    complexity = Math.max(complexity, item.complexity);
    edgeIntensity = Math.max(edgeIntensity, item.edgeIntensity);
    localContrast += item.localContrast;
    edgeCount = Math.max(edgeCount, item.edgeCount);
    scanPhase += item.scanPhase;
  }

  const count = list.length;
  return {
    density: density / count,
    toggleRate: toggleRate / count,
    complexity,
    edgeIntensity,
    localContrast: localContrast / count,
    edgeCount,
    scanPhase: scanPhase / count,
  };
}

function emptyFeatures() {
  return {
    density: 0,
    toggleRate: 0,
    complexity: 0,
    edgeIntensity: 0,
    localContrast: 0,
    edgeCount: 0,
    scanPhase: 0,
  };
}

function applyControls() {
  state.controls = readControls();

  if (state.scans.length) {
    for (const scan of state.scans) {
      scan.scanSpeed = state.controls.scanSpeed;
      scan.scanAngle = state.controls.scanAngle;
    }
  }

  if (state.engines) {
    state.engines.sine?.setParam("pitchBase", state.controls.pitchBase);
    state.engines.sine?.setParam("sineMix", state.controls.sineMix);
    state.engines.pulse?.setParam("pulseMix", state.controls.pulseMix);
    state.engines.pulse?.setParam("clickGain", state.controls.clickGain);
    state.engines.pulse?.setParam("pulseRate", state.controls.pulseRate);
    state.engines.pulse?.setParam("pulseWidth", state.controls.pulseWidth / 1000);
    state.engines.pulse?.setParam("burstDensity", state.controls.burstDensity);
    state.engines.noise?.setParam("noiseMix", state.controls.noiseMix);
    state.engines.noise?.setParam("noiseGain", state.controls.noiseGain);
    state.engines.noise?.setParam("noiseBandFreq", state.controls.noiseBandFreq);
    state.engines.noise?.setParam("noiseQ", state.controls.noiseQ);
    state.engines.noise?.setParam("noiseColor", state.controls.noiseColor);
  }

  if (state.degradation) {
    state.degradation.setParam("bitDepth", state.controls.bitDepth);
    state.degradation.setParam("sampleRateReduction", state.controls.sampleRateReduction);
    state.degradation.setParam("clipAmount", state.controls.clipAmount);
  }

  if (state.masterGraph) {
    state.masterGraph.setGain(state.controls.masterGain);
  }
}

function readControls() {
  return {
    scanSpeed: Number(elements.scanSpeed.value),
    scanAngle: degToRad(Number(elements.scanAngle.value)),
    pitchBase: Number(elements.pitchBase.value),
    sineMix: Number(elements.sineMix.value),
    pulseMix: Number(elements.pulseMix.value),
    noiseMix: Number(elements.noiseMix.value),
    masterGain: Number(elements.masterGain.value),
    clickGain: Number(elements.clickGain.value),
    pulseRate: Number(elements.pulseRate.value),
    pulseWidth: Number(elements.pulseWidth.value),
    burstDensity: Number(elements.burstDensity.value),
    noiseGain: Number(elements.noiseGain.value),
    noiseBandFreq: Number(elements.noiseBandFreq.value),
    noiseQ: Number(elements.noiseQ.value),
    noiseColor: elements.noiseColor.value,
    bitDepth: Number(elements.bitDepth.value),
    sampleRateReduction: Number(elements.sampleRateReduction.value),
    clipAmount: Number(elements.clipAmount.value),
  };
}

async function loadPreset(url, { quiet = false } = {}) {
  ensureSource();
  if (!quiet) setStatus(`Loading ${labelFromPreset(url)}...`);
  presetGroup.setActive(url);
  try {
    await state.source.tryLoadAsset(url);
  } catch {
    state.source.generateDefaultPattern();
  }
  refreshScansFromSource();
  updateSourceLabels();
  renderSourcePreview();
  applyControls();
  renderFrame();
  if (!quiet) setStatus(`Source: ${state.source.sourceLabel}`);
}

async function loadFile(file) {
  ensureSource();
  presetGroup.setActive("");
  setStatus(`Loading ${file.name}...`);
  await state.source.loadFromFile(file);
  refreshScansFromSource();
  updateSourceLabels();
  renderSourcePreview();
  applyControls();
  renderFrame();
  setStatus(`Source: ${file.name}`);
}

function refreshScansFromSource() {
  if (!state.source || !state.scans.length) return;
  for (const scan of state.scans) {
    scan.setSource(state.source.sourceCanvas);
  }
}

function updateSourceLabels() {
  const label = state.source?.sourceLabel ?? "—";
  elements.sourceLabel.textContent = label;
  elements.sourceLabelPreview.textContent = label;
  elements.sourceLabelInline.textContent = label;
}

function renderSourcePreview() {
  if (!state.source || !elements.sourcePreviewImage) return;
  try {
    elements.sourcePreviewImage.src = state.source.sourceCanvas.toDataURL("image/png");
  } catch {
    elements.sourcePreviewImage.removeAttribute("src");
  }
}

function renderStats(mappedFeatures, aggregate) {
  const first = mappedFeatures[0]?.scan;
  const second = mappedFeatures[1]?.scan;
  const third = mappedFeatures[2]?.scan;

  elements.scanAValue.textContent = first ? first.strength.toFixed(2) : "0.00";
  elements.scanBValue.textContent = second ? second.strength.toFixed(2) : "0.00";
  elements.scanCValue.textContent = third ? third.strength.toFixed(2) : "0.00";

  elements.featureDensityValue.textContent = aggregate.density.toFixed(2);
  elements.featureToggleRateValue.textContent = aggregate.toggleRate.toFixed(2);
  elements.featureComplexityValue.textContent = aggregate.complexity.toFixed(2);
  elements.featureEdgeIntensityValue.textContent = aggregate.edgeIntensity.toFixed(2);
  elements.featureLocalContrastValue.textContent = aggregate.localContrast.toFixed(2);
  elements.featureEdgeCountValue.textContent = aggregate.edgeCount.toFixed(2);
}

function renderUI(resetStats = false) {
  updateSourceLabels();
  if (resetStats) {
    elements.scanAValue.textContent = "0.00";
    elements.scanBValue.textContent = "0.00";
    elements.scanCValue.textContent = "0.00";
    elements.featureDensityValue.textContent = "0.00";
    elements.featureToggleRateValue.textContent = "0.00";
    elements.featureComplexityValue.textContent = "0.00";
    elements.featureEdgeIntensityValue.textContent = "0.00";
    elements.featureLocalContrastValue.textContent = "0.00";
    elements.featureEdgeCountValue.textContent = "0.00";
  }
}

function renderFrame() {
  const canvas = elements.scanCanvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  resizeCanvas();

  const width = canvas.width;
  const height = canvas.height;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020305";
  ctx.fillRect(0, 0, width, height);

  if (state.source) {
    ctx.globalAlpha = 0.92;
    ctx.drawImage(state.source.sourceCanvas, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  drawOverlayGrid(ctx, width, height);

  if (state.scans.length) {
    for (const scan of state.scans) {
      scan.drawScanLine(ctx, width, height);
    }
  }

  ctx.restore();
}

function drawOverlayGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  const spacing = Math.max(32, Math.round(Math.min(width, height) / 20));
  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function resizeCanvas() {
  const canvas = elements.scanCanvas;
  const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function setStatus(text) {
  elements.statusValue.textContent = text;
}

function labelFromPreset(url) {
  const found = SOURCE_PRESETS.find((item) => item.url === url);
  return found ? found.label : url.split("/").pop();
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function formatHz(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)}kHz` : `${Math.round(value)}Hz`;
}

function reportError(error) {
  console.error(error);
  setStatus("Error");
}

function resolveParamName(name) {
  if (!name) return "";
  return PARAM_ALIASES[name] || name;
}

function findParamElement(name) {
  const resolved = resolveParamName(name);
  return document.getElementById(resolved) || document.querySelector(`[name="${resolved}"]`);
}

function dispatchControlEvent(el) {
  const eventName = el.tagName === "SELECT" ? "change" : "input";
  el.dispatchEvent(new Event(eventName, { bubbles: true }));
  if (eventName !== "change") {
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function setControlValue(name, value) {
  if (name === "sourcePreset") {
    const preset = SOURCE_PRESETS.find((entry) => entry.label === value || entry.url === value);
    if (preset) {
      void loadPreset(preset.url);
      return true;
    }
    return false;
  }

  const el = findParamElement(name);
  if (!el) return false;

  if (el.tagName === "SELECT") {
    const next = String(value);
    const hasOption = Array.from(el.options).some((option) => option.value === next);
    if (!hasOption) return false;
    el.value = next;
    dispatchControlEvent(el);
    return true;
  }

  if (el.type === "range" || el.type === "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return false;
    const min = el.min === "" ? -Infinity : Number(el.min);
    const max = el.max === "" ? Infinity : Number(el.max);
    const clamped = Math.min(max, Math.max(min, numeric));
    el.value = String(clamped);
    dispatchControlEvent(el);
    return true;
  }

  if (el.type === "checkbox") {
    el.checked = !!value;
    dispatchControlEvent(el);
    return true;
  }

  el.value = String(value);
  dispatchControlEvent(el);
  return true;
}

function rampControlValue(name, from, to, durationMs) {
  if (state.relayRamps[name]) {
    cancelAnimationFrame(state.relayRamps[name]);
    delete state.relayRamps[name];
  }
  if (!(durationMs > 0)) {
    setControlValue(name, to);
    return;
  }
  const startAt = performance.now();
  const step = () => {
    const elapsed = performance.now() - startAt;
    const k = Math.min(1, elapsed / durationMs);
    const current = from + (to - from) * k;
    setControlValue(name, current);
    if (k >= 1) {
      delete state.relayRamps[name];
      return;
    }
    state.relayRamps[name] = requestAnimationFrame(step);
  };
  state.relayRamps[name] = requestAnimationFrame(step);
}

function applyPresetObject(preset) {
  if (!preset || typeof preset !== "object") return;
  Object.entries(preset).forEach(([name, value]) => {
    try {
      setControlValue(name, value);
    } catch (_) {}
  });
}

function getSnapshot() {
  const controls = state.controls || readControls();
  return {
    sourceLabel: state.source?.sourceLabel || "",
    audioState: state.audioContext?.state || "uninitialized",
    running: !!state.running,
    scanSpeed: controls.scanSpeed,
    scanAngle: Number(elements.scanAngle.value),
    pitchBase: controls.pitchBase,
    sineMix: controls.sineMix,
    pulseMix: controls.pulseMix,
    noiseMix: controls.noiseMix,
    masterGain: controls.masterGain,
    clickGain: controls.clickGain,
    pulseRate: controls.pulseRate,
    pulseWidth: controls.pulseWidth,
    burstDensity: controls.burstDensity,
    noiseGain: controls.noiseGain,
    noiseBandFreq: controls.noiseBandFreq,
    noiseQ: controls.noiseQ,
    noiseColor: controls.noiseColor,
    bitDepth: controls.bitDepth,
    sampleRateReduction: controls.sampleRateReduction,
    clipAmount: controls.clipAmount,
  };
}

function elsysMacro(name, value) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  if (name === "macro.a") {
    setControlValue("pulseRate", 0.2 + 17.8 * v);
    setControlValue("burstDensity", v);
    setControlValue("noiseGain", v);
  } else if (name === "macro.b") {
    setControlValue("noiseBandFreq", 100 + 7900 * v);
    setControlValue("noiseQ", 0.2 + 17.8 * v);
    setControlValue("clipAmount", v);
    setControlValue("sampleRateReduction", 1 + 23 * v);
  } else if (name === "macro.c") {
    setControlValue("scanAngle", 360 * v);
    setControlValue("scanSpeed", 0.1 + 2.1 * v);
  } else if (name === "volume") {
    setControlValue("masterGain", v * v);
  } else {
    setControlValue(name, value);
  }
}

function ensureElSystemaRegistration() {
  if (!FIELD_ON || state.elSystemaRegistered || !state.audioContext || !state.masterGraph) return;
  window.__cellnoise_setParam = setControlValue;
  window.registerElSystemaInstrument({
    id: "cellnoise",
    audioContext: state.audioContext,
    outputNode: state.masterGraph.masterGain,
    sharedAnalyser: state.masterGraph.analyser,
    play: () => {
      void startAll().catch(reportError);
    },
    stop: () => {
      void stopAll().catch(reportError);
    },
    setParam: (name, value) => {
      elsysMacro(name, value);
    },
    ramp: (name, from, to, durationMs) => {
      rampControlValue(name, Number(from), Number(to), Number(durationMs));
    },
    loadPreset: (preset) => {
      applyPresetObject(preset);
    },
    snapshot: () => getSnapshot(),
  });
  state.elSystemaRegistered = true;
}
