(function (root) {
  "use strict";

  function clamp01(x) {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function normalizeSeed(seed) {
    if (typeof seed !== "number" || !isFinite(seed)) return 0;
    return clamp01(seed);
  }

  function frac(x) {
    return x - Math.floor(x);
  }

  function seedToUint(seed, salt) {
    const base = Math.floor(normalizeSeed(seed) * 4294967295) >>> 0;
    return (base ^ (salt >>> 0) ^ 0x9e3779b9) >>> 0;
  }

  function createMulberry32(seed, salt) {
    let t = seedToUint(seed, salt);
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      let z = Math.imul(t ^ (t >>> 15), 1 | t);
      z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pinkInit(seed, opts) {
    const levels = (opts && opts.levels) || 7;
    const rand = createMulberry32(seed, 0x50494e4b);
    const state = {
      rand: rand,
      levels: [],
      beat: 0
    };
    for (let i = 0; i < levels; i++) state.levels.push(rand());
    return state;
  }

  function pinkNext(state) {
    state.beat += 1;
    state.levels[0] = state.rand();
    for (let k = 1; k < state.levels.length; k++) {
      if (state.beat % (1 << k) === 0) state.levels[k] = state.rand();
    }
    let sum = 0;
    for (let i = 0; i < state.levels.length; i++) sum += state.levels[i];
    return clamp01(sum / state.levels.length);
  }

  function logisticInit(seed, opts) {
    const r = opts && typeof opts.r === "number" ? opts.r : 3.95;
    return { x: 0.4 + 0.1 * normalizeSeed(seed), r: r };
  }

  function logisticNext(state) {
    state.x = state.r * state.x * (1 - state.x);
    return clamp01(state.x);
  }

  function lorenzInit(seed) {
    const s = normalizeSeed(seed);
    return {
      x: 0.1 + s * 0.1,
      y: (s - 0.5) * 0.2,
      z: s * 0.2
    };
  }

  function lorenzNext(state, opts) {
    const dt = opts && typeof opts.dt === "number" ? opts.dt : 0.015;
    const sigma = 10;
    const rho = 28;
    const beta = 8 / 3;
    const dx = sigma * (state.y - state.x);
    const dy = state.x * (rho - state.z) - state.y;
    const dz = state.x * state.y - beta * state.z;
    state.x += dx * dt;
    state.y += dy * dt;
    state.z += dz * dt;
    return clamp01((state.x + 20) / 40);
  }

  function goldInit(seed) {
    return { n: Math.floor(normalizeSeed(seed) * 1000) };
  }

  function goldNext(state) {
    const phi = (1 + Math.sqrt(5)) / 2;
    state.n += 1;
    return frac(state.n * phi);
  }

  function fibInit(seed) {
    return {
      i: Math.floor(normalizeSeed(seed) * 5),
      fib: [1, 1]
    };
  }

  function fibNext(state) {
    while (state.fib.length < state.i + 3) {
      const n = state.fib.length;
      state.fib.push(state.fib[n - 1] + state.fib[n - 2]);
    }
    state.i += 1;
    return (state.fib[state.i] % 100) / 100;
  }

  function brownInit(seed) {
    return {
      x: 0.5 + (normalizeSeed(seed) - 0.5) * 0.1,
      rand: createMulberry32(seed, 0x42524f57)
    };
  }

  function brownNext(state, opts) {
    const step = opts && typeof opts.step === "number" ? opts.step : 0.05;
    state.x += (state.rand() - 0.5) * step;
    state.x = clamp01(state.x);
    return state.x;
  }

  function sineInit(seed) {
    return { t: normalizeSeed(seed) * 100 };
  }

  function sineNext(state, opts) {
    const dt = opts && typeof opts.dt === "number" ? opts.dt : 0.05;
    state.t += dt;
    const a = Math.sin(state.t * Math.PI);
    const b = Math.sin(state.t * Math.E);
    const c = Math.sin(state.t * Math.sqrt(2));
    return clamp01((a + b + c + 3) / 6);
  }

  function caInit(seed, opts) {
    const width = opts && typeof opts.width === "number" ? opts.width : 64;
    const rule = opts && typeof opts.rule === "number" ? opts.rule : 30;
    const cells = new Uint8Array(width);
    cells[Math.floor(normalizeSeed(seed) * (width - 1))] = 1;
    return { cells: cells, rule: rule };
  }

  function caNext(state) {
    const width = state.cells.length;
    const next = new Uint8Array(width);
    for (let i = 0; i < width; i++) {
      const l = state.cells[(i - 1 + width) % width];
      const c = state.cells[i];
      const r = state.cells[(i + 1) % width];
      const idx = (l << 2) | (c << 1) | r;
      next[i] = (state.rule >> idx) & 1;
    }
    state.cells = next;
    return state.cells[Math.floor(width / 2)] ? 1 : 0;
  }

  function levyInit(seed, opts) {
    return {
      phase: normalizeSeed(seed),
      alpha: opts && typeof opts.alpha === "number" ? opts.alpha : 1.5,
      rand: createMulberry32(seed, 0x4c455659)
    };
  }

  function levyNext(state) {
    const u = Math.max(0.001, state.rand());
    const step = 1 / Math.pow(u, 1 / state.alpha);
    state.phase = frac(state.phase + step * 0.05);
    return state.phase;
  }

  const NATURAL = {
    pink:     { init: pinkInit, next: pinkNext },
    logistic: { init: logisticInit, next: logisticNext },
    lorenz:   { init: lorenzInit, next: lorenzNext },
    gold:     { init: goldInit, next: goldNext },
    fib:      { init: fibInit, next: fibNext },
    brown:    { init: brownInit, next: brownNext },
    sine:     { init: sineInit, next: sineNext },
    ca:       { init: caInit, next: caNext },
    levy:     { init: levyInit, next: levyNext }
  };

  const MODES = {
    "凪": { "拍": { fn: "pink", smooth: 0.9 }, "節": { fn: "brown", smooth: 0.9 }, "章": { fn: "brown", smooth: 0.9 }, "巻": { fn: "brown", smooth: 0.9 } },
    "流": { "拍": { fn: "pink", smooth: 0.6 }, "節": { fn: "gold", smooth: 0.5 }, "章": { fn: "fib", smooth: 0.4 }, "巻": { fn: "lorenz", smooth: 0.3 } },
    "動": { "拍": { fn: "logistic", smooth: 0.3 }, "節": { fn: "pink", smooth: 0.3 }, "章": { fn: "gold", smooth: 0.4 }, "巻": { fn: "lorenz", smooth: 0.3 } },
    "嵐": { "拍": { fn: "lorenz", smooth: 0.1 }, "節": { fn: "levy", smooth: 0.0 }, "章": { fn: "logistic", smooth: 0.1 }, "巻": { fn: "levy", smooth: 0.0 } },
    "整": { "拍": { fn: "ca", smooth: 0.0 }, "節": { fn: "fib", smooth: 0.0 }, "章": { fn: "ca", smooth: 0.0 }, "巻": { fn: "fib", smooth: 0.0 } },
    "無": { "拍": { fn: "levy", smooth: 0.5 }, "節": { fn: "levy", smooth: 0.5 }, "章": { fn: "brown", smooth: 0.7 }, "巻": { fn: "sine", smooth: 0.5 } }
  };

  const API = {
    clamp01: clamp01,
    normalizeSeed: normalizeSeed,
    createMulberry32: createMulberry32,
    pink: NATURAL.pink,
    logistic: NATURAL.logistic,
    lorenz: NATURAL.lorenz,
    gold: NATURAL.gold,
    fib: NATURAL.fib,
    brown: NATURAL.brown,
    sine: NATURAL.sine,
    ca: NATURAL.ca,
    levy: NATURAL.levy,
    NATURAL: NATURAL,
    MODES: MODES
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  } else {
    root.ElSystemaNatural = API;
    root.ElSystemaModes = MODES;
  }
})(typeof window !== "undefined" ? window : globalThis);
