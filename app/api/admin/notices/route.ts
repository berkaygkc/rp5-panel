import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { getNoticeStore } from "@/lib/server/notices/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  return NextResponse.json({ notices: getNoticeStore().snapshot() });
}

/** Yönetici: test bildirimi gönder */
export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { title?: string; body?: string; severity?: "info" | "attention" | "urgent"; kind?: string; screen?: string };
  if (!body.title?.trim()) return NextResponse.json({ error: "başlık gerekli" }, { status: 400 });
  const { notice } = getNoticeStore().push(
    { id: `admin:test:${Date.now()}`, title: body.title.trim(), body: body.body, severity: body.severity, kind: body.kind ?? "system", screen: body.screen, ttlMs: 5 * 60_000 },
    "admin"
  );
  return NextResponse.json({ notice }, { status: 201 });
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id, all } = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };
  const store = getNoticeStore();
  if (all) { for (const n of store.snapshot()) store.clear(n.id); return NextResponse.json({ ok: true }); }
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  return NextResponse.json({ removed: store.clear(id) });
}
