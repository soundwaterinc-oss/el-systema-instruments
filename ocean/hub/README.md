# hub ─ 場の中継

役: `ws://localhost:8787` で受け、入ったメッセージを全クライアントへ放るだけ。録は `logs/YYYY-MM-DD.jsonl` に追記。

## 起動

```
cd hub
npm init -y
npm i ws
node server.js
```

`PORT` で番号は変えられる:

```
PORT=8787 node server.js
```

## 確かめる

別端末で:

```
curl http://127.0.0.1:8787/health
# {"ok":true,"clients":0}
```

ブラウザのコンソールから:

```js
const ws = new WebSocket("ws://127.0.0.1:8787");
ws.onopen = () => ws.send(JSON.stringify({ t:"kotodama", from:"console", text:"hello", at: Date.now() }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## 混在コンテンツの正道

**公開（https の pages.dev / github.io）から `ws://localhost` を開くのは取らない。**
Firefox / Safari が遮断、Chrome も `127.0.0.1` 限定の不安定な許容で、`wss://` を自己署名で立てるとハンドシェイクが無言で失敗する罠もある。

正道は単純：

> **casting の間だけ、各器のソースを `python3 -m http.server` と同じローカル http ルートから供する。**

つまり:
- 公開デプロイ（https）は触らず**そのまま**。
- 場と繋ぐときは **`http://127.0.0.1:8000/el-systema-bloom-geometry-generator/`** のようにローカル http で開く。
- これで `http://localhost → ws://localhost` の同origin/同scheme 関係になり、混在コンテンツが起きない。
- 手元に源が無い器（mycorrhiza-beat / moss-reservoir / kagome-sound）は clone するまで場に入れない（REGISTRY blocker A/B/C）。

## 背景タブの注意

- 器タブを **背景にしない**。ブラウザは背景タブの `setInterval` を 1秒級に間引き、`requestAnimationFrame` を止める。kehai の流量と既定 ramp が劣化する。
- 運用：器タブと field タブは別ウィンドウで**同時可視**に並べる。
- 恒久解：第二段完成の宿題として、kehai のクロックを AudioContext / AudioWorklet に移す（音スレッドは間引かれない）。

## 退路

- `ws` パッケージが入らない環境では Bun.serve に差し替え可。メッセージ形は同じ。
