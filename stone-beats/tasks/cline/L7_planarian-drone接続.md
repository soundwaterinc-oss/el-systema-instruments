# L7 ─ planarian-drone を場に上げる（push + 接続）

## 状況

- **デプロイ**：https://planarian-drone.pages.dev/（title: "PLANARIAN DRONE — EL-SYSTEMA v5"）
- **ローカル源**：`/Users/nakamuraryuuakira/Desktop/dsktop/PLANARIAN-DRONE/`
- **git remote 無し** ─ ローカルだけ。Cloudflare Pages へは `wrangler pages deploy` で直接上げている状態（推測）
- **形式**：React + Vite（[L5b mycorrhiza](L5b_mycorrhiza接続.md) と同型）
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)

## 出力

### ステップ 1：GitHub に push する（**先にやる ─ 消失リスク回避**）

```bash
cd "/Users/nakamuraryuuakira/Desktop/dsktop/PLANARIAN-DRONE"

# gh で空 repo を作って push
gh repo create soundwaterinc-oss/planarian-drone --public --source=. --remote=origin --push
```

push 後、デフォルトブランチが `main` か他か確認。Cloudflare Pages との連携設定（git 連携にするか、wrangler のみにするか）はユーザ判断 ─ **触らない**。

### ステップ 2：`public/shared/` に葉 API 三本を写経

```bash
mkdir -p public/shared
for f in el-systema-shapes.js el-systema-transport.js el-systema-control.js; do
  curl -sL "https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/$f" -o "public/shared/$f"
done
git add public/shared/
git commit -m "public/shared: el-systema-acid から葉 API 三本を写経"
git push
```

### ステップ 3：`index.html` + `src/audio/` に葉 API を差し込む

#### `index.html`

Vite のエントリ（`<script type="module" src="/src/main.jsx">` 等）の**直前**に三本：

```html
<script src="/shared/el-systema-shapes.js"></script>
<script src="/shared/el-systema-transport.js"></script>
<script src="/shared/el-systema-control.js"></script>
<script type="module" src="/src/main.jsx"></script>
```

注意：planarian-drone の現状の `index.html` は 422 bytes（軽量、おそらく Vite のテンプレ）。読んで合わせる。

#### `src/audio/` で AudioContext と master Gain を確定する箇所

`src/audio/` 配下のファイルを探す。drone 楽器なので、おそらく：
- AudioContext シングルトン
- 複数オシレータが master Gain に集まる構造
- 「鳴り続ける」エンジン（drone は基本的に on/off の二値、ramp で fade）

#### register の呼び出し

```js
if (typeof window.registerElSystemaInstrument === "function") {
  window.registerElSystemaInstrument({
    id: "planarian-drone",
    audioContext: audioCtx,
    outputNode:   masterGain,

    play:  () => { /* drone を fade-in で鳴らす */ },
    stop:  () => { /* drone を fade-out で止める */ },

    setParam: (name, value) => {
      // React state setter 経由（L5b §選択肢 A or B を参照）
      // 例: window.__planarian_setParam(name, value)
    },

    ramp: (name, from, to, dur) => {
      // shared/ の標準 ramp で十分なら省略可
    },

    loadPreset: (preset) => {
      if (preset && typeof preset === "object") {
        for (const [k, v] of Object.entries(preset)) {
          // setParam 経由
        }
      }
    },

    snapshot: () => {
      // 主要パラメータを JSON object で返す
      return { /* ... */ };
    },
  });
}
```

### ステップ 4：[REGISTRY.md](../../REGISTRY.md) と [docs/09_接続契約.md](../../docs/09_接続契約.md) §六を更新

- REGISTRY に新行を追加（既に CC が下準備）
- 09 §六に planarian-drone のパラメータ一覧を写経して追記

## 合格条件

[docs/09_接続契約.md](../../docs/09_接続契約.md) §五の **5 件すべて**：

1. `http://localhost:<port>/` を開くと console に「ws connected」相当が出る
2. `field/` の「節の庭」に `planarian-drone` が現れる
3. `field/` から `play` を送ると鳴る（drone なので持続音）
4. `setParam("<paramName>", value)` で UI が変わる
5. `stop` 後 6 秒で `silence` が宣られる

## 触ってはいけないもの

- Cloudflare Pages の deploy 経路（wrangler 設定）─ 触らずに「git remote が増えただけ」の状態にする
- `vite.config.js` のビルド設定
- React state 構造

## 注意

- planarian-drone は v5 のコードで、現行 v6+ から離れている可能性 ─ ビルドが通るか先に確認
- drone 楽器は**鳴り続ける**性質なので、`play` は fade-in、`stop` は fade-out 推奨（即値だと clip 音）
- パラメータ名は drone 系っぽいもの（drone level, cutoff, density, modulation, depth, ...）を写経で発見する
- 仕様書 v5 が PLANARIAN-DRONE 配下に README 等で残っているなら、それも読む価値あり
