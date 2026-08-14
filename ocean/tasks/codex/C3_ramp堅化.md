# C3 ─ ramp の堅化

## 入力
- 実装：[shared/el-systema-control.js](../../shared/el-systema-control.js) の relay 受信側、[field/field.js](../../field/field.js) の ramp 送信側
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md) §三・「`ramp` の最小契約」
- 仕様：[01_語彙と所作と筋書き.md](../../01_語彙と所作と筋書き.md) 四・不変条件 4「揺らぎは招の時に焼く」

## 出力
ramp の送信側（巫が `relay {cmd:"ramp", ...}` を発火）と受信側（依代が `cb.ramp(name, from, to, dur)` を呼ぶ）の両側で、以下を保証する。

### 1. 招の時に焼かれる「実刻」

祭次の `{時, 揺, command: "ramp", from, to, duration}` から：
- `startAt = castStartAt + 時*1000 + (rand-0.5)*揺*2*1000`（**招の時に一度だけ**焼く）
- `dur` は当該 ramp の duration 秒
- ramp message には `startAt`（絶対時刻 ms）と `dur` を入れる

メッセージ schema は既に対応している（[shared/el-systema-shapes.js](../../shared/el-systema-shapes.js) の `isRelay` ramp 節）。

### 2. 依代側 ramp 実装の最小骨格

各依代の `cb.ramp(name, from, to, dur)` ハンドラ：

```js
ramp: (name, from, to, dur) => {
  const start = performance.now();
  const ms    = Math.max(1, dur * 1000);
  let raf;

  // 同パラメータに走っている前の ramp を中止（後勝ち）
  if (rampHandles[name]) cancelAnimationFrame(rampHandles[name]);

  const tick = () => {
    const k = Math.min(1, (performance.now() - start) / ms);
    const v = from + (to - from) * k;
    applyParam(name, v);            // 既存 setParam と同じ反映器
    if (k < 1) {
      rampHandles[name] = requestAnimationFrame(tick);
    } else {
      delete rampHandles[name];
    }
  };
  rampHandles[name] = requestAnimationFrame(tick);
}
```

### 3. duration ≤ 0 の扱い
- 即座に `to` をセット、ramp 化しない
- `applyParam(name, to)` のみ

### 4. 競合解決：後勝ち
- 同名パラメータに既に動いている ramp が在れば**中止**し、新しい ramp で上書き
- 別名パラメータ同士は独立に走る

### 5. 巫側のスケジューラ
- `setTimeout(() => sendRelay(...), startAt - now())` で発火時刻に揃える
- スケジューラ自体の精度（10-15ms の jitter）は許容、ramp の精度は受け取り側 rAF が吸収

### 6. ramp 中の依代切断
- 依代が消えた／reload された場合、受け取り側 ramp は次の relay を待つだけ
- 巫側で「依代が消えた」を `kehai` 途絶で検知し、進行中 ramp を**未確定として言上に残す**

## 合格条件
1. `setParam` 同等の即値変更（`dur=0`）が瞬時に反映
2. `dur=10` の ramp が線形に 10 秒で移動、可聴ノイズ無し
3. 同パラメータに `dur=20` を投げた直後に `dur=5` を投げると、5 秒ですぐ目標へ向かう
4. 別パラメータの ramp は並列に動く
5. 招ごとに `startAt` が違う（揺らぎが反映される）
6. 言上に焼かれた `startAt` と `dur` が残る（後で復元可能）

## 触ってはいけないもの
- メッセージ schema
- AudioParam の自動化（setTargetAtTime 等）─ これは依代の内部、ramp は外側で値を流す

## 注意
- WebAudio の `setTargetAtTime` を ramp の実装に使うかは依代の自由。**外向き API は `applyParam(name, v)` の線形流し込み**で統一すれば、楽器が違っても巫からは同じ
- duration 数十秒の長い ramp ではフレームの整数倍に丸める必要無し（rAF が ~16ms 粒度）
