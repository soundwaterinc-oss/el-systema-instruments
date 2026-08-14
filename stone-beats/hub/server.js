// EL-SYSTEMA ─ 中継（hub）
//
// 役: ws://localhost:8787 で受け、入ったメッセージを全クライアントへ放るだけ。
// 録: 受けたメッセージを JSONL で logs/YYYY-MM-DD.jsonl に追記（消えない言上）。
// 依存: ws (npm i ws) ── Node 標準では WS サーバが書けないため。
//
// 起動: node hub/server.js  （または PORT=8787 node hub/server.js）
//
// 退路: ws パッケージが入れられない環境では Bun.serve に差し替えてよい。
//       メッセージ形は同じ。

const fs = require("fs");
const path = require("path");
const http = require("http");

const PORT = parseInt(process.env.PORT || "8787", 10);
const LOG_DIR = path.join(__dirname, "..", "logs");
const STARTED_AT = Date.now();
const SHUTDOWN_WAIT_MS = 5000;
let lastMessageAt = null;

let WebSocketServer;
try {
  WebSocketServer = require("ws").Server;
} catch (e) {
  console.error("[el-systema/hub] 'ws' パッケージが要ります: cd hub && npm i ws  または  npm i ws --prefix hub");
  process.exit(1);
}

// shared/el-systema-shapes.js を兄弟ディレクトリから読む
let Shapes = null;
try {
  Shapes = require("../shared/el-systema-shapes.js");
} catch (_) {
  console.warn("[el-systema/hub] shapes 検査は使わず素通しで動きます");
}

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function logFile() {
  // 日付の切り替わりは Node プロセスのローカル timezone に従う。
  // 現運用は localhost 想定なので、通常は起動マシンの JST で YYYY-MM-DD が焼かれる。
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `${yyyy}-${mm}-${dd}.jsonl`);
}

// 書き込み中の pending を追う。終了時は全完了を待つ。
const pendingWrites = new Set();

function appendLog(line) {
  let done = null;
  const p = new Promise(function (resolve) { done = resolve; });
  pendingWrites.add(p);
  fs.appendFile(logFile(), line + "\n", function (err) {
    if (err) console.error("[el-systema/hub] log write failed:", err.message);
    pendingWrites.delete(p);
    done();
  });
  return p;
}

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[el-systema/hub] ${signal} 受信、ログフラッシュ中... (pending=${pendingWrites.size})`);

  httpServer.close(function () {
    console.log("[el-systema/hub] http server closed");
  });

  wss.clients.forEach(function (client) {
    try { client.close(); } catch (_) {}
  });

  const flushAll = Promise.allSettled(Array.from(pendingWrites));
  const timeout = new Promise(function (resolve) {
    setTimeout(function () { resolve("timeout"); }, SHUTDOWN_WAIT_MS);
  });

  Promise.race([flushAll, timeout]).then(function (result) {
    const timedOut = result === "timeout";
    if (timedOut) {
      console.error(`[el-systema/hub] 強制終了 (まだ ${pendingWrites.size} 件の書き込み中)`);
    } else {
      console.log("[el-systema/hub] ログフラッシュ完了、終了します");
    }
    wss.close(function () {
      process.exit(timedOut ? 1 : 0);
    });
  }).catch(function (err) {
    console.error("[el-systema/hub] shutdown error:", err && err.message ? err.message : err);
    process.exit(1);
  });
}

process.on("SIGINT", function () { gracefulShutdown("SIGINT"); });
process.on("SIGTERM", function () { gracefulShutdown("SIGTERM"); });

function safeSend(ws, payload) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(payload, { compress: false }, function (err) {
      if (err) console.warn("[el-systema/hub] send failed:", err.message);
    });
  } catch (err) {
    console.warn("[el-systema/hub] send threw:", err && err.message ? err.message : err);
  }
}

// 最小の HTTP サーバ（ヘルスチェック /health）
const httpServer = http.createServer(function (req, res) {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      clients: wss ? wss.clients.size : 0,
      uptime: Math.round((Date.now() - STARTED_AT) / 1000),
      lastMessageAt: lastMessageAt,
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", function (ws, req) {
  const peer = (req.socket && req.socket.remoteAddress) || "?";
  console.log(`[el-systema/hub] + ${peer}  (now=${wss.clients.size})`);

  ws.on("message", function (raw) {
    let s;
    try { s = raw.toString("utf8"); } catch (_) { return; }
    lastMessageAt = Date.now();
    let m;
    try { m = JSON.parse(s); } catch (_) {
      safeSend(ws, JSON.stringify({ t: "err", from: "hub", of: "?", msg: "bad json", at: Date.now() }));
      return;
    }
    // hub は「通り道は形式のみ」を守る ─ schema 不整合でも素通しし、警告だけ送信者に返す。
    // クライアントだけ schema が進んだ場合に hub が無言で単一障害点にならぬよう。
    appendLog(s);
    if (Shapes && !Shapes.isValid(m)) {
      console.warn("[el-systema/hub] schema invalid (passing through):", s.slice(0, 200));
      safeSend(ws, JSON.stringify({ t: "err", from: "hub", of: (m && m.id) || "?", msg: "schema invalid (passed through)", at: Date.now() }));
    }
    // 送信者除外で放る:
    //   - 御題/招の二重記録（field が自分で pushKotodama→ echo で再 push）を消す
    //   - 器 N 台での N×N×6Hz kehai 扇形増殖を畳む
    //   - 自分の relay の ack を見たいときは hub が個別 ws.send で返すので別件
    wss.clients.forEach(function (c) {
      if (c !== ws && c.readyState === 1) {
        safeSend(c, s);
      }
    });
  });

  ws.on("error", function (err) {
    console.warn("[el-systema/hub] client error:", err && err.message ? err.message : err);
  });

  ws.on("close", function () {
    // TODO: 将来 relay の hub 側 ack 待ちを持つなら、ここで発火元へ err を返す。
    console.log(`[el-systema/hub] - ${peer}  (now=${wss.clients.size})`);
  });
});

httpServer.listen(PORT, "127.0.0.1", function () {
  console.log(`[el-systema/hub] listening ws://127.0.0.1:${PORT}`);
  console.log(`[el-systema/hub] logging to ${logFile()}`);
});
