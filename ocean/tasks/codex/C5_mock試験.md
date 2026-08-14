# C5 ─ mock-instrument を試験台に

## 入力
- 既存：[mock-instrument.html](../../mock-instrument.html)
- 接続契約：[docs/09_接続契約.md](../../docs/09_接続契約.md)
- 葉 API：[shared/el-systema-control.js](../../shared/el-systema-control.js)

## 出力
[mock-instrument.html](../../mock-instrument.html) を**葉 API の全コマンド往復試験**に育てる。本格的な楽器は不要、`registerElSystemaInstrument` への入出力をすべて UI で見えるように。

### 表示すべきもの

```
┌─────────────────────────────────────────────────┐
│ mock-instrument                                  │
│ [接続灯：●緑]  ws://localhost:8787              │
├─────────────────────────────────────────────────┤
│ 受け取った御題（最新 20 件）                     │
│ ▸ play     at 12:34:56                          │
│ ▸ setParam name=cutoff value=0.7  at 12:34:58   │
│ ▸ ramp name=master from=0 to=1 dur=5 ...        │
│ ▸ stop     at 12:35:01                          │
├─────────────────────────────────────────────────┤
│ 送る kehai：[●sim]  presence: [---|---] 0.42    │
│ 鳴る／止む：[Start] [Stop]                       │
├─────────────────────────────────────────────────┤
│ 状態の snapshot：                                │
│ { everSpoke: true, lastPlay: ..., params: {...} }│
└─────────────────────────────────────────────────┘
```

### 実装の最小形

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"><title>mock-instrument</title>
<style>/* 簡素な mono 系 */</style>
</head>
<body>
<div id="conn">未接続</div>
<div id="received"></div>
<button id="start">Start</button>
<button id="stop">Stop</button>
<div id="snapshot"></div>

<script src="shared/el-systema-shapes.js"></script>
<script src="shared/el-systema-transport.js"></script>
<script src="shared/el-systema-control.js"></script>
<script>
const ac = new (window.AudioContext || window.webkitAudioContext)();
const master = ac.createGain();
master.connect(ac.destination);

// 鳴り：単純なノイズ + LP（実音を出して kehai を出させる）
let noiseSrc = null;
function noiseOn() {
  if (noiseSrc) return;
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0; i<d.length; i++) d[i] = Math.random()*2-1;
  noiseSrc = ac.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true;
  const lp = ac.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=1200;
  const g = ac.createGain(); g.gain.value=0.05;
  noiseSrc.connect(lp); lp.connect(g); g.connect(master);
  noiseSrc.start();
}
function noiseOff() {
  if (!noiseSrc) return;
  noiseSrc.stop(); noiseSrc = null;
}

const params = {};   // 受け取った setParam を全部入れる
const received = []; // 受信履歴

function logReceived(label, payload) {
  received.unshift({ at: new Date().toLocaleTimeString(), label, payload });
  if (received.length > 20) received.length = 20;
  document.getElementById("received").textContent =
    received.map(r => `▸ ${r.label} ${JSON.stringify(r.payload)}  at ${r.at}`).join("\n");
  document.getElementById("snapshot").textContent = JSON.stringify({ playing: !!noiseSrc, params }, null, 2);
}

registerElSystemaInstrument({
  id: "mock-instrument",
  audioContext: ac,
  outputNode: master,
  play:  () => { logReceived("play", {});   noiseOn(); },
  stop:  () => { logReceived("stop", {});   noiseOff(); },
  setParam: (name, value) => { logReceived("setParam", {name, value}); params[name] = value; },
  ramp: (name, from, to, dur) => { logReceived("ramp", {name, from, to, dur}); params[name] = to; /* 簡略 */ },
  loadPreset: (preset) => { logReceived("loadPreset", preset); Object.assign(params, preset); },
  snapshot: () => ({ playing: !!noiseSrc, params: {...params} }),
});

document.getElementById("start").onclick = noiseOn;
document.getElementById("stop").onclick  = noiseOff;
</script>
</body>
</html>
```

### 試験プロトコル（手動 & 半自動）

[mock-instrument.html](../../mock-instrument.html) を場に上げた後、field から以下を順に送って受信欄を確認：

1. `play` を送る → 受信欄に `play` が出る、ノイズが鳴る
2. `setParam cutoff=0.5` → 受信欄に出る、`snapshot` に反映
3. `ramp master 0→1 dur=5` → 受信欄に出る、5 秒後 snapshot の master=1
4. `loadPreset {a:1, b:2}` → 受信欄に出る、snapshot.params に a/b
5. `stop` → 受信欄、ノイズ停止
6. 6 秒待つ → hub のログに `silence` が現れる
7. `kotodama from:"user"` を field から送る → mock 側 hub ログにのみ現れる（mock は kotodama を直接受けない）

## 合格条件
1. 上の 7 ステップが**すべて成功**
2. hub の jsonl ログに往復が完全に残っている
3. mock 側を再 load しても再接続が成立
4. mock を二つ開くと「id 衝突」を `err` で hub が返す（→ schema 修正 task 別、ここは確認のみ）

## 触ってはいけないもの
- shared/ の三本
- hub/server.js

## 注意
- mock は**鳴ること**が大事（kehai を実際に出す）─ ただし耳に痛くないノイズで
- 既存 [mock-instrument.html](../../mock-instrument.html) があるならその構造を残しつつ強化する
