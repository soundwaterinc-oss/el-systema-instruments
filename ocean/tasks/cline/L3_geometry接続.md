# L3 ─ geometry-scanner を場に上げる

## 入力

- リポジトリ：[soundwaterinc-oss/el-systema-bloom-geometry-generator](https://github.com/soundwaterinc-oss/el-systema-bloom-geometry-generator)
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)
- 共有スクリプトの正典：[el-systema-acid/shared/](https://github.com/soundwaterinc-oss/el-systema-acid/tree/main/shared)
- 既存 audio engine：`app.js`（約 2200 行）
- 既存 master 段の場所：`state.masterBus`、`state.audioContext`、`state.analyser`（`app.js:402-403` 付近）

## 出力

`el-systema-bloom-geometry-generator/` リポジトリで以下のコミット二本：

### コミット 1：`shared/ scripts を写経する`

- `shared/el-systema-shapes.js`
- `shared/el-systema-transport.js`
- `shared/el-systema-control.js`

を [el-systema-acid](https://github.com/soundwaterinc-oss/el-systema-acid) からそのままコピーして配置する。

```bash
git clone https://github.com/soundwaterinc-oss/el-systema-bloom-geometry-generator.git
cd el-systema-bloom-geometry-generator
mkdir -p shared
curl -sL https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/el-systema-shapes.js     -o shared/el-systema-shapes.js
curl -sL https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/el-systema-transport.js  -o shared/el-systema-transport.js
curl -sL https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/el-systema-control.js    -o shared/el-systema-control.js
git add shared/
git commit -m "shared: el-systema-acid から葉 API 三本を写経"
```

### コミット 2：`index.html と app.js に葉 API を差し込む`

#### `index.html`

`<script src="./app.js">` の**直前**に三本を入れる：

```html
<script src="shared/el-systema-shapes.js"></script>
<script src="shared/el-systema-transport.js"></script>
<script src="shared/el-systema-control.js"></script>
<script src="./app.js"></script>
```

#### `app.js`

`state.audioContext` と `state.masterBus` が確定した後（おそらく `initAudio` 関数の末尾、約行 400 付近）に挿入：

```js
// 葉：場と繋ぐ。fallback で単体動作も維持
if (typeof window.registerElSystemaInstrument !== "function") {
  window.registerElSystemaInstrument = function(){};
}

registerElSystemaInstrument({
  id: "geometry-scanner",
  audioContext: state.audioContext,
  outputNode:   state.masterBus,
  sharedAnalyser: state.analyser,            // 既存 analyser を借りる

  play:  () => { /* 既存 toggleTransport の「再生開始」相当を呼ぶ */ },
  stop:  () => { /* 既存 stop 相当を呼ぶ */ },

  setParam: (name, value) => {
    // 1) selected* 系（selectedScale 等）：
    //    既存の選択切替関数（あれば呼ぶ）または state[name] = value + rebuildPattern(name)
    if (name in state && /^selected/.test(name)) {
      state[name] = value;
      if (typeof rebuildPattern === "function") rebuildPattern(name);
      return;
    }
    // 2) slider 系（bpm, cutoff, droneLevel 等）：
    //    対応する input 要素を探し、value を入れて 'input' イベントを発火
    const el = document.getElementById(name) || document.querySelector(`[name="${name}"]`);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // 3) どこにも該当しない時は黙って捨てる（throw しない）
  },

  ramp: (name, from, to, durationSec) => {
    // rAF で線形補間。同パラメータへの ramp は後勝ち（前のを中止）
    const dur = Math.max(0.001, durationSec);
    const startMs = performance.now();
    const tick = () => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      const k = Math.min(1, elapsedSec / dur);
      const v = from + (to - from) * k;
      // setParam 経由で UI に反映
      if (typeof rampHandlers !== "undefined" && rampHandlers[name]) rampHandlers[name] = tick;
      const el = document.getElementById(name) || document.querySelector(`[name="${name}"]`);
      if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  loadPreset: (preset) => {
    if (!preset || typeof preset !== "object") return;
    for (const [k, v] of Object.entries(preset)) {
      try {
        if (typeof v === "object" && v !== null) {
          // selectedVoices などのネスト
          for (const [k2, v2] of Object.entries(v)) {
            const nested = `${k}.${k2}`;
            // 対応する処理（適宜）
            if (k === "selectedVoices" && state.selectedVoices) {
              state.selectedVoices[k2] = v2;
            }
          }
        } else {
          // 平キーは setParam 相当
          registerElSystemaInstrument.__last?.setParam?.(k, v);
        }
      } catch (_) {}
    }
    if (typeof rebuildPattern === "function") rebuildPattern("preset");
  },

  snapshot: () => {
    // 主要 state を JSON 可能な形で返す
    return {
      bpm: state.bpm, cutoff: state.cutoff, resonance: state.resonance,
      decay: state.decay, accent: state.accent, slide: state.slide,
      toneBrightness: state.toneBrightness, grit: state.grit,
      masterDrive: state.masterDrive, noiseMix: state.noiseMix,
      clickAmount: state.clickAmount, harmonics: state.harmonics,
      bassLevel: state.bassLevel, droneLevel: state.droneLevel,
      percussionLevel: state.percussionLevel,
      osc1Drive: state.osc1Drive, droneDrive: state.droneDrive, osc2Drive: state.osc2Drive,
      selectedScale: state.selectedScale, selectedRootNote: state.selectedRootNote,
      selectedRhythm: state.selectedRhythm, selectedFunction: state.selectedFunction,
      selectedVisual: state.selectedVisual, selectedScanPath: state.selectedScanPath,
      selectedVoices: { ...state.selectedVoices },
    };
  },
});
```

注意：上の `setParam` / `ramp` の中の DOM 探索（`document.getElementById(name)`）は既存 UI の id 規約に合わせる。実際の id 名は app.js の input 要素を確認して合わせること。

## 合格条件

[docs/09_接続契約.md](../../docs/09_接続契約.md) §五の **5 件すべて**：

1. `http://localhost:<port>/index.html` を開くと**接続灯が緑**（接続灯の追加は別タスクで OK ─ まずは console.log で「ws connected」が出れば良い）
2. `field/` の「節の庭」に `geometry-scanner` が現れる
3. `field/` から `play` を送ると鳴る
4. `setParam("bpm", 120)` で UI 上の bpm が変わる
5. 鳴り終わって 6 秒経つと `silence` が宣られる（hub の log を見て確認）

## 触ってはいけないもの

- 既存の audio engine（`state.masterBus` 以下の信号経路）
- 既存の UI（id・class・既存の event handler）
- `app.js` の module スコープを露出させない（外部から `state` を弄れる窓は作らない）

## 注意

- **kehai 観測は `state.analyser` を借りる**ことで既存 destination 経路を変えない（[AUDIT.md](../../AUDIT.md) §一）
- 既存器を壊すラッパー方式ではなく、**registerElSystemaInstrument 一回の呼び出しに閉じ込める**
- 場に繋がない時も既存 UI から普通に動かせること（fallback 確認）
