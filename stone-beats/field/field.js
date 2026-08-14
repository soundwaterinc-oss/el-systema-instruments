// EL-SYSTEMA ─ ヲサ（巫）の場
//
// 役:
//   - 場に繋がる（ws）
//   - 祭文（ガイス JSON）を読み、静的検査する
//   - 「祭次」を時刻に従って配る
//   - 「応答」を 6Hz の神籠り loop で評価し、満たせば為（行為）を撃つ
//   - すべて言上（kotodama 風記録）に残す。AI は系に入れない

(function () {
  "use strict";

  const Shapes = window.ElSystemaShapes;
  const Transport = window.ElSystemaTransport;
  const Names = window.ElSystemaNames;
  const NAGARE = window.ElSystemaNAGARE || null;

  const el = {
    title: document.getElementById("title"),
    connBadge: document.getElementById("connBadge"),
    connUrl: document.getElementById("connUrl"),
    liturgyFile: document.getElementById("liturgyFile"),
    liturgyName: document.getElementById("liturgyName"),
    loadExample: document.getElementById("loadExample"),
    castStart: document.getElementById("castStart"),
    castStop: document.getElementById("castStop"),
    castReturn: document.getElementById("castReturn"),
    exportBtn: document.getElementById("exportBtn"),
    canvas: document.getElementById("canvas"),
    kotodama: document.getElementById("kotodama"),
    kotodamaHead: document.getElementById("kotodamaHead"),
    nagareTuneHead: document.getElementById("nagareTuneHead"),
    nagareHead: document.getElementById("nagareHead"),
    nagareStatus: document.getElementById("nagareStatus"),
    kyouchiLabel: document.getElementById("kyouchiLabel"),
    nagareMode: document.getElementById("nagareMode"),
    nagareStartBtn: document.getElementById("nagareStartBtn"),
    nagareStopBtn: document.getElementById("nagareStopBtn"),
    nagareSeedLabel: document.getElementById("nagareSeedLabel"),
    nagareSeedInput: document.getElementById("nagareSeedInput"),
    nagareSeedRefresh: document.getElementById("nagareSeedRefresh"),
    nagareAutoStart: document.getElementById("nagareAutoStart"),
    nagareAutoStartLabel: document.getElementById("nagareAutoStartLabel"),
    nagareScaleHead: document.getElementById("nagareScaleHead"),
    nagareScaleNote: document.getElementById("nagareScaleNote"),
    nagareScaleGrid: document.getElementById("nagareScaleGrid"),
    nagareInstrumentHead: document.getElementById("nagareInstrumentHead"),
    nagareInstrumentGrid: document.getElementById("nagareInstrumentGrid")
  };

  el.title.textContent = Names.UI.title;
  el.kotodamaHead.textContent = Names.UI.kotodamaHead;
  if (el.nagareTuneHead) el.nagareTuneHead.textContent = Names.UI.nagareTuneHead;
  if (el.nagareHead) el.nagareHead.textContent = Names.UI.nagarePanelHead;
  if (el.kyouchiLabel) el.kyouchiLabel.textContent = Names.UI.kyouchi;
  if (el.nagareStartBtn) el.nagareStartBtn.textContent = Names.UI.nagareStart;
  if (el.nagareStopBtn) el.nagareStopBtn.textContent = Names.UI.nagareStop;
  if (el.nagareSeedLabel) el.nagareSeedLabel.textContent = Names.UI.nagareSeedLabel;
  if (el.nagareSeedRefresh) el.nagareSeedRefresh.textContent = Names.UI.nagareSeedRefresh;
  if (el.nagareAutoStartLabel) el.nagareAutoStartLabel.textContent = Names.UI.nagareAutoStart;
  if (el.nagareScaleHead) el.nagareScaleHead.textContent = Names.UI.nagareScaleHead;
  if (el.nagareScaleNote) el.nagareScaleNote.textContent = Names.UI.nagareScaleNote;
  if (el.nagareInstrumentHead) el.nagareInstrumentHead.textContent = Names.UI.nagareInstrumentHead;

  const state = {
    transport: null,
    liturgy: null,
    liturgySource: null,
    casting: false,
    castStartAt: 0,
    instruments: {},
    fired: {},
    quietSince: {},
    coolingUntil: {},
    waveBurst: [],
    scheduledSeq: [],
    sessionMessages: [],
    sessionStartAt: null,
    sessionId: null,
    sessionEndedAt: null,
    sessionOpen: false,
    nagareSeed: 0,
    nagareAutoStart: true,
    nagareRowsVersion: "",
    nagareRamps: {}
  };

  function clamp01(x) {
    return x < 0 ? 0 : (x > 1 ? 1 : x);
  }

  function formatSeed(seed) {
    return (Math.round(clamp01(seed) * 100000) / 100000).toFixed(5);
  }

  function parseSeedInput() {
    if (!el.nagareSeedInput) return null;
    const raw = String(el.nagareSeedInput.value || "").trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!isFinite(n)) return null;
    return clamp01(n);
  }

  function bakeSeed() {
    return clamp01((Shapes.nowMs() % 100000) / 100000);
  }

  function getNagareSnapshot() {
    if (!NAGARE) return null;
    return NAGARE.getSnapshot ? NAGARE.getSnapshot() : {
      running: !!NAGARE.state.runningSince,
      seed: NAGARE.state.seed || 0,
      mode: NAGARE.config.境地,
      時間スケール: NAGARE.config.時間スケール,
      依代別: NAGARE.config.依代別
    };
  }

  function isInstrumentConnected(inst) {
    if (!inst || !inst.lastKehaiAt) return false;
    return (Shapes.nowMs() - inst.lastKehaiAt) < 4000;
  }

  function getInstrumentIdsForUi() {
    const ids = Object.keys(state.instruments);
    ids.sort();
    return ids;
  }

  function uiSync() {
    el.castStart.disabled = !(state.liturgy && !state.casting && state.transport);
    el.castStop.disabled = !state.casting;
    el.castReturn.disabled = !state.transport;
    if (el.exportBtn) el.exportBtn.disabled = state.sessionMessages.length === 0;

    if (el.nagareStartBtn) el.nagareStartBtn.disabled = !NAGARE;
    if (el.nagareStopBtn) el.nagareStopBtn.disabled = !NAGARE || !NAGARE.isRunning();
    syncNagareStatus();
    syncNagareInstrumentRows();
  }

  function startSession() {
    state.sessionMessages = [];
    state.sessionStartAt = Shapes.nowMs();
    state.sessionId = Shapes.newRelayId();
    state.sessionEndedAt = null;
    state.sessionOpen = true;
  }

  function endSession() {
    if (!state.sessionOpen) return;
    state.sessionEndedAt = Shapes.nowMs();
    state.sessionOpen = false;
    uiSync();
  }

  function recordSessionMessage(m) {
    if (!state.sessionOpen) return;
    if (m.t === "kehai") return;
    state.sessionMessages.push(m);
    uiSync();
  }

  function exportSession() {
    if (state.sessionMessages.length === 0) {
      pushKotodama({ t: "err", from: "field", of: "export", msg: "書き出すメッセージがありません", at: Shapes.nowMs() });
      return;
    }

    const payload = state.sessionMessages.slice();
    const meta = {
      t: "meta",
      session: state.sessionId || Shapes.newRelayId(),
      started: state.sessionStartAt || (payload[0] ? payload[0].at : Shapes.nowMs()),
      ended: state.sessionEndedAt || Shapes.nowMs(),
      messageCount: payload.length
    };
    const messages = [meta].concat(payload);
    const jsonl = messages.map(function (m) { return JSON.stringify(m); }).join("\n") + "\n";
    const blob = new Blob([jsonl], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = "kotodama-" + timestamp + ".jsonl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    pushKotodama({ t: "kotodama", from: "field", text: "言上 " + messages.length + " 行を書き出しました", at: Shapes.nowMs() });
  }

  function pushKotodama(m) {
    const li = document.createElement("li");
    li.className = m.t;
    const time = new Date(m.at);
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    const ss = String(time.getSeconds()).padStart(2, "0");
    const t = document.createElement("time");
    t.textContent = hh + ":" + mm + ":" + ss;
    const body = document.createElement("span");
    body.textContent = formatLine(m);
    li.appendChild(t);
    li.appendChild(body);
    el.kotodama.prepend(li);
    if (el.kotodama.children.length > 500) {
      el.kotodama.removeChild(el.kotodama.lastChild);
    }
  }

  function formatLine(m) {
    switch (m.t) {
      case "relay":
        return "→ " + m.target + ": " + m.cmd
          + (m.name ? " " + m.name : "")
          + (m.value !== undefined ? "=" + m.value : "")
          + (m.cmd === "ramp" ? " " + m.from + "→" + m.to + " dur=" + m.dur + "ms startAt=" + m.startAt : "");
      case "kehai":
        return "· " + m.from + "  presence=" + m.presence + "  low=" + m.low + "  high=" + m.high + (m.everSpoke ? "" : " (" + Names.UI.everSpokeNo + ")");
      case "silence":
        return "… " + m.from + "  沈黙 " + m.since.toFixed(1) + "s";
      case "ack":
        return "✓ " + m.from + "  of=" + m.of;
      case "err":
        return "✗ " + m.from + "  of=" + m.of + "  " + m.msg;
      case "maneki":
        return "招 " + m.guise + "  startAt=" + m.startAt;
      case "kotodama":
        return "「" + m.text + "」 ─ " + m.from;
      default:
        return JSON.stringify(m);
    }
  }

  function openTransport() {
    state.transport = Transport.createTransport({ kind: "ws" });
    state.transport.onOpen(function () {
      el.connBadge.textContent = "繋がりました";
      el.connBadge.className = "badge live";
      uiSync();
    });
    state.transport.onClose(function () {
      el.connBadge.textContent = "切れました";
      el.connBadge.className = "badge dim";
      uiSync();
    });
    state.transport.onMessage(handleIncoming);
  }

  const PRESENCE_WAKE = 0.06;

  function ensureInst(id) {
    if (!state.instruments[id]) {
      state.instruments[id] = {
        presence: 0,
        low: 0,
        high: 0,
        everSpoke: false,
        lastKehaiAt: 0,
        silenceOnsetAt: null
      };
      syncNagareInstrumentRows(true);
    }
    return state.instruments[id];
  }

  function handleIncoming(m) {
    if (!Shapes.isValid(m)) return;
    if (m.t === "kehai") {
      const k = ensureInst(m.from);
      k.presence = m.presence;
      k.low = m.low;
      k.high = m.high;
      k.everSpoke = m.everSpoke;
      k.lastKehaiAt = m.at;
      if (k.silenceOnsetAt && m.presence >= PRESENCE_WAKE) k.silenceOnsetAt = null;
      return;
    }
    if (m.t === "silence") {
      recordSessionMessage(m);
      pushKotodama(m);
      const s = ensureInst(m.from);
      s.silenceOnsetAt = m.at - (m.since || 0) * 1000;
      return;
    }
    recordSessionMessage(m);
    pushKotodama(m);
  }

  function sendRelay(target, cmd, extra) {
    const m = Object.assign({
      t: "relay",
      id: Shapes.newRelayId(),
      target: target,
      cmd: cmd,
      at: Shapes.nowMs()
    }, extra || {});
    if (isMusubiTarget(target)) {
      dispatchMusubiRelay(m);
      return;
    }
    state.transport.send(m);
    recordSessionMessage(m);
    pushKotodama(m);
  }

  function isMusubiTarget(target) {
    if (Shapes.isReservedTarget) return Shapes.isReservedTarget(target);
    return target === "MUSUBI" || target === "nagare";
  }

  function syncNagareUi(forceRows) {
    syncNagareStatus();
    applyNagareScaleValues();
    syncNagareInstrumentRows(!!forceRows);
  }

  function applyMusubiMusicPatch(patch) {
    if (!NAGARE || typeof NAGARE.applyMusicState !== "function") {
      throw new Error("NAGARE music state is not available");
    }
    NAGARE.applyMusicState(patch || {});
    syncNagareUi(true);
  }

  function scheduleMusicPolicies() {
    if (!NAGARE || !state.liturgy || !state.liturgy["音楽"] || !Array.isArray(state.liturgy["音楽"]["転調策"])) return;
    const modulations = state.liturgy["音楽"]["転調策"];
    modulations.forEach(function (entry) {
      if (!entry || typeof entry !== "object" || typeof entry["時"] !== "number") return;
      if (entry["時"] > state.liturgy.duration) {
        pushKotodama({ t: "err", from: "field", of: "music", msg: "転調策が duration を超えています: t=" + entry["時"], at: Shapes.nowMs() });
        return;
      }
      setTimeout(function () {
        if (!state.casting) return;
        const patch = {};
        if (entry.key !== undefined) patch.key = entry.key;
        if (entry.mode !== undefined) patch.mode = entry.mode;
        if (entry.bpm !== undefined) patch.bpm = entry.bpm;
        if (entry.register !== undefined) patch.register = entry.register;
        const durationSec = typeof entry.duration === "number" ? entry.duration : 4;
        const elapsedSec = Math.max(0, (Shapes.nowMs() - state.castStartAt) / 1000);
        if (entry.policy) {
          NAGARE.runMusicTransition(patch, { policy: entry.policy, durationSec: durationSec, elapsedSec: elapsedSec });
        } else {
          const ids = NAGARE.getActiveInstruments();
          const groups = {};
          ids.forEach(function (id) {
            const policy = NAGARE.getDefaultModulationPolicy(id);
            if (!groups[policy]) groups[policy] = [];
            groups[policy].push(id);
          });
          Object.keys(groups).forEach(function (policy) {
            NAGARE.runMusicTransition(patch, { policy: policy, durationSec: durationSec, elapsedSec: elapsedSec, ids: groups[policy] });
          });
        }
        syncNagareUi(true);
      }, Math.max(0, Math.round(entry["時"] * 1000)));
    });
  }

  function normalizeMusubiRole(role) {
    const aliases = {
      "nuki": "抜き差し",
      "nukisashi": "抜き差し",
      "phrase": "抜き差し",
      "rhythm": "律動",
      "beat": "律動",
      "shift": "転調",
      "transpose": "転調"
    };
    if (role === "抜き差し" || role === "律動" || role === "転調") return role;
    return aliases[String(role || "").toLowerCase()] || null;
  }

  function applyMusubiParam(name, value) {
    if (!NAGARE) throw new Error("NAGARE is not available");
    let m = String(name || "").match(/^music\.(key|mode|bpm|register)$/);
    if (m) {
      const patch = {};
      patch[m[1]] = value;
      applyMusubiMusicPatch(patch);
      return;
    }
    if (name === "境地" || name === "mode") {
      if (typeof value !== "string") throw new Error("境地 must be a string");
      NAGARE.setMode(value);
      syncNagareUi();
      return;
    }
    if (name === "seed") {
      if (typeof value !== "number" || !isFinite(value)) throw new Error("seed must be a finite number");
      const nextSeed = clamp01(value);
      reflectSeedInput(nextSeed);
      if (NAGARE.isRunning()) {
        NAGARE.restart(nextSeed);
      }
      syncNagareUi();
      return;
    }

    m = String(name || "").match(/^scale\.([^.]+)\.(fn|smooth|hz)$/);
    if (m) {
      const patch = {};
      if (m[2] === "fn") {
        if (typeof value !== "string") throw new Error(name + " must be a string");
        patch.fn = value;
      } else {
        if (typeof value !== "number" || !isFinite(value)) throw new Error(name + " must be a finite number");
        patch[m[2]] = value;
      }
      NAGARE.setScaleConfig(m[1], patch);
      syncNagareUi();
      return;
    }

    m = String(name || "").match(/^instrument\.([^.]+)\.([^.]+)$/);
    if (m) {
      const role = normalizeMusubiRole(m[2]);
      if (!role) throw new Error("unknown MUSUBI role: " + m[2]);
      NAGARE.setInstrumentRole(m[1], role, !!value);
      syncNagareUi(true);
      return;
    }

    throw new Error("unknown MUSUBI param: " + name);
  }

  function cancelMusubiRamp(name) {
    const handle = state.nagareRamps[name];
    if (!handle) return;
    cancelAnimationFrame(handle.rafId);
    delete state.nagareRamps[name];
  }

  function rampMusubiParam(name, from, to, dur, startAt) {
    if (name === "境地" || name === "mode" || name === "seed" || /^instrument\./.test(name)) {
      throw new Error("MUSUBI ramp does not support " + name);
    }
    cancelMusubiRamp(name);
    if (!(dur > 0)) {
      applyMusubiParam(name, to);
      return;
    }
    const t0 = (typeof startAt === "number" && startAt > Shapes.nowMs()) ? startAt : Shapes.nowMs();
    const token = Shapes.newRelayId();
    const step = function () {
      const handle = state.nagareRamps[name];
      if (!handle || handle.token !== token) return;
      const now = Shapes.nowMs();
      if (now < t0) {
        handle.rafId = requestAnimationFrame(step);
        return;
      }
      const k = Math.min(1, (now - t0) / dur);
      const v = from + (to - from) * k;
      applyMusubiParam(name, v);
      if (k >= 1) {
        delete state.nagareRamps[name];
        return;
      }
      handle.rafId = requestAnimationFrame(step);
    };
    state.nagareRamps[name] = { token: token, rafId: requestAnimationFrame(step) };
  }

  function flattenMusubiPreset(preset) {
    const flat = [];
    Object.keys(preset || {}).forEach(function (key) {
      const value = preset[key];
      if (key === "music" && value && typeof value === "object" && !Array.isArray(value)) {
        Object.keys(value).forEach(function (field) {
          flat.push(["music." + field, value[field]]);
        });
        return;
      }
      if (key === "scale" && value && typeof value === "object" && !Array.isArray(value)) {
        Object.keys(value).forEach(function (scale) {
          const cfg = value[scale];
          if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return;
          Object.keys(cfg).forEach(function (field) {
            flat.push(["scale." + scale + "." + field, cfg[field]]);
          });
        });
        return;
      }
      if (key === "instrument" && value && typeof value === "object" && !Array.isArray(value)) {
        Object.keys(value).forEach(function (id) {
          const roles = value[id];
          if (!roles || typeof roles !== "object" || Array.isArray(roles)) return;
          Object.keys(roles).forEach(function (role) {
            flat.push(["instrument." + id + "." + role, roles[role]]);
          });
        });
        return;
      }
      flat.push([key, value]);
    });
    return flat;
  }

  function dispatchMusubiRelay(m) {
    try {
      switch (m.cmd) {
        case "play":
          startNagare(computeNagareSeed({ preferCurrent: true, preferLiturgySeed: true }), true);
          break;
        case "stop":
          stopNagare();
          break;
        case "setParam":
          applyMusubiParam(m.name, m.value);
          break;
        case "ramp":
          rampMusubiParam(m.name, m.from, m.to, m.dur, m.startAt);
          break;
        case "loadPreset":
          flattenMusubiPreset(m.preset).forEach(function (entry) {
            applyMusubiParam(entry[0], entry[1]);
          });
          break;
        case "snapshot":
          pushKotodama({
            t: "kotodama",
            from: "field",
            text: "MUSUBI snapshot " + JSON.stringify(getNagareSnapshot()),
            at: Shapes.nowMs()
          });
          break;
      }
      recordSessionMessage(m);
      pushKotodama(m);
    } catch (e) {
      const err = {
        t: "err",
        from: "field",
        of: "MUSUBI",
        msg: e && e.message ? e.message : String(e),
        at: Shapes.nowMs()
      };
      recordSessionMessage(m);
      recordSessionMessage(err);
      pushKotodama(err);
    }
  }

  function computeNagareSeed(options) {
    const opts = options || {};
    const inputSeed = parseSeedInput();
    if (inputSeed !== null) return inputSeed;
    if (opts.preferLiturgySeed && state.liturgy && typeof state.liturgy.seed === "number") {
      return clamp01(state.liturgy.seed);
    }
    if (opts.preferCurrent && typeof state.nagareSeed === "number" && state.nagareSeed >= 0) {
      return clamp01(state.nagareSeed);
    }
    return bakeSeed();
  }

  function reflectSeedInput(seed) {
    state.nagareSeed = clamp01(seed);
    if (el.nagareSeedInput) el.nagareSeedInput.value = formatSeed(state.nagareSeed);
  }

  function startNagare(seed, refreshInput) {
    if (!NAGARE) return;
    const baked = clamp01(typeof seed === "number" ? seed : computeNagareSeed({}));
    state.nagareSeed = baked;
    if (refreshInput !== false) reflectSeedInput(baked);
    NAGARE.start(baked);
    syncNagareStatus();
  }

  function clearNagareRamps() {
    Object.keys(state.nagareRamps).forEach(cancelMusubiRamp);
  }

  function stopNagare() {
    if (!NAGARE) return;
    clearNagareRamps();
    NAGARE.stop();
    syncNagareStatus();
  }

  function syncNagareStatus() {
    if (!el.nagareStatus || !NAGARE) return;
    const snap = getNagareSnapshot();
    const mode = snap.mode || "凪";
    el.nagareStatus.className = "mode-badge mode-" + mode;
    el.nagareStatus.textContent = snap.running ? Names.UI.nagareRunning : Names.UI.nagareStopped;
    if (el.nagareMode && el.nagareMode.value !== mode) el.nagareMode.value = mode;
    if (el.nagareAutoStart) el.nagareAutoStart.checked = state.nagareAutoStart;
  }

  function renderNagareScaleGrid() {
    if (!NAGARE || !el.nagareScaleGrid) return;
    const frag = document.createDocumentFragment();
    const functions = NAGARE.getAvailableFunctions();
    const scales = NAGARE.getScaleNames();
    for (let i = 0; i < scales.length; i++) {
      const scale = scales[i];
      const row = document.createElement("div");
      row.className = "scale-row";

      const label = document.createElement("div");
      label.className = "scale-name";
      label.textContent = Names.UI.時間スケール[scale] || scale;

      const card = document.createElement("div");
      card.className = "scale-card";

      const select = document.createElement("select");
      select.id = "nagare-scale-fn-" + scale;
      for (let j = 0; j < functions.length; j++) {
        const fn = functions[j];
        const opt = document.createElement("option");
        opt.value = fn;
        opt.textContent = fn;
        select.appendChild(opt);
      }

      const meta = document.createElement("div");
      meta.className = "scale-meta";

      const rangeLabel = document.createElement("span");
      rangeLabel.textContent = "smoothing";

      const strong = document.createElement("strong");
      strong.id = "nagare-scale-smooth-value-" + scale;

      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "1";
      range.step = "0.01";
      range.id = "nagare-scale-smooth-" + scale;

      meta.appendChild(rangeLabel);
      meta.appendChild(strong);
      card.appendChild(select);
      card.appendChild(meta);
      card.appendChild(range);
      row.appendChild(label);
      row.appendChild(card);
      frag.appendChild(row);
    }
    el.nagareScaleGrid.innerHTML = "";
    el.nagareScaleGrid.appendChild(frag);
  }

  function applyNagareScaleValues() {
    if (!NAGARE) return;
    const snap = getNagareSnapshot();
    const scales = NAGARE.getScaleNames();
    for (let i = 0; i < scales.length; i++) {
      const scale = scales[i];
      const cfg = snap.時間スケール[scale];
      const select = document.getElementById("nagare-scale-fn-" + scale);
      const range = document.getElementById("nagare-scale-smooth-" + scale);
      const value = document.getElementById("nagare-scale-smooth-value-" + scale);
      if (select) select.value = cfg.fn;
      if (range) range.value = Number(cfg.smooth || 0).toFixed(2);
      if (value) value.textContent = Number(cfg.smooth || 0).toFixed(2);
    }
  }

  function renderNagareModeOptions() {
    if (!NAGARE || !el.nagareMode) return;
    const frag = document.createDocumentFragment();
    const modes = NAGARE.getModeNames();
    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i];
      const opt = document.createElement("option");
      opt.value = mode;
      opt.textContent = mode;
      frag.appendChild(opt);
    }
    el.nagareMode.innerHTML = "";
    el.nagareMode.appendChild(frag);
  }

  function syncNagareInstrumentRows(force) {
    if (!NAGARE || !el.nagareInstrumentGrid) return;
    const ids = getInstrumentIdsForUi();
    const version = ids.join("|");
    if (force || version !== state.nagareRowsVersion) {
      renderNagareInstrumentRows(ids);
      state.nagareRowsVersion = version;
    }
    const rows = el.nagareInstrumentGrid.querySelectorAll(".instrument-row");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = row.getAttribute("data-id");
      const inst = state.instruments[id];
      row.classList.toggle("disconnected", !isInstrumentConnected(inst));
    }
  }

  function renderNagareInstrumentRows(ids) {
    if (!NAGARE || !el.nagareInstrumentGrid) return;
    el.nagareInstrumentGrid.innerHTML = "";
    if (!ids.length) {
      const empty = document.createElement("div");
      empty.className = "instrument-empty";
      empty.textContent = "依代がまだ参じていません";
      el.nagareInstrumentGrid.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    const roles = NAGARE.getRoleNames();
    const snap = getNagareSnapshot();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const caps = NAGARE.getInstrumentCapabilities(id);
      const row = document.createElement("div");
      row.className = "instrument-row";
      row.setAttribute("data-id", id);

      const main = document.createElement("div");
      main.className = "instrument-main";
      const masterLabel = document.createElement("label");
      const master = document.createElement("input");
      master.type = "checkbox";
      master.className = "nagare-master-toggle";
      master.setAttribute("data-id", id);
      master.checked = roles.some(function (role) {
        return !!(snap.依代別[id] && snap.依代別[id][role]);
      });
      const name = document.createElement("span");
      name.textContent = id;
      masterLabel.appendChild(master);
      masterLabel.appendChild(name);
      main.appendChild(masterLabel);

      const roleWrap = document.createElement("div");
      roleWrap.className = "role-toggles";

      for (let j = 0; j < roles.length; j++) {
        const role = roles[j];
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "nagare-role-toggle";
        box.setAttribute("data-id", id);
        box.setAttribute("data-role", role);
        box.disabled = !caps[role];
        box.checked = !!(snap.依代別[id] && snap.依代別[id][role]);
        label.appendChild(box);
        label.appendChild(document.createTextNode(Names.UI["nagareRole" + (role === "抜き差し" ? "Nuki" : role === "律動" ? "Rhythm" : "Shift")] || role));
        roleWrap.appendChild(label);
      }

      row.appendChild(main);
      row.appendChild(roleWrap);
      frag.appendChild(row);
    }

    el.nagareInstrumentGrid.appendChild(frag);
  }

  function bindNagareUi() {
    if (!NAGARE) return;

    renderNagareModeOptions();
    renderNagareScaleGrid();
    applyNagareScaleValues();
    reflectSeedInput(NAGARE.state.seed || 0.5);
    syncNagareStatus();
    syncNagareInstrumentRows(true);

    el.nagareMode.addEventListener("change", function () {
      NAGARE.setMode(el.nagareMode.value);
      applyNagareScaleValues();
      syncNagareStatus();
    });

    const scales = NAGARE.getScaleNames();
    for (let i = 0; i < scales.length; i++) {
      const scale = scales[i];
      const select = document.getElementById("nagare-scale-fn-" + scale);
      const range = document.getElementById("nagare-scale-smooth-" + scale);
      const label = document.getElementById("nagare-scale-smooth-value-" + scale);
      select.addEventListener("change", function () {
        NAGARE.setScaleConfig(scale, { fn: select.value });
      });
      range.addEventListener("input", function () {
        const smooth = clamp01(Number(range.value));
        if (label) label.textContent = smooth.toFixed(2);
        NAGARE.setScaleConfig(scale, { smooth: smooth });
      });
    }

    el.nagareAutoStart.addEventListener("change", function () {
      state.nagareAutoStart = !!el.nagareAutoStart.checked;
    });

    el.nagareStartBtn.addEventListener("click", function () {
      startNagare(computeNagareSeed({ preferCurrent: false, preferLiturgySeed: false }), true);
    });

    el.nagareStopBtn.addEventListener("click", function () {
      stopNagare();
      uiSync();
    });

    el.nagareSeedRefresh.addEventListener("click", function () {
      const seed = computeNagareSeed({ preferCurrent: true, preferLiturgySeed: true });
      reflectSeedInput(seed);
      if (NAGARE.isRunning()) startNagare(seed, true);
    });

    el.nagareSeedInput.addEventListener("change", function () {
      const seed = parseSeedInput();
      if (seed !== null) reflectSeedInput(seed);
    });

    el.nagareInstrumentGrid.addEventListener("change", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const id = target.getAttribute("data-id");
      if (!id) return;

      if (target.classList.contains("nagare-master-toggle")) {
        const roles = NAGARE.getRoleNames();
        const caps = NAGARE.getInstrumentCapabilities(id);
        for (let i = 0; i < roles.length; i++) {
          const role = roles[i];
          const enabled = !!target.checked && !!caps[role];
          NAGARE.setInstrumentRole(id, role, enabled);
        }
        syncNagareInstrumentRows(true);
        return;
      }

      if (target.classList.contains("nagare-role-toggle")) {
        const role = target.getAttribute("data-role");
        NAGARE.setInstrumentRole(id, role, !!target.checked);
        syncNagareInstrumentRows(true);
      }
    });
  }

  function scheduleCast() {
    const seq = state.liturgy["祭次"] || [];
    state.scheduledSeq = seq.map(function (e) {
      const yura = (typeof e["揺"] === "number") ? (Math.random() * 2 - 1) * e["揺"] : 0;
      const atMs = Math.max(0, (e["時"] + yura) * 1000);
      return { entry: e, atMs: atMs, startAt: state.castStartAt + atMs };
    });
    state.scheduledSeq.forEach(function (slot) {
      const e = slot.entry;
      setTimeout(function () {
        if (!state.casting) return;
        const cmd = e["command"];
        const extra = { startAt: slot.startAt };
        if (cmd === "setParam") { extra.name = e["param"]; extra.value = e["value"]; }
        if (cmd === "ramp") {
          extra.name = e["param"];
          extra.from = e["from"];
          extra.to = e["to"];
          extra.dur = ((typeof e["duration"] === "number") ? e["duration"] : 1) * 1000;
        }
        if (cmd === "loadPreset") extra.preset = e["preset"];
        sendRelay(e["target"], cmd, extra);
      }, slot.atMs);
    });
  }

  function evalSignal(sig) {
    if (sig === "density") {
      const ids = Object.keys(state.instruments);
      if (!ids.length) return 0;
      let s = 0;
      for (let i = 0; i < ids.length; i++) s += (state.instruments[ids[i]].presence || 0);
      return s / ids.length;
    }
    if (sig === "low" || sig === "high") {
      const ids = Object.keys(state.instruments);
      if (!ids.length) return 0;
      let s = 0;
      for (let i = 0; i < ids.length; i++) s += (state.instruments[ids[i]][sig] || 0);
      return s / ids.length;
    }
    const m = sig.match(/^(presence|silence):(.+)$/);
    if (!m) return 0;
    const id = m[2];
    const inst = state.instruments[id];
    if (!inst) return 0;
    if (m[1] === "presence") return inst.presence || 0;
    if (m[1] === "silence") {
      if (!inst.silenceOnsetAt) return 0;
      return (Shapes.nowMs() - inst.silenceOnsetAt) / 1000;
    }
    return 0;
  }

  function compare(v, op, lhs) {
    switch (op) {
      case ">": return v > lhs;
      case "<": return v < lhs;
      case ">=": return v >= lhs;
      case "<=": return v <= lhs;
      default: return false;
    }
  }

  function fireAction(act, now) {
    const extra = {};
    if (act["command"] === "setParam") { extra.name = act["param"]; extra.value = act["value"]; }
    if (act["command"] === "ramp") {
      extra.name = act["param"];
      extra.from = act["from"];
      extra.to = act["to"];
      extra.dur = ((typeof act["duration"] === "number") ? act["duration"] : 1) * 1000;
      extra.startAt = now;
    }
    if (act["command"] === "loadPreset") extra.preset = act["preset"];
    sendRelay(act["target"], act["command"], extra);
    state.waveBurst.push({ id: act["target"], at: now });
  }

  function evalResponse(r, i, now) {
    if (state.fired[i]) return;
    if (state.coolingUntil[i] && state.coolingUntil[i] > now) return;

    const c = r["時"];
    const v = evalSignal(c["信号"]);
    const ok = compare(v, c["演算"], c["値"]);
    const need = (typeof c["持続"] === "number") ? c["持続"] : 0;

    if (!ok) {
      state.quietSince[i] = 0;
      return;
    }
    if (!state.quietSince[i]) state.quietSince[i] = now;
    if ((now - state.quietSince[i]) < need * 1000) return;

    fireAction(r["為"], now);
    if (r["一度"] === true) state.fired[i] = true;
    if (typeof r["冷却"] === "number") state.coolingUntil[i] = now + r["冷却"] * 1000;
    state.quietSince[i] = 0;
  }

  function kamigomori() {
    if (!state.casting) return;
    const rules = state.liturgy["応答"] || [];
    const now = Shapes.nowMs();
    try {
      for (let i = 0; i < rules.length; i++) evalResponse(rules[i], i, now);
    } catch (e) {
      pushKotodama({ t: "err", from: "field", of: "kamigomori", msg: e && e.message ? e.message : String(e), at: now });
    }
  }
  setInterval(kamigomori, 1000 / 6);

  const ctx = el.canvas.getContext("2d");
  function draw() {
    requestAnimationFrame(draw);
    const W = el.canvas.width;
    const H = el.canvas.height;
    ctx.fillStyle = "#0e0d0b";
    ctx.fillRect(0, 0, W, H);

    const ids = state.liturgy ? (state.liturgy["楽器"] || []) : Object.keys(state.instruments);
    const n = ids.length;
    if (!n) return;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.36;
    const now = Shapes.nowMs();

    ids.forEach(function (id, i) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      const inst = state.instruments[id] || {};
      const p = inst.presence || 0;
      const silenced = !!inst.silenceOnsetAt;

      if (!inst.everSpoke) {
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = "#56524a";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (silenced) {
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(76,107,115,0.4)";
        ctx.fill();
      } else {
        const rad = 8 + p * 32;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200,123,58," + (0.25 + 0.6 * p).toFixed(2) + ")";
        ctx.fill();
      }

      ctx.fillStyle = "#56524a";
      ctx.font = "11px serif";
      ctx.textAlign = "center";
      ctx.fillText(id, x, y + 36);
    });

    state.waveBurst = state.waveBurst.filter(function (w) { return now - w.at < 1400; });
    state.waveBurst.forEach(function (w) {
      const i = ids.indexOf(w.id);
      if (i < 0) return;
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      const t = (now - w.at) / 1400;
      ctx.beginPath();
      ctx.arc(x, y, 18 + t * 60, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(184,148,100," + (1 - t).toFixed(2) + ")";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
  draw();

  function loadLiturgyObj(obj, sourceName) {
    if (!Shapes.isLiturgy(obj)) {
      const errs = Shapes.explainLiturgy(obj);
      pushKotodama({ t: "err", from: "field", of: "liturgy", msg: "祭が読めません ─ " + errs.join(" / "), at: Shapes.nowMs() });
      el.liturgyName.textContent = "─";
      state.liturgy = null;
      state.liturgySource = null;
      uiSync();
      return;
    }
    state.liturgy = obj;
    state.liturgySource = sourceName;
    el.liturgyName.textContent = obj["track"] || sourceName;
    pushKotodama({
      t: "kotodama",
      from: "field",
      text: (obj["綴び"] || "") || ("祭文「" + (obj["track"] || sourceName) + "」を頂きました"),
      at: Shapes.nowMs()
    });
    uiSync();
  }

  el.liturgyFile.addEventListener("change", function () {
    const f = el.liturgyFile.files && el.liturgyFile.files[0];
    if (!f) return;
    f.text().then(function (s) {
      try { loadLiturgyObj(JSON.parse(s), f.name); }
      catch (e) { pushKotodama({ t: "err", from: "field", of: "liturgy", msg: e.message, at: Shapes.nowMs() }); }
    });
  });

  el.loadExample.addEventListener("click", function () {
    fetch("../liturgy.example.json")
      .then(function (r) { return r.json(); })
      .then(function (obj) { loadLiturgyObj(obj, "example"); })
      .catch(function (e) { pushKotodama({ t: "err", from: "field", of: "liturgy", msg: e.message, at: Shapes.nowMs() }); });
  });

  el.castStart.addEventListener("click", function () {
    if (!state.liturgy || state.casting) return;
    if (!Shapes.isLiturgy(state.liturgy)) {
      const errs = Shapes.explainLiturgy(state.liturgy);
      pushKotodama({ t: "err", from: "field", of: "maneki", msg: "祭が読めません ─ " + errs.join(" / "), at: Shapes.nowMs() });
      state.liturgy = null;
      state.liturgySource = null;
      el.liturgyName.textContent = "─";
      uiSync();
      return;
    }
    const declared = state.liturgy["楽器"] || [];
    const missing = declared.filter(function (id) { return !state.instruments[id]; });
    if (missing.length) {
      pushKotodama({ t: "err", from: "field", of: "maneki", msg: "依代が居ません: " + missing.join(", "), at: Shapes.nowMs() });
      uiSync();
      return;
    }

    state.casting = true;
    state.castStartAt = Shapes.nowMs();
    state.nagareSeed = computeNagareSeed({ preferLiturgySeed: true });
    state.fired = {};
    state.quietSince = {};
    state.coolingUntil = {};
    startSession();

    const maneki = { t: "maneki", guise: state.liturgySource || "?", startAt: state.castStartAt, at: state.castStartAt };
    state.transport.send(maneki);
    recordSessionMessage(maneki);
    pushKotodama(maneki);

    if (NAGARE && state.liturgy["音楽"]) {
      try { applyMusubiMusicPatch(state.liturgy["音楽"]); }
      catch (e) { pushKotodama({ t: "err", from: "field", of: "music", msg: e.message, at: Shapes.nowMs() }); }
    }
    if (NAGARE && state.nagareAutoStart) startNagare(state.nagareSeed, true);
    scheduleCast();
    scheduleMusicPolicies();
    uiSync();
  });

  el.castStop.addEventListener("click", function () {
    if (!state.casting) return;
    state.casting = false;
    stopNagare();
    sendRelay("all", "stop", {});
    endSession();
    uiSync();
  });

  el.castReturn.addEventListener("click", function () {
    state.casting = false;
    stopNagare();
    sendRelay("all", "stop", {});
    endSession();
    state.instruments = {};
    state.fired = {};
    state.quietSince = {};
    state.coolingUntil = {};
    state.waveBurst = [];
    state.nagareRowsVersion = "";
    syncNagareInstrumentRows(true);
    uiSync();
  });

  if (el.exportBtn) el.exportBtn.addEventListener("click", exportSession);

  if (NAGARE) {
    NAGARE.attachRuntime({
      sendRelay: sendRelay,
      pushKotodama: function (m) {
        recordSessionMessage(m);
        pushKotodama(m);
      },
      getActiveInstruments: function () {
        if (state.liturgy && Array.isArray(state.liturgy["楽器"]) && state.liturgy["楽器"].length) {
          return state.liturgy["楽器"].slice();
        }
        return Object.keys(state.instruments);
      }
    });
    bindNagareUi();
  }

  setInterval(function () {
    syncNagareStatus();
    syncNagareInstrumentRows();
  }, 1000);

  openTransport();
  uiSync();
})();
