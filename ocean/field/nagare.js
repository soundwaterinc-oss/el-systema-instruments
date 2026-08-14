(function (root) {
  "use strict";

  const Shapes = root.ElSystemaShapes || (typeof require === "function" ? require("../shared/el-systema-shapes.js") : null);
  const Natural = root.ElSystemaNatural || (typeof require === "function" ? require("../shared/el-systema-natural.js") : null);
  const Modes = root.ElSystemaModes || (Natural && Natural.MODES) || {};

  if (!Shapes || !Natural) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[el-systema] nagare requires shapes and natural");
    }
    return;
  }

  const SCALE_DEFAULTS = {
    "拍": { hz: 6, fn: "pink", seed: 0 },
    "節": { hz: 0.1, fn: "gold", seed: 0 },
    "章": { hz: 0.01, fn: "fib", seed: 0 },
    "巻": { hz: 0.002, fn: "lorenz", seed: 0 }
  };

  const STONE_VOICES = ["玄武岩", "花崗岩", "石灰岩", "砂岩", "磁石", "砂礫"];
  const OCEAN_VOICES = ["ds", "oki", "kg"];
  const GEOMETRY_ROOTS = ["C", "D", "Eb", "F", "G", "A", "Bb"];
  const GEOMETRY_SCALES = ["Japanese In", "Pentatonic Bloom", "1/f Harmonic", "Cellular Major", "Moss Minor"];
  const GEOMETRY_RHYTHMS = ["Kecak Cycle", "Polyrhythm Bloom", "Golden Step", "Logistic Burst"];
  const OCEAN_ROOTS = [55, 65, 73, 82, 87, 98, 110, 123, 138];
  const OCEAN_SCALES = ["ヒラジョシ", "リディアン", "ヨナ抜き", "Whole Tone", "ペンタトニック"];
  const STONE_RHYTHMS = ["1/f", "Cinquillo", "Tresillo", "Clave", "Logistic"];
  const PARTICLE_ENGINES = ["Particle", "Metallic", "Physical"];
  const KAGOME_SCALES = ["hirajoshi", "yo", "insen", "ryukyu", "dorian", "pelog_5", "maqam_rast", "wholetone", "fibonacci_freqs"];
  const KAGOME_RHYTHMS = ["44", "68", "ewe_bell", "bossa", "78", "pink", "logistic", "golden", "brownian"];
  const PLANARIAN_ROOTS = [0, 2, 4, 5, 7, 9, 11];
  const PLANARIAN_SCALES = ["just-minor", "dorian", "golden", "harmonic", "pentatonic", "hirajoshi", "minor-pent", "mixolydian"];
  const MUSIC_MODES = ["凪", "琉球", "平調子", "陰旋", "アイヌ", "シベリア", "モンゴル", "スレンドロ", "ペログ", "マカーム", "バイラヴィ", "無"];
  const NOTE_TO_KEY = {
    "C": 0, "B#": 0,
    "C#": 1, "DB": 1,
    "D": 2,
    "D#": 3, "EB": 3,
    "E": 4, "FB": 4,
    "F": 5, "E#": 5,
    "F#": 6, "GB": 6,
    "G": 7,
    "G#": 8, "AB": 8,
    "A": 9,
    "A#": 10, "BB": 10,
    "B": 11, "CB": 11
  };
  const KEY_TO_NOTE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const GEOMETRY_ROOT_PCS = { "C": 0, "D": 2, "Eb": 3, "F": 5, "G": 7, "A": 9, "Bb": 10 };
  const MUSIC_DEFAULTS = {
    key: 0,
    mode: "凪",
    bpm: 72,
    register: 0,
    転調策: []
  };
  const MUSIC_MODE_DEGREES = {
    "凪": [0, 7],
    "琉球": [0, 4, 5, 7, 11],
    "平調子": [0, 2, 3, 7, 8],
    "陰旋": [0, 1, 5, 7, 10],
    "アイヌ": [0, 5, 7, 10],
    "シベリア": [0, 4, 7, 10],
    "モンゴル": [0, 2, 4, 7, 9],
    "スレンドロ": [0, 2, 5, 7, 9],
    "ペログ": [0, 1, 4, 8, 9],
    "マカーム": [0, 2, 3, 5, 7, 9, 10],
    "バイラヴィ": [0, 1, 3, 5, 7, 8, 10],
    "無": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };
  const TEMPO_RATIOS = {
    "mycorrhiza-beat": 1,
    "stone-beats": 1,
    "kagome-sound": 1,
    "moss-reservoir": 0.5,
    "particle-noise": 1,
    "geometry-scanner": 1,
    "ocean": 0.5,
    "planarian-drone": null,
    "cell-noise": 0.125
  };
  const MODULATION_POLICIES = {
    "stone-beats": "immediate",
    "mycorrhiza-beat": "immediate",
    "particle-noise": "immediate",
    "ocean": "voice-led",
    "moss-reservoir": "voice-led",
    "planarian-drone": "voice-led",
    "kagome-sound": "phrase-aligned",
    "geometry-scanner": "phrase-aligned",
    "cell-noise": "section-aligned"
  };
  const POLICY_NAMES = ["immediate", "phrase-aligned", "section-aligned", "voice-led"];
  const NATURAL_FN_NAMES = ["pink", "logistic", "lorenz", "gold", "fib", "brown", "sine", "ca", "levy"];
  const SCALE_NAMES = ["拍", "節", "章", "巻"];
  const ROLE_NAMES = ["抜き差し", "律動", "転調"];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function frac(x) {
    return x - Math.floor(x);
  }

  function pickFromList(list, value) {
    if (!list.length) return null;
    const idx = Math.min(list.length - 1, Math.floor(Natural.clamp01(value) * list.length));
    return list[idx];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function keyToHz(key, octaveBase, registerBias) {
    const reg = typeof registerBias === "number" ? registerBias : 0;
    const octave = octaveBase + Math.round(clamp(reg, -1, 1));
    return midiToHz(key + 12 * (octave + 1));
  }

  function noteNameToKey(value) {
    if (typeof value === "number" && isFinite(value)) {
      return ((Math.round(value) % 12) + 12) % 12;
    }
    const text = String(value || "").trim().toUpperCase();
    if (!text) throw new Error("music.key is empty");
    const mapped = NOTE_TO_KEY[text];
    if (typeof mapped !== "number") throw new Error("unknown music.key: " + value);
    return mapped;
  }

  function nearestPitchClass(key, options) {
    let best = options[0];
    let bestDist = 99;
    for (let i = 0; i < options.length; i++) {
      const candidate = options[i];
      const dist = Math.min((key - candidate + 12) % 12, (candidate - key + 12) % 12);
      if (dist < bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
    return best;
  }

  function nearestOceanRoot(key, registerBias) {
    const targetHz = keyToHz(key, 2, registerBias);
    let best = OCEAN_ROOTS[0];
    let bestDiff = Infinity;
    for (let i = 0; i < OCEAN_ROOTS.length; i++) {
      const root = OCEAN_ROOTS[i];
      const diff = Math.abs(Math.log(root / targetHz));
      if (diff < bestDiff) {
        best = root;
        bestDiff = diff;
      }
    }
    return best;
  }

  function clampGeometryRoot(key) {
    let best = "C";
    let bestDist = 99;
    Object.keys(GEOMETRY_ROOT_PCS).forEach(function (label) {
      const candidate = GEOMETRY_ROOT_PCS[label];
      const dist = Math.min((key - candidate + 12) % 12, (candidate - key + 12) % 12);
      if (dist < bestDist) {
        best = label;
        bestDist = dist;
      }
    });
    return best;
  }

  function kagomePresetForMode(mode) {
    switch (mode) {
      case "琉球": return { scaleCategory: "japanese", scalePreset: "ryukyu" };
      case "平調子": return { scaleCategory: "japanese", scalePreset: "hirajoshi" };
      case "陰旋": return { scaleCategory: "japanese", scalePreset: "insen" };
      case "モンゴル": return { scaleCategory: "japanese", scalePreset: "yo" };
      case "スレンドロ": return { scaleCategory: "world", scalePreset: "slendro" };
      case "ペログ": return { scaleCategory: "world", scalePreset: "pelog_5" };
      case "マカーム": return { scaleCategory: "world", scalePreset: "maqam_rast" };
      case "バイラヴィ": return { scaleCategory: "world", scalePreset: "bhairavi" };
      case "無": return { scaleCategory: "generative", scalePreset: "chromatic" };
      case "アイヌ": return { scaleCategory: "japanese", scalePreset: "insen" };
      case "シベリア": return { scaleCategory: "generative", scalePreset: "harmonic_series" };
      case "凪": return { scaleCategory: "custom", customScale: "261.63,392.00" };
      default: return { scaleCategory: "japanese", scalePreset: "ryukyu" };
    }
  }

  function tempoRatio(id) {
    return Object.prototype.hasOwnProperty.call(TEMPO_RATIOS, id) ? TEMPO_RATIOS[id] : 1;
  }

  function getModulationPolicy(id) {
    return MODULATION_POLICIES[id] || "immediate";
  }

  function pitchClassSet(key, mode) {
    const root = noteNameToKey(key);
    const degrees = MUSIC_MODE_DEGREES[mode] || MUSIC_MODE_DEGREES["凪"];
    return degrees.map(function (deg) {
      return (root + deg) % 12;
    });
  }

  function currentBar(music, elapsedSec) {
    const bpm = clamp((music && music.bpm) || MUSIC_DEFAULTS.bpm, 40, 180);
    return elapsedSec * bpm / (60 * 4);
  }

  function timeToNextPhraseBoundary(music, elapsedSec, phraseBars) {
    const bars = phraseBars || 8;
    const cur = currentBar(music, elapsedSec);
    const next = Math.ceil(cur / bars) * bars;
    return Math.max(0, (next - cur) * 60 * 4 / music.bpm);
  }

  function timeToNextSectionBoundary(music, elapsedSec, sectionBars) {
    const bars = sectionBars || 32;
    const cur = currentBar(music, elapsedSec);
    const next = Math.ceil(cur / bars) * bars;
    return Math.max(0, (next - cur) * 60 * 4 / music.bpm);
  }

  function hasScaleIdentity(id) {
    return id === "ocean" || id === "geometry-scanner" || id === "kagome-sound" || id === "planarian-drone";
  }

  function filterRelays(relays, omitNames) {
    const skips = {};
    for (let i = 0; i < omitNames.length; i++) skips[omitNames[i]] = true;
    return asArray(relays).filter(function (relay) {
      return !skips[relay.name];
    });
  }

  function buildKagomeScaleRelays(music, keyOverride) {
    const preset = kagomePresetForMode(music.mode);
    if (music.mode === "凪" || preset.customScale) {
      const pcs = music.mode === "凪" ? [noteNameToKey(keyOverride != null ? keyOverride : music.key), (noteNameToKey(keyOverride != null ? keyOverride : music.key) + 7) % 12] : pitchClassSet(keyOverride != null ? keyOverride : music.key, music.mode);
      const custom = pcs.slice(0, Math.max(2, Math.min(5, pcs.length))).map(function (pc, idx) {
        return keyToHz(pc, 4 + (idx > 0 && pc < pcs[0] ? 1 : 0), 0).toFixed(2);
      }).join(",");
      return [
        { name: "scaleCategory", value: "custom" },
        { name: "customScale", value: custom }
      ];
    }
    return Object.keys(preset).map(function (key) {
      return { name: key, value: preset[key] };
    });
  }

  function buildMusicAdapterRelays(id, music) {
    return asArray((MusicAdapterMap[id] || function () { return []; })(id, music));
  }

  function buildImmediateMusicRelays(oldMusic, newMusic, ids, durationSec) {
    const relays = [];
    const durationMs = Math.max(0, Math.round((durationSec || 4) * 1000));
    const idList = ids && ids.length ? ids : Object.keys(MusicAdapterMap);
    for (let i = 0; i < idList.length; i++) {
      const id = idList[i];
      let adapterRelays = buildMusicAdapterRelays(id, newMusic);
      if (id === "ocean") {
        adapterRelays = filterRelays(adapterRelays, ["root"]);
        const oldHz = nearestOceanRoot(oldMusic.key, oldMusic.register);
        const newHz = nearestOceanRoot(newMusic.key, newMusic.register);
        if (oldHz !== newHz && durationMs > 0) {
          relays.push({ target: id, cmd: "ramp", name: "root", from: oldHz, to: newHz, dur: durationMs, startAt: Shapes.nowMs() });
        } else {
          relays.push({ target: id, cmd: "setParam", name: "root", value: newHz });
        }
      }
      if (id === "moss-reservoir") {
        adapterRelays = filterRelays(adapterRelays, ["rootHz"]);
        const oldHz = +clamp(keyToHz(oldMusic.key, 1, oldMusic.register), 24, 108).toFixed(2);
        const newHz = +clamp(keyToHz(newMusic.key, 1, newMusic.register), 24, 108).toFixed(2);
        if (oldHz !== newHz && durationMs > 0) {
          relays.push({ target: id, cmd: "ramp", name: "rootHz", from: oldHz, to: newHz, dur: durationMs, startAt: Shapes.nowMs() });
        } else {
          relays.push({ target: id, cmd: "setParam", name: "rootHz", value: newHz });
        }
      }
      for (let j = 0; j < adapterRelays.length; j++) relays.push(adapterRelays[j]);
    }
    return relays;
  }

  function buildVoiceLedStageA(oldMusic, newMusic, ids) {
    const oldPcs = pitchClassSet(oldMusic.key, oldMusic.mode);
    const newPcs = pitchClassSet(newMusic.key, newMusic.mode);
    const common = oldPcs.filter(function (pc) { return newPcs.indexOf(pc) >= 0; });
    const relays = [];
    const idList = ids && ids.length ? ids : Object.keys(MusicAdapterMap);
    for (let i = 0; i < idList.length; i++) {
      const id = idList[i];
      if (id === "ocean") {
        relays.push({ target: id, cmd: "setParam", name: "kg.level", value: 50 });
      } else if (id === "planarian-drone") {
        relays.push({ target: id, cmd: "setParam", name: "layer.1.level", value: 0.5 });
        relays.push({ target: id, cmd: "setParam", name: "layer.2.level", value: 0.5 });
      } else if (id === "kagome-sound") {
        const custom = common.map(function (pc, idx) {
          return keyToHz(pc, 4 + (idx > 0 && pc < common[0] ? 1 : 0), 0).toFixed(2);
        }).join(",");
        relays.push({ target: id, cmd: "setParam", name: "scaleCategory", value: "custom" });
        relays.push({ target: id, cmd: "setParam", name: "customScale", value: custom || "261.63,392.00" });
      } else if (id === "geometry-scanner") {
        relays.push({ target: id, cmd: "setParam", name: "droneLevel", value: 0.5 });
      }
    }
    return relays;
  }

  function buildVoiceLedStageB(oldMusic, newMusic, ids) {
    const relays = [];
    const idList = ids && ids.length ? ids : Object.keys(MusicAdapterMap);
    for (let i = 0; i < idList.length; i++) {
      const id = idList[i];
      if (id === "ocean") {
        relays.push({ target: id, cmd: "setParam", name: "scale", value: filterRelays(buildMusicAdapterRelays(id, newMusic), ["root"])[0].value });
      } else if (id === "planarian-drone") {
        const planarian = filterRelays(buildMusicAdapterRelays(id, newMusic), ["rootNote"]);
        for (let j = 0; j < planarian.length; j++) relays.push(planarian[j]);
      } else if (id === "kagome-sound") {
        const scaleRelays = buildKagomeScaleRelays(newMusic, oldMusic.key);
        for (let j = 0; j < scaleRelays.length; j++) {
          relays.push({ target: id, cmd: "setParam", name: scaleRelays[j].name, value: scaleRelays[j].value });
        }
      } else if (id === "geometry-scanner") {
        relays.push({ target: id, cmd: "setParam", name: "selectedScale", value: filterRelays(buildMusicAdapterRelays(id, newMusic), ["selectedRootNote", "bpm"])[0].value });
      }
    }
    return relays;
  }

  function buildVoiceLedStageC(oldMusic, newMusic, durationSec, ids) {
    return buildImmediateMusicRelays(oldMusic, newMusic, ids, durationSec);
  }

  function voiceLed(oldMusic, newMusic, durationSec, ids) {
    const total = Math.max(0.001, durationSec || 4);
    const phase = total / 3;
    return [
      { stage: "A", atSec: 0, relays: buildVoiceLedStageA(oldMusic, newMusic, ids) },
      { stage: "B", atSec: phase, relays: buildVoiceLedStageB(oldMusic, newMusic, ids) },
      { stage: "C", atSec: phase * 2, relays: buildVoiceLedStageC(oldMusic, newMusic, phase, ids) }
    ];
  }

  function planMusicTransition(oldMusic, newMusic, policy, durationSec, ids, elapsedSec) {
    const normalizedPolicy = POLICY_NAMES.indexOf(policy) >= 0 ? policy : "immediate";
    const delaySec = normalizedPolicy === "phrase-aligned"
      ? timeToNextPhraseBoundary(oldMusic, elapsedSec || 0, 8)
      : normalizedPolicy === "section-aligned"
        ? timeToNextSectionBoundary(oldMusic, elapsedSec || 0, 32)
        : 0;
    if (normalizedPolicy === "voice-led") {
      return voiceLed(oldMusic, newMusic, durationSec, ids).map(function (step) {
        return {
          stage: step.stage,
          atSec: delaySec + step.atSec,
          relays: step.relays
        };
      });
    }
    return [{
      stage: normalizedPolicy,
      atSec: delaySec,
      relays: buildImmediateMusicRelays(oldMusic, newMusic, ids, durationSec)
    }];
  }

  function normalizeMusicState(patch, base) {
    const next = clone(base || MUSIC_DEFAULTS);
    if (!patch || typeof patch !== "object") return next;
    if (patch.key !== undefined) next.key = noteNameToKey(patch.key);
    if (patch.mode !== undefined) {
      if (typeof patch.mode !== "string" || MUSIC_MODES.indexOf(patch.mode) < 0) {
        throw new Error("unknown music.mode: " + patch.mode);
      }
      next.mode = patch.mode;
    }
    if (patch.bpm !== undefined) {
      if (typeof patch.bpm !== "number" || !isFinite(patch.bpm)) throw new Error("music.bpm must be a finite number");
      next.bpm = clamp(patch.bpm, 40, 180);
    }
    if (patch.register !== undefined) {
      if (typeof patch.register !== "number" || !isFinite(patch.register)) throw new Error("music.register must be a finite number");
      next.register = clamp(patch.register, -1, 1);
    }
    if (patch["転調策"] !== undefined) {
      if (!Array.isArray(patch["転調策"])) throw new Error("music.転調策 must be an array");
      next["転調策"] = patch["転調策"].slice();
    }
    return next;
  }

  function deriveSeed(seed, label) {
    let hash = 0;
    for (let i = 0; i < label.length; i++) hash = ((hash * 33) + label.charCodeAt(i)) >>> 0;
    return frac(Natural.normalizeSeed(seed) + hash * 0.0000001 + 0.61803398875);
  }

  function smoothValue(prev, raw, alpha) {
    const a = Natural.clamp01(typeof alpha === "number" ? alpha : 0);
    const target = Natural.clamp01(raw);
    if (a === 0) return target > 0.5 ? 1 : 0;
    if (typeof prev !== "number") return target;
    return Natural.clamp01(prev * a + target * (1 - a));
  }

  function makeRuntime() {
    return {
      sendRelay: function () {},
      pushKotodama: function () {},
      getActiveInstruments: function () { return []; }
    };
  }

  function makeDefaultInstrumentConfig() {
    return {
      "stone-beats":     { 抜き差し: true,  律動: true,  転調: false },
      "ocean":           { 抜き差し: true,  律動: false, 転調: true  },
      "geometry-scanner":{ 抜き差し: true,  律動: true,  転調: true  },
      "particle-noise":  { 抜き差し: true,  律動: true,  転調: false },
      "mycorrhiza-beat": { 抜き差し: true,  律動: true,  転調: false },
      "moss-reservoir":  { 抜き差し: true,  律動: true,  転調: true  },
      "kagome-sound":    { 抜き差し: false, 律動: true,  転調: true  },
      "planarian-drone": { 抜き差し: true,  律動: false, 転調: true  },
      "cell-noise":      { 抜き差し: true,  律動: true,  転調: true  }
    };
  }

  function asArray(x) {
    if (!x) return [];
    return Array.isArray(x) ? x : [x];
  }

  const InstrumentMap = {
    "stone-beats": {
      抜き差し: {
        voices: STONE_VOICES,
        floor: 0.18,
        apply: function (id, voice, value) {
          const vol = Math.round(value * 100);
          return [
            { target: id, cmd: "setParam", name: "voice." + voice + ".on", value: vol > 8 ? 1 : 0 },
            { target: id, cmd: "setParam", name: "voice." + voice + ".volume", value: vol }
          ];
        }
      },
      律動: {
        voices: STONE_VOICES,
        apply: function (id, value, ctx) {
          const lead = STONE_VOICES[ctx.tickCount % STONE_VOICES.length];
          const rhythm = pickFromList(STONE_RHYTHMS, value);
          return [
            { target: id, cmd: "setParam", name: "energy", value: +(0.25 + value * 0.65).toFixed(4) },
            { target: id, cmd: "setParam", name: "vary", value: +(0.15 + value * 0.75).toFixed(4) },
            { target: id, cmd: "setParam", name: "voice." + lead + ".density", value: Math.round(20 + value * 80) },
            { target: id, cmd: "setParam", name: "voice." + lead + ".rhythm", value: rhythm }
          ];
        }
      },
      転調: null
    },
    "ocean": {
      抜き差し: {
        voices: OCEAN_VOICES,
        floor: 0.22,
        apply: function (id, voice, value) {
          return { target: id, cmd: "setParam", name: voice + ".level", value: Math.round(value * 100) };
        }
      },
      律動: null,
      転調: {
        apply: function (id, value, ctx) {
          const nextRoot = pickFromList(OCEAN_ROOTS, value);
          const nextScale = pickFromList(OCEAN_SCALES, frac(value * 1.618));
          const relays = [];
          if (typeof ctx.prevRoot === "number") {
            relays.push({
              target: id,
              cmd: "ramp",
              name: "root",
              from: ctx.prevRoot,
              to: nextRoot,
              dur: 2600,
              startAt: Shapes.nowMs()
            });
          } else {
            relays.push({ target: id, cmd: "setParam", name: "root", value: nextRoot });
          }
          relays.push({ target: id, cmd: "setParam", name: "scale", value: nextScale });
          ctx.prevRoot = nextRoot;
          return relays;
        }
      }
    },
    "geometry-scanner": {
      抜き差し: {
        voices: ["bassLevel", "droneLevel", "percussionLevel"],
        floor: 0.14,
        apply: function (id, voice, value) {
          return { target: id, cmd: "setParam", name: voice, value: +(0.08 + value * 1.04).toFixed(4) };
        }
      },
      律動: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "bpm", value: Math.round(72 + value * 96) },
            { target: id, cmd: "setParam", name: "selectedRhythm", value: pickFromList(GEOMETRY_RHYTHMS, value) }
          ];
        }
      },
      転調: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "selectedRootNote", value: pickFromList(GEOMETRY_ROOTS, value) },
            { target: id, cmd: "setParam", name: "selectedScale", value: pickFromList(GEOMETRY_SCALES, frac(value * 1.27)) }
          ];
        }
      }
    },
    "particle-noise": {
      抜き差し: {
        voices: PARTICLE_ENGINES,
        floor: 0.18,
        apply: function (id, voice, value) {
          return { target: id, cmd: "setParam", name: voice + ".masterGain", value: +(0.12 + value * 0.92).toFixed(4) };
        }
      },
      律動: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "rate", value: +(1.5 + value * 18).toFixed(3) },
            { target: id, cmd: "setParam", name: "density", value: +(0.08 + value * 1.22).toFixed(4) }
          ];
        }
      },
      転調: null
    },
    "mycorrhiza-beat": {
      抜き差し: {
        voices: ["kick", "snare", "hat", "perc"],
        apply: function (id, voice, value) {
          return { target: id, cmd: "setParam", name: "sendLevel." + voice, value: +(value * 0.9).toFixed(4) };
        }
      },
      律動: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "bpm", value: Math.round(86 + value * 70) },
            { target: id, cmd: "setParam", name: "density", value: +(0.15 + value * 0.8).toFixed(4) }
          ];
        }
      },
      転調: null
    },
    "moss-reservoir": {
      抜き差し: {
        voices: ["master"],
        floor: 0.2,
        apply: function (id, voice, value) {
          return { target: id, cmd: "setParam", name: voice, value: +(0.12 + value * 0.88).toFixed(4) };
        }
      },
      律動: {
        apply: function (id, value) {
          return { target: id, cmd: "setParam", name: "bpm", value: Math.round(48 + value * 108) };
        }
      },
      転調: {
        apply: function (id, value) {
          return { target: id, cmd: "setParam", name: "rootHz", value: Math.round(24 + value * 84) };
        }
      }
    },
    "kagome-sound": {
      抜き差し: null,
      律動: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "tempoSlider", value: Math.round(48 + value * 112) },
            { target: id, cmd: "setParam", name: "rhythmPreset", value: pickFromList(KAGOME_RHYTHMS, frac(value * 1.37)) }
          ];
        }
      },
      転調: {
        apply: function (id, value) {
          return { target: id, cmd: "setParam", name: "scalePreset", value: pickFromList(KAGOME_SCALES, value) };
        }
      }
    },
    "planarian-drone": {
      抜き差し: {
        voices: ["layer.0", "layer.1", "layer.2"],
        floor: 0.18,
        apply: function (id, voice, value) {
          const layer = voice.split(".")[1];
          return [
            { target: id, cmd: "setParam", name: "layer." + layer + ".active", value: value > 0.08 ? 1 : 0 },
            { target: id, cmd: "setParam", name: "layer." + layer + ".level", value: +(0.12 + value * 0.88).toFixed(4) }
          ];
        }
      },
      律動: null,
      転調: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "rootNote", value: pickFromList(PLANARIAN_ROOTS, value) },
            { target: id, cmd: "setParam", name: "targetScale", value: pickFromList(PLANARIAN_SCALES, frac(value * 1.19)) }
          ];
        }
      }
    },
    "cell-noise": {
      抜き差し: {
        voices: ["sineMix", "pulseMix", "noiseMix"],
        floor: 0.15,
        apply: function (id, voice, value) {
          return { target: id, cmd: "setParam", name: voice, value: +(0.08 + value * 0.92).toFixed(4) };
        }
      },
      律動: {
        apply: function (id, value) {
          return [
            { target: id, cmd: "setParam", name: "pulseRate", value: +(0.5 + value * 8).toFixed(3) },
            { target: id, cmd: "setParam", name: "burstDensity", value: +(0.05 + value * 0.9).toFixed(4) }
          ];
        }
      },
      転調: {
        apply: function (id, value) {
          return { target: id, cmd: "setParam", name: "pitchBase", value: Math.round(90 + value * 360) };
        }
      }
    }
  };

  const MusicAdapterMap = {
    "stone-beats": function (id, music) {
      const relays = [];
      const bpm = Math.round(music.bpm * (tempoRatio(id) || 1));
      for (let i = 0; i < STONE_VOICES.length; i++) {
        const voice = STONE_VOICES[i];
        relays.push({ target: id, cmd: "setParam", name: "voice." + voice + ".bpm", value: bpm });
        if (music.mode === "凪") {
          relays.push({ target: id, cmd: "setParam", name: "voice." + voice + ".on", value: voice === "砂礫" ? 1 : 0 });
        }
      }
      return relays;
    },
    "ocean": function (id, music) {
      const relays = [
        { target: id, cmd: "setParam", name: "root", value: nearestOceanRoot(music.key, music.register) },
        { target: id, cmd: "setParam", name: "drift", value: Math.round(music.bpm * (tempoRatio(id) || 1)) }
      ];
      const scaleMap = {
        "凪": "ペンタトニック",
        "琉球": "ペンタトニック",
        "平調子": "ヒラジョシ",
        "陰旋": "ヨナ抜き",
        "アイヌ": "ヨナ抜き",
        "シベリア": "リディアン",
        "モンゴル": "ペンタトニック",
        "スレンドロ": "Whole Tone",
        "ペログ": "ヒラジョシ",
        "マカーム": "リディアン",
        "バイラヴィ": "ヨナ抜き",
        "無": "Whole Tone"
      };
      relays.push({ target: id, cmd: "setParam", name: "scale", value: scaleMap[music.mode] || "ペンタトニック" });
      if (music.mode === "凪") {
        relays.push({ target: id, cmd: "setParam", name: "oki.level", value: 0 });
        relays.push({ target: id, cmd: "setParam", name: "kg.level", value: 0 });
      }
      return relays;
    },
    "geometry-scanner": function (id, music) {
      const ratio = tempoRatio(id);
      const relays = [
        { target: id, cmd: "setParam", name: "bpm", value: Math.round(music.bpm * (ratio || 1)) },
        { target: id, cmd: "setParam", name: "selectedRootNote", value: clampGeometryRoot(music.key) }
      ];
      const scaleMap = {
        "凪": "Pentatonic Bloom",
        "琉球": "Pentatonic Bloom",
        "平調子": "Japanese In",
        "陰旋": "Moss Minor",
        "アイヌ": "Moss Minor",
        "シベリア": "1/f Harmonic",
        "モンゴル": "Pentatonic Bloom",
        "スレンドロ": "Pentatonic Bloom",
        "ペログ": "Japanese In",
        "マカーム": "Cellular Major",
        "バイラヴィ": "Moss Minor",
        "無": "1/f Harmonic"
      };
      relays.push({ target: id, cmd: "setParam", name: "selectedScale", value: scaleMap[music.mode] || "Pentatonic Bloom" });
      if (music.mode === "凪") {
        relays.push({ target: id, cmd: "setParam", name: "bassLevel", value: 0.9 });
        relays.push({ target: id, cmd: "setParam", name: "droneLevel", value: 0.05 });
        relays.push({ target: id, cmd: "setParam", name: "percussionLevel", value: 0.05 });
      }
      return relays;
    },
    "particle-noise": function (id, music) {
      const ratio = tempoRatio(id);
      const relays = [
        { target: id, cmd: "setParam", name: "rate", value: +((music.bpm * (ratio || 1)) / 60).toFixed(3) }
      ];
      if (music.mode === "凪") {
        relays.push({ target: id, cmd: "setParam", name: "rate", value: 0.5 });
        relays.push({ target: id, cmd: "setParam", name: "density", value: 0.1 });
      }
      return relays;
    },
    "kagome-sound": function (id, music) {
      const ratio = tempoRatio(id);
      const relays = [
        { target: id, cmd: "setParam", name: "tempoSlider", value: Math.round(music.bpm * (ratio || 1)) }
      ];
      const preset = kagomePresetForMode(music.mode);
      Object.keys(preset).forEach(function (key) {
        relays.push({ target: id, cmd: "setParam", name: key, value: preset[key] });
      });
      return relays;
    },
    "mycorrhiza-beat": function (id, music) {
      const ratio = tempoRatio(id);
      const relays = [
        { target: id, cmd: "setParam", name: "bpm", value: Math.round(music.bpm * (ratio || 1)) }
      ];
      if (music.mode === "凪") {
        ["kick", "snare", "hat", "perc"].forEach(function (voice) {
          relays.push({ target: id, cmd: "setParam", name: "sendLevel." + voice, value: 0.2 });
        });
      }
      return relays;
    },
    "moss-reservoir": function (id, music) {
      const ratio = tempoRatio(id);
      const relays = [
        { target: id, cmd: "setParam", name: "bpm", value: Math.round(music.bpm * (ratio || 1)) },
        { target: id, cmd: "setParam", name: "rootHz", value: +clamp(keyToHz(music.key, 1, music.register), 24, 108).toFixed(2) }
      ];
      if (music.mode === "凪") {
        relays.push({ target: id, cmd: "setParam", name: "den", value: 0.08 });
      }
      return relays;
    },
    "planarian-drone": function (id, music) {
      const relays = [
        { target: id, cmd: "setParam", name: "rootNote", value: nearestPitchClass(music.key, PLANARIAN_ROOTS) }
      ];
      const scaleMap = {
        "凪": "pentatonic",
        "琉球": "mixolydian",
        "平調子": "hirajoshi",
        "陰旋": "minor-pent",
        "アイヌ": "minor-pent",
        "シベリア": "harmonic",
        "モンゴル": "pentatonic",
        "スレンドロ": "pentatonic",
        "ペログ": "hirajoshi",
        "マカーム": "dorian",
        "バイラヴィ": "minor-pent",
        "無": "harmonic"
      };
      relays.push({ target: id, cmd: "setParam", name: "targetScale", value: scaleMap[music.mode] || "pentatonic" });
      if (music.mode === "凪") {
        relays.push({ target: id, cmd: "setParam", name: "layer.0.active", value: 1 });
        relays.push({ target: id, cmd: "setParam", name: "layer.1.active", value: 0 });
        relays.push({ target: id, cmd: "setParam", name: "layer.2.active", value: 0 });
      }
      return relays;
    },
    "cell-noise": function (id, music) {
      const ratio = tempoRatio(id);
      const relays = [
        { target: id, cmd: "setParam", name: "pitchBase", value: +keyToHz(music.key, 4, music.register).toFixed(2) },
        { target: id, cmd: "setParam", name: "pulseRate", value: +(music.bpm * (ratio || 1)).toFixed(3) }
      ];
      if (music.mode === "凪") {
        relays.push({ target: id, cmd: "setParam", name: "pulseRate", value: 0.5 });
        relays.push({ target: id, cmd: "setParam", name: "burstDensity", value: 0.1 });
      }
      return relays;
    }
  };

  const NAGARE = {
    config: {
      境地: "凪",
      時間スケール: clone(SCALE_DEFAULTS),
      依代別: makeDefaultInstrumentConfig()
    },
    state: {
      runningSince: 0,
      timers: {},
      fnStates: {},
      values: {},
      relayMemory: {},
      sectionMemory: {},
      seed: 0,
      music: clone(MUSIC_DEFAULTS),
      musicTimers: [],
      runtime: makeRuntime(),
      tickCounts: { "拍": 0, "節": 0, "章": 0, "巻": 0 }
    },

    attachRuntime: function (runtime) {
      runtime = runtime || {};
      this.state.runtime = {
        sendRelay: typeof runtime.sendRelay === "function" ? runtime.sendRelay : function () {},
        pushKotodama: typeof runtime.pushKotodama === "function" ? runtime.pushKotodama : function () {},
        getActiveInstruments: typeof runtime.getActiveInstruments === "function" ? runtime.getActiveInstruments : function () { return []; }
      };
    },

    getAvailableFunctions: function () {
      return NATURAL_FN_NAMES.slice();
    },

    getScaleNames: function () {
      return SCALE_NAMES.slice();
    },

    getRoleNames: function () {
      return ROLE_NAMES.slice();
    },

    getModeNames: function () {
      return Object.keys(Modes);
    },

    getMusicState: function () {
      return clone(this.state.music);
    },

    getMusicModeNames: function () {
      return MUSIC_MODES.slice();
    },

    getTempoRatios: function () {
      return clone(TEMPO_RATIOS);
    },

    getDefaultModulationPolicy: function (id) {
      return getModulationPolicy(id);
    },

    pitchClassSet: function (key, mode) {
      return pitchClassSet(key, mode);
    },

    planMusicTransition: function (patch, options) {
      const oldMusic = this.getMusicState();
      const nextMusic = normalizeMusicState(patch || {}, oldMusic);
      const opts = options || {};
      return planMusicTransition(oldMusic, nextMusic, opts.policy || "immediate", opts.durationSec || 4, opts.ids || this.getActiveInstruments(), opts.elapsedSec || 0);
    },

    getDefaultMusicState: function () {
      return clone(MUSIC_DEFAULTS);
    },

    setMode: function (name) {
      if (!Modes[name]) throw new Error("unknown mode: " + name);
      this.config.境地 = name;
      const mode = Modes[name];
      const scales = this.config.時間スケール;
      Object.keys(SCALE_DEFAULTS).forEach(function (scale) {
        scales[scale].fn = mode[scale].fn;
        scales[scale].smooth = mode[scale].smooth;
      });
      if (this.state.runningSince) this.start(this.state.seed);
    },

    setScaleConfig: function (scale, patch) {
      if (!this.config.時間スケール[scale]) throw new Error("unknown scale: " + scale);
      const cfg = this.config.時間スケール[scale];
      if (patch && typeof patch.fn === "string" && NATURAL_FN_NAMES.indexOf(patch.fn) >= 0) {
        cfg.fn = patch.fn;
      }
      if (patch && typeof patch.smooth === "number") {
        cfg.smooth = Natural.clamp01(patch.smooth);
      }
      if (patch && typeof patch.hz === "number" && patch.hz > 0) {
        cfg.hz = patch.hz;
      }
      if (this.state.fnStates[scale]) this.state.fnStates[scale] = {};
    },

    setInstrumentRole: function (id, role, enabled) {
      if (!this.config.依代別[id]) this.config.依代別[id] = {};
      this.config.依代別[id][role] = !!enabled;
    },

    isRunning: function () {
      return !!this.state.runningSince;
    },

    restart: function (seed) {
      this.start(typeof seed === "number" ? seed : this.state.seed);
    },

    getInstrumentCapabilities: function (id) {
      const map = InstrumentMap[id] || {};
      return {
        抜き差し: !!map.抜き差し,
        律動: !!map.律動,
        転調: !!map.転調
      };
    },

    getSnapshot: function () {
      return {
        running: this.isRunning(),
        seed: this.state.seed,
        mode: this.config.境地,
        music: this.getMusicState(),
        時間スケール: clone(this.config.時間スケール),
        依代別: clone(this.config.依代別)
      };
    },

    getActiveInstruments: function () {
      const fromRuntime = asArray(this.state.runtime.getActiveInstruments());
      if (fromRuntime.length) return fromRuntime;
      return Object.keys(this.config.依代別);
    },

    getRoleEnabled: function (id, role) {
      const entry = this.config.依代別[id];
      return !!(entry && entry[role]);
    },

    isInstrumentEnabled: function (id) {
      const entry = this.config.依代別[id];
      if (!entry) return true;
      for (let i = 0; i < ROLE_NAMES.length; i++) {
        if (entry[ROLE_NAMES[i]]) return true;
      }
      return false;
    },

    getFnState: function (scale, key) {
      const cfg = this.config.時間スケール[scale];
      const name = cfg.fn;
      const bucket = this.state.fnStates[scale] || (this.state.fnStates[scale] = {});
      const label = key + "|" + name;
      if (!bucket[label]) {
        bucket[label] = Natural[name].init(deriveSeed(this.state.seed, scale + ":" + label), cfg.opts || {});
      }
      return bucket[label];
    },

    getLastValue: function (scope, key) {
      return this.state.values[scope] && this.state.values[scope][key];
    },

    setLastValue: function (scope, key, value) {
      if (!this.state.values[scope]) this.state.values[scope] = {};
      this.state.values[scope][key] = value;
    },

    emitRelay: function (relay) {
      if (!relay || !relay.target || !relay.cmd) return;
      const key = relay.target + "|" + relay.cmd + "|" + (relay.name || "");
      const prev = this.state.relayMemory[key];
      const nextTag = relay.cmd === "ramp"
        ? [relay.from, relay.to, relay.dur, relay.startAt].join("|")
        : String(relay.value);
      if (prev === nextTag) return;
      this.state.relayMemory[key] = nextTag;
      this.state.runtime.sendRelay(relay.target, relay.cmd, relay);
    },

    applyVoiceFloor: function (id, roleMap, values, tickCount) {
      if (!roleMap || !roleMap.voices || !roleMap.floor) return values;
      let max = 0;
      for (let i = 0; i < values.length; i++) {
        if (values[i].value > max) max = values[i].value;
      }
      if (max >= roleMap.floor) return values;
      const keep = tickCount % values.length;
      return values.map(function (entry, idx) {
        return {
          voice: entry.voice,
          value: idx === keep ? roleMap.floor : entry.value
        };
      });
    },

    processPhrase: function (id, map, scale, tickCount) {
      const role = map.抜き差し;
      if (!role || !this.getRoleEnabled(id, "抜き差し")) return;
      const scope = "抜き差し:" + id;
      const prepared = [];
      for (let i = 0; i < role.voices.length; i++) {
        const voice = role.voices[i];
        const state = this.getFnState(scale, scope + ":" + voice);
        const raw = Natural[this.config.時間スケール[scale].fn].next(state, this.config.時間スケール[scale].opts || {});
        const prev = this.getLastValue(scope, voice);
        const value = smoothValue(prev, raw, this.config.時間スケール[scale].smooth);
        this.setLastValue(scope, voice, value);
        prepared.push({ voice: voice, value: value });
      }
      const leveled = this.applyVoiceFloor(id, role, prepared, tickCount);
      for (let j = 0; j < leveled.length; j++) {
        const entry = leveled[j];
        const relays = asArray(role.apply(id, entry.voice, entry.value, {
          scale: scale,
          tickCount: tickCount,
          mode: this.config.境地
        }));
        for (let k = 0; k < relays.length; k++) this.emitRelay(relays[k]);
      }
    },

    processBeat: function (id, map, scale, tickCount) {
      const role = map.律動;
      if (!role || !this.getRoleEnabled(id, "律動")) return;
      const scope = "律動:" + id;
      const state = this.getFnState(scale, scope);
      const raw = Natural[this.config.時間スケール[scale].fn].next(state, this.config.時間スケール[scale].opts || {});
      const prev = this.getLastValue(scope, "value");
      const value = smoothValue(prev, raw, this.config.時間スケール[scale].smooth);
      this.setLastValue(scope, "value", value);
      const relays = asArray(role.apply(id, value, {
        scale: scale,
        tickCount: tickCount,
        mode: this.config.境地
      }));
      for (let i = 0; i < relays.length; i++) this.emitRelay(relays[i]);
    },

    processChapter: function (id, map, scale, tickCount) {
      const role = map.転調;
      if (!role || !this.getRoleEnabled(id, "転調")) return;
      const scope = "転調:" + id;
      const state = this.getFnState(scale, scope);
      const raw = Natural[this.config.時間スケール[scale].fn].next(state, this.config.時間スケール[scale].opts || {});
      const prev = this.getLastValue(scope, "value");
      const value = smoothValue(prev, raw, this.config.時間スケール[scale].smooth);
      this.setLastValue(scope, "value", value);
      const ctx = this.state.sectionMemory[id] || (this.state.sectionMemory[id] = {});
      const relays = asArray(role.apply(id, value, {
        scale: scale,
        tickCount: tickCount,
        mode: this.config.境地,
        prevRoot: ctx.prevRoot,
        state: ctx
      }));
      for (let i = 0; i < relays.length; i++) this.emitRelay(relays[i]);
    },

    setMusicState: function (patch) {
      this.state.music = normalizeMusicState(patch, this.state.music);
      return this.getMusicState();
    },

    clearMusicTimers: function () {
      while (this.state.musicTimers.length) {
        clearTimeout(this.state.musicTimers.pop());
      }
    },

    applyMusicState: function (patch, ids) {
      const music = this.setMusicState(patch || {});
      const targets = Array.isArray(ids) && ids.length ? ids.slice() : this.getActiveInstruments();
      for (let i = 0; i < targets.length; i++) {
        const id = targets[i];
        if (!this.isInstrumentEnabled(id)) continue;
        const adapter = MusicAdapterMap[id];
        if (!adapter) continue;
        const relays = asArray(adapter(id, music));
        for (let j = 0; j < relays.length; j++) this.emitRelay(relays[j]);
      }
      return music;
    },

    runMusicTransition: function (patch, options) {
      const oldMusic = this.getMusicState();
      const opts = options || {};
      const newMusic = normalizeMusicState(patch || {}, oldMusic);
      const plans = planMusicTransition(oldMusic, newMusic, opts.policy || "immediate", opts.durationSec || 4, opts.ids || this.getActiveInstruments(), opts.elapsedSec || 0);
      const self = this;
      const summary = "転調策 key " + KEY_TO_NOTE[oldMusic.key] + "→" + KEY_TO_NOTE[newMusic.key]
        + " mode " + oldMusic.mode + "→" + newMusic.mode
        + " policy=" + (opts.policy || "immediate")
        + " duration=" + (opts.durationSec || 4);
      this.state.runtime.pushKotodama({ t: "kotodama", from: "field", text: summary, at: Shapes.nowMs() });
      const finalAtSec = plans.length ? plans[plans.length - 1].atSec : 0;
      plans.forEach(function (plan) {
        const timer = setTimeout(function () {
          self.state.runtime.pushKotodama({ t: "kotodama", from: "field", text: "転調段 " + plan.stage, at: Shapes.nowMs() });
          for (let i = 0; i < plan.relays.length; i++) self.emitRelay(plan.relays[i]);
          if (plan === plans[plans.length - 1]) {
            self.state.music = newMusic;
          }
        }, Math.max(0, Math.round(plan.atSec * 1000)));
        self.state.musicTimers.push(timer);
      });
      if (!plans.length || finalAtSec <= 0) {
        this.state.music = newMusic;
      }
      return plans;
    },

    tickScale: function (scale) {
      const ids = this.getActiveInstruments();
      const count = (this.state.tickCounts[scale] || 0) + 1;
      this.state.tickCounts[scale] = count;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const map = InstrumentMap[id];
        if (!map) continue;
        if (scale === "拍") this.processBeat(id, map, scale, count);
        if (scale === "節") this.processPhrase(id, map, scale, count);
        if (scale === "章") this.processChapter(id, map, scale, count);
      }
      if (scale === "拍") this.applyMusicState(null, ids);
    },

    start: function (seed) {
      this.stop();
      this.state.seed = Natural.normalizeSeed(seed);
      this.state.runningSince = Shapes.nowMs();
      this.state.fnStates = {};
      this.state.values = {};
      this.state.relayMemory = {};
      this.state.sectionMemory = {};
      this.clearMusicTimers();
      this.state.tickCounts = { "拍": 0, "節": 0, "章": 0, "巻": 0 };
      const scales = this.config.時間スケール;
      const self = this;

      Object.keys(scales).forEach(function (scale) {
        const cfg = scales[scale];
        cfg.seed = deriveSeed(self.state.seed, scale + ":" + cfg.fn);
        self.tickScale(scale);
        const intervalMs = Math.max(16, Math.round(1000 / cfg.hz));
        self.state.timers[scale] = setInterval(function () {
          self.tickScale(scale);
        }, intervalMs);
      });

      this.state.runtime.pushKotodama({
        t: "kotodama",
        from: "nagare",
        text: "流れを起こす seed=" + this.state.seed.toFixed(5) + " mode=" + this.config.境地,
        at: Shapes.nowMs()
      });
    },

    stop: function () {
      Object.keys(this.state.timers).forEach(function (scale) {
        clearInterval(NAGARE.state.timers[scale]);
      });
      this.state.timers = {};
      this.state.fnStates = {};
      this.state.values = {};
      this.state.relayMemory = {};
      this.state.sectionMemory = {};
      this.clearMusicTimers();
      this.state.tickCounts = { "拍": 0, "節": 0, "章": 0, "巻": 0 };
      if (this.state.runningSince) {
        this.state.runtime.pushKotodama({
          t: "kotodama",
          from: "nagare",
          text: "流れを鎮める",
          at: Shapes.nowMs()
        });
      }
      this.state.runningSince = 0;
    }
  };

  NAGARE.setMode("凪");

  if (typeof module !== "undefined" && module.exports) {
    module.exports = NAGARE;
    module.exports.InstrumentMap = InstrumentMap;
    module.exports.MusicAdapterMap = MusicAdapterMap;
    module.exports.TEMPO_RATIOS = TEMPO_RATIOS;
    module.exports.MODULATION_POLICIES = MODULATION_POLICIES;
    module.exports.MUSIC_MODE_DEGREES = MUSIC_MODE_DEGREES;
    module.exports.pitchClassSet = pitchClassSet;
    module.exports.voiceLed = voiceLed;
    module.exports.planMusicTransitionCore = planMusicTransition;
    module.exports.timeToNextPhraseBoundary = timeToNextPhraseBoundary;
  } else {
    root.ElSystemaInstrumentMap = InstrumentMap;
    root.ElSystemaMusicAdapterMap = MusicAdapterMap;
    root.ElSystemaTempoRatios = TEMPO_RATIOS;
    root.ElSystemaNAGARE = NAGARE;
  }
})(typeof window !== "undefined" ? window : globalThis);
