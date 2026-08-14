# L5c ─ mossreservoir を場に上げる

## 入力

- リポジトリ：[soundwaterinc-oss/mossreservoir](https://github.com/soundwaterinc-oss/mossreservoir)
- デプロイ：https://mossreservoir.pages.dev/
- 形式：**React + Vite**
- 構造：`index.html`, `MossReservoir.jsx`（root 直下 ？？）, `src/App.jsx`, `src/main.jsx`, `src/audio/`, `src/components/`, `src/hooks/`, `src/legacy/`, `src/utils/`
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)
- 注意：root に `mycorrhiza-beat.html` が存在（要確認、何のためか分からない）

## 出力

`mossreservoir/` リポジトリで以下のコミット二本：

### コミット 1：`public/shared/ scripts を写経する`

L5b と同型：

```bash
git clone https://github.com/soundwaterinc-oss/mossreservoir.git
cd mossreservoir
mkdir -p public/shared
for f in el-systema-shapes.js el-systema-transport.js el-systema-control.js; do
  curl -sL "https://raw.githubusercontent.com/soundwaterinc-oss/el-systema-acid/main/shared/$f" -o "public/shared/$f"
done
git add public/shared/
git commit -m "public/shared: el-systema-acid から葉 API 三本を写経"
```

### コミット 2：`index.html と src/audio/ に葉 API を差し込む`

L5b（mycorrhiza-beat）と同型。違いは：

- `id: "moss-reservoir"`
- audio 初期化箇所は `src/audio/` の中（要コード読み）
- パラメータ名は moss-reservoir 固有（ベース系の楽器なので freq、cutoff、depth 等が想定される）

#### `index.html` の修正

`/src/main.jsx`（または `/MossReservoir.jsx` ？？）の**直前**に三本を入れる：

```html
<script src="/shared/el-systema-shapes.js"></script>
<script src="/shared/el-systema-transport.js"></script>
<script src="/shared/el-systema-control.js"></script>
<script type="module" src="/src/main.jsx"></script>
```

#### React 側で register

L5b §「選択肢 A／B」と同型。`id` だけ `"moss-reservoir"` に変える。

#### `MossReservoir.jsx`（root 直下）の扱い

root に `.jsx` が直接ある意味が不明。可能性：
- 古いエントリポイント（vite 移行前の名残）
- 別のビルド経路で使われている
- legacy で参照だけ残っている

`vite.config.js` の `build.input` を見て、現行エントリポイントを確認すること。
古いものなら .gitignore か delete 候補（**ユーザ承認後**）。

#### `mycorrhiza-beat.html` の扱い

mossreservoir リポに別楽器のファイル名がある ─ 由来不明。**触らない、削除しない**。
ユーザに「mycorrhiza-beat.html は何ですか？」と確認する。

## 合格条件

[docs/09_接続契約.md](../../docs/09_接続契約.md) §五の **5 件すべて**：

1. `http://localhost:<port>/` を開くと console に「ws connected」相当が出る
2. `field/` の「節の庭」に `moss-reservoir` が現れる
3. `field/` から `play` を送ると鳴る
4. `setParam("<paramName>", value)` で UI が変わる（param 名は実装読みで特定）
5. 鳴り終わって 6 秒経つと `silence` が宣られる

## 触ってはいけないもの

- React state 構造
- 既存 audio graph
- `MossReservoir.jsx` root 版（同定が済むまで保留）
- `mycorrhiza-beat.html`（由来確認まで保留）

## 注意

1. shared/ パラメータ名は moss-reservoir のコードを読んで [docs/09_接続契約.md](../../docs/09_接続契約.md) §六に追記
2. ベース楽器なので低域メインの可能性が高い ─ kehai の `low` チャネルが大きく出るはず
3. legacy/ ディレクトリの扱いは触らない（用途不明）
