import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";
const SIZES = ["1x1", "2x1", "1x2", "2x2", "4x2"];

/** Kullanıcının widget ayarları; satırı olmayan widget kendi varsayılanıyla çalışır */
export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const rows = await db().widgetSetting.findMany();
  return NextResponse.json({
    settings: rows.map((r) => ({
      id: r.id,
      enabled: r.enabled,
      priority: r.priority,
      sizes: JSON.parse(r.sizes || "[]") as string[],
      pinned: r.pinCol !== null && r.pinRow !== null && r.pinSize ? { col: r.pinCol, row: r.pinRow, size: r.pinSize } : null,
    })),
  });
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as {
    id?: string; enabled?: boolean; priority?: number; sizes?: string[];
    pinned?: { col: number; row: number; size: string } | null;
  };
  if (!b.id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const sizes = (b.sizes ?? []).filter((s) => SIZES.includes(s));
  const pin = b.pinned && SIZES.includes(b.pinned.size) && b.pinned.col >= 0 && b.pinned.row >= 0 ? b.pinned : null;
  const data = {
    enabled: b.enabled !== false,
    priority: Math.max(0, Math.min(100, Math.round(Number(b.priority ?? 50)))),
    sizes: JSON.stringify(sizes),
    pinCol: pin ? pin.col : null,
    pinRow: pin ? pin.row : null,
    pinSize: pin ? pin.size : null,
  };
  await db().widgetSetting.upsert({ where: { id: b.id }, create: { id: b.id, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

/** Varsayılana dön */
export async function DELETE(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await db().widgetSetting.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
