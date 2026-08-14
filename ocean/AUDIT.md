# AUDIT ─ EL-SYSTEMA 第二段 設計監査

`REGISTRY.md` を前提とする。ここは読みのみ。実装は Codex / Cline へ。

監査対象は本来「仕様書 ＋ 既存第一段コード（`shared/el-systema-control.js` / `field/`）」だが、第一段コードは手元に無い（**blocker F**）。よって本書は：

- **仕様書のみ**を正典とした設計監査
- 手元に在る既存器（geometry-scanner, particle-noise）の構造に照らしての**差し込み実現可能性**
- 第一段の API・メッセージ骨子の**起草**（Codex が書く前の設計図）

の三層で書く。第一段の正典が後から現れたら本書を上書きする。

---

## 一・既存器の構造に照らした不変条件の検証

### geometry-scanner（`el-systema-bloom-geometry-generator/app.js` 2206行）

仕様書の不変条件と現状の整合:

| 不変条件 | 現状 | 評価 |
|---|---|---|
| 観測は受動・信号経路を変えない | `state.masterBus → state.analyser → destination`（`app.js:402-403`）が**既存**。analyser はループ用に作られている | **そのまま借りられる**。新規 AnalyserNode を足す必要すら無い |
| 既存手動UI操作と同じ次数の操作で同結果 | tab 系は `state.selectedX = value; rebuildPattern(...)`（`app.js:251-301`）、slider 系は input イベント経由で `rebuildPattern(id === "harmonics")` | **完全な対応**。Cline 指示の選択肢8（selected*→state mutate→rebuild）と一致 |
| 既存器を壊さないラッパー方式 | `state` は module スコープ、外からは触れない | **針穴は無いが、必要も無い**。`registerElSystemaInstrument` 内に小さな adapter を Cline が書く |
| ハンジ規則は人が一行で読める | 仕様書 §五の JSON 形式は人読み可 | OK |
| 待ちの揺らぎは宣言、実刻は記録 | 仕様書 §五「実刻は casting 開始時に確定、記録に必ず残す」 | 第一段で実装すべき。`field/` 不在のため確認不能 |

結論: **既存器は第一段差し込みに対して開いている**。書き換えは零。

### particle-noise（`el-systema-bloom-particle-noise/`、`./public+./src/`）

| 不変条件 | 現状 | 評価 |
|---|---|---|
| 既存マスター出口 | `src/audio/master.js::createMasterGraph(audioContext)` ─ 未読、要 Codex 読了 | 同型と推定（master GainNode→destination） |
| `setParams({ masterGain, rate, size, density, brightness, scatter, randomness, level, bandwidth, delay, reverb })` がエンジンごとに存在 | `src/main.js:204-213` | パラメータ名がそろっており Cline の `setParam` は機械的に橋を渡せる |
| play / stop / start All / stop All | `appState.engines[name].start()/stop()/stopAll()` | 整合 |

結論: 同型ラッパー方式で **geometry-scanner と並走可**。Cline 第二弾候補。

### blocker F の影響範囲

第一段コードが手元に無い結果、以下の不変条件は**未検証**:
- カスト中の状態整合性（複数 ramp の競合解決）
- 沈黙判定（`everSpoke` の取得タイミングと境界）
- relay/kehai/ack のメッセージ schema
- `target: "all"` と `target: "<id>"` の dispatcher
- `getKehai()` の API（仕様書 §三）

これらは仕様書から逆算して**起草**する（後述 §四）。

---

## 二・第二段の全体設計

### 2.1 アーキテクチャ

```
┌──────────── 場 (channel) ─────────────────────────────────┐
│                                                              │
│  ws://localhost:8787  ←─ 第一段の通り道（案B）              │
│         │                                                    │
│  ┌──────┴──────────────┬──────────────┬──────────────────┐ │
│  ▼                     ▼              ▼                  ▼  │
│ 巫（field/）        器 geo         器 particle        器 …  │
│  ├ ガイス読込       ├ register      ├ register             │
│  ├ 御題派遣          ├ kehai 6Hz    ├ kehai 6Hz             │
│  ├ ハンジ評価        ├ relay 受け   ├ relay 受け            │
│  ├ 神籠り loop      ├ ack 返し     ├ ack 返し              │
│  ├ 言葉（記録）      └ ramp/state    └ ramp/state           │
│  └ 遊（空の輪・節・羽い・波紋）                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

中継（ws hub）は薄い JS（Node または Bun）。受けたメッセージを全員に放つだけ。

### 2.2 ファイル構成（第二段で在るべきもの）

```
EL-SYSTEMA ACID/
├ shared/
│   ├ el-systema-control.js     # 葉 API（registerElSystemaInstrument）
│   ├ el-systema-transport.js   # 通り道（WS / BroadcastChannel の抽象）
│   └ el-systema-shapes.js      # メッセージ schema と型ガード
├ field/
│   ├ index.html                # 巫の場（ブラウザ）
│   ├ field.js                  # 神籠り loop、御題派遣、ハンジ評価
│   ├ field.css                 # 空の輪・節・羽い・波紋
│   ├ names.js                  # 場のチャンネル名・巫の役の語・祭次/招/応答/記上の表示語
│   └ liturgy.example.json      # 例ガイス
├ hub/                          # ★ 新規・第一段に無い
│   ├ server.js                 # ws hub（Node 標準 + ws パッケージ、または Bun.serve）
│   └ README.md                 # 起動法
├ mock-instrument.html          # register API の単体検証
├ el-systema-bloom-geometry-generator/  # Cline 第一差し込み先
├ el-systema-bloom-particle-noise/      # Cline 第二差し込み先
└ REGISTRY.md / AUDIT.md
```

第一段の正典に `hub/` が**入っていない**のは仕様書通り（同一オリジン BroadcastChannel 前提）。第零段で「現実と衝突する」と判定したので、案B として `hub/` を新設する。`shared/el-systema-transport.js` で通り道を抽象化すれば、将来 BroadcastChannel に戻すことも残せる。

### 2.3 葉 API（`registerElSystemaInstrument` 起草）

```js
// shared/el-systema-control.js
window.registerElSystemaInstrument({
  id: "geometry-scanner",         // 必須・場で一意
  audioContext: state.audioContext,   // 任意（生音から気配を読む）
  outputNode: state.masterBus,        // 任意（destination ではなく master sum）

  // 御題受け（巫から来る相）。target=自id または "all" のとき発火
  onPlay:    () => { /* 既存 toggleTransport 相当 */ },
  onStop:    () => { /* 既存 stop 相当 */ },
  onSetParam:(name, value) => { /* 既存 input 反映 */ },
  onRamp:    (name, from, to, duration) => { /* rAF で滑らかに */ },
  onLoadPreset: (preset) => { /* 既存 state へ反映＋rebuildPattern */ },
  onSnapshot: () => ({ /* 主要パラメータと selectedX を JSON で */ }),

  // 任意・通り道を介さない直接観測 API
  getKehai: () => ({
    presence: 0..1,    // RMS の対数圧縮、ヒステリシス入り
    low: 0..1,         // ローバンドエネルギー
    high: 0..1,        // ハイバンドエネルギー
    everSpoke: bool,   // 一度でも presence > τ_speak を超えたか
    lastSpokeAt: ms,   // 直近で超えた audioContext.currentTime
  }),
});
```

**観測の不変条件**:
- `outputNode.connect(analyser)`、`analyser.connect(destination)` は**しない**。observer は既存 analyser を共有するか、`outputNode.connect(observerAnalyser)` で **「足すだけ」** とし、`observerAnalyser` は dangling（どこへも繋がない）。
- 既存に `state.analyser` が在る器（geometry-scanner）は **observer を新設せず、既存を借りる**。
- particle-noise のように master.js が GainNode を返す型は、その GainNode に observer を**追加 connect**する。

**メッセージ relay 受けの id 解釈**:
- `target === id` または `target === "all"` のみ反応
- 他 id 宛は黙って捨てる（フィルタ）
- `ack` は relay を実際に消化したときだけ返す

### 2.4 メッセージ形（`shared/el-systema-shapes.js` 起草）

```jsonc
// 御題（巫→器）─ ※relay.target は target に固定（ramp の to と衝突回避）
{ "t": "relay", "target": "geometry-scanner", "cmd": "play" }
{ "t": "relay", "target": "geometry-scanner", "cmd": "stop" }
{ "t": "relay", "target": "geometry-scanner", "cmd": "setParam", "name": "droneLevel", "value": 0.42 }
{ "t": "relay", "target": "all",              "cmd": "ramp", "name": "masterDrive", "from": 0.2, "to": 0.7, "dur": 28000, "startAt": 1234567 }
{ "t": "relay", "target": "geometry-scanner", "cmd": "loadPreset", "preset": { "selectedScale": "1/f Harmonic", ... } }

// 気配（器→場、6Hz 流し）
{ "t": "kehai", "from": "geometry-scanner", "presence": 0.42, "low": 0.31, "high": 0.18, "everSpoke": true, "at": 1234567 }

// 静寂宣言（器→場、everSpoke==true かつ presence<τ_quiet 持続 N秒）
{ "t": "silence", "from": "geometry-scanner", "since": 6.2, "at": 1234567 }

// 応答・誤り
{ "t": "ack",  "from": "geometry-scanner", "of": "<元 relay の id 等で参照>", "ok": true,  "at": 1234567 }
{ "t": "err",  "from": "geometry-scanner", "of": "...",                      "msg": "unknown param: foo" }

// 招（巫→場、casting 開始の宣言・実刻を確定）
{ "t": "maneki", "guise": "<file or hash>", "startAt": 1234567 }
{ "t": "kotodama", "from": "field", "text": "東より、根が芽を見ます…", "at": 1234567 }
```

**設計判断**:
- `t`（type）は短く一文字級（`relay/kehai/silence/ack/err/maneki/kotodama`）。仕様書の語を keep。
- `at` は **すべてのメッセージに必須**。実刻の不滅。
- 揺らぎ（`揺` ±）は巫が `maneki` を撒く瞬間に解決済みの `startAt` で焼く。器側で乱数しない。
- `relay` には `id` フィールドを付与し、ack/err は `of: <id>` で参照。

### 2.5 場の信号の意味論（仕様書 §四の具象化）

| 信号 | 取得元 | 計算 |
|---|---|---|
| `presence:<id>` | 器の kehai.presence | RMS（256サンプル幅）→ 対数圧縮 → ヒステリシス（上 0.06／下 0.04）。0..1 |
| `silence:<id>` | 器側で算出、`silence` メッセージ送出 | `everSpoke == true` かつ `presence < τ_quiet (=0.05)` が `dur` 秒継続したとき `since=dur` |
| `density` | 場側で集計 | `sum(kehai.presence over all instruments) / n` |
| `low` / `high` | 各器の kehai.low/high → 場側で平均 | 同 |

**境界事例の処置**（仕様書 §三の沈黙の定義に照らして）:

- **everSpoke 取得遅延**: 器が start 直後でまだ一度も鳴っていないとき、`presence < τ_quiet` を満たしていても **silence にしない**。`everSpoke = false` のまま「未鳴」状態として保つ。仕様書「鳴っていなければ 0（まだ鳴っていない＝沈黙ではなく未鳴）」と一致。
- **stop による静まり**: stop されたら `everSpoke` は維持する（履歴を失わない）。再 start で `everSpoke` は維持されたまま判定再開。
- **`持続` のリセット条件**: ハンジ条件が満たされた瞬間に内部タイマーをスタート、条件が崩れた瞬間にリセット。場側で持つ。
- **`冷却`**: 条件再達成までの抑制。`一度:true` が立っているハンジは **冷却を見ない**（既に発火済み）。

### 2.6 ramp 競合の解決

- 同 id × 同 param に同時に二つの ramp が来た場合、**後勝ち**。先行は即座に `cancelScheduledValues(audioContext.currentTime)` 後、現在値からの線形補間を新規スケジュールへ置換。
- stop（明示）が来たら、その器に向かう全 ramp を畳む（rAF を `cancelAnimationFrame`、Web Audio param は `cancelScheduledValues`）。
- 巫の「鎮める」（relay stop all）も同様に**全器の全 ramp を畳む**。state の `selectedX` は触らない。

### 2.7 ガイス文法の検証

`liturgy.example.json` の文法に対し、巫の起動時に静的検査:

1. **必須キー**: `album / track / 楽器 / 祭次 / 応答`。
2. **未知の信号名**: `信号` が `presence:<id>` / `silence:<id>` / `density` / `low` / `high` のいずれかで、id 部が `楽器` 配列に在ること。
3. **未知の target**: `祭次` および `応答.為` の `target` が `楽器` 配列に在ること（`"all"` は許す）。
4. **未知の command**: `play / stop / setParam / ramp / loadPreset / snapshot`。
5. **応答に AI を入れない**: `応答[i].為` が一個の発火に閉じている（条件分岐や eval を含まない）。
6. **覚え書きを言葉に流す**: `綴び` を JSON 起動時に画面（言上）へ書き出す（未知文字も人語のまま）。

検査で落ちたら casting は**始めない**。窓に静かに「祭が読めません: …」を出すだけ。

---

## 三・危険・注意点

### D1. 通り道の混在コンテンツ（正道は local-http 供給）
pages.dev / github.io（https）から `ws://localhost` を直接開くのは**取らない**:
- Firefox / Safari は遮断、Chrome も 127.0.0.1 限定の不安定な許容。
- `wss://` 自己署名は WSS ハンドシェイクが無言で失敗する罠あり。Chrome 固定は当てにならない。

**正道（採用）**: casting の間だけ、器のソースを `python3 -m http.server` と同じローカル http ルートから供する。
- 公開デプロイは無傷で残す。
- 場接続時は `http://127.0.0.1:8000/el-systema-bloom-geometry-generator/` 等で開く → `http→ws` 同origin同scheme で混在無し。
- 手元に源が無い器（mycorrhiza-beat / moss-reservoir / kagome-sound）は **clone してから**場に入れる（REGISTRY blocker A/B/C）。
- 結果: REGISTRY blocker H は「ブラウザ三種実機テスト」から「local-http で sidestep」に変わる。実機テストは不要化。

### D2. casting 中の状態不整合
- 巫が `loadPreset` を撒いている最中に手動 UI を回す → 競合。
- 方針: `loadPreset` 受信時、その器は **手動操作を 200ms 黙殺**（巫の信頼ウィンドウ）。ただし操作自体は記録（言上に残す）。
- 仕様書「忘れもの＝言上に残す」を守る。

### D3. ramp 競合（前述、2.6）
- 同 param 多重ramp、stop 競合、巫の鎮める優先。

### D4. 沈黙の境界（前述、2.5）
- everSpoke 未取得時の silence 偽陽性回避。
- stop 後の everSpoke 維持。
- 冷却と一度=true の相互作用（一度=true は冷却を無視）。

### D5. BroadcastChannel と WS の混在
- 案C 併用は**取らない**（第二段では）。通り道は一筋。
- D オリジン（github.io 二器）の BroadcastChannel 使いたい誘惑が出るが、第二段では我慢する。第四段「焼き」で必要なら再検討。

### D6. 既存器を壊さない差し込み箇所
- geometry-scanner: `app.js` 末尾、`init()` 後（state.audioContext が立った後）に `if (window.registerElSystemaInstrument) registerElSystemaInstrument({...})`。
- particle-noise: `src/main.js` の `startAudio()` 内、`appState.masterGraph` 生成後（`syncMasterGain()` の前）。
- どちらも script タグ追加は `<head>` の最後または `<body>` 末で、`type="module"` を**付けない**（グローバル `window.registerElSystemaInstrument` を露出するため）。

### D6.5. 背景タブの間引き
ブラウザは背景タブの `setInterval` を 1秒級に間引き、`requestAnimationFrame` を停める。器タブを背景にすると kehai 流量が劣化し、既定 ramp が止まる。
- 運用: 器タブと field タブを**別ウィンドウで同時可視**に並べる。
- 恒久解（第二段完成宿題）: kehai のクロックを AudioContext.currentTime / AudioWorklet に移す（音スレッドは間引かれない）。

### D7. AudioContext の所有
- 仕様書「AudioContext は一つ、複数なら**マスター出口バス**」。
- 既存器は各々一個。**第一段から AudioContext を生成しない**。器が立てた `audioContext` を受け取って観測のみ。

### D8. file:// 不可
- 各器は必ず http(s) で配信。デプロイ済み URL を使う、または `python -m http.server` 等。
- 第一段の `field/` も同じ。直開きしない。

---

## 四・他エージェントへの実装タスク分解

### Codex（弓編の堅牢化＋第一段の起草）

**Codex P0（blocker F の解消）**:
1. `shared/el-systema-control.js` を書く（本書 §2.3）。
2. `shared/el-systema-transport.js` を書く（WS / BroadcastChannel の抽象、案B 既定）。
3. `shared/el-systema-shapes.js` を書く（本書 §2.4 の schema と型ガード）。
4. `hub/server.js` を書く（Node + `ws` パッケージ、または Bun.serve）。受けたメッセージを全クライアントへ放流。ログを JSONL で残す。
5. `mock-instrument.html` で register API 単体動作確認（巫無し）。

**Codex P1（第二段の本体）**:
6. `field/index.html` `field/field.js` `field/field.css` を書く（仕様書 §四・五・七）。
7. `field/names.js`（場のチャンネル名、巫の役の語、祭次/招/応答/記上の表示語の集約）。
8. ガイス読込と静的検査（本書 §2.7）。
9. 神籠り loop / 御題派遣 / ハンジ評価エンジン / ramp の rAF / 沈黙判定の境界処置（本書 §2.5）。
10. 言葉（kotodama）の不滅な記録、画面言上。
11. `liturgy.example.json` を書く（仕様書 §五の例を骨子に、本書 §2.5 の信号で書き起こす）。
12. 鎮める／戻す／空に戻る の処置（仕様書 §三）。
13. 空の輪・節・羽い・波紋の絵（VUメーター調にしない）。

### Cline（横断差し込み・既存器に葉を埋める）

**Cline P0**:
1. `el-systema-bloom-geometry-generator/index.html` に `<script src="../shared/el-systema-control.js">` 一行追加。
2. `app.js` の `init()` 末尾に `registerElSystemaInstrument({ id: "geometry-scanner", audioContext: state.audioContext, outputNode: state.masterBus, ... })` の一回呼び出し。
3. 葉 API のハンドラを書く（既存の `toggleTransport / 各 input dispatch / state.selectedX 反映 + rebuildPattern` を呼ぶだけ）。
4. `getPreset()` / `loadPreset(p)` を実装（本書 §2.3 の主要パラメータ、`state.selected*` を含む）。
5. 自動テスト: 「手動UIで触ったときと、御題で動かしたときに、結果が一致する」を console ログで確認。

**Cline P1**:
6. particle-noise（github.io 版）にも同様の差し込み。
7. ワークスペース直下 `public/+src/` に **blocker D 解消後**、必要なら差し込み。

**Cline P2（blocker A/B/C 後）**:
8. mycorrhiza-beat / moss-reservoir / kagome-sound の clone 着地後、同様の差し込み。

### CC（自分の第三段以降）

- 第三段（仕様書 §九）: 子相のガイスと album manifest、相違の渡り。
- 第四段（焼き）: 複数 casting から正典を OfflineAudioContext で固定。
- 第五段: Processing 合奏人。

---

## 五・MVP（最小）と完成（第二段）の差分

### 第二段 MVP（最小で「場が形を持つ」と言える線）

1. `hub/server.js` が立つ。
2. `shared/el-systema-control.js` の register API が**最低限**動く（id、relay 受け、kehai 送り 1Hz でよい）。
3. `field/index.html` で**一個のガイス**（`liturgy.example.json`）を頭から最後まで走らせる。
4. **geometry-scanner 一器**にだけ差し込みが入っている。
5. 御題（play / stop / setParam / ramp / loadPreset）が手動UIと**同じ次数の操作と同結果**。
6. 鎮める（relay stop all）が効く。
7. 言上が消えない（画面ログ）。

これで仕様書「ご趣意」の核 ─ 巫が場を読みつつ器が気配を返す ─ が実体化する。約 800-1200 行を見込む（shared 200、field 500、hub 100、liturgy 50、test 100）。

### 第二段 完成

MVP に加えて:

- particle-noise（github.io 版）も差し込み済み。**二器並走**。
- 沈黙判定の境界処置（everSpoke、冷却、一度）すべて。
- ramp 競合解決、stop の畳み込み。
- ガイス静的検査、未知信号名/未知 target/未知コマンドのはじき。
- 場の絵（空の輪・節・羽い・波紋）すべて。
- ロック画面（mock-instrument.html）での register API 単体検証。
- 言上の JSONL 永続記録。

完成しても **manifest（相違の渡り）・複数器 broadcast・焼きは入らない**。それは第三段／第四段。

---

## 六・未決・ユーザへの確認（AUDIT 由来）

REGISTRY blocker に加えて、本書の起草内容に対しての確認:

| ID | 内容 | 既定の案 |
|---|---|---|
| **AU1** | 通り道 案B（ws hub）で固める | ✅ 推し |
| **AU2** | メッセージ schema の語: `t/from/to/at/cmd/id/of` を採用 | ✅ 推し |
| **AU3** | maneki/kotodama の語を巫メッセージにも使う | ✅ 推し（仕様書の語の延長） |
| **AU4** | ガイス JSON の表記は**日本語キー優先**、英語キーも別名で許す | 仕様書通り。両方走らせる |
| **AU5** | hub のランタイム: Node + `ws` パッケージ vs Bun.serve | Node + `ws`（依存軽い） |
| **AU6** | 第一段ファイルを**ここで起草**する（blocker F を解く）か、別ディレクトリから引き取るか | ユーザに確認 |

---

## 七・録（記録）

- 本書は読みのみ。新規ファイルは `AUDIT.md` のみ。
- 既存器は触っていない。
- 推測は推測と明記。
- 第一段コードが手元に現れたら本書を**当該節だけ上書き**し、起草内容を消す（事実が優先）。
