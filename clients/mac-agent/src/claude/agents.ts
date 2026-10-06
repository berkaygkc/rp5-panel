/**
 * Alt ajan takibi.
 *
 * Bir oturum arka planda alt ajan çalıştırdığında kendi dökümü büyümeyi
 * bırakır — dışarıdan "durmuş" görünür, oysa iş başka yerde sürer. Alt ajanın
 * mesajları bu dökme yazılmaz; elimizdeki tek iz, başlatan `Agent` çağrısına
 * karşılık gelen `tool_result`'ın henüz gelmemiş olmasıdır.
 *
 * Sonucu gelmemiş her çağrı, çalışan bir alt ajan demektir.
 */

import type { RawRecord } from "./parse.js";

export interface PendingAgent {
  /** Çağrının `description` alanı — panelde gösterilecek insanca etiket */
  label: string;
  /** Başlatıldığı an (ms) */
  ts: number;
}

export type AgentPending = Map<string, PendingAgent>;

/** Alt ajan başlatan araçlar; `Task` eski adıdır, dökümlerde hâlâ görülebilir */
const AGENT_TOOLS = new Set(["Agent", "Task"]);
const FALLBACK_LABEL = "alt ajan";

/** Tek bir döküm kaydını işler: başlatmayı ekler, sonucu düşer. */
export function applyAgentRecord(pending: AgentPending, rec: RawRecord, ts: number): void {
  const content = (rec as { message?: { content?: unknown } })?.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (b.type === "tool_use" && typeof b.id === "string" && AGENT_TOOLS.has(String(b.name))) {
      const input = (b.input ?? {}) as Record<string, unknown>;
      const described = typeof input.description === "string" ? input.description.trim() : "";
      pending.set(b.id, { label: described || FALLBACK_LABEL, ts });
      continue;
    }

    if (b.type === "tool_result" && typeof b.tool_use_id === "string") {
      pending.delete(b.tool_use_id);
    }
  }
}

/** Kaç alt ajan çalışıyor ve en son başlayanın etiketi ne */
export function runningAgents(pending: AgentPending): { count: number; label: string | null } {
  let label: string | null = null;
  let newest = -Infinity;
  for (const a of pending.values()) {
    if (a.ts >= newest) {
      newest = a.ts;
      label = a.label;
    }
  }
  return { count: pending.size, label };
}
