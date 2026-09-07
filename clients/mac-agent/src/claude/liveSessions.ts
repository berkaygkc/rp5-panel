/**
 * Canlı Claude Code oturumları — Claude Code'un kendi kaydı olan
 * ~/.claude/sessions/<pid>.json dosyalarından okunur.
 *
 * Bu kaynak süreç/klasör tahminlerinden çok daha güvenilirdir: oturum
 * kimliğini, çalışma dizinini, insan-okur adını ve meşguliyet durumunu
 * doğrudan verir. (Döküm dosyası bambaşka bir proje klasöründe olabilir —
 * ör. git worktree'sinde başlatılıp taşınmış oturumlar.)
 */
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const SESSIONS_DIR = path.join(os.homedir(), ".claude", "sessions");
export interface LiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  /** Claude Code'un verdiği ad (otomatik ya da türetilmiş) */
  name: string | null;
  busy: boolean;
  startedAt: number | null;
  updatedAt: number | null;
}

/** pid → komut adı (pid geri dönüşümüne karşı doğrulama) */
function claudePids(): Promise<Set<number>> {
  return new Promise((resolve) => {
    execFile("ps", ["-axo", "pid=,comm="], { timeout: 5000 }, (err, stdout) => {
      const set = new Set<number>();
      if (!err) {
        for (const line of stdout.split("\n")) {
          const m = line.match(/^\s*(\d+)\s+(.*)$/);
          if (m && /claude|node/i.test(m[2])) set.add(Number(m[1]));
        }
      }
      resolve(set);
    });
  });
}

export async function readLiveSessions(excludeRe: RegExp): Promise<LiveSession[]> {
  let files: string[];
  try {
    files = await fs.readdir(SESSIONS_DIR);
  } catch {
    return [];
  }

  const pids = await claudePids();
  const out: LiveSession[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    let raw: string;
    try {
      raw = await fs.readFile(path.join(SESSIONS_DIR, file), "utf8");
    } catch {
      continue;
    }
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }

    const pid = Number(j.pid);
    const sessionId = typeof j.sessionId === "string" ? j.sessionId : "";
    const cwd = typeof j.cwd === "string" ? j.cwd : "";
    if (!pid || !sessionId || !cwd) continue;
    if (excludeRe.test(cwd)) continue;

    // Süreç gerçekten yaşıyor mu (bayat dosyalar birikir)
    if (!pids.has(pid)) continue;
    try {
      process.kill(pid, 0);
    } catch {
      continue;
    }

    // Not: statusUpdatedAt periyodik yenilenmez (durum değişince yazılır),
    // bu yüzden yaşına bakılmaz; tazelik kararını döküm dosyasının büyümesi verir.
    const busy = j.status === "busy";

    out.push({
      pid,
      sessionId,
      cwd,
      name: typeof j.name === "string" && j.name.trim() ? j.name.trim() : null,
      busy,
      startedAt: Number(j.startedAt) || null,
      updatedAt: Number(j.updatedAt) || null,
    });
  }
  return out;
}
