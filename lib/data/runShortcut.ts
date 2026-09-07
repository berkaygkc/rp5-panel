"use client";

import { agentWsUrl } from "@/lib/agentUrl";

import type { ShortcutRun } from "@/lib/types/shortcuts";

/**
 * Gerçek kısayolu Mac ajanına gönderir ve sonucu bekler.
 * Kısa ömürlü bir WS bağlantısı kullanır (gönder → runAck bekle → kapat);
 * ajan yoksa/yanıt gecikirse dürüst bir hata döner.
 */
export function runShortcutOnAgent(
  id: string,
  action: ShortcutRun
): Promise<{ ok: boolean; message?: string }> {
  const url = agentWsUrl();
  if (!url) {
    return Promise.resolve({ ok: false, message: "Mac ajanı yapılandırılmamış (.env.local)" });
  }

  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const done = (result: { ok: boolean; message?: string }) => {
      if (settled) return;
      settled = true;
      try {
        ws?.close();
      } catch {
        /* kapanmış olabilir */
      }
      resolve(result);
    };

    const timer = window.setTimeout(
      () => done({ ok: false, message: "Mac ajanına ulaşılamadı" }),
      4000
    );

    try {
      ws = new WebSocket(url);
    } catch {
      window.clearTimeout(timer);
      return done({ ok: false, message: "Mac ajanına ulaşılamadı" });
    }

    ws.onopen = () => ws?.send(JSON.stringify({ type: "run", id, action }));
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type: string;
          id?: string;
          ok?: boolean;
          message?: string;
        };
        if (msg.type !== "runAck" || msg.id !== id) return; // "state" mesajlarını atla
        window.clearTimeout(timer);
        done({ ok: Boolean(msg.ok), message: msg.message });
      } catch {
        /* bozuk mesajı yok say */
      }
    };
    ws.onerror = () => {
      window.clearTimeout(timer);
      done({ ok: false, message: "Mac ajanına ulaşılamadı" });
    };
  });
}
