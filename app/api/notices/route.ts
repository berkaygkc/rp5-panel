import { NextResponse } from "next/server";
import { getNoticeStore } from "@/lib/server/notices/store";
import { producerAuthorized } from "@/lib/server/notices/auth";
import type { NoticeInput } from "@/lib/notices/types";

const SEVERITIES = new Set(["info", "attention", "urgent"]);
const ID_RE = /^[a-zA-Z0-9:_.\-@/]{1,160}$/;

/** Aktif bildirimler (kiosk okur; kimlik gerekmez) */
export async function GET() {
  return NextResponse.json({ notices: getNoticeStore().snapshot() });
}

/** Üretici: bildirim oluştur/güncelle — Authorization: Bearer <NOTICE_TOKEN> */
export async function POST(req: Request) {
  const auth = producerAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });

  let body: Partial<NoticeInput>;
  try {
    body = (await req.json()) as Partial<NoticeInput>;
  } catch {
    return NextResponse.json({ error: "geçersiz JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !ID_RE.test(body.id))
    return NextResponse.json({ error: "id gerekli (harf, rakam, : _ . - @ /)" }, { status: 400 });
  if (typeof body.title !== "string" || !body.title.trim())
    return NextResponse.json({ error: "title gerekli" }, { status: 400 });
  if (body.severity !== undefined && !SEVERITIES.has(body.severity))
    return NextResponse.json({ error: "severity: info | attention | urgent" }, { status: 400 });

  const input: NoticeInput = {
    id: body.id,
    title: body.title.trim().slice(0, 140),
    kind: typeof body.kind === "string" ? body.kind.slice(0, 32) : undefined,
    severity: body.severity,
    body: typeof body.body === "string" ? body.body.trim().slice(0, 400) : undefined,
    screen: typeof body.screen === "string" ? body.screen.slice(0, 32) : undefined,
    ttlMs: typeof body.ttlMs === "number" && body.ttlMs > 0 ? Math.min(body.ttlMs, 7 * 86_400_000) : undefined,
    meta: body.meta && typeof body.meta === "object" ? body.meta : undefined,
  };
  const source = req.headers.get("x-notice-source")?.slice(0, 40) || "producer";
  const { notice, changed } = getNoticeStore().push(input, source);
  return NextResponse.json({ notice, changed }, { status: changed ? 201 : 200 });
}
