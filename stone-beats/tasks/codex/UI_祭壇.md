# UI ─ 祭壇（四層）の実装

## 入力
- 設計：[docs/05_UI設計.md](../../docs/05_UI設計.md) の §二（祭壇）と §三（器側のしるし）
- 既存：[field/index.html](../../field/index.html)、[field/field.js](../../field/field.js)、[field/field.css](../../field/field.css)、[field/names.js](../../field/names.js)
- レイアウト案：[docs/05_UI設計.md §五](../../docs/05_UI設計.md)

## 出力
[field/](../../field/) の UI を四層構造に拡張。一気に全部やる必要は無い ─ A 層から順に。

---

## A 層：見守る（受動・常時表示）

### A1. 節の庭（既存改修）

- 現状：[field/index.html](../../field/index.html) に `<canvas id="canvas">` あり、[field/field.js](../../field/field.js) で描画
- 改修：依代を点で描く、各点に `id` ラベル、`presence` で明るさ、`silence` で薄く
- 波紋：応答発火時に同心円を 1 秒で広げる

### A2. マブイ計（新規）

- 各依代の `presence` / `low` / `high` を線グラフ（最新 10 秒、6Hz で更新）
- 場所：節の庭の右脇または下
- 一つのキャンバスに依代ぶん重ねるか、依代別に小さいスパークラインを並べる

### A3. 祭次の現在地（新規）

- 「3/12 ─ 次は 24 秒後」のような表示
- 招からの経過秒、祭の全体秒（duration）に対する位置のバー

### A4. 判示の盤（新規）

- 全応答規則を一覧で表示
- 各規則の状態を色で示す：
  - **灰**：条件未達
  - **黄**：条件は満ちているが持続待ち
  - **赤**：冷却中
  - **発火**：1 秒の波紋

### A5. ユンタクの河（新規）

- 言上を時系列のテキスト窓で
- 自動スクロール、ただし手動スクロール時は止まる
- 表示する type（[C4_言上不滅.md](C4_言上不滅.md) §3 と整合）：
  - relay / maneki / silence / kotodama / err（kehai は除外）

### A6. 時計（新規）

- 招からの経過時間
- 祭全体に対する位置

---

## B 層：調律する（能動・破壊しない）

### B1. 出力（既存）

- マスター音量。場全体の出力を ramp で動かす（巫が `setParam master` を全 target に送る）

### B2. 時間倍率（新規）

- 0.5x ~ 2.0x のスライダ
- 祭次の進行速度を変える ─ ただし**揺らぎは焼かれた実刻のまま**
- 実装：祭次のスケジューラに「現在の倍率」を掛けて next_at を再計算

### B3. 天気逸れ（新規）

- 4 状態：「湿り」「乾き」「冷え」「熱り」
- 全器に共通の調律を送る ─ どんなパラメータに何を送るかは器側の対応次第
- 例：「湿り」→ 全器に `setParam reverb=high` 相当

### B4. マブイの厚さ（新規）

- 全器の `kehai` 感度を底上げ／削る ─ ただし観測は受動なので**閾値**側を動かす
- マブイ計の見え方のチューニングと、応答の評価感度両方に効く

---

## C 層：割って入る（赤系統で目立たせる）

### C1. マブイグミ（新規）

- 沈黙した依代一覧（silence 出してる）を表示
- 一括「呼び戻し」ボタン：それらに play を 0.2 秒間隔で順に送る

### C2. 判示の早撃ち（新規）

- 「判示の盤」の各規則の脇に「今すぐ」ボタン
- 押すと **冷却・持続を無視して**為を撃つ

### C3. 判示の見送り（新規）

- 同じく規則の脇に「次は見送り」ボタン
- 次に発火しそうになった時、一度だけ skip

### C4. 招き直し（新規）

- 祭次を冒頭に戻す ─ 言上は残る（新しい maneki が記録される）

### C5. ヌジファ（既存）

- 全停止ボタン。ramp で 2 秒で 0 へ

### C6. ウクリ（既存）

- 場を空にする。依代の接続は維持

---

## D 層：記す（人の詞を流す）

### D1. ユンタク入力（新規）

- 1 行テキスト入力 + Enter で送信
- `kotodama {from:"user", text:"...", at:Date.now()}` を hub へ流す

### D2. しるし（新規）

- ボタン押下で `kotodama {from:"user", text:"*", at:Date.now()}` を流す（瞬間の旗）
- 言上窓に⭐︎ 印として目立つ表示

### D3. 書き出し（新規）

- session（招〜鎮め）の言上を jsonl ダウンロード
- 内部で「招の at」から「鎮めの at」までを field の memory で保持しておく必要あり

---

## 器側のしるし（[docs/05_UI設計.md §三](../../docs/05_UI設計.md)）

### 共通の小部品

各楽器（[stone-beats.html](../../stone-beats.html)、[ocean.html](../../ocean.html)、…）に画面右下の小さな部品を追加：

```html
<div id="connBadge" style="position:fixed;bottom:8px;right:8px;
  font:10px var(--mono);color:#666;padding:3px 8px;border:1px solid #444;border-radius:2px;">
  ─
</div>
<style>
  #connBadge.on  { color:#9c9; border-color:#5a5; }
  #connBadge.off { color:#c99; border-color:#a55; }
  #incoming      { position:fixed;inset:0;pointer-events:none;
                   box-shadow:inset 0 0 40px rgba(140,180,200,.0);
                   transition:box-shadow .2s; }
  #incoming.flash{ box-shadow:inset 0 0 40px rgba(140,180,200,.5); }
</style>
```

`shared/el-systema-control.js` から：
- transport.onOpen → `#connBadge` を `on`
- transport.onClose → `off`
- relay 受信時 → `#incoming` に 200ms flash

これは shared/ 側に乗せる方が依代ごとの手間が減る ─ shared/el-systema-control.js に「視覚的な見える化を生やす」フックを足す（ただし view は task のスコープ外）。

---

## 合格条件

### 段階 1 ─ A 層だけ（最優先）
- 1.A1: 節の庭に依代 6 つが表示できる
- 1.A2: マブイ計に kehai の動きが出る
- 1.A3: 祭次の現在地が刻まれる
- 1.A4: 判示の盤が灰／黄／赤／発火を切り替える
- 1.A5: ユンタクの河が流れる
- 1.A6: 時計が動く

### 段階 2 ─ B 層
- 2.B1: 出力スライダがマスターを変える
- 2.B2: 時間倍率が祭次の進行を変える
- 2.B3: 天気逸れが全器に届く（4 状態切り替えで反応が出る）
- 2.B4: マブイの厚さが判示の盤に反映される

### 段階 3 ─ C 層
- 3.C1〜C6: それぞれのボタンが期待通り動く

### 段階 4 ─ D 層
- 4.D1: ユンタクが流れる
- 4.D2: しるしが残る
- 4.D3: 書き出しが session 単位で取れる

## 触ってはいけないもの
- 既存 [field/names.js](../../field/names.js) の語 ─ 増やすのは OK、既存を変えない
- メッセージ schema
- 既存依代の UI

## 注意
- [docs/05_UI設計.md §五](../../docs/05_UI設計.md) のレイアウト案は粗案 ─ 実装で微調整 OK
- 色彩は既存 [field/field.css](../../field/field.css) の系統に合わせる
- 段階 1（A 層）が動けば**第一巻祭文の上演に必須**、ここまでで第一マイルストーン
