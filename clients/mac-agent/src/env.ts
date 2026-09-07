/**
 * Alt süreç ortamı.
 *
 * Ajan bir Claude Code oturumunun içinden başlatılmışsa ortamında
 * CLAUDE_CODE_CHILD_SESSION gibi işaretler bulunur. Bunlar aktarılırsa ajanın
 * açtığı VSCode → tümleşik terminal → `claude` zinciri "çocuk oturum" sanılıp
 * DÖKÜM KAYDINI KAPATIR (konuşma diske yazılmaz, --resume çalışmaz).
 * Bu yüzden ajan, açtığı her şeye Claude izlerinden arındırılmış ortam verir.
 */

import { readFileSync } from "node:fs";

const CLAUDE_VAR = /^CLAUDE/i;

/** process.env'in Claude Code izlerinden arındırılmış kopyası */
export function cleanEnv(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!CLAUDE_VAR.test(k)) out[k] = v;
  return out;
}

/**
 * Kullanım ölçümü (`claude -p "/usage"`) için ortam: temiz + bilinçli çocuk
 * işareti. Ölçüm bir konuşma değildir; döküm yazmaması istenir.
 */
export function probeEnv(): NodeJS.ProcessEnv {
  return { ...cleanEnv(), CLAUDE_CODE_CHILD_SESSION: "1" };
}

/**
 * Basit .env yükleyici (ajan klasöründeki .env): KEY=VALUE satırları,
 * # ile yorum, tırnaklar soyulur; var olan ortam değişkeni ezilmez.
 */
export function loadDotEnv(file = ".env"): void {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
