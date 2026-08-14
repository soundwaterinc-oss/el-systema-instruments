# L5b ─ mycorrhiza-beat を場に上げる

## 入力

- リポジトリ：[soundwaterinc-oss/mycorrhiza-beat](https://github.com/soundwaterinc-oss/mycorrhiza-beat)
- デプロイ：https://mycorrhiza-beat.pages.dev/
- 形式：**React + Vite**
- 構造：`index.html`, `src/App.jsx`, `src/main.jsx`, `src/audio/`, `src/osc/`, `src/scan/`, `src/viz/`, `src/components/`, `src/utils/`, `src/constants.js`
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)

## 出力

`mycorrhiza-beat/` リポジトリで以下のコミット二本：

### コミット 1：`public/shared/ scripts を写経する`

Vite の `public/` は build 時にそのまま root にコピーされる。葉 API はここに置く：

```bash
git clone https://github.com/soundwaterinc-oss/mycorrhiza-beat.git
cd mycorrhiza-beat
mkdir -p public/shared
for f in el-systema-shapes.js el-systema-transport.js el-systema-control.js; do
  curl -sL "https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/$f" -o "public/shared/$f"
done
git add public/shared/
git commit -m "public/shared: el-systema-acid から葉 API 三本を写経"
```

### コミット 2：`index.html と src/audio/ に葉 API を差し込む`

#### `index.html`

`<script type="module" src="/src/main.jsx"></script>` の**直前**に三本：

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MYCORRHIZA::BEAT</title>
</head>
<body>
  <div id="root"></div>
  <script src="/shared/el-systema-shapes.js"></script>
  <script src="/shared/el-systema-transport.js"></script>
  <script src="/shared/el-systema-control.js"></script>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

#### `src/audio/` で AudioContext と master Gain を出している箇所を探す

おそらく `src/audio/index.js`、`src/audio/engine.js`、`src/audio/context.js` 等。
audio がシングルトン的に作られているなら module スコープの変数を抽出する。

#### `src/main.jsx` または `src/audio/*` で register を呼ぶ

React の場合、最も自然なのは：

**選択肢 A：`src/audio/` 内で audio 初期化が終わった瞬間に register**

```js
// src/audio/engine.js または同等の場所
import { /* ... */ } from "./xxx";

let audioCtx, masterGain;

export function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  // ... 既存の audio graph ...

  // 葉：場と繋ぐ
  if (typeof window.registerElSystemaInstrument === "function") {
    window.registerElSystemaInstrument({
      id: "mycorrhiza-beat",
      audioContext: audioCtx,
      outputNode:   masterGain,
      play:  () => engineApi.start(),
      stop:  () => engineApi.stop(),
      setParam: (name, value) => engineApi.setParam(name, value),
      ramp: (name, from, to, dur) => engineApi.ramp(name, from, to, dur),
      loadPreset: (p) => engineApi.loadPreset(p),
      snapshot: () => engineApi.getSnapshot(),
    });
  }
  return { audioCtx, masterGain };
}
```

`engineApi` の中身は mycorrhiza-beat の既存 API に合わせる。

**選択肢 B：React component（`App.jsx`）の `useEffect` で register**

audio init 後に React state が落ち着いた時点で register。
audio 初期化が React lifecycle 内なら自然。但し audio が再初期化されると register が二重になるので注意。

#### setParam の橋渡し（重要）

mycorrhiza-beat は React + Vite。state は React の useState / context / zustand のいずれか。`document.getElementById` で直接 UI を叩くのは脆い ─ **state 更新関数を経由する**ほうが堅い：

```js
// 例：state 更新を window 経由で公開しておく
useEffect(() => {
  window.__mycorrhiza_setParam = (name, value) => {
    // 内部の state setter を呼ぶ
    if (name === "bpm") setBpm(value);
    else if (name === "selectedScale") setSelectedScale(value);
    // ...
  };
  return () => { delete window.__mycorrhiza_setParam; };
}, [/* deps */]);
```

そして `setParam` ハンドラ内で `window.__mycorrhiza_setParam(name, value)` を呼ぶ。
この方式は外向きの「窓」を一つだけ作る（指示書の「外から state を弄れる針穴は無い」に対する妥協）。

## 合格条件

[docs/09_接続契約.md](../../docs/09_接続契約.md) §五の **5 件すべて**：

1. `http://localhost:<port>/` を開くと console に「ws connected」相当が出る
2. `field/` の「節の庭」に `mycorrhiza-beat` が現れる
3. `field/` から `play` を送ると鳴る
4. `setParam("bpm", 120)` で UI 上の bpm が変わる
5. 鳴り終わって 6 秒経つと `silence` が宣られる

## 触ってはいけないもの

- React state 構造そのもの（state を露出させる「窓」は OK だが、構造を変えない）
- 既存 audio graph
- vite.config.js のビルド設定（基本的に）

## 注意

1. **Vite の dev / build 経路の両方で動作確認**：`npm run dev` と `npm run build && npm run preview`
2. shared/ を `public/shared/` に置くと、dev でも prod でも `/shared/...` で参照できる
3. setParam の窓は **read-only な観点では透明、write は限定的に**（不変条件「観測は受動」に整合）
4. React 18+ なら StrictMode で useEffect が二回走るが、register は副作用フラグで一回だけ呼ばれるようにする：
   ```js
   const registered = useRef(false);
   useEffect(() => {
     if (registered.current) return;
     registered.current = true;
     // register here
   }, []);
   ```
