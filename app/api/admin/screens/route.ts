import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";
const KNOWN = ["overview", "shortcuts", "claude", "mail", "infra"];

export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  return NextResponse.json({ screens: await db().screen.findMany({ orderBy: { order: "asc" } }), known: KNOWN });
}

/** Tüm listeyi yaz: sıra, başlık, renk, görünürlük (overview kapatılamaz) */
export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { screens } = (await req.json().catch(() => ({}))) as { screens?: Array<{ id: string; title: string; tint: string; enabled: boolean }> };
  if (!Array.isArray(screens)) return NextResponse.json({ error: "screens gerekli" }, { status: 400 });
  const d = db();
  let order = 0;
  for (const s of screens) {
    if (!KNOWN.includes(s.id)) continue;
    await d.screen.upsert({
      where: { id: s.id },
      create: { id: s.id, title: String(s.title || s.id).slice(0, 40), tint: String(s.tint || "var(--color-blue)").slice(0, 60), order: order++, enabled: s.id === "overview" ? true : Boolean(s.enabled) },
      update: { title: String(s.title || s.id).slice(0, 40), tint: String(s.tint || "var(--color-blue)").slice(0, 60), order: order++, enabled: s.id === "overview" ? true : Boolean(s.enabled) },
    });
  }
  return NextResponse.json({ ok: true });
}
