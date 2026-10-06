/**
 * Alt ajan takibi.
 *
 * Bir oturum alt ajan çalıştırdığında kendi dökümü büyümeyi bırakır —
 * dışarıdan "durmuş" görünür, oysa iş başka yerde sürer.
 *
 * Döküm iki ayrı biçim yazar ve ikisini de izlemek gerekir:
 *
 *  1. Bloklayan çağrı: `Agent` tool_use'una karşılık `tool_result` ancak alt
 *     ajan bitince gelir. Sonucun yokluğu, çalıştığı anlamına gelir.
 *
 *  2. Arka plan çağrısı: `tool_result` çağrının hemen ardından gelir ve yalnız
 *     "Async agent launched successfully … agentId: <id>" der. Burada sonucun
 *     varlığı bitiş DEĞİLDİR; iş o andan sonra başlar. Bitişi, ileride düşen
 *     `<task-notification><task-id>…` kaydı bildirir. Bazı oturumlarda bu
 *     kayıt hiç düşmez; orada tek iz, alt ajanın son raporunu taşıyan
 *     `<agent-message from="…">` + `[Subagent hand-back]` çiftidir.
 *
 * Bu yüzden kayıt, sonucu görünce silinmez: anahtarı tool_use kimliğinden alt
 * ajan kimliğine taşınır ve bildirim gelene kadar açık kalır.
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

/** Arka plana alınan çağrının anlık sonucundan alt ajan kimliğini çıkarır */
const ASYNC_LAUNCH = /Async agent launched[\s\S]*?agentId:\s*([A-Za-z0-9_-]+)/;
/** Bitiş bildirimi; aynı kayıt hem enqueue hem remove olarak iki kez geçebilir */
const TASK_DONE = /<task-notification>[\s\S]*?<task-id>\s*([A-Za-z0-9_-]+)\s*<\/task-id>/g;
/**
 * Alt ajanın son raporu. `<agent-message from>` çerçevesi oturumlar arası her
 * mesajda kullanılır; yalnızca `[Subagent hand-back]` taşıyanı bitiş sayarız,
 * yoksa sıradan bir yazışma ajanı ölü gösterir.
 */
const HANDBACK = /<agent-message from="([A-Za-z0-9_-]+)">\s*\n?\s*\[Subagent hand-back\]/g;

/** tool_result içeriği düz metin de olabilir, metin bloklarından oluşan dizi de */
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const b of content) {
    if (b && typeof b === "object" && typeof (b as { text?: unknown }).text === "string") {
      out += (b as { text: string }).text;
    }
  }
  return out;
}

/** Tek bir döküm kaydını işler: başlatmayı ekler, bitişi düşer. */
export function applyAgentRecord(pending: AgentPending, rec: RawRecord, ts: number): void {
  // Bitiş bildirimi `queue-operation` kaydının düz metin `content` alanında
  // taşınır — mesaj gövdesinde değil.
  const loose = typeof (rec as { content?: unknown })?.content === "string" ? (rec as { content: string }).content : "";
  const message = (rec as { message?: { content?: unknown } })?.message?.content;
  const inMessage = typeof message === "string" ? message : "";
  for (const hay of [loose, inMessage]) {
    if (!hay) continue;
    for (const re of [TASK_DONE, HANDBACK]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(hay))) pending.delete(m[1]);
    }
  }

  if (!Array.isArray(message)) return;

  for (const block of message) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;

    if (b.type === "tool_use" && typeof b.id === "string" && AGENT_TOOLS.has(String(b.name))) {
      const input = (b.input ?? {}) as Record<string, unknown>;
      const described = typeof input.description === "string" ? input.description.trim() : "";
      pending.set(b.id, { label: described || FALLBACK_LABEL, ts });
      continue;
    }

    if (b.type === "tool_result" && typeof b.tool_use_id === "string") {
      const open = pending.get(b.tool_use_id);
      if (!open) continue;
      const async = ASYNC_LAUNCH.exec(resultText(b.content));
      pending.delete(b.tool_use_id);
      // Arka plana alındıysa iş şimdi başlıyor: kaydı alt ajan kimliğiyle sürdür.
      if (async) pending.set(async[1], open);
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
