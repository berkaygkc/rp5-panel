"use client";

import { useEffect, useState } from "react";
import { EMPTY_CHAT, type ChatState } from "@/lib/types/chat";

const POLL_MS = 10_000;

/** Sohbet verisi — panelin kendi backend'inden (Chatwoot + Mattermost izleyicisi) */
export function useChat(): { data: ChatState; stale: boolean } {
  const [data, setData] = useState<ChatState>(EMPTY_CHAT);
  const [stale, setStale] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/chat", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as ChatState;
        if (!alive) return;
        setData(json);
        setStale(false);
      } catch {
        if (alive) setStale(true);
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  return { data, stale };
}
