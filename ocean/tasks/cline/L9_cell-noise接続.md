# L9 ─ cell-noise を場に上げる

## 状況

- **デプロイ**：https://soundwaterinc-oss.github.io/CellnoiseGenerator/public/launch-20260524c.html
- **リポジトリ**：[soundwaterinc-oss/CellnoiseGenerator](https://github.com/soundwaterinc-oss/CellnoiseGenerator)（default branch=`EL-SYSTEMA`）
- **ローカル源**：`/Users/nakamuraryuuakira/Desktop/dsktop/EL-SYSTEMA ACID/CellnoiseGenerator/`（同 branch を clone 済）
- **形式**：static HTML（index.html + public/launch-*.html + src/）─ L4 particle と同型
- **同定済**：[REGISTRY.md](../../REGISTRY.md)、別物として **新 id `cell-noise`** で接続
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)
- **第二巻「九の輪」の 9 番目の依代**：[liturgy.nine-voices.json](../../liturgy.nine-voices.json) が **これを待っている**
- パラメータ契約：[docs/09_接続契約.md](../../docs/09_接続契約.md) §六「cell-noise（写経済）」

## 出力

CellnoiseGenerator リポジトリにコミット二本。

### コミット 1：`shared/ scripts を写経する`

```bash
cd "/Users/nakamuraryuuakira/Desktop/dsktop/EL-SYSTEMA ACID/CellnoiseGenerator"
git checkout EL-SYSTEMA

# 葉 API 三本を写経（場の正典）
mkdir -p public/shared
for f in el-systema-shapes.js el-systema-transport.js el-systema-control.js; do
  curl -sL "https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/$f" -o "public/shared/$f"
done
git add public/shared/
git commit -m "public/shared: el-systema-acid から葉 API 三本を写経"
git push
```

### コミット 2：`launch-*.html と src/main.js に葉 API を差し込む`

#### `public/launch-20260524c.html`（または最新の launch-*.html）

エントリスクリプト直前に三本：

```html
<!-- 葉：場と繋ぐための三本 -->
<script src="shared/el-systema-shapes.js"></script>
<script src="shared/el-systema-transport.js"></script>
<script src="shared/el-systema-control.js"></script>
```

順序は **shapes → transport → control**（依存順）。

#### `src/main.js`（または entry script）

冒頭に fallback：

```js
if (typeof window.registerElSystemaInstrument !== "function") {
  window.registerElSystemaInstrument = function(){};
}
```

オーディオ初期化が完了した時点（`AudioContext` と master GainNode が在る時）で：

```js
registerElSystemaInstrument({
  id: "cell-noise",                            // ─ 場で一意
  audioContext: <AudioContext>,
  outputNode:   <master GainNode>,             // destination ではなく master 段

  play:       () => { /* 既存 start 相当 */ },
  stop:       () => { /* 既存 stop 相当 */ },
  setParam:   (name, value) => {
    // DOM 上の input/select の id / name をそのまま受ける（contract 通り）
    // alias 群もここで吸収:
    //   master       → masterGain
    //   root/rootHz  → pitchBase
    //   rate         → pulseRate
    //   density      → burstDensity
    //   brightness   → noiseBandFreq
    //   resonance    → noiseQ
    const aliases = {
      master: "masterGain", root: "pitchBase", rootHz: "pitchBase",
      rate: "pulseRate", density: "burstDensity",
      brightness: "noiseBandFreq", resonance: "noiseQ"
    };
    const actual = aliases[name] || name;
    const el = document.getElementById(actual) || document.querySelector(`[name="${actual}"]`);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
  ramp:       (name, from, to, durMs) => {
    // 葉 API の rAF ramp で十分（cb.ramp 不実装で OK、shared が肩代わりする）
  },
  loadPreset: (preset) => {
    // preset object のキーを既知のものに限定して反映、無効キーはスキップ
    Object.keys(preset).forEach(k => setParam(k, preset[k]));
  },
  snapshot:   () => {
    // JSON シリアライズ可能なフラットな object
    return {
      sourceLabel: <現在の source ラベル>,
      audioState: <"running" | "suspended" | "closed">,
      running: <bool>,
      masterGain: <num>, pitchBase: <num>, pulseRate: <num>,
      sineMix: <num>, pulseMix: <num>, noiseMix: <num>,
      burstDensity: <num>, bitDepth: <num>
    };
  }
});
```

接続灯（[09_接続契約.md §四](../../docs/09_接続契約.md)）は既存実装に従い、右下に追加。

### コミット 3（任意）：接続灯と判示波紋の UI

[09_接続契約.md §四](../../docs/09_接続契約.md) に従う：
- 接続灯：画面右下、緑＝繋ぎ / 灰＝独立 / 赤＝切断
- 判示波紋：canvas 中央から外向き

実装方法は依代に任せる。位置と色だけ統一。

## 合格条件

[09_接続契約.md §五](../../docs/09_接続契約.md) の 5 条すべて：

1. localhost で開くと接続灯が緑になる
2. 巫の「節の庭」に `cell-noise` の節が現れる
3. `play` を送ると鳴る
4. `setParam` で巫から弄ったパラメータが UI に反映される
5. 鳴り終わった後、沈黙が宣られる（log に `silence` メッセージ）

加えて：

6. 第二巻「九の輪」を巫が招くと **schema validation を通り**、cast が始まる
7. 第二巻の t=388 で cell-noise の loadPreset が届き、t=391 で play、t=552 で stop が走る
8. `[REGISTRY.md](../../REGISTRY.md)` の cell-noise 行が「接続待ち」→「接続済 ─ L9 完了 (id=`cell-noise`、commit `<sha>`）」に更新される

## 触ってはいけないもの

- 既存の `index.html`（ルート）に手を入れる必要は無い（launch-*.html だけが本番）
- 既存 audio engine の信号経路（master/destination の関係を変えない）
- 既存 UI の id / name（contract が依拠している）

## 注意

- master 段の GainNode を取り出して `outputNode` に渡す ─ destination の直前ではなく、user volume が掛かる**手前**
- 既に `analyser` を内部に持っていたら `sharedAnalyser:` に渡す（葉 API が分岐挿入を省く）
- setParam の DOM 反映で `dispatchEvent("input")` を打つのを忘れない（react/vanilla 共通の作法）
- snapshot は循環参照禁止、JSON.stringify 可能なフラット object のみ
- 接続完了後は **第二巻「九の輪」が世界で初めて 9 声で奏でられる**。検証時に巫に告げる
