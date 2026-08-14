# M1 ─ NAGARE エンジン（流れ）と自然関数辞典

## 入力
- 設計：[docs/10_MUSUBI演奏系.md](../../docs/10_MUSUBI演奏系.md)
- 自然関数辞典：[docs/11_自然関数辞典.md](../../docs/11_自然関数辞典.md)
- 既存：[field/field.js](../../field/field.js)、[shared/el-systema-control.js](../../shared/el-systema-control.js)
- メッセージ schema：[shared/el-systema-shapes.js](../../shared/el-systema-shapes.js)

## 出力

`shared/` 配下に NAGARE エンジン core を新規追加：

### 1. 自然関数辞典 ─ `shared/el-systema-natural.js`

8 関数を [11_自然関数辞典.md](../../docs/11_自然関数辞典.md) のコード例に従って実装。共通 API：

```js
window.ElSystemaNatural = {
  // 各関数は { init: (seed, opts) => state, next: (state) => [0,1] }
  pink:     { init, next },
  logistic: { init, next },
  lorenz:   { init, next },
  gold:     { init, next },
  fib:      { init, next },
  brown:    { init, next },
  sine:     { init, next },
  ca:       { init, next },
  levy:     { init, next },
};
```

- 各関数は state を持ち越せる。seed は招の時に焼く。
- `init(seed)` の seed は [0, 1] の数。再現性を保つため Math.random() を使わない実装も検討（Mulberry32 等の seeded PRNG を内蔵すると良い）。
- 全関数 unit test を `shared/el-systema-natural.test.js`（簡素な assertion）で書く。

### 2. NAGARE エンジン core ─ `field/nagare.js`

field 側に NAGARE engine を実装。`window.ElSystemaNAGARE` で公開：

```js
// 各時間スケールでスケジューリング
const NAGARE = {
  config: {
    境地: "凪",                  // 現在の境地
    時間スケール: {
      拍:    { hz: 6,   fn: "pink",     seed: 0 },
      節:    { hz: 0.1, fn: "gold",     seed: 0 },
      章:    { hz: 0.01,fn: "fib",      seed: 0 },
      巻:    { hz: 0.002,fn: "lorenz",  seed: 0 },
    },
    依代別: {
      // ここに後段 M2 で抜き差し envelope を入れる
    },
  },
  state: {
    runningSince: 0,
    timers: {},
    fnStates: {},
  },
  start(seed),    // 招と同時に呼ばれる、seed を焼く
  stop(),         // 流れを鎮める
  setMode(name),  // 境地を切替
};
```

### 3. 境地（mode）プリセット

`shared/el-systema-natural.js` の末尾に置く：

```js
window.ElSystemaModes = {
  "凪":  { 拍:{fn:"pink",   smooth:0.9}, 節:{fn:"brown", smooth:0.9}, 章:{fn:"brown", smooth:0.9}, 巻:{fn:"brown",   smooth:0.9} },
  "流":  { 拍:{fn:"pink",   smooth:0.6}, 節:{fn:"gold",  smooth:0.5}, 章:{fn:"fib",   smooth:0.4}, 巻:{fn:"lorenz",  smooth:0.3} },
  "動":  { 拍:{fn:"logistic",smooth:0.3},節:{fn:"pink",  smooth:0.3}, 章:{fn:"gold",  smooth:0.4}, 巻:{fn:"lorenz",  smooth:0.3} },
  "嵐":  { 拍:{fn:"lorenz", smooth:0.1}, 節:{fn:"levy",  smooth:0.0}, 章:{fn:"logistic",smooth:0.1},巻:{fn:"levy",   smooth:0.0} },
  "整":  { 拍:{fn:"ca",     smooth:0.0}, 節:{fn:"fib",   smooth:0.0}, 章:{fn:"ca",    smooth:0.0}, 巻:{fn:"fib",     smooth:0.0} },
  "無":  { 拍:{fn:"levy",   smooth:0.5}, 節:{fn:"levy",  smooth:0.5}, 章:{fn:"brown", smooth:0.7}, 巻:{fn:"sine",    smooth:0.5} },
};
```

`smooth` は 0..1。0 = 二値、1 = 強い smoothing。

### 4. seed の焼き

招（maneki）が押された時に NAGARE.start(seed) を呼ぶ。seed は：

```js
const seed = (Date.now() % 100000) / 100000;  // 0..1 の決定論的な値
```

- 同じ seed なら同じ流れ
- 巫が「seed を指定して招」したい時のため、UI で seed 入力欄を持つ（任意）

### 5. relay の発火

NAGARE は各 tick で：
1. 時間スケールごとに next 関数を呼ぶ
2. 出力 [0,1] を依代別の駆動信号に変換（M2 で詳述）
3. 駆動信号を `setParam` の relay として hub に流す
4. すべての発火を **言上に残す**（既存の言上層に流すだけ）

## 合格条件

1. `shared/el-systema-natural.js` の 8 関数すべてが [docs/11_自然関数辞典.md](../../docs/11_自然関数辞典.md) のコード例と整合
2. seed=0.5 で各関数を 100 回呼ぶと**毎回同じ列**が出る（決定論的）
3. `field/nagare.js` の NAGARE.start(0.5) で `setMode("流")` した時、`/health` レベルで relay が増える（流れが起動）
4. `NAGARE.stop()` で relay 発火が止む
5. 言上に「NAGARE が打った relay」が記録されている（既存の relay と同型のメッセージ）

## 触ってはいけないもの
- 既存の祭次スケジューラ（[field/field.js](../../field/field.js) の御願詞処理）
- 既存の判示評価
- メッセージ schema（追加は OK、変更は NG）

## 注意
- NAGARE は祭次・判示と**並走**する。三者の relay が衝突した場合は ramp の後勝ち（[C3_ramp堅化](C3_ramp堅化.md) §4）に従う
- seed PRNG は Mulberry32 か xorshift で十分（暗号レベル不要）
- 関数の state は session 終了時に flush（言上に最終状態を残しても良い、無くても良い）
- 8 関数すべてが本実装で必須。手抜きで「あとで実装」のものは置かない
