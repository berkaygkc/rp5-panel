"use client";

import { getCore } from "@/lib/data/core";
import type { ShortcutRun } from "@/lib/types/shortcuts";

/**
 * Kısayolu çalıştırır. Panel bir cihaza doğrudan bağlanmaz: çekirdeğe niyet
 * gönderir, çekirdek "shortcuts" yeteneğini sunan sağlayıcıya yönlendirir ve
 * sonucu geri taşır. Sağlayıcı bağlı değilse dürüst bir hata döner.
 */
export function runShortcutOnAgent(
  id: string,
  action: ShortcutRun
): Promise<{ ok: boolean; message?: string }> {
  return getCore()
    .intent("shortcuts", "run", { id, action })
    .then((ack) => ({ ok: ack.ok, message: ack.message }));
}
