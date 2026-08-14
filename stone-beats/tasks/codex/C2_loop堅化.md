# C2 ─ 神籠り loop の堅化

## 入力
- 実装：[field/field.js](../../field/field.js)（409 行）の応答評価部分
- 仕様：[01_語彙と所作と筋書き.md](../../01_語彙と所作と筋書き.md) §三・四、[02_仕様書要約.md](../../docs/02_仕様書要約.md) §四
- メッセージ schema：[shared/el-systema-shapes.js](../../shared/el-systema-shapes.js)

## 出力
[field/field.js](../../field/field.js) の応答評価ロジックの堅化。

### 検証して直すべき項目

#### 1. 演算子の境界
- `>`, `<`, `==` を `>= <= !=` の場合と取り違えない
- 浮動小数（`presence` 等）の `==` は誤動作のもと ─ `>` / `<` のみ仕様で許す、`==` は禁ずる or 許容誤差付き

#### 2. `持続` 条件の評価
- `信号 演算 値` を**N 秒間連続で満たした時**に発火
- 中断（一瞬でも条件を割った）でカウンタ reset
- 既存実装の `quietSince`（state.quietSince）が応答 index ごとに保たれているか確認
- **`持続` が省略された応答は閾値超過の瞬間に発火**（既定値 0 秒）

#### 3. `一度` の発火管理
- `一度: true` の応答は `state.fired[idx] = true` で済むが、**祭文を読み直すと reset されるべき**
- 招ごと（maneki ごと）に fired をクリアする確認

#### 4. `冷却` の評価
- 冷却中は条件が満ちても撃たない
- 冷却の開始時刻は**為が撃たれた瞬間**
- 既存 `state.coolingUntil[idx]` の確認

#### 5. 複数応答の同時発火
- 同じ拍に複数の応答条件が満ちた場合、**祭文に書かれた順**で順次発火
- 為が前の為を打ち消す可能性（同 target / 同 param への ramp 等）は後勝ち

#### 6. kehai が来ない依代の判定
- 依代が register していない、または接続が切れた id を `信号` で参照した場合：
  - **未到着扱いで条件を満たさない**（false） として進む
  - hub の `err` 経由で巫が知る
- 既存実装で `state.instruments[id]` が空の時の振る舞いを確認

#### 7. 揺らぎ（時の揺）は招の瞬間に焼く
- 仕様書「揺らぎは招の時に焼く・実刻は記録に残す」
- 祭次の各御題の `時 + (rand-0.5)*揺*2` を**招の時に一度だけ計算して固定**
- ramp の絶対時刻 `startAt` も招の時に焼く
- 言上に焼かれた実刻が残る

### 評価器の最小骨格（参考）

```js
function evalResponse(resp, idx, now) {
  // 冷却中なら抜ける
  if (state.coolingUntil[idx] && now < state.coolingUntil[idx]) return;
  // 一度発火済みならスキップ
  if (resp.一度 && state.fired[idx]) return;

  const ok = checkCondition(resp.時, now);
  if (!ok) {
    state.持続Since[idx] = 0;
    return;
  }
  // 持続秒の達成判定
  const need = (resp.時.持続 || 0);
  if (!state.持続Since[idx]) state.持続Since[idx] = now;
  if ((now - state.持続Since[idx]) < need * 1000) return;

  // 為を撃つ
  fire(resp.為);
  state.fired[idx] = state.fired[idx] || resp.一度;
  if (resp.冷却) state.coolingUntil[idx] = now + resp.冷却 * 1000;
  state.持続Since[idx] = 0;  // 連続発火を避ける
}
```

## 合格条件
1. 仕様書例（[liturgy.example.json](../../liturgy.example.json) 応答節）の三つの規則が**境界値で**正しく発火・停止する
2. 同一応答が冷却内に再発火しない
3. `一度: true` の応答は再招でリセット、それまで一回だけ
4. 同拍に二つ以上の応答が満ちた場合、祭文順で順次発火（言上で確認可能）
5. 揺らぎが招ごとに違う実刻を焼く（同じ祭文でも招ごとに少しずれる）
6. 連続 6 分の祭で評価器が落ちない・遅延しない

## 触ってはいけないもの
- メッセージ schema
- 既存の transport（WS 接続）
- 既存の祭次配信器（`時` 通りに御題を投げる部分）

## 注意
- 評価は **6Hz**（160ms 間隔）─ requestAnimationFrame ではなく setInterval が向く
- 評価中のエラーは try/catch で吸収、言上に `err` で記録
- AI は条件に入らない（[02_仕様書要約.md](../../docs/02_仕様書要約.md) §四・不変条件 2）
