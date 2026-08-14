# L6 ─ CellNoiseGenerator の同定と接続

## 状況（[REGISTRY.md](../../REGISTRY.md) §一 blocker D/E）

- 仕様書は「CellNoiseGenerator」と呼ぶ
- デプロイは `http://localhost:3212/public`
- ワークスペース直下の `public/` + `src/` がそれと思われる ─ title は `Particle Noise Lab`
- **`el-systema-bloom-particle-noise` とほぼ同じ実装**に見える（HANDOFF.md 上）
- 同時に `el-systema-particle-noise-lab/` という別ディレクトリも存在（用途未確定）

## このタスクは「正体を確定する」こと

### ステップ 1：3 ディレクトリの diff を取る

```bash
cd "/Users/nakamuraryuuakira/Desktop/dsktop/EL-SYSTEMA ACID"

# 1. ファイル数と総量
for d in el-systema-bloom-particle-noise el-systema-particle-noise-lab public src; do
  if [ -d "$d" ]; then
    echo "=== $d ==="
    find "$d" -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" \) | wc -l
    du -sh "$d" 2>/dev/null
  fi
done

# 2. main.js の頭 30 行を見比べる
for d in el-systema-bloom-particle-noise/src public/../src; do
  if [ -f "$d/main.js" ]; then
    echo "=== $d/main.js ==="
    head -30 "$d/main.js"
  fi
done

# 3. ハッシュで完全一致判定
sha256sum el-systema-bloom-particle-noise/src/main.js  src/main.js  el-systema-particle-noise-lab/src/main.js 2>/dev/null
```

### ステップ 2：仮説判定

結果に基づいて以下のいずれかに分類：

- **仮説 1：完全に同じ** → ワークスペース直下の `public/`+`src/` は手元コピー、`el-systema-bloom-particle-noise/` を正本として扱う。`public/`+`src/` と `el-systema-particle-noise-lab/` は削除候補
- **仮説 2：派生（少しだけ違う）** → どちらが正本か CC に判定を求める。CC のレビュー後、片方を archive
- **仮説 3：完全に別物** → 別の id として場に上げる必要あり。例: `cell-noise-lab`、`particle-noise-lab`

### ステップ 3：判定結果を [REGISTRY.md](../../REGISTRY.md) §二の該当 section に追記

仮説 1/2/3 のどれだったか、なぜそう判定したか、を 5 行以内で書く。

### ステップ 4（仮説 3 の場合のみ）：別 id で場に上げる

接続作業は L4 と同型。**新しい id**（例: `particle-noise-lab`）で `registerElSystemaInstrument` を呼ぶ。

## 合格条件

- [REGISTRY.md](../../REGISTRY.md) の blocker D/E の状態が「解消」になっている
- 仮説 3 だった場合は場に上がっている

## 触ってはいけないもの

- ファイルの削除は**ユーザ承認後**にのみ実行（仮説 1/2 で「削除候補」となったものを勝手に消さない）
- ローカル `http://localhost:3212` が動いている経路（CellNoiseGenerator の既存デプロイ）

## 注意

- 同定が確定するまでは場に上げない（同名で二つ繋がると場が壊れる）
