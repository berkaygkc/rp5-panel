import { NextResponse } from "next/server";
import net from "node:net";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";
import { getBeszelMonitor } from "@/lib/server/monitors/beszel";
import { getNoticeStore } from "@/lib/server/notices/store";
import { getChatMonitor } from "@/lib/server/monitors/chat";
import { getAllSettings } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (ok: boolean) => { s.destroy(); resolve(ok); };
    s.setTimeout(1500, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

/** Yönetim panosu: servis sağlığı ve sayılar */
export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const s = await getAllSettings();
  let beszelUrl: URL | null = null;
  try { beszelUrl = new URL(s["beszel.url"]); } catch { /* geçersiz */ }
  const [agent, beszel, counts] = await Promise.all([
    probe("127.0.0.1", 17705),
    beszelUrl ? probe(beszelUrl.hostname, Number(beszelUrl.port) || 80) : Promise.resolve(false),
    Promise.all([db().screen.count({ where: { enabled: true } }), db().shortcutItem.count(), db().noticeRule.count({ where: { enabled: true } })]),
  ]);
  const infra = getBeszelMonitor().snapshot;
  const chat = getChatMonitor().snapshot;
  return NextResponse.json({
    agent, beszel,
    infra: { configured: infra.configured, systems: infra.systems.length, down: infra.systems.filter((x) => x.status === "down").length, error: infra.error },
    chat: {
      chatwoot: { configured: chat.chatwoot.configured, error: chat.chatwoot.error, items: chat.chatwoot.items.length },
      mattermost: { configured: chat.mattermost.configured, error: chat.mattermost.error, items: chat.mattermost.items.length },
      updatedAt: chat.updatedAt,
    },
    notices: getNoticeStore().snapshot().length,
    counts: { screens: counts[0], shortcuts: counts[1], rules: counts[2] },
    node: process.version, uptimeSec: Math.round(process.uptime()),
  });
}
