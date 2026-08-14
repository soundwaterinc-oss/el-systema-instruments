# EL-SYSTEMA / MUSUBI

ユタ儀礼の作法を引いた、複数の依代（楽器）が場で響き合う系。
**MUSUBI（結び）** は ceremonic に依代を繋ぐ系の名。神道の「むすび」─
万物を繋ぐ霊的な力 ─ を借りて、場・巫・葉・祭文・神籠りを一つに束ねる。

場は ws://localhost:8787 のヒヌカン（hub）を中心に立ち、巫（ユタ）が御願詞（祭文）を上げる。

## デプロイ

- リポジトリ：[soundwaterinc-oss/el-systema-acid](https://github.com/soundwaterinc-oss/el-systema-acid)
- Pages（静的 ─ 楽器 / field 単体動作）：https://soundwaterinc-oss.github.io/el-systema-acid/
  - [stone-beats](https://soundwaterinc-oss.github.io/el-systema-acid/stone-beats.html)
  - [ocean](https://soundwaterinc-oss.github.io/el-systema-acid/ocean.html)
  - [field](https://soundwaterinc-oss.github.io/el-systema-acid/field/)
  - [mock-instrument](https://soundwaterinc-oss.github.io/el-systema-acid/mock-instrument.html)
- 場で繋ぐときは hub（[hub/server.js](hub/server.js)）を localhost で立て、各楽器を localhost 経由で開く（公開 https から `ws://localhost` は混在コンテンツで弾かれる ─ [hub/README.md](hub/README.md) 参照）。

## 構成

| 部 | 役 | 場所 |
|---|---|---|
| **巫（ユタ・場）** | 御願詞を読み、招き、判示を撃つ | [field/](field/) |
| **ヒヌカン（hub）** | 場の中継、すべての言葉が通る | [hub/](hub/) |
| **葉（control）** | 依代と場の取次 API | [shared/](shared/) |
| **依代（楽器）** | 神が降りる依りどころ | [stone-beats.html](stone-beats.html)、[ocean.html](ocean.html)、[mock-instrument.html](mock-instrument.html) |
| **御願詞（祭文）** | 一場の楽譜 | [liturgy.example.json](liturgy.example.json) |

## 立て方

```bash
# 1. ヒヌカンを立てる（hub）
cd hub && npm i ws && node server.js
# → ws://localhost:8787 で待つ

# 2. 別端末でローカル http サーバを立てる（混在コンテンツ回避のため）
cd ..
python3 -m http.server 8765
# → http://localhost:8765/ で楽器・field が見られる

# 3. ブラウザで依代を開く
#    http://localhost:8765/stone-beats.html
#    http://localhost:8765/ocean.html
#    http://localhost:8765/mock-instrument.html

# 4. 巫を開く
#    http://localhost:8765/field/

# 5. 御願詞を読み込み、「祭を始める」
```

## 単体動作

各楽器は場に繋がなくても**そのまま動く**。葉 API には fallback がある。
[stone-beats.html](stone-beats.html) と [ocean.html](ocean.html) を直接開いてもよい。

## 依代の一覧

| 依代 | 帯域・性格 | 場所 |
|---|---|---|
| **stone-beats** | 打物・金物・低域グリッチ。6 つの石（玄武岩・花崗岩・石灰岩・砂岩・磁石・砂礫）が並列に走る | [stone-beats.html](stone-beats.html) |
| **ocean** | 海。深海・沖・海岸の三層、潮流による有機パン、天候、雨、雷 | [ocean.html](ocean.html) |
| **geometry-scanner** | 別リポ：[soundwaterinc-oss/el-systema-bloom-geometry-generator](https://github.com/soundwaterinc-oss/el-systema-bloom-geometry-generator) |
| **particle-noise** | 別リポ：[soundwaterinc-oss/el-systema-bloom-particle-noise](https://github.com/soundwaterinc-oss/el-systema-bloom-particle-noise) |
| **mock-instrument** | 単体検証用 | [mock-instrument.html](mock-instrument.html) |

## 文書

- [01_語彙と所作と筋書き.md](01_語彙と所作と筋書き.md) ─ 場の語、所作、筋書き（正典）
- [docs/02_仕様書要約.md](docs/02_仕様書要約.md) ─ ユタ儀礼としての要約
- [docs/05_UI設計.md](docs/05_UI設計.md) ─ 自動演奏中の操作（UI）
- [docs/06_設計手順.md](docs/06_設計手順.md) ─ 役の分け方と段階
- [AUDIT.md](AUDIT.md) ─ 設計監査
- [REGISTRY.md](REGISTRY.md) ─ 棚卸しと通り道の選定

## 配分（実装）

- **CC**（Claude Code）─ 仕様書、UI 設計、判定基準、祭文起草
- **Codex** ─ 場側（field / hub / shared）の堅牢化と UI 実装
- **Cline** ─ 器側、葉 API の各依代への差し込み

詳細は [docs/06_設計手順.md](docs/06_設計手順.md)。

## 不変条件

1. 観測は受動（葉 API は信号経路を変えない）
2. 判示は一行で読める（AI は条件に入らない）
3. 揺らぎは招の時に焼く（実刻は記録に残す）
4. 言上は不滅
5. 依代は単体でも動く
6. AI は神籠りに入らない
