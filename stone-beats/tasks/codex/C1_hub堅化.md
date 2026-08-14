# C1 ─ hub の堅さ

## 入力
- 実装：[hub/server.js](../../hub/server.js)（102 行）
- 仕様：[02_仕様書要約.md](../../docs/02_仕様書要約.md)、[hub/README.md](../../hub/README.md)
- メッセージ schema：[shared/el-systema-shapes.js](../../shared/el-systema-shapes.js)

## 出力
[hub/server.js](../../hub/server.js) の修正、必要なら [hub/README.md](../../hub/README.md) 追記。

### 改善項目

#### 1. 切断時のクライアント掃除
- `ws.on("close")` で `console.log` だけ ─ **client 自体の参照は `wss.clients` が自動掃除**するので OK
- ただし**進行中の relay の ack 待ち**がもしあれば、close 時に発火元へ `err` を返す必要あり（現在は relay の ack 機構が hub に無いので追記不要、ただし将来のために TODO コメントを残す）

#### 2. ログ追記の atomic 性
- 現在 `fs.appendFile`（非同期、queue は OS に任せ）─ 同時 6 クライアントから秒間 36 行（kehai 6Hz × 6 器）程度なら問題なし
- ただし**プロセス終了時に in-flight が消える** ─ SIGINT / SIGTERM で `process.on('exit')` を hook して flush（実は appendFile は即書きなので fdatasync は不要、ただし**書き終わるまで exit を待つ**ようにする）
- 提案：`appendLog` を Promise 化、停止時に `Promise.all(pending)` を待つ

#### 3. 同時接続 6+ の詰まり耐性
- 現在 `wss.clients.forEach(c => c.send(s))` ─ N 個の `send` が逐次（同期）。各 send が遅延すれば forEach が固まる
- **対策**：`c.send(s, { compress: false }, () => {})` でコールバック形式（非ブロッキング）に変える
- `c.readyState === 1` 判定はすでに OK

#### 4. WebSocket の error イベント
- 現在 `ws.on("error", ...)` が無い ─ クライアントが ECONNRESET 等で落ちると uncaught exception で hub が死ぬ可能性
- **追加**：`ws.on("error", e => console.warn(...))` で吸収

#### 5. /health で詳細を返す
- 現在 `{ ok, clients: <count> }` のみ
- 追記：`{ ok, clients, uptime, lastMessageAt }`（任意）

## 合格条件
1. 6 クライアント（stone-beats / ocean / mock / mycorrhiza / moss / kagome）が同時接続しても、メッセージが詰まらない（field の節の庭が 6 器すべて応答する）
2. クライアント片方を `Ctrl+C` で殺しても hub プロセスが落ちない
3. 高負荷時（kehai 6Hz × 6 器 = 36 msg/s）でログファイルに重複行や欠損行が無い
4. `SIGINT` で hub を止めた後にログファイル末尾を確認、最後の数行がちゃんと書かれている

## 触ってはいけないもの
- メッセージ schema（[shared/el-systema-shapes.js](../../shared/el-systema-shapes.js)）
- ws パッケージ以外への乗り換え
- ポート 8787（変えるなら `PORT` env で）

## 注意
- 上の改善はすべて**素通し精神**を保つ：hub は形式だけ守って素通し、schema 違反は警告のみで素通し（既に実装済み）
- Bun への乗り換えはこの task のスコープ外（README に書いてある退路）
