/**
 * RP5 Mac ajanı.
 *   npm run dev   → gerçek kaynaklar (Spotify / Apple Music / MediaRemote) + Claude Code izleme
 *   npm run demo  → sentetik çalar (hiçbir uygulamaya dokunmaz)
 *
 * Panel tarafı: .env.local içine NEXT_PUBLIC_MEDIA_WS=ws://<mac-ip>:17705
 */
import { loadDotEnv } from "./env.js";
loadDotEnv();

import { refreshAgentConfig } from "./config.js";

import { LiveAgent } from "./agent.js";
import { ClaudeMonitor } from "./claude/monitor.js";
import { UsageMonitor } from "./claude/usage.js";
import { MailMonitor } from "./mail/spark.js";
import { FrontmostMonitor } from "./frontmost.js";
import { DemoPlayer } from "./sources/demo.js";
import { runShortcut } from "./runner.js";
import { createServer, type Client } from "./server.js";
import type { ClientCommand, ServerMessage, WireMediaState } from "./protocol.js";

const DEMO = process.argv.includes("--demo");
const portArg = process.argv.find((a) => a.startsWith("--port="));
const PORT = portArg ? parseInt(portArg.split("=")[1], 10) : 17705;

const POLL_MS = 1000;
/** Konum bu kadar saptıysa (harici seek) yeni senkron noktası yayınla */
const DRIFT_SEC = 1.5;
/** En geç bu aralıkta bir kalp atışı senkronu gönder */
const HEARTBEAT_MS = 10_000;
/** Claude Code oturum taraması (yalnızca abone varken) */
const CLAUDE_SCAN_MS = 5000;
/** Plan kullanım limitleri: `claude -p "/usage"` ~3 sn sürer, seyrek çalışır */
const USAGE_REFRESH_MS = 5 * 60_000;
/** Posta kutusu tazeleme aralığı (yalnızca abone varken) */
const MAIL_REFRESH_MS = 20_000;
/** Ön plandaki VSCode çalışma alanı yoklama aralığı (Claude bildirim kuralı) */
const FRONTMOST_POLL_MS = 2000;

const demo = DEMO ? new DemoPlayer() : null;
const live = DEMO ? null : new LiveAgent();
const claude = new ClaudeMonitor();
const usage = new UsageMonitor();
const mail = new MailMonitor();
const frontmost = new FrontmostMonitor();
// Bekleme bildirimi, ön plandaki VSCode çalışma alanındaki oturum için üretilmez
claude.isInFront = (project) => frontmost.isWorkspaceInFront(project);
setInterval(() => void frontmost.poll(), FRONTMOST_POLL_MS);

let current: WireMediaState | null = null;
let lastSent: WireMediaState | null = null;
let lastSentAt = 0;

function shouldBroadcast(next: WireMediaState): boolean {
  if (!lastSent) return true;
  if ((next.track?.id ?? null) !== (lastSent.track?.id ?? null)) return true;
  if (
    next.playing !== lastSent.playing ||
    next.source !== lastSent.source ||
    next.volume !== lastSent.volume
  ) {
    return true;
  }
  const dtSec = (Date.now() - lastSentAt) / 1000;
  const expected = lastSent.positionSec + (lastSent.playing ? dtSec : 0);
  if (Math.abs(next.positionSec - expected) > DRIFT_SEC) return true;
  return Date.now() - lastSentAt > HEARTBEAT_MS;
}

let polling = false;

async function poll() {
  // Yavaş osascript çağrıları (ör. izin diyaloğu) üst üste binmesin
  if (polling) return;
  polling = true;
  try {
    const next = demo ? demo.state() : await live!.read();
    current = next;
    if (shouldBroadcast(next)) {
      server.broadcast(next);
      lastSent = next;
      lastSentAt = Date.now();
    }
  } finally {
    polling = false;
  }
}

let claudeScanning = false;

async function claudeScan(push: boolean) {
  if (claudeScanning) return;
  claudeScanning = true;
  try {
    const snap = await claude.scan();
    if (push) server.broadcastClaude({ type: "claudeSessions", ...snap });
  } catch (err) {
    console.error("[claude] tarama hatası:", (err as Error).message);
  } finally {
    claudeScanning = false;
  }
}

const server = createServer(PORT, () => current, {
  onCommand(cmd: ClientCommand, client: Client, reply: (msg: ServerMessage) => void) {
    switch (cmd.type) {
      case "run":
        void runShortcut(cmd.action).then((result) => {
          console.log(
            `[run] ${cmd.action.kind} → ${result.ok ? "tamam" : `HATA: ${result.message}`}`
          );
          reply({ type: "runAck", id: cmd.id, ok: result.ok, message: result.message });
        });
        return;

      case "claudeSubscribe":
        client.claude = cmd.on;
        if (cmd.on) {
          // Isınmış anlık görüntüyü hemen ver, taze taramayı arkadan gönder
          reply({ type: "claudeSessions", ...claude.snapshot });
          reply({ type: "claudeUsage", usage: usage.wire });
          void claudeScan(true);
          void usage.refresh().then((u) => {
            if (u) server.broadcastClaude({ type: "claudeUsage", usage: u });
          });
        } else {
          claude.unsubscribeFeed(client);
        }
        return;

      case "claudeFeed":
        if (cmd.sessionId) void claude.subscribeFeed(client, cmd.sessionId, reply);
        else claude.unsubscribeFeed(client);
        return;

      case "mailSubscribe":
        client.mail = cmd.on;
        if (cmd.on) {
          reply({ type: "mail", mail: mail.wire });
          void mail.refresh().then((m) => {
            if (m) server.broadcastMail({ type: "mail", mail: m });
          });
        }
        return;

      default:
        if (demo) {
          demo.command(cmd);
          void poll();
        } else {
          void live!.command(cmd).then(() => {
            // AppleScript'in durumu yansıtması için kısa bir gecikmeyle yeniden yokla
            setTimeout(() => void poll(), 400);
          });
        }
    }
  },
  onClose(client: Client) {
    claude.unsubscribeFeed(client);
  },
});

console.log(
  `[rp5-mac-agent] ${DEMO ? "DEMO modunda" : "canlı modda"} — ws://0.0.0.0:${PORT}`
);
if (!DEMO) {
  console.log(
    "[rp5-mac-agent] İlk çalıştırmada macOS, Spotify/Music otomasyon izni isteyebilir."
  );
}

void poll();
setInterval(() => void poll(), POLL_MS);

// Posta kutusu: abone varken periyodik tazele (salt okunur SQLite sorgusu)
setInterval(() => {
  if (!server.hasMailSubscribers()) return;
  void mail.refresh().then((m) => {
    if (m) server.broadcastMail({ type: "mail", mail: m });
  });
}, MAIL_REFRESH_MS);

// Panel yapılandırması (dışlanan hesaplar, bekleme eşiği …): açılışta ve dakikada bir
void refreshAgentConfig();
setInterval(() => void refreshAgentConfig(), 60_000);

// Plan kullanımı: açılışta bir kez ölç, sonra abone varken 5 dakikada bir tazele
void usage.refresh(0);
setInterval(() => {
  if (!server.hasClaudeSubscribers()) return;
  void usage.refresh(USAGE_REFRESH_MS).then((u) => {
    if (u) server.broadcastClaude({ type: "claudeUsage", usage: u });
  });
}, 60_000);

// Claude Code: başlangıçta bir kez ısıt, sonra yalnızca abone varken tara
void claudeScan(false);
setInterval(() => {
  if (server.hasClaudeSubscribers()) void claudeScan(true);
}, CLAUDE_SCAN_MS);
