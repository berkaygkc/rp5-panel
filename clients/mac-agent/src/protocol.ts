import type { ClaudeSessionWire, ClaudeStats, FeedEvent } from "./claude/types.js";
import type { UsageWire } from "./claude/usage.js";
import type { MailWire } from "./mail/spark.js";

/**
 * Panel ↔ ajan tel protokolü.
 * Paneldeki karşılığı: lib/data/useMedia.ts içindeki Wire* tipleri — senkron tutun.
 */

export type WireSource = "spotify" | "music" | "browser" | "system";

export interface WireTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  artworkUrl: string | null;
}

export interface WireMediaState {
  track: WireTrack | null;
  playing: boolean;
  /** Konum senkron noktası (sn). İstemci kendi saatiyle interpolasyon yapar. */
  positionSec: number;
  /** 0–100; ses kontrolü mümkün değilse null (panel kontrolü gizler) */
  volume: number | null;
  source: WireSource;
  outputDevice: string | null;
}

/** Kısayol eylemleri: panel yalnızca bu iki dar biçimi gönderebilir. */
export type RunAction =
  | { kind: "project"; path: string }
  | { kind: "ssh"; host: string; port?: number; user?: string; via?: "termius" | "terminal" };

export type ServerMessage =
  | { type: "state"; state: WireMediaState }
  | { type: "runAck"; id: string; ok: boolean; message?: string }
  | { type: "claudeSessions"; sessions: ClaudeSessionWire[]; stats: ClaudeStats }
  | { type: "claudeFeed"; sessionId: string; events: FeedEvent[]; reset: boolean }
  | { type: "claudeUsage"; usage: UsageWire }
  /** Spark Desktop posta kutusu */
  | { type: "mail"; mail: MailWire };

export type ClientCommand =
  | { type: "togglePlay" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "seekTo"; sec: number }
  | { type: "setVolume"; value: number }
  | { type: "run"; id: string; action: RunAction }
  /** Claude Code ekranı: oturum listesi aboneliği ve seçili oturumun canlı akışı */
  | { type: "claudeSubscribe"; on: boolean }
  | { type: "claudeFeed"; sessionId: string | null }
  /** Posta ekranı aboneliği */
  | { type: "mailSubscribe"; on: boolean };
