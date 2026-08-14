// EL-SYSTEMA ─ 言上（コトダマ）のリプレイ
//
// 役: 過去の JSONL ログを hub 経由で再放出。タイムスタンプを保ったまま再生。
// 用途: 祭の事後検証、デバッグ、後で「あの瞬間」を再生
//
// 使い方:
//   node hub/replay.js logs/2026-05-23.jsonl                 # 等倍再生
//   node hub/replay.js logs/2026-05-23.jsonl --rate=2.0     # 2 倍速
//   node hub/replay.js logs/2026-05-23.jsonl --rate=0.5     # 0.5 倍速
//
// 環境変数:
//   WS_URL: hub の WebSocket URL (デフォルト: ws://localhost:8787)

const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const jsonlPath = process.argv[2];
const rate = parseFloat((process.argv.find(a => a.startsWith("--rate=")) || "--rate=1.0").split("=")[1]);
const wsUrl = process.env.WS_URL || "ws://localhost:8787";

if (!jsonlPath) {
  console.error("usage: node hub/replay.js <path> [--rate=N]");
  console.error("  <path>: JSONL ファイルへのパス (例: logs/2026-05-23.jsonl)");
  console.error("  --rate=N: 再生速度 (1.0=等倍, 2.0=2倍速, 0.5=半速)");
  console.error("");
  console.error("環境変数:");
  console.error("  WS_URL: hub の WebSocket URL (デフォルト: ws://localhost:8787)");
  process.exit(2);
}

if (!fs.existsSync(jsonlPath)) {
  console.error(`ファイルが見つかりません: ${jsonlPath}`);
  process.exit(1);
}

if (!isFinite(rate) || rate <= 0) {
  console.error(`--rate は正の数である必要があります: ${rate}`);
  process.exit(2);
}

console.log(`[replay] ${jsonlPath} を読み込み中...`);

const lines = fs.readFileSync(jsonlPath, "utf8").split(/\r?\n/).filter(Boolean);

if (lines.length === 0) {
  console.error("ログが空です");
  process.exit(2);
}

console.log(`[replay] ${lines.length} 行のメッセージを読み込みました`);

const messages = lines.map((line, i) => {
  try {
    return JSON.parse(line);
  } catch (e) {
    console.warn(`[replay] 行 ${i + 1} の JSON パース失敗、スキップ: ${e.message}`);
    return null;
  }
}).filter(Boolean).filter((m, i) => {
  if (m.t === "meta") return false;
  if (typeof m.at !== "number") {
    console.warn(`[replay] 行 ${i + 1} は at が無いのでスキップ`);
    return false;
  }
  return true;
});

messages.sort((a, b) => a.at - b.at);

if (messages.length === 0) {
  console.error("有効なメッセージがありません");
  process.exit(2);
}

// メタ情報の表示
const firstMsg = messages[0];
const lastMsg = messages[messages.length - 1];
const totalDuration = (lastMsg.at - firstMsg.at) / 1000;
const replayDuration = totalDuration / rate;

console.log(`[replay] 最初のメッセージ: ${new Date(firstMsg.at).toISOString()} (${firstMsg.t})`);
console.log(`[replay] 最後のメッセージ: ${new Date(lastMsg.at).toISOString()} (${lastMsg.t})`);
console.log(`[replay] 総再生時間: ${totalDuration.toFixed(1)}秒 → ${replayDuration.toFixed(1)}秒 (${rate}x)`);
console.log(`[replay] ${wsUrl} に接続中...`);

const ws = new WebSocket(wsUrl);

ws.on("open", () => {
  console.log(`[replay] 接続完了、再生開始`);

  const t0 = firstMsg.at;
  const realStart = Date.now();

  messages.forEach((m, i) => {
    const wait = (m.at - t0) / rate;
    setTimeout(() => {
      try {
        ws.send(JSON.stringify(m));
        // 進捗表示（10% ごと）
        const progress = ((i + 1) / messages.length * 100).toFixed(0);
        if (progress % 10 === 0 || i === messages.length - 1) {
          const elapsed = ((Date.now() - realStart) / 1000).toFixed(1);
          console.log(`[replay] ${progress}% (${i + 1}/${messages.length}) - ${elapsed}s elapsed`);
        }
      } catch (e) {
        console.warn(`[replay] 送信失敗 (${i + 1}/${messages.length}): ${e.message}`);
      }
    }, wait);
  });

  // 再生終了後に接続を閉じる
  const totalWait = (lastMsg.at - t0) / rate;
  setTimeout(() => {
    console.log(`[replay] 再生完了`);
    ws.close();
  }, totalWait + 1000);
});

ws.on("error", (err) => {
  console.error(`[replay] WebSocket エラー: ${err.message}`);
  console.error(`[replay] hub が起動しているか確認してください (node hub/server.js)`);
  process.exit(1);
});

ws.on("close", () => {
  console.log(`[replay] 接続終了`);
  process.exit(0);
});
