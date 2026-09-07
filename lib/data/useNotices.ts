"use client";

import { useCallback, useEffect, useState } from "react";
import type { Notice, NoticeEvent } from "@/lib/notices/types";

/**
 * Bildirim akışı — panelin kendi backend'inden SSE ile (aynı origin: LAN'da da,
 * ileride sabit DNS'te de çalışır). EventSource kopunca kendi yeniden bağlanır;
 * her bağlanışta sunucu anlık görüntüyü yeniden gönderir.
 */
export function useNotices(): {
  notices: Notice[];
  connected: boolean;
  dismiss: (id: string) => void;
} {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/notices/stream");
    const parse = (e: MessageEvent): NoticeEvent | null => {
      try {
        return JSON.parse(String(e.data)) as NoticeEvent;
      } catch {
        return null;
      }
    };
    es.addEventListener("snapshot", (e) => {
      const ev = parse(e as MessageEvent);
      if (ev?.type === "snapshot") setNotices(ev.notices);
      setConnected(true);
    });
    es.addEventListener("notice", (e) => {
      const ev = parse(e as MessageEvent);
      if (ev?.type !== "notice") return;
      setNotices((list) => [ev.notice, ...list.filter((n) => n.id !== ev.notice.id)]);
    });
    es.addEventListener("clear", (e) => {
      const ev = parse(e as MessageEvent);
      if (ev?.type !== "clear") return;
      setNotices((list) => list.filter((n) => n.id !== ev.id));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotices((list) => list.filter((n) => n.id !== id));
    void fetch(`/api/notices/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {
      /* sunucuya ulaşılamadı: yerelde zaten kapandı */
    });
  }, []);

  return { notices, connected, dismiss };
}
