"use client";

import { agentWsUrl } from "@/lib/agentUrl";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClaudeSession, ClaudeState, ClaudeStats, FeedEvent, Usage } from "@/lib/types/claude";

/** Medya ile aynı ajan; boşsa bağlantı kurulmaz, ekran boş durum gösterir. */

const FEED_KEEP = 40;

const EMPTY_STATS: ClaudeStats = {
  today: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  last5h: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  working: 0,
  waiting: 0,
  todayCostUsd: 0,
};

const EMPTY_USAGE: Usage = { limits: [], windows: [], updatedAt: 0, error: null };

type ServerMsg =
  | { type: "claudeSessions"; sessions: ClaudeSession[]; stats: ClaudeStats }
  | { type: "claudeFeed"; sessionId: string; events: FeedEvent[]; reset: boolean }
  | { type: "claudeUsage"; usage: Usage }
  | { type: string };

export function useClaude(options?: { feed?: boolean }): {
  data: ClaudeState;
  stale: boolean;
  select: (id: string | null) => void;
} {
  /** Canlı akış aboneliği — dashboard kartı yalnızca listeyle yetinir */
  const feedRef = useRef(options?.feed ?? true);
  const [state, setState] = useState<ClaudeState>({
    sessions: [],
    stats: EMPTY_STATS,
    selectedId: null,
    feed: [],
    usage: EMPTY_USAGE,
  });
  const [stale, setStale] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    const wsUrl = agentWsUrl();
    if (!wsUrl) return;
    let closed = false;
    let retry: number | undefined;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "claudeSubscribe", on: true }));
        // Yeniden bağlanınca seçili akışı geri al
        if (selectedRef.current) {
          if (feedRef.current) ws.send(JSON.stringify({ type: "claudeFeed", sessionId: selectedRef.current }));
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as ServerMsg;
          if (msg.type === "claudeSessions" && "sessions" in msg) {
            setStale(false);
            setState((s) => {
              // İlk veride seçim yoksa çalışan/bekleyen ilk oturumu otomatik seç
              let selectedId = s.selectedId;
              if (!selectedId) {
                const first = msg.sessions.find((x) => x.status !== "closed") ?? msg.sessions[0];
                if (first) {
                  selectedId = first.id;
                  selectedRef.current = first.id;
                  if (feedRef.current) ws.send(JSON.stringify({ type: "claudeFeed", sessionId: first.id }));
                }
              }
              return { ...s, sessions: msg.sessions, stats: msg.stats, selectedId };
            });
          } else if (msg.type === "claudeUsage" && "usage" in msg) {
            setState((s) => ({ ...s, usage: msg.usage }));
          } else if (msg.type === "claudeFeed" && "events" in msg) {
            setState((s) => {
              if (msg.sessionId !== s.selectedId) return s;
              const feed = msg.reset ? msg.events : [...s.feed, ...msg.events];
              return { ...s, feed: feed.slice(-FEED_KEEP) };
            });
          }
        } catch {
          /* bozuk mesajı yok say */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setStale(true);
        retry = window.setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setState((s) => ({ ...s, selectedId: id, feed: [] }));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (feedRef.current) ws.send(JSON.stringify({ type: "claudeFeed", sessionId: id }));
    }
  }, []);

  return { data: state, stale, select };
}
