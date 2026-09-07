import { NextResponse } from "next/server";
import { producerAuthorized } from "@/lib/server/notices/auth";
import { getAllSettings } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";

/** Mac ajanının çektiği yapılandırma (Bearer NOTICE_TOKEN) */
export async function GET(req: Request) {
  const auth = producerAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
  const s = await getAllSettings();
  return NextResponse.json({
    mailExcludedAddresses: s["mail.excludedAddresses"],
    mailMaxNoticesPerRefresh: s["mail.maxNoticesPerRefresh"],
    mailMessageLimit: s["mail.messageLimit"],
    claudeWaitNoticeMs: s["claude.waitNoticeMs"],
    updatedAt: Date.now(),
  });
}
