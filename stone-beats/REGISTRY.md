# REGISTRY ─ EL-SYSTEMA 棚卸しと場の通り道（第零段）

作業ディレクトリ: `/Users/nakamuraryuuakira/Desktop/dsktop/EL-SYSTEMA ACID`
日付: 2026-05-18
書き手: CC（読みのみ。移動・改修・clone は提案に留める）

これは第零段の出力。仕様書（`02_仕様書.md`）と指示書（`03_エージェント指示.md`）を正典とし、ローカル源を読みながら、**第二段以降の地図**を一枚にする。推測しない。源に無いものは blocker として書く。

---

## 一・デプロイ↔ローカル源の対応

| 器（仕様書の名） | デプロイ URL | オリジン群 | ローカル源 | git remote | 状態 |
|---|---|---|---|---|---|
| BeatGenerator (mycorrhiza-beat) | https://mycorrhiza-beat.pages.dev/ | A 単独 | clone 済 | `soundwaterinc-oss/mycorrhiza-beat`（React+Vite、branch `main`） | **接続済** ─ L5b 完了 (id=`mycorrhiza-beat`、commit `a522159`) |
| BassGenerator (moss-reservoir) | https://mossreservoir.pages.dev/ | B 単独 | clone 済 | `soundwaterinc-oss/mossreservoir`（React+Vite、branch `EL-SYSTEMA`） | **接続済** ─ L5c 完了 (id=`moss-reservoir`、commit `6b760d9`) |
| 籠目 (kagome-sound) | https://kagome-sound.pages.dev/ | C 単独 | clone 済 | `soundwaterinc-oss/kagome-sound`（単一 HTML、branch `EL-SYSTEMA`） | **接続済** ─ L5a 完了 (id=`kagome-sound`、commit `02ca3da`) |
| ParticleNoise | https://soundwaterinc-oss.github.io/el-systema-bloom-particle-noise/ | D 共有 | `el-systema-bloom-particle-noise/` | `soundwaterinc-oss/el-systema-bloom-particle-noise` (branch `EL-SYSTEMA`) | **接続済** ─ L4 完了 (id=`particle-noise`、commit `d31b46e`) |
| GEO/OSC | https://soundwaterinc-oss.github.io/el-systema-bloom-geometry-generator/ | D 共有 | `el-systema-bloom-geometry-generator/` | `soundwaterinc-oss/el-systema-bloom-geometry-generator` | **接続済** ─ L3 完了 (id=`geometry-scanner`、commit `7ffca51`)。「OSC」はオシレータ名（OSC1/OSC2） |
| CellNoiseGenerator | https://soundwaterinc-oss.github.io/CellnoiseGenerator/public/launch-20260524c.html | F 共有（github.io） | `soundwaterinc-oss/CellnoiseGenerator`（default branch=`EL-SYSTEMA`） | あり | **接続待ち** ─ 別物確定、新 id `cell-noise` で [L4 同型タスク](tasks/cline/L4_particle接続.md) 流用。localhost 配信は廃止 |
| stone-beats | https://soundwaterinc-oss.github.io/el-systema-acid/stone-beats.html | el-systema-acid (Pages) | `stone-beats.html`（単一 HTML） | `soundwaterinc-oss/el-systema-acid` | **接続済** ─ CC L1 |
| ocean | https://soundwaterinc-oss.github.io/el-systema-acid/ocean.html | el-systema-acid (Pages) | `ocean.html`（単一 HTML） | `soundwaterinc-oss/el-systema-acid` | **接続済** ─ CC L2 |
| PLANARIAN DRONE (planarian-drone) | https://planarian-drone.pages.dev/ | G 単独 | `/Users/nakamuraryuuakira/Desktop/dsktop/PLANARIAN-DRONE/`（React+Vite） | `soundwaterinc-oss/planarian-drone` | **接続済** ─ L7 完了 (id=`planarian-drone`、commit `a93f6ca`) |

未対応の所在外（指示書の表に無いがローカルに在る）:

- `el-systema-particle-noise-lab/`（.git 無し、`public/` `src/` `HANDOFF.md`） ─ ParticleNoise の派生／別案か。**用途未確定**。
- `stone-beats.html` ─ 単体器（石の物理から打鼓を組む）。`registerElSystemaInstrument` の fallback 入りで standalone 動作する。場と繋ぐときは `<script src="shared/...">` 三本を `<head>` に足す（葉 API は既に正しい形で呼んでいる）。

---

## 二・各器の外部接面（読みの結果）

### ParticleNoise（`el-systema-bloom-particle-noise/`）
- 実装: plain HTML/CSS/JS。`<script type="module" src="./src/main.js?v=...">`。
- 既存 API（最低限のもの）: `Start Audio` / `Start All` / `Stop` / `Stop All`、`Particle`/`Metallic`/`Physical` の三エンジン。
- マスター出口: `src/audio/master.js` の `createMasterGraph(audioContext)`（未読／呼び出し方から GainNode 状の出口らしい）。`masterGain` パラメータあり。
- 観測候補: マスター出口 GainNode を `AnalyserNode` に分岐すれば「ふるい」の追加足し算で済む。
- 既存 global 取り合い: 仕様書の `geometry-scanner` のように直接 state 露出はしていない。`elements`/`appState` は module スコープ。**外から触る針穴は無い**。
- 危ない点: `state.particles` を中心に UI が動く設計。kehai 注入は `analyser → 既存 destination 系の脇` で完結すること（音は変えない）。

### GEO/OSC（`el-systema-bloom-geometry-generator/`） ─ 本タスクの最右翼
- 実装: plain HTML/CSS/JS。`app.js` が単一の audio engine + UI + scan。
- 既存 API: `Start Audio` / `Start Sequencer` / `Start Autogenesis` / `Pattern Mutation`、layers = `OSC1` / `Drone` / `OSC2`。
- パラメータ多数: `bpm, cutoff, resonance, decay, accent, slide, toneBrightness, grit, masterDrive, noiseMix, clickAmount, harmonics, bassLevel/droneLevel/percussionLevel, osc1Drive, droneDrive, osc2Drive, selectedScale, selectedRootNote, selectedRhythm, selectedFunction, selectedVisual, selectedScanPath, selectedVoices.{bass,drone,percussion}`（指示書 Cline 節と整合）。
- マスター出口: 未読、要確認。スキャナ → 各 voice → 何らかの master sum → destination の単一経路と推定。
- 観測候補: 同上、master sum の前後に AnalyserNode を一本足す（信号経路は変えない）。
- **OSC プロトコル送信**: `grep -i "osc|/osc|udp"` で出るのは UI 上のオシレータ名のみ。**Max/Node への OSC 出力は実装されていない**。仕様書の `GEO/OSC` 表現は **OSC1/OSC2 のオシレータ**を指している可能性が高い。第二段の責務に「OSC 送信」を含めるかは別件、要決定。

### CellNoiseGenerator（正体確定）
- `CellnoiseGenerator/`（branch `EL-SYSTEMA`）の manifest sha256 は `c58979796586afb1bcd760d3c4232592fdf1acd883f8dd5c2768099570d9baf9`。`geometry/*`、SVG presets、bootstrap 群を持つ別実装。
- ワークスペース直下 `public/`+`src/` の manifest sha256 は `4fa1a654400fa75f3fd841f433467e6478b2b92f4c42c6e28a20740412ffebcd`、`el-systema-particle-noise-lab/` は `dd3fcefea40fd798392c17581f82471826df5ed94b07430b6ca063f5933ff334`。
- `el-systema-bloom-particle-noise/` は `2b086ef7a326ec6345630a9a8fd54c5c9813b22b3ca92fc959060e3de956d52a` で、直下コピーとは `src/main.js` と梱包位置の差が中心。
- 判定: 仮説 3。「CellNoiseGenerator」は `particle-noise` 系とは別物で、直下コピーと `el-systema-particle-noise-lab/` は既存 ParticleNoise 派生。
- 次手: 新 id `cell-noise` で L4 同型の接続タスクを起こす。

### `el-systema-particle-noise-lab/`（指示書に無い）
- `public/` `src/` `HANDOFF.md`。.git 無し、由来不明。
- HANDOFF.md は ParticleNoise のもの。
- 仮説: 派生／実験／古いコピー。**判定不能 → blocker E**。

### 不在の器 ─ blocker A / B / C
- mycorrhiza-beat / moss-reservoir / kagome-sound の **ソースが手元に無い**。
- pages.dev デプロイ物しかなく、bundled/minified された JS を読むのは設計監査としては虚しい。
- これらの器に `registerElSystemaInstrument` を差し込む（指示書の「横断差し込み」）には、各々の**ソースリポを clone する必要がある**。clone 自体はユーザ承認案件。

---

## 三・第一段（双方向の心音）の所在 ─ **不在**

指示書・仕様書ともに「正典として既に在る」と言う以下が、**この作業ディレクトリには無い**:

- `shared/el-systema-control.js`
- `field/index.html` / `field.js` / `field.css`
- `liturgy.example.json`
- `mock-instrument.html`
- `01_語彙と所作と筋書き.md`

つまり、CC の第二段（設計監査）も Codex の第二段（弓編の堅牢化）も、**正典が手元に無い前提では始められない**。

考えられる事情:
- 別ディレクトリに在る（別ワークスペース／別リポ）。
- まだ書かれていない（仕様書が宣言だけで、実体は未着手）。
- 共有チャネル経由で渡されたが、ここには着地していない。

**blocker F**: 第一段ファイル群の所在を確認するか、無いなら**ここで初めて書く**必要がある（その場合、第零段の末尾に「正典の起草」が加わる）。

念のため確認: どの器にも `registerElSystema` / `BroadcastChannel` / `WebSocket` / `kehai` の文字列は**現れない**。grep 済み。第一段はコードとしても未注入。

---

## 四・場の通り道 ─ 三案の評価と推し

### 確実な現実
- 五つの器が**四つの別オリジン**に散る:
  - A: `mycorrhiza-beat.pages.dev`
  - B: `mossreservoir.pages.dev`
  - C: `kagome-sound.pages.dev`
  - D: `soundwaterinc-oss.github.io`（ParticleNoise と GEO/OSC が共有）
  - E: `localhost:3212`（CellNoiseGenerator）
- `BroadcastChannel` は**同一オリジンのみ**。
- 既存どこにも場の接続コードは無い。

### 案A・物理集約（全器を一 origin に寄せる）
- 利: BroadcastChannel が単純に動く。心音の往来が最短。
- 害: 独立デプロイを壊す。pages.dev × 3、github.io × 1、ローカル × 1 の運用を畳むコストが大きい。各器が独立に進化してきた経緯（自前 README/SPEC を持つ）を捨てる。**取らない**。

### 案B・ローカル WebSocket 中継（推し）
- ねらい: `ws://localhost:PORT` に薄い中継を一つ立て、各器はそこへ繋ぐ。
- WebSocket は**同一オリジン制約が無い**。各 origin の器は今のまま、`new WebSocket("ws://localhost:8787")` で場へ入れる。
- 移行コスト: 各器に**スクリプト一行と `registerElSystemaInstrument` 呼び出し一回**。既存音源生成・UI操作は破らない。
- 仕様書のメッセージ形（`relay / kehai / ack` …）は通り道に依存せず同形のまま運べる ─ `shared/el-systema-control.js` の send/recv だけが通り道別に分岐する。
- 副産物: ローカル・無料・透明・記録可能（場のメッセージを丸ごとログに落とせる）。
- 将来: Processing / Max / Node が同じ WS に繋がれば、仕様書の「同じ神経系の合奏人」がそのまま実現する。

#### 案B の確かめねば（実機検証 ─ 第零段の末尾でやる）
1. **HTTPS → ws:// 混在コンテンツ**: pages.dev (https) のページから `ws://localhost:8787` を開けるか。
   - Chrome / Edge: `ws://127.0.0.1` と `ws://localhost` は "potentially trustworthy" 扱いで通る見込み。
   - Safari / Firefox: より厳しい。**ブラウザ三種で実機確認**が要る。
   - 通らない場合の選択肢: (a) `wss://` で自己署名証明書、(b) 各器側を Chrome に固定、(c) reverse proxy で同一 origin に集める（案A への退路）。
2. **`file://` は通り道に入れない**: 仕様書通り。各器は必ず http/https で配信。
3. **GitHub Pages の D 共有**: ParticleNoise と GEO/OSC は同一オリジン → 二者間だけは BroadcastChannel が**追加で**使える。WS と二重に流すかは別件。**まずは WS 一本に統一**する方が場の信号が一筋になる。

### 案C・併用（同一オリジン内 BroadcastChannel、跨ぐ分だけ WS）
- 利: 内輪は速い。
- 害: 通り道が二系統になり、保守と耳が割れる。**第二段では取らず、第四段「焼き」で必要が出れば再検討**。

### 結論
**案B 推し**。`shared/el-systema-control.js` の中で通り道だけを抽象化し、メッセージ形（relay / kehai / ack …）は不変のまま、心音の往来を一本の WS に乗せる。各器の移行は「スクリプト一行と register 呼び出し」だけ。

---

## 五・第二段への手渡し（実装の宿題）

### 第零段 → 第二段の橋渡しで CC（設計監査）が読むべき順

1. 第一段の正典（`shared/el-systema-control.js`、`field/` 一式）─ **blocker F が解けてから**。
2. `el-systema-bloom-geometry-generator/app.js` の全長読み（最右翼／差し込み一番手）。
3. `el-systema-bloom-particle-noise/src/main.js` と `src/audio/*`（差し込み二番手）。
4. ワークスペース直下 `src/main.js` / `public/index.html`（**blocker D の同定**が要）。

### Cline（横断差し込み）の出発点
- 指示書通り `geometry-scanner = el-systema-bloom-geometry-generator/` から。
- 差し込みは `index.html` に `<script src="../shared/el-systema-control.js">` 一行と、初期化後の `registerElSystemaInstrument({ id: "geometry-scanner", audioContext, outputNode, … })` 一回。
- 既存の input.value 更新と input イベント dispatch、selected* + rebuildPattern の経路は**そのまま使う**（書き換えない）。
- ただし `shared/el-systema-control.js` が無い限り、import 先が無い。**blocker F 先行**。

### Codex（弓編の堅牢化）の出発点
- 仕様書「九・段階」の第二段。`field/` 側のシナリオ実行、guise の検証、 ramp の rAF、忘記録（ことば）の不滅。
- これも正典が手元に無いので **blocker F 先行**。

---

## 六・blocker 一覧（CC が解けないので上げる）

| ID | 内容 | 解き手 |
|---|---|---|
| **A** | mycorrhiza-beat のソース不在 | ユーザに clone 場所を確認、または取得を承認 |
| **B** | moss-reservoir のソース不在 | 同上 |
| **C** | kagome-sound のソース不在 | 同上 |
| **D** | ~~ワークスペース直下 `public/`+`src/` ＝ 仕様書の「CellNoiseGenerator」か？ `el-systema-bloom-particle-noise` との関係は？~~ → **解消**。直下 `public/`+`src/` は CellNoise 本体ではなく ParticleNoise 派生 | 解消 |
| **E** | ~~`el-systema-particle-noise-lab/` の用途~~ → **解消**。同ディレクトリも ParticleNoise 派生の別包みで、CellNoise 本体は `CellnoiseGenerator/` | 解消 |
| **F** | 第一段の正典（`shared/`、`field/`、`01_…筋書き.md`、`liturgy.example.json`、`mock-instrument.html`）の所在 | ユーザに別ディレクトリの位置を教えてもらう、または「ここで起草」を承認 |
| **G** | 仕様書の「GEO/OSC」は OSC プロトコル送信を含意するか／オシレータ名の意か | ユーザに意図を確認 |
| **H** | ~~案B の HTTPS pages.dev → `ws://localhost:` 混在コンテンツ、ブラウザ三種での実機確認~~ → **sidestep 採用**: casting 中は手元クローンを local http から供する。混在コンテンツ自体が起きない。AUDIT D1 参照 | 解消（local-http で迂回）。blocker A/B/C を解けば全器同じ扱い |

---

## 七・実行待ち（ユーザ承認案件）

第零段は読みまで。以下は提案。実行はユーザの承認を待つ:

1. blocker A / B / C: 三器のソースリポを clone する場所を決め、`mycorrhiza-beat/`・`moss-reservoir/`・`kagome-sound/` として手元に置く。
2. blocker F: 第一段の正典をどこから引き取るか、または**ここで起草する**かを決める。
3. blocker D / E / G: ユーザの一言で解ける名・意の確認。
4. blocker H: pages.dev × 3 を Safari / Firefox / Chrome で開き、開発者ツールから `new WebSocket("ws://127.0.0.1:8787")` を叩いて開く／拒まれるを確かめる。WS サーバは仮で `python -m websockets`、`websocat` 等で十分。

---

## 八・録（記録）

- 走査で鍵・.env・秘密は見ていない。表に書いていない。
- 編集はしていない。新規作成はこの `REGISTRY.md` 一つだけ。clone・移動はしていない。
- 推測は推測と明記。整合は整合と明記。
