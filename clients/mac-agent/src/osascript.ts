import { execFile } from "node:child_process";
import { cleanEnv } from "./env.js";

/**
 * osascript çalıştırıcı. Zaman aşımı bilinçli olarak uzun: ilk çalıştırmada
 * macOS'un otomasyon izni diyaloğu osascript'i bloklar; kısa bir zaman aşımı
 * süreci öldürüp iznin hiç verilememesine yol açar.
 * Hatalar (ör. -1743 "Not authorized") tanılama için loglanır ama spam
 * olmaması için aynı mesaj 30 sn'de bir yazılır.
 */
const lastLogged = new Map<string, number>();

function logThrottled(msg: string) {
  const now = Date.now();
  const prev = lastLogged.get(msg) ?? 0;
  if (now - prev < 30_000) return;
  lastLogged.set(msg, now);
  console.error(`[osascript] ${msg}`);
}

export function runAppleScript(script: string, timeoutMs = 15_000): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], { timeout: timeoutMs, env: cleanEnv() }, (err, stdout, stderr) => {
      if (err) {
        logThrottled((stderr || err.message).trim().split("\n")[0]);
        return resolve(null);
      }
      resolve(stdout.trim());
    });
  });
}
