/**
 * Plan kullanım limitleri — `claude -p "/usage"` çıktısını ayrıştırır.
 * Resmî bir API yok; Claude Code'un kendi çıktısı tek güvenilir kaynak.
 * Çağrı ~3 sn sürer, o yüzden seyrek (5 dk) çalıştırılır ve önbelleklenir.
 */
import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { probeEnv } from "../env.js";

/**
 * Ölçüm kendi oturum dosyasını yazar; ev dizininde çalışırsa panelin oturum
 * listesini kirletir. Bu yüzden ayrılmış bir klasörde çalışır ve o klasörün
 * slug'ı izleyici tarafından hariç tutulur (EXCLUDE_SLUG_RE → rp5-agent).
 */
const USAGE_CWD = path.join(os.homedir(), ".rp5-agent", "usage");

export interface UsageLimit {
  /** "session" | "week" | "week:Fable" gibi kararlı anahtar */
  id: string;
  label: string;
  /** 0–100 */
  percent: number;
  /** "Sep 2 at 6:40pm" → ham metin; panel yerelleştirir */
  resetsAt: string | null;
}

export interface UsageWindow {
  id: "24h" | "7d";
  label: string;
  requests: number;
  sessions: number;
  /** "95% of your usage was at >150k context" gibi davranış notları */
  notes: string[];
}

export interface UsageWire {
  limits: UsageLimit[];
  windows: UsageWindow[];
  /** Ölçümün alındığı an (ms) */
  updatedAt: number;
  /** Komut çalışmadıysa nedeni */
  error: string | null;
}

const CMD_TIMEOUT_MS = 30_000;

function runUsage(): Promise<string> {
  mkdirSync(USAGE_CWD, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = execFile(
      "claude",
      ["-p", "/usage"],
      { timeout: CMD_TIMEOUT_MS, cwd: USAGE_CWD, maxBuffer: 1024 * 1024, env: probeEnv() },
      (err, stdout) => (err && !stdout ? reject(err) : resolve(stdout))
    );
    // stdin beklemesin (aksi halde 3 sn boşuna bekler)
    child.stdin?.end();
  });
}

const PERCENT_LINE = /^Current (session|week)([^:]*):\s*(\d+)%\s*used(?:\s*·\s*resets\s+(.+?))?\s*$/i;
const WINDOW_LINE = /^Last (24h|7d)\s*·\s*([\d.,]+)\s*requests?\s*·\s*([\d.,]+)\s*sessions?/i;
const num = (s: string) => Number(s.replace(/[.,]/g, ""));

/** Parantez içindeki kaynağı temizler: " (all models)" → "all models" */
function scopeLabel(kind: string, raw: string): { id: string; label: string } {
  const scope = raw.trim().replace(/^\(|\)$/g, "").trim();
  if (kind.toLowerCase() === "session") return { id: "session", label: "Bu oturum" };
  if (!scope || /all models/i.test(scope)) return { id: "week", label: "Bu hafta · tüm modeller" };
  return { id: `week:${scope}`, label: `Bu hafta · ${scope}` };
}

export function parseUsage(text: string): Omit<UsageWire, "updatedAt" | "error"> {
  const limits: UsageLimit[] = [];
  const windows: UsageWindow[] = [];
  let current: UsageWindow | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const pct = line.match(PERCENT_LINE);
    if (pct) {
      const { id, label } = scopeLabel(pct[1], pct[2]);
      limits.push({
        id,
        label,
        percent: Math.max(0, Math.min(100, Number(pct[3]))),
        resetsAt: pct[4]?.replace(/\s*\([^)]*\)\s*$/, "").trim() || null,
      });
      current = null;
      continue;
    }
    const win = line.match(WINDOW_LINE);
    if (win) {
      current = {
        id: win[1].toLowerCase() as "24h" | "7d",
        label: win[1] === "24h" ? "Son 24 saat" : "Son 7 gün",
        requests: num(win[2]),
        sessions: num(win[3]),
        notes: [],
      };
      windows.push(current);
      continue;
    }
    // Pencere altındaki girintili davranış notları
    if (current && raw.startsWith("  ") && line && current.notes.length < 4) {
      current.notes.push(line);
    }
  }
  return { limits, windows };
}

export class UsageMonitor {
  private cache: UsageWire = { limits: [], windows: [], updatedAt: 0, error: null };
  private running = false;

  get wire(): UsageWire {
    return this.cache;
  }

  /** Önbellek bu yaştan eskiyse yeniden ölç */
  async refresh(maxAgeMs = 5 * 60_000): Promise<UsageWire | null> {
    if (this.running) return null;
    if (this.cache.updatedAt && Date.now() - this.cache.updatedAt < maxAgeMs) return null;
    this.running = true;
    try {
      const out = await runUsage();
      const parsed = parseUsage(out);
      const ok = parsed.limits.length > 0;
      this.cache = {
        ...parsed,
        updatedAt: Date.now(),
        error: ok ? null : "kullanım çıktısı okunamadı",
      };
      return this.cache;
    } catch (err) {
      this.cache = {
        ...this.cache,
        updatedAt: Date.now(),
        error: (err as Error).message.split("\n")[0],
      };
      return this.cache;
    } finally {
      this.running = false;
    }
  }
}
