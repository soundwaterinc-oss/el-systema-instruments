# L5a ─ kagome-sound を場に上げる

## 入力

- リポジトリ：[soundwaterinc-oss/kagome-sound](https://github.com/soundwaterinc-oss/kagome-sound)
- デプロイ：https://kagome-sound.pages.dev/
- 形式：**単一 HTML**（`index.html` 723 行、Poly Engine）─ stone-beats / ocean と同型
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)

## 出力

`kagome-sound/` リポジトリで以下のコミット二本：

### コミット 1：`shared/ scripts を写経する`

```bash
git clone https://github.com/soundwaterinc-oss/kagome-sound.git
cd kagome-sound
mkdir -p shared
for f in el-systema-shapes.js el-systema-transport.js el-systema-control.js; do
  curl -sL "https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/$f" -o "shared/$f"
done
git add shared/
git commit -m "shared: el-systema-acid から葉 API 三本を写経"
```

### コミット 2：`index.html に葉 API を差し込む`

#### 探すべき場所
1. `index.html` 内の `<script>` 開始位置
2. AudioContext を作っている場所（`new AudioContext(...)` または `new (window.AudioContext||...)()` 等）
3. master GainNode（出力直前の Gain）の変数名

#### 修正 1：主な `<script>` の**直前**に三本

```html
<script src="shared/el-systema-shapes.js"></script>
<script src="shared/el-systema-transport.js"></script>
<script src="shared/el-systema-control.js"></script>

<script>
  // 既存のスクリプト ...
</script>
```

#### 修正 2：既存スクリプト先頭に fallback

```js
if (typeof window.registerElSystemaInstrument !== "function") {
  window.registerElSystemaInstrument = function(){};
}
```

#### 修正 3：AudioContext と master が確定した後に register

おそらく `init()` または `setupAudio()` 相当の関数の末尾。例：

```js
function init(){
  // ... 既存のオーディオ初期化 ...
  // audioCtx と master Gain が確定した後で：

  registerElSystemaInstrument({
    id: "kagome-sound",
    audioContext: audioCtx,
    outputNode:   masterGain,

    play:  () => { /* 既存「Start」相当のボタン押下を関数化したもの */ },
    stop:  () => { /* 既存「Stop」相当 */ },

    setParam: (name, value) => {
      // kagome の UI 上の select / input を name 経由で操作
      const el = document.getElementById(name) || document.querySelector(`[name="${name}"]`);
      if (el) {
        if (el.tagName === "SELECT") {
          el.value = value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    },

    ramp: (name, from, to, durationSec) => {
      const dur = Math.max(0.001, durationSec);
      const startMs = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - startMs) / 1000 / dur);
        const v = from + (to - from) * k;
        const el = document.getElementById(name) || document.querySelector(`[name="${name}"]`);
        if (el) {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    loadPreset: (preset) => {
      if (!preset || typeof preset !== "object") return;
      for (const [k, v] of Object.entries(preset)) {
        const el = document.getElementById(k) || document.querySelector(`[name="${k}"]`);
        if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
      }
    },

    snapshot: () => {
      // kagome の主要 UI 状態を読み取る
      // input/select 全部を name=value で返す（DOM 探索）
      const snap = {};
      document.querySelectorAll("input, select").forEach(el => {
        if (el.id) snap[el.id] = el.value;
      });
      return snap;
    },
  });
}
```

DOM 探索だけで動く設計にしてある（kagome の内部 state を直接触らない）。
DOM の id が見つからない場合は task の注意 §3 を参照。

## 合格条件

[docs/09_接続契約.md](../../docs/09_接続契約.md) §五の **5 件すべて**：

1. `http://localhost:<port>/index.html` を開くと console に「ws connected」相当が出る
2. `field/` の「節の庭」に `kagome-sound` が現れる
3. `field/` から `play` を送ると鳴る
4. `setParam(<UI id>, value)` で UI が変わる
5. 鳴り終わって 6 秒経つと `silence` が宣られる

## 触ってはいけないもの

- 既存 Poly Engine の audio path
- 既存 UI のレイアウト・スタイル
- pages.dev の deploy 経路（vite build → wrangler が動いている）

## 注意

1. AudioContext / masterGain の変数名は kagome の実装次第。コードを読んで合わせる
2. `play` / `stop` ハンドラは既存ボタン押下と等価になる関数を新しく書く（既存ボタンの onclick を関数化）
3. setParam の対象が UI id で見つからない場合は、kagome の内部 state mutator（あれば）を呼ぶ ─ 但し**外から state を直接触らない**
4. `snapshot` の DOM 探索版は雑だが妥当 ─ もっと厳密にしたい場合は CC に相談
5. kagome は React / Vite を**使っていない**ので、shared/ の script タグは普通に効く
