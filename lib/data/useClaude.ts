"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCore, useCapability } from "@/lib/data/core";
import type { ClaudeSession, ClaudeState, ClaudeStats, FeedEvent, Usage } from "@/lib/types/claude";

const FEED_KEEP = 40;

const EMPTY_STATS: ClaudeStats = {
  today: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  last5h: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  working: 0,
  waiting: 0,
  todayCostUsd: 0,
};

const EMPTY_USAGE: Usage = { limits: [], windows: [], updatedAt: 0, error: null };

interface SessionsPayload {
  sessions: ClaudeSession[];
  stats: ClaudeStats;
}
interface FeedPayload {
  sessionId: string;
  events: FeedEvent[];
  reset: boolean;
}

/**
 * Claude Code oturumları. Sağlayıcı tarama sonucunu çekirdeğe yayınlar, yüzey
 * yalnızca alanlara abone olur. Akış aboneliği bir niyet olarak gider.
 */
export function useClaude(options?: { feed?: boolean }): {
  data: ClaudeState;
  stale: boolean;
  select: (id: string | null) => void;
} {
  const wantsFeed = options?.feed ?? true;
  const feedRef = useRef(wantsFeed);
  const [state, setState] = useState<ClaudeState>({
    sessions: [],
    stats: EMPTY_STATS,
    selectedId: null,
    feed: [],
    usage: EMPTY_USAGE,
  });
  const selectedRef = useRef<string | null>(null);
  const online = useCapability("claude");

  useEffect(() => {
    const core = getCore();
    const askFeed = (sessionId: string | null) => {
      if (feedRef.current) void core.intent("claude", "feed", { sessionId });
    };

    const offSessions = core.watch("claude.sessions", (payload) => {
      const p = payload as SessionsPayload;
      setState((s) => {
        // İlk veride seçim yoksa çalışan/bekleyen ilk oturumu otomatik seç
        let selectedId = s.selectedId;
        if (!selectedId) {
          const first = p.sessions.find((x) => x.status !== "closed") ?? p.sessions[0];
          if (first) {
            selectedId = first.id;
            selectedRef.current = first.id;
            askFeed(first.id);
          }
        }
        return { ...s, sessions: p.sessions, stats: p.stats, selectedId };
      });
    });

    const offUsage = core.watch("claude.usage", (payload) => {
      setState((s) => ({ ...s, usage: payload as Usage }));
    });

    const offFeed = wantsFeed
      ? core.watch("claude.feed", (payload) => {
          const p = payload as FeedPayload;
          setState((s) => {
            if (p.sessionId !== s.selectedId) return s;
            const feed = p.reset ? p.events : [...s.feed, ...p.events];
            return { ...s, feed: feed.slice(-FEED_KEEP) };
          });
        })
      : () => {};

    return () => {
      offSessions();
      offUsage();
      offFeed();
    };
  }, [wantsFeed]);

  const select = useCallback((id: string | null) => {
    selectedRef.current = id;
    setState((s) => ({ ...s, selectedId: id, feed: [] }));
    if (feedRef.current) void getCore().intent("claude", "feed", { sessionId: id });
  }, []);

  return { data: state, stale: !online, select };
}
