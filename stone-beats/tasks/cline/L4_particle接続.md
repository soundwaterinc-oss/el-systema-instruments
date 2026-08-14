# L4 ─ particle-noise を場に上げる

## 入力

- リポジトリ：[soundwaterinc-oss/el-systema-bloom-particle-noise](https://github.com/soundwaterinc-oss/el-systema-bloom-particle-noise)
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)
- 共有スクリプトの正典：[el-systema-acid/shared/](https://github.com/soundwaterinc-oss/el-systema-acid/tree/main/shared)
- 既存 audio engine：`src/main.js` + `src/audio/master.js`（`createMasterGraph(audioContext)`）
- 既存 API：`appState.engines[name].start()/stop()/stopAll()`、`setParams({...})`

## 出力

`el-systema-bloom-particle-noise/` リポジトリで以下のコミット二本：

### コミット 1：`shared/ scripts を写経する`

L3 と同じ：

```bash
git clone https://github.com/soundwaterinc-oss/el-systema-bloom-particle-noise.git
cd el-systema-bloom-particle-noise
mkdir -p shared
curl -sL https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/el-systema-shapes.js     -o shared/el-systema-shapes.js
curl -sL https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/el-systema-transport.js  -o shared/el-systema-transport.js
curl -sL https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/el-systema-control.js    -o shared/el-systema-control.js
git add shared/
git commit -m "shared: el-systema-acid から葉 API 三本を写経"
```

### コミット 2：`index.html と src/main.js に葉 API を差し込む`

#### `index.html`

`<script type="module" src="./src/main.js">` の**前**に三本：

```html
<script src="shared/el-systema-shapes.js"></script>
<script src="shared/el-systema-transport.js"></script>
<script src="shared/el-systema-control.js"></script>
<script type="module" src="./src/main.js?v=2"></script>
```

ESM の `main.js` 内から `window.registerElSystemaInstrument` を呼ぶので、global 注入のこの順で OK。

#### `src/main.js`

`createMasterGraph(audioContext)` が完了してマスター GainNode が確定した後、初期化の最後に挿入：

```js
// 葉：場と繋ぐ。fallback で単体動作も維持
if (typeof window.registerElSystemaInstrument !== "function") {
  window.registerElSystemaInstrument = function(){};
}

const masterGraph = createMasterGraph(audioContext);   // 既存
// ↑ 既存。返り値の master Gain ノードを outputNode に渡す
const masterBus = masterGraph.masterGain || masterGraph.output || masterGraph;

registerElSystemaInstrument({
  id: "particle-noise",
  audioContext: audioContext,
  outputNode:   masterBus,

  play:  () => {
    // 既存「Start All」相当 ─ 三エンジン全て play
    Object.values(appState.engines).forEach(e => e.start && e.start());
  },
  stop:  () => {
    Object.values(appState.engines).forEach(e => e.stop && e.stop());
  },

  setParam: (name, value) => {
    // 設計：name は engine 名.param か、全 engine 共通の param
    //  例: "particle.density"、"metallic.brightness"、"masterGain"
    const [engineName, param] = name.includes(".") ? name.split(".") : [null, name];

    if (engineName && appState.engines[engineName]) {
      appState.engines[engineName].setParams({ [param]: value });
      return;
    }
    // engineName が無い → 全 engine に同じ param を放る
    Object.values(appState.engines).forEach(e => {
      if (e.setParams) {
        try { e.setParams({ [param]: value }); } catch (_) {}
      }
    });
  },

  ramp: (name, from, to, durationSec) => {
    const dur = Math.max(0.001, durationSec);
    const startMs = performance.now();
    const tick = () => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      const k = Math.min(1, elapsedSec / dur);
      const v = from + (to - from) * k;
      // setParam 経由で滑らかに反映
      try { registerElSystemaInstrument.__last?.setParam?.(name, v); } catch (_) {}
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  loadPreset: (preset) => {
    if (!preset || typeof preset !== "object") return;
    for (const [k, v] of Object.entries(preset)) {
      try { /* same as setParam */ } catch (_) {}
    }
  },

  snapshot: () => {
    // 主要パラメータ ─ engine ごとに collect
    const snap = {};
    for (const [engineName, e] of Object.entries(appState.engines)) {
      if (e.getParams) snap[engineName] = e.getParams();
    }
    return snap;
  },
});
```

## 合格条件

[docs/09_接続契約.md](../../docs/09_接続契約.md) §五の **5 件すべて**：

1. `http://localhost:<port>/` を開くと console に「ws connected」相当が出る（接続灯は別タスク）
2. `field/` の「節の庭」に `particle-noise` が現れる
3. `field/` から `play` を送ると三エンジン全て鳴る
4. `setParam("particle.density", 0.5)` で UI 上の density が変わる
5. 鳴り終わって 6 秒経つと `silence` が宣られる

## 触ってはいけないもの

- `src/audio/master.js` の `createMasterGraph` の中身（masterBus を「読む」だけ）
- engine の内部構造（`appState.engines[name]` の表向き API だけを通す）
- ESM の export 構造

## 注意

- engine 名のドット表記 `particle.<param>` 等を新規 setParam の規約として定義する（[docs/09_接続契約.md](../../docs/09_接続契約.md) §六に追記する余地あり）
- particle-noise は **engine が三つ並列**なので `play` は「全部開始」、`stop` は「全部停止」を意味する。個別エンジンの起動は `setParam("particle.on", true)` のような表現を後で追加するか別タスクで検討
