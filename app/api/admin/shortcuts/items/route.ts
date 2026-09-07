import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

interface ItemInput {
  id?: string;
  groupId?: string;
  label?: string;
  sublabel?: string | null;
  feedback?: string;
  kind?: "project" | "ssh";
  path?: string | null;
  host?: string | null;
  port?: number | null;
  user?: string | null;
  via?: "termius" | "terminal" | null;
  enabled?: boolean;
}

function clean(i: ItemInput) {
  const kind = i.kind === "ssh" ? "ssh" : "project";
  const label = String(i.label ?? "").trim().slice(0, 60);
  if (!label) return { error: "etiket gerekli" };
  if (kind === "project" && !String(i.path ?? "").trim()) return { error: "proje yolu gerekli" };
  if (kind === "ssh" && !String(i.host ?? "").trim()) return { error: "sunucu adresi gerekli" };
  return {
    data: {
      label,
      sublabel: i.sublabel ? String(i.sublabel).slice(0, 80) : null,
      feedback: String(i.feedback ?? `${label} açıldı`).slice(0, 80),
      kind,
      path: kind === "project" ? String(i.path).trim() : null,
      host: kind === "ssh" ? String(i.host).trim() : null,
      port: kind === "ssh" && i.port ? Math.max(1, Math.min(65535, Math.round(Number(i.port)))) : null,
      user: kind === "ssh" && i.user ? String(i.user).trim().slice(0, 40) : null,
      via: kind === "ssh" && i.via === "terminal" ? "terminal" : null,
      enabled: i.enabled !== false,
    },
  };
}

export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as ItemInput;
  if (!body.groupId) return NextResponse.json({ error: "groupId gerekli" }, { status: 400 });
  const c = clean(body);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const order = await db().shortcutItem.count({ where: { groupId: body.groupId } });
  const item = await db().shortcutItem.create({ data: { ...c.data, groupId: body.groupId, order } });
  return NextResponse.json({ item }, { status: 201 });
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as ItemInput & { reorder?: Array<{ id: string; groupId: string }> };
  // Toplu sıralama (sürükle-bırak / yukarı-aşağı)
  if (Array.isArray(body.reorder)) {
    const perGroup = new Map<string, number>();
    for (const r of body.reorder) {
      const order = perGroup.get(r.groupId) ?? 0;
      perGroup.set(r.groupId, order + 1);
      await db().shortcutItem.update({ where: { id: r.id }, data: { order, groupId: r.groupId } }).catch(() => null);
    }
    return NextResponse.json({ ok: true });
  }
  if (!body.id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const c = clean(body);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const item = await db().shortcutItem.update({ where: { id: body.id }, data: c.data });
  return NextResponse.json({ item });
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await db().shortcutItem.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
