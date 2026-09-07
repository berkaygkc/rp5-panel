import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const groups = await db().shortcutGroup.findMany({ orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } });
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return NextResponse.json({ error: "başlık gerekli" }, { status: 400 });
  const order = await db().shortcutGroup.count();
  const g = await db().shortcutGroup.create({ data: { title: title.trim().slice(0, 40), order } });
  return NextResponse.json({ group: g }, { status: 201 });
}

/** Grupları yeniden sırala / yeniden adlandır */
export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { groups } = (await req.json().catch(() => ({}))) as { groups?: Array<{ id: string; title?: string }> };
  if (!Array.isArray(groups)) return NextResponse.json({ error: "groups gerekli" }, { status: 400 });
  let order = 0;
  for (const g of groups) {
    await db().shortcutGroup.update({ where: { id: g.id }, data: { order: order++, ...(g.title ? { title: g.title.trim().slice(0, 40) } : {}) } }).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await db().shortcutGroup.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
