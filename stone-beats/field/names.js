// EL-SYSTEMA ─ 場の名と巫の言葉を一所に集める。差し替え可。
// ここを書き換えれば言葉だけが変わる。場の信号・命令の形は一切変わらない。

(function (root) {
  "use strict";

  const FieldNames = {
    場: "el-systema-field",
    巫の役: "ヲサ",

    祭次の語: "祭次",
    招の語:   "招",
    応答の語: "応答",
    記上の語: "言上",

    // 画面表示用ラベル
    UI: {
      title: "EL-SYSTEMA / MUSUBI ─ ヲサの場",
      castStart: "祭を始める",
      castStop:  "鎮める",
      castReturn: "空に戻る",
      loadLiturgy: "祭文を読む",
      noLiturgy: "祭文を選びなさい",
      castInvalid: "祭が読めません",
      everSpokeNo: "まだ鳴かず",
      kotodamaHead: "言上",
      // 流れ（NAGARE）UI 用語
      nagare: "流れ",
      kyouchi: "境地",
      nagareStart: "流れを起こす",
      nagareStop:  "流れを鎮める",
      nagareAutoStart: "招と同時に起こす",
      nagareSeedLabel: "seed",
      nagareSeedRefresh: "焼き直す",
      nagareScaleHead: "時間スケール別の関数",
      nagareScaleNote: "境地を変えるとここは上書きされます",
      nagareInstrumentHead: "依代別の抜き差し対象",
      nagareAllLabel: "流れ",
      nagareRoleNuki: "抜き差し",
      nagareRoleRhythm: "律動",
      nagareRoleShift: "転調",
      nagareRunning: "起動中",
      nagareStopped: "停止中",
      nagarePanelHead: "流れの卓",
      nagareTuneHead: "B 層 ─ 調律する",
      時間スケール: { 拍: "拍", 節: "節", 章: "章", 巻: "巻" },
    },

    // 境地（mode）名 ─ docs/10_MUSUBI演奏系.md §4.6
    境地: {
      凪: "calm",
      流: "flow",
      動: "motion",
      嵐: "storm",
      整: "order",
      無: "void",
    },
  };

  root.ElSystemaNames = FieldNames;
})(typeof window !== "undefined" ? window : globalThis);
