// EL-SYSTEMA ─ メッセージの形（schema と型ガード）
//
// すべてのメッセージは plain object。t（type）と at（実刻 ms）は必須。
// 古い JS でも読めるよう、ES module ではなく IIFE で window/globalThis に出す。
// hub（Node）からも require せずに同じ判定を共有できるよう module.exports も書く。

(function (root) {
  "use strict";

  const TYPES = ["relay", "kehai", "silence", "ack", "err", "maneki", "kotodama"];
  const CMDS  = ["play", "stop", "setParam", "ramp", "loadPreset", "snapshot"];
  const LITURGY_OPS = [">", "<", ">=", "<="];
  const RESERVED_TARGETS = ["MUSUBI", "nagare"];
  const MUSIC_MODES = ["凪", "琉球", "平調子", "陰旋", "アイヌ", "シベリア", "モンゴル", "スレンドロ", "ペログ", "マカーム", "バイラヴィ", "無"];
  const MUSIC_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const MUSIC_POLICIES = ["immediate", "phrase-aligned", "section-aligned", "voice-led"];

  function isString(x) { return typeof x === "string" && x.length > 0; }
  function isNumber(x) { return typeof x === "number" && isFinite(x); }
  function isBool(x)   { return typeof x === "boolean"; }
  function isObj(x)    { return x && typeof x === "object" && !Array.isArray(x); }
  function isReservedTarget(x) { return isString(x) && RESERVED_TARGETS.indexOf(x) >= 0; }
  function isMusicKey(x) {
    return (isNumber(x) && x >= 0 && x <= 11) || (isString(x) && MUSIC_KEYS.indexOf(x) >= 0);
  }

  function nowMs() {
    return Date.now();
  }

  // 共通必須キー
  function hasCommon(m) {
    return isObj(m) && isString(m.t) && TYPES.indexOf(m.t) >= 0 && isNumber(m.at);
  }

  function isRelay(m) {
    if (!hasCommon(m) || m.t !== "relay") return false;
    if (!isString(m.target)) return false;
    if (!isString(m.cmd) || CMDS.indexOf(m.cmd) < 0) return false;
    if (!isString(m.id)) return false;
    switch (m.cmd) {
      case "play":
      case "stop":
      case "snapshot":
        return true;
      case "setParam":
        return isString(m.name) && (isNumber(m.value) || isString(m.value));
      case "ramp":
        return isString(m.name) && isNumber(m.from) && isNumber(m.to) && isNumber(m.dur) && isNumber(m.startAt);
      case "loadPreset":
        return isObj(m.preset);
      default:
        return false;
    }
  }

  function isKehai(m) {
    return hasCommon(m) && m.t === "kehai"
      && isString(m.from)
      && isNumber(m.presence) && isNumber(m.low) && isNumber(m.high)
      && isBool(m.everSpoke);
  }

  function isSilence(m) {
    return hasCommon(m) && m.t === "silence"
      && isString(m.from) && isNumber(m.since);
  }

  function isAck(m) {
    return hasCommon(m) && m.t === "ack"
      && isString(m.from) && isString(m.of) && isBool(m.ok);
  }

  function isErr(m) {
    return hasCommon(m) && m.t === "err"
      && isString(m.from) && isString(m.of) && isString(m.msg);
  }

  function isManeki(m) {
    return hasCommon(m) && m.t === "maneki"
      && isString(m.guise) && isNumber(m.startAt);
  }

  function isKotodama(m) {
    return hasCommon(m) && m.t === "kotodama"
      && isString(m.from) && isString(m.text);
  }

  function isValid(m) {
    if (!hasCommon(m)) return false;
    switch (m.t) {
      case "relay":    return isRelay(m);
      case "kehai":    return isKehai(m);
      case "silence":  return isSilence(m);
      case "ack":      return isAck(m);
      case "err":      return isErr(m);
      case "maneki":   return isManeki(m);
      case "kotodama": return isKotodama(m);
      default: return false;
    }
  }

  function explainLiturgy(o) {
    const errs = [];
    if (!isObj(o)) {
      errs.push("祭文 object ではない");
      return errs;
    }

    if (!isString(o.track)) errs.push("track が無い");
    if (!isNumber(o.duration) || o.duration <= 0) errs.push("duration が正数で無い");
    if (!Array.isArray(o["楽器"]) || o["楽器"].length === 0) {
      errs.push("楽器 が空でない array で無い");
    } else {
      o["楽器"].forEach(function (id, i) {
        if (!isString(id)) errs.push("楽器[" + i + "] が文字列で無い");
      });
    }
    if (!Array.isArray(o["祭次"])) errs.push("祭次 が array で無い");
    if (!Array.isArray(o["応答"])) errs.push("応答 が array で無い");
    if (o["音楽"] !== undefined && !isObj(o["音楽"])) errs.push("音楽 が object で無い");
    if (errs.length) return errs;

    if (o["音楽"]) {
      const music = o["音楽"];
      if (music.key !== undefined && !isMusicKey(music.key)) errs.push("音楽.key は 0..11 または音名で無い");
      if (music.mode !== undefined && (!isString(music.mode) || MUSIC_MODES.indexOf(music.mode) < 0)) errs.push("音楽.mode が不正");
      if (music.bpm !== undefined && (!isNumber(music.bpm) || music.bpm < 40 || music.bpm > 180)) errs.push("音楽.bpm が 40..180 の数で無い");
      if (music.register !== undefined && (!isNumber(music.register) || music.register < -1 || music.register > 1)) errs.push("音楽.register が -1..1 の数で無い");
      if (music["転調策"] !== undefined && !Array.isArray(music["転調策"])) errs.push("音楽.転調策 が array で無い");
      if (Array.isArray(music["転調策"])) {
        music["転調策"].forEach(function (entry, i) {
          if (!isObj(entry)) {
            errs.push("音楽.転調策[" + i + "] が object で無い");
            return;
          }
          if (!isNumber(entry["時"]) || entry["時"] < 0) errs.push("音楽.転調策[" + i + "].時 が 0 以上の数で無い");
          if (entry.key !== undefined && !isMusicKey(entry.key)) errs.push("音楽.転調策[" + i + "].key が不正");
          if (entry.mode !== undefined && (!isString(entry.mode) || MUSIC_MODES.indexOf(entry.mode) < 0)) errs.push("音楽.転調策[" + i + "].mode が不正");
          if (entry.bpm !== undefined && (!isNumber(entry.bpm) || entry.bpm < 40 || entry.bpm > 180)) errs.push("音楽.転調策[" + i + "].bpm が 40..180 の数で無い");
          if (entry.register !== undefined && (!isNumber(entry.register) || entry.register < -1 || entry.register > 1)) errs.push("音楽.転調策[" + i + "].register が -1..1 の数で無い");
          if (entry.policy !== undefined && (!isString(entry.policy) || MUSIC_POLICIES.indexOf(entry.policy) < 0)) errs.push("音楽.転調策[" + i + "].policy が不正");
          if (entry.duration !== undefined && (!isNumber(entry.duration) || entry.duration < 0)) errs.push("音楽.転調策[" + i + "].duration が 0 以上の数で無い");
        });
      }
    }

    const ids = o["楽器"];
    const hasTarget = function (target) {
      return isReservedTarget(target) || (isString(target) && ids.indexOf(target) >= 0);
    };

    o["祭次"].forEach(function (seq, i) {
      if (!isObj(seq)) {
        errs.push("祭次[" + i + "] が object で無い");
        return;
      }
      if (!isNumber(seq["時"]) || seq["時"] < 0) errs.push("祭次[" + i + "].時 が 0 以上の数で無い");
      if (!isNumber(seq["揺"]) || seq["揺"] < 0) errs.push("祭次[" + i + "].揺 が 0 以上の数で無い");
      if (!hasTarget(seq["target"])) errs.push("祭次[" + i + "].target が 楽器 または予約 target に無い");
      if (!isString(seq["command"]) || CMDS.indexOf(seq["command"]) < 0) {
        errs.push("祭次[" + i + "].command が不正");
        return;
      }
      switch (seq["command"]) {
        case "play":
        case "stop":
        case "snapshot":
          break;
        case "setParam":
          if (!isString(seq["param"])) errs.push("祭次[" + i + "].param が文字列で無い");
          if (seq["value"] === undefined) errs.push("祭次[" + i + "].value が無い");
          break;
        case "ramp":
          if (!isString(seq["param"])) errs.push("祭次[" + i + "].param が文字列で無い");
          if (!isNumber(seq["from"])) errs.push("祭次[" + i + "].from が数で無い");
          if (!isNumber(seq["to"])) errs.push("祭次[" + i + "].to が数で無い");
          if (!isNumber(seq["duration"]) || seq["duration"] < 0) errs.push("祭次[" + i + "].duration が 0 以上の数で無い");
          break;
        case "loadPreset":
          if (!isObj(seq["preset"])) errs.push("祭次[" + i + "].preset が object で無い");
          break;
      }
    });

    o["応答"].forEach(function (rule, i) {
      if (!isObj(rule)) {
        errs.push("応答[" + i + "] が object で無い");
        return;
      }
      if (!isString(rule["名"])) errs.push("応答[" + i + "].名 が文字列で無い");

      const cond = rule["時"];
      if (!isObj(cond)) {
        errs.push("応答[" + i + "].時 が object で無い");
      } else {
        if (!isString(cond["信号"])) errs.push("応答[" + i + "].時.信号 が文字列で無い");
        if (!isString(cond["演算"]) || LITURGY_OPS.indexOf(cond["演算"]) < 0) {
          errs.push("応答[" + i + "].時.演算 は > < >= <= のみ");
        }
        if (!isNumber(cond["値"])) errs.push("応答[" + i + "].時.値 が数で無い");
        if (cond["持続"] !== undefined && (!isNumber(cond["持続"]) || cond["持続"] < 0)) {
          errs.push("応答[" + i + "].時.持続 が 0 以上の数で無い");
        }
      }

      const act = rule["為"];
      if (!isObj(act)) {
        errs.push("応答[" + i + "].為 が object で無い");
      } else {
        if (!hasTarget(act["target"])) errs.push("応答[" + i + "].為.target が 楽器 または予約 target に無い");
        if (!isString(act["command"]) || CMDS.indexOf(act["command"]) < 0) {
          errs.push("応答[" + i + "].為.command が不正");
        } else {
          switch (act["command"]) {
            case "play":
            case "stop":
            case "snapshot":
              break;
            case "setParam":
              if (!isString(act["param"])) errs.push("応答[" + i + "].為.param が文字列で無い");
              if (act["value"] === undefined) errs.push("応答[" + i + "].為.value が無い");
              break;
            case "ramp":
              if (!isString(act["param"])) errs.push("応答[" + i + "].為.param が文字列で無い");
              if (!isNumber(act["from"])) errs.push("応答[" + i + "].為.from が数で無い");
              if (!isNumber(act["to"])) errs.push("応答[" + i + "].為.to が数で無い");
              if (!isNumber(act["duration"]) || act["duration"] < 0) errs.push("応答[" + i + "].為.duration が 0 以上の数で無い");
              break;
            case "loadPreset":
              if (!isObj(act["preset"])) errs.push("応答[" + i + "].為.preset が object で無い");
              break;
          }
        }
      }

      if (rule["一度"] !== undefined && !isBool(rule["一度"])) errs.push("応答[" + i + "].一度 が boolean で無い");
      if (rule["冷却"] !== undefined && (!isNumber(rule["冷却"]) || rule["冷却"] < 0)) errs.push("応答[" + i + "].冷却 が 0 以上の数で無い");
    });

    return errs;
  }

  function isLiturgy(o) {
    return explainLiturgy(o).length === 0;
  }

  // 巫が新規 relay を作るときの id 採番（衝突しなければよい）
  let _seq = 0;
  function newRelayId() {
    _seq = (_seq + 1) | 0;
    return "r" + nowMs().toString(36) + "-" + _seq.toString(36);
  }

  const API = {
    TYPES, CMDS, LITURGY_OPS, RESERVED_TARGETS, MUSIC_MODES, MUSIC_KEYS, MUSIC_POLICIES,
    nowMs, newRelayId,
    isRelay, isKehai, isSilence, isAck, isErr, isManeki, isKotodama, isValid,
    isReservedTarget, isMusicKey, isLiturgy, explainLiturgy,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  } else {
    root.ElSystemaShapes = API;
  }
})(typeof window !== "undefined" ? window : globalThis);
