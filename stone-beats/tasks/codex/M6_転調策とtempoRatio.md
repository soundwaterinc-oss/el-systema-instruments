# M6 ─ tempoRatio と転調策（modulation policies）

## 入力
- 設計：docs/12_音楽的整合.md §五 (tempoRatio)、§六 (転調策)、§十一 M6 段階
- 各依代の tempoRatio / policy 既定：docs/12_音楽的整合.md §五 と §六、および docs/09_接続契約.md §六の二
- 前提：M5 (Add MUSUBI musical state core, commit 8c04237) 完了済
- 現状：field/nagare.js の `MusicAdapterMap` 各依代が `Math.round(music.bpm)` を生で送る、`music.転調策` は配列として保存されるが実行されない、modulation policy は無い

## 動機

M5 で MUSUBI 音楽状態 (key/mode/bpm/register) は landed したが、現状は全依代が **同一 bpm を生で受ける** ため多声リズムが立たない。また `key`/`mode` 変化は immediate に全依代へ撃たれるので、`voice-led` のような気づかれぬ転調ができない。

M6 で以下が動く：

1. **tempoRatio** が依代ごとに掛かり、master bpm 90 のとき stone-beats は 180、moss は 45、cell-noise は 11.25 のような多声リズムが立つ
2. **転調策** が祭文の時刻指定で `music.*` setParam を撃つ
3. **modulation policy** が 4 種使い分けられ、`voice-led` で凪境地に**気づかぬ転調**が走る

## 出力

### 1. tempoRatio constant map ─ field/nagare.js

依代ごとの既定 ratio。各 mode で動的に揺らすのは M7 以降、M6 では固定値：

```js
const TEMPO_RATIOS = {
  "mycorrhiza-beat": 1,
  "stone-beats":     1,         // M6 では 1。境地依存の 2 倍化は M7
  "kagome-sound":    1,
  "moss-reservoir":  0.5,       // half-time
  "particle-noise":  1,         // rate = bpm/60 × 1
  "geometry-scanner":1,
  "ocean":           0.5,       // drift = bpm × 0.5
  "planarian-drone": null,      // 拍を持たない、bpm は無視
  "cell-noise":      0.125      // 1/8 sub-harmonic pulse
};
```

各 `MusicAdapter` の bpm 送出を `Math.round(music.bpm * (TEMPO_RATIOS[id] || 1))` に修正。
`tempoRatio === null` の依代（planarian-drone）には bpm 関連 relay を送らない。

検証用 export：
```js
module.exports.TEMPO_RATIOS = TEMPO_RATIOS;
root.ElSystemaTempoRatios = TEMPO_RATIOS;
```

### 2. 転調策の解釈 ─ field/field.js

祭文 cast 時、`music.転調策[]` の各エントリを `祭次` と同様に `setTimeout` 経由でスケジュール。

エントリの schema：

```json
{
  "時": 60,                          // 秒、必須
  "key": "F",                         // optional
  "mode": "マカーム",                 // optional
  "bpm": 110,                         // optional
  "register": 0.2,                    // optional
  "policy": "voice-led",              // optional, 既定は依代別 (後述)
  "duration": 16                      // optional, voice-led / immediate の総 ramp 秒数、既定 4
}
```

時刻 `時` に：

1. policy が `immediate`：全依代に対し 4 秒（or `duration`）の ramp を一斉に
2. policy が `phrase-aligned`：次の節境界（既定 8 小節 = `8 × 4 × 60 / music.bpm` 秒）まで遅延、境界で immediate と同様
3. policy が `section-aligned`：次の章境界（32 小節 = `32 × 4 × 60 / music.bpm` 秒）まで遅延
4. policy が `voice-led`：下記の 3 段階

policy が undefined の場合は依代別既定（[09_接続契約.md §六の二](../../docs/09_接続契約.md#六の二・音楽アダプタ依代別-native-マッピング)）：
- ocean / moss / planarian → voice-led
- kagome / geometry → phrase-aligned
- stone / mycorrhiza / particle → immediate
- cell-noise → section-aligned

混在する場合：祭文に書かれた `policy` を全依代に一律で使う（依代別既定は祭文 policy 不在時のみ）。

### 3. voice-led の 3 段階実装

`docs/12_音楽的整合.md §六 voice-led アルゴリズム`に従う：

```js
function voiceLed(oldMusic, newMusic, durationSec, ids) {
  const oldPCS = pitchClassSet(oldMusic.key, oldMusic.mode);
  const newPCS = pitchClassSet(newMusic.key, newMusic.mode);
  const common = oldPCS.filter(p => newPCS.includes(p));

  // 段階 A (0 .. durationSec/3): 旧 scale だが共通音以外を attenuate
  // 段階 B (durationSec/3 .. 2/3): scale を newMode に切替（root はまだ old）
  // 段階 C (2/3 .. durationSec): root を ramp で new に
}

function pitchClassSet(key, mode) {
  const degrees = MUSIC_MODE_DEGREES[mode] || [0, 7];
  return degrees.map(d => (key + d) % 12);
}
```

`MUSIC_MODE_DEGREES` は shared/el-systema-shapes.js に既にある CANONICAL_MODES と同型。export を nagare.js から借りるか、もう一度宣言する。

#### 段階 A の具体（依代別）

scale を持つ 4 依代のみ非自明：

- **ocean**: 共通音以外を attenuate するため、`ds` / `oki` / `kg` のうち、その voice が現在鳴らしている主たる pitch が common に含まれなければ level を半減
  - 簡易実装: M6 では「3 voices のうち 1 つだけランダムに level=0.5、他はそのまま」で済ませて良い（M7 で精緻化）
- **planarian**: layer.0/1/2 のうち non-common を level→0.5
- **kagome**: customScale を common 音だけで再構成して送る
- **geometry**: `droneLevel` を 0.5 に絞る（最も持続的な音層）

scale を持たぬ 5 依代は段階 A をスキップして段階 C の bpm 切替だけ受ける。

#### 段階 B の具体

scale を切替えるが root は old のまま：

- ocean: `setParam("scale", newScaleMap[newMode])` を送る（root はまだ送らない）
- planarian: `setParam("targetScale", newScaleMap[newMode])`
- kagome: customScale を newMode 度数 × oldKey で計算して送る
- geometry: `setParam("selectedScale", newScaleMap[newMode])`

#### 段階 C の具体

root を ramp で new に：

- ocean: `cmd: "ramp", name: "root", from: oldHz, to: newHz, duration: (durationSec/3)`
- planarian: `setParam("rootNote", newKey)`（ramp 不能なので即時、durationSec/3 待ってから）
- kagome: customScale を newMode × newKey で再計算して送る
- geometry: `setParam("selectedRootNote", letterFromKey(newKey))`
- moss: `ramp("rootHz", oldHz, newHz, durationSec/3)`
- cell-noise: `setParam("pitchBase", newHz)`

段階 A/B/C それぞれ別々の `setTimeout` で発火させる。

### 4. phrase-aligned / section-aligned の境界計算

NAGARE か field に bar/beat counter を持つ：

```js
function currentBar(music, elapsedSec) {
  // 4/4 default、1 拍 = 60/bpm 秒、1 小節 = 4 拍
  return elapsedSec * music.bpm / (60 * 4);
}

function timeToNextPhraseBoundary(music, elapsedSec, phraseBars) {
  // phraseBars: 既定 8
  const cur = currentBar(music, elapsedSec);
  const next = Math.ceil(cur / phraseBars) * phraseBars;
  return (next - cur) * 60 * 4 / music.bpm;
}
```

`phraseBars` は 8、`sectionBars` は 32 を既定とする。`音楽` block 内で `phraseBars` / `sectionBars` を override 可能にしても良い（M6 では既定固定で OK）。

### 5. 既存 MusicAdapterMap への組込み

各 adapter の bpm 送出箇所を `Math.round(music.bpm * tempoRatio(id))` に置換：

```js
function tempoRatio(id) {
  return TEMPO_RATIOS[id] != null ? TEMPO_RATIOS[id] : 1;
}

// 例 mycorrhiza-beat:
"mycorrhiza-beat": function (id, music) {
  const r = tempoRatio(id);
  if (r === null) return [];  // bpm を送らない
  return [
    { target: id, cmd: "setParam", name: "bpm", value: Math.round(music.bpm * r) },
    // ... 既存の凪 mode 処理
  ];
}
```

planarian-drone の adapter は bpm 関連 relay を一切送らないことを確認（既に rootNote / targetScale のみ送ってる ─ 修正不要）。

### 6. test

field/nagare.test.js に追加：

- `tempoRatio` map が全 9 依代の id を含む
- `applyMusicState({bpm: 120})` 後、各依代に送られる bpm 値が `120 * tempoRatio[id]` に等しい（planarian は relay 送出されない）
- `pitchClassSet(0, "琉球")` が `[0, 4, 5, 7, 11]` を返す
- `voiceLed(oldMusic, newMusic, 12, ids)` が時刻 0, 4, 8 にそれぞれ A/B/C 段階の relay を生成する
- 転調策エントリが時刻 60 で発火、policy=phrase-aligned 時に次の節境界まで遅延されるシナリオ

shared/el-systema-shapes.test.js に追加：

- `音楽.転調策[i]` の schema validation（時 が数、policy が enum、duration 妥当）

### 7. 言上

転調策が発火する瞬間に：

```js
pushKotodama({
  t: "kotodama", from: "field",
  text: "転調策 t=60: key C→F mode 琉球→マカーム policy=voice-led duration=12"
});
```

voice-led 3 段階の各境界でも一行ずつ残す。

## 合格条件

1. 第二巻「九の輪」の `音楽.転調策` に以下を入れて招くと、時刻通りに転調が走る：
   ```json
   "転調策": [
     { "時": 60,  "mode": "琉球", "policy": "voice-led", "duration": 12 },
     { "時": 270, "mode": "マカーム", "key": "F", "policy": "immediate", "duration": 4 },
     { "時": 480, "mode": "凪", "bpm": 50, "policy": "voice-led", "duration": 30 }
   ]
   ```
2. `applyMusicState({bpm: 120})` を撃つと、mycorrhiza-beat が 120 BPM、stone-beats も 120、moss-reservoir が 60、cell-noise の pulseRate が 15 (= 120/8) 相当、planarian は bpm 関連 relay 受けない
3. voice-led 転調 (12 秒) を観察すると、最初の 4 秒は旧 scale で voice attenuate、次の 4 秒で scale だけ変わって root はまだ古い、最後の 4 秒で root が新調へ ramp
4. phrase-aligned 転調が招の経過時間に応じて適切に次の小節境界まで遅延する（bpm=80 なら 8 小節 = 24 秒の倍数で着地）
5. 凪境地・voice-led・key=C のままで mode=琉球→マカーム 切替が、9 依代に共通音保持で気づかれぬよう移行
6. 既存の M4 境地切替 / M5 immediate music setParam と共存（policy 不在の単発 music.* setParam は immediate 同等）

## 触ってはいけないもの

- M5 で実装された `MusicAdapterMap` / `applyMusicState` の外部 API
- 依代側 shared/el-systema-control.js
- M7 以降の機能：kagome 動的 customScale で key 別 transpose、境地→音楽既定の自動適用、harmony 信号、register zone の zone 内 octave 制限

## 注意

- voice-led の段階 A は M6 では「voice level を半減」までで良い（厳密な「common 音だけ鳴らす」は楽器側に scale awareness が無いと不能）。M7 で kagome 動的 customScale + voice-led 完全版を実装
- planarian の rootNote は ramp 不可（離散値）なので段階 C は setParam の即時切替で良い。それでも段階 B から段階 C への移行を「voice-led」と呼べる：scale が先に変わり、root が後から決まる
- tempoRatio の境地依存揺動（stone を動境地で 2 倍にする等）は M7 で実装、M6 では固定値で十分
- 転調策の `時` が祭文 `duration` を超える場合は警告のみで発火させない
- 転調策と判示（応答）は独立に発火する。両方で `music.*` が動いて競合する場合、後勝ち（最新 setParam が state を上書き）
