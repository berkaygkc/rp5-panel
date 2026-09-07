"use client";

import { useEffect, useState } from "react";
import type { ChatSource, ChatThread } from "@/lib/types/chat";

const POLL_MS = 10_000;

/** Seçili sohbetin mesajları; seçim değişince sıfırlanır, 10 sn'de bir tazelenir */
export function useChatThread(source: ChatSource, ref: string): { thread: ChatThread | null; error: string | null } {
  const [state, setState] = useState<{ key: string; thread: ChatThread | null; error: string | null }>({ key: "", thread: null, error: null });
  const key = `${source}:${ref}`;

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/chat/thread?source=${source}&ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
        const json = (await res.json()) as ChatThread & { error?: string };
        if (!alive) return;
        if (!res.ok) setState((s) => ({ key, thread: s.key === key ? s.thread : null, error: json.error ?? `HTTP ${res.status}` }));
        else setState({ key, thread: json, error: null });
      } catch (err) {
        if (alive) setState((s) => ({ key, thread: s.key === key ? s.thread : null, error: (err as Error).message }));
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [source, ref, key]);

  return state.key === key ? { thread: state.thread, error: state.error } : { thread: null, error: null };
}
