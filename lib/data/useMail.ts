"use client";

import { agentWsUrl } from "@/lib/agentUrl";

import { useEffect, useRef, useState } from "react";
import type { MailState } from "@/lib/types/mail";



const EMPTY: MailState = {
  available: false,
  accounts: [],
  messages: [],
  updatedAt: 0,
  error: null,
};

/**
 * Spark Desktop posta kutusu — ajan yerel SQLite'ı salt okunur sorgular,
 * panel yalnızca sonucu gösterir (okuma amaçlı, hiçbir yazma yok).
 */
export function useMail(): { data: MailState; stale: boolean } {
  const [data, setData] = useState<MailState>(EMPTY);
  const [stale, setStale] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = agentWsUrl();
    if (!wsUrl) return;
    let closed = false;
    let retry: number | undefined;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "mailSubscribe", on: true }));
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type: string; mail?: MailState };
          if (msg.type === "mail" && msg.mail) {
            setData(msg.mail);
            setStale(false);
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

  return { data, stale };
}
