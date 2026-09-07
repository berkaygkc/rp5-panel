/**
 * Claude Code JSONL kayıtlarını ayrıştırır.
 * Dikkat: assistant kayıtları içerik bloğu başına tekrarlanır ve usage her
 * birinde aynıdır — token toplamı message.id ile TEKİLLEŞTİRİLEREK alınır.
 */
import type { FeedEvent, Tokens } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawRecord = Record<string, any>;

export function parseLine(line: string): RawRecord | null {
  if (!line || line[0] !== "{") return null;
  try {
    return JSON.parse(line) as RawRecord;
  } catch {
    return null;
  }
}

export function emptyTokens(): Tokens {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

export function addTokens(a: Tokens, b: Tokens): void {
  a.input += b.input;
  a.output += b.output;
  a.cacheRead += b.cacheRead;
  a.cacheWrite += b.cacheWrite;
}

export function usageOf(rec: RawRecord): Tokens | null {
  const u = rec.message?.usage;
  if (!u) return null;
  return {
    input: Number(u.input_tokens ?? 0),
    output: Number(u.output_tokens ?? 0),
    cacheRead: Number(u.cache_read_input_tokens ?? 0),
    cacheWrite: Number(u.cache_creation_input_tokens ?? 0),
  };
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function basename(p: unknown): string {
  return typeof p === "string" ? p.split("/").pop() ?? p : "";
}

/** Araç çağrısını tek satırda özetler — panelde "ne yapıyor" satırı */
function summarizeTool(name: string, input: RawRecord | undefined): string {
  if (!input) return "";
  switch (name) {
    case "Bash":
      return clip(String(input.description ?? input.command ?? ""), 110);
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return basename(input.file_path);
    case "Grep":
      return clip(`${input.pattern ?? ""} ${input.path ? "· " + basename(input.path) : ""}`, 90);
    case "Glob":
      return clip(String(input.pattern ?? ""), 90);
    case "WebFetch":
    case "WebSearch":
      return clip(String(input.url ?? input.query ?? ""), 90);
    case "Agent":
      return clip(String(input.description ?? ""), 90);
    case "Skill":
      return clip(String(input.skill ?? ""), 60);
    default: {
      const first = Object.values(input).find((v) => typeof v === "string");
      return clip(typeof first === "string" ? first : "", 80);
    }
  }
}

/** Bir kayıttan canlı akış olayları üretir (0..n). */
export function feedEventsOf(rec: RawRecord): FeedEvent[] {
  const ts = rec.timestamp ? Date.parse(rec.timestamp) : Date.now();
  const content = rec.message?.content;
  const out: FeedEvent[] = [];

  if (rec.type === "user" && !rec.isMeta) {
    if (typeof content === "string") {
      if (content.trim()) out.push({ ts, kind: "user", text: clip(content.trim(), 400) });
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
          out.push({ ts, kind: "user", text: clip(block.text.trim(), 400) });
        } else if (block?.type === "tool_result") {
          const raw = block.content;
          const text =
            typeof raw === "string"
              ? raw
              : Array.isArray(raw)
                ? raw.map((c: RawRecord) => (c?.type === "text" ? c.text : "[görsel]")).join(" ")
                : "";
          out.push({
            ts,
            kind: "result",
            text: clip(text.trim().split("\n")[0] || "tamam", 140),
            error: Boolean(block.is_error),
          });
        }
      }
    }
  } else if (rec.type === "assistant" && Array.isArray(content)) {
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
        out.push({ ts, kind: "assistant", text: clip(block.text.trim(), 500) });
      } else if (block?.type === "tool_use") {
        out.push({
          ts,
          kind: "tool",
          tool: String(block.name ?? "araç"),
          text: summarizeTool(String(block.name ?? ""), block.input),
        });
      }
    }
  }
  return out;
}
