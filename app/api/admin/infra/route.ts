import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";
import { getBeszelMonitor } from "@/lib/server/monitors/beszel";

export const dynamic = "force-dynamic";

/** Beszel sistemleri + görünüm ayarları (ad, sıra, gizli) */
export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const snap = getBeszelMonitor().snapshot;
  const overrides = await db().infraSystemOverride.findMany();
  return NextResponse.json({
    configured: snap.configured,
    error: snap.error,
    updatedAt: snap.updatedAt,
    systems: snap.systems.map((s) => {
      const o = overrides.find((x) => x.beszelId === s.id);
      return { id: s.id, name: s.name, host: s.host, status: s.status, containers: s.containers.length, displayName: o?.displayName ?? null, order: o?.order ?? 0, hidden: o?.hidden ?? false };
    }),
  });
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { systems } = (await req.json().catch(() => ({}))) as { systems?: Array<{ id: string; displayName?: string | null; hidden?: boolean }> };
  if (!Array.isArray(systems)) return NextResponse.json({ error: "systems gerekli" }, { status: 400 });
  let order = 0;
  for (const s of systems) {
    const data = { displayName: s.displayName?.trim() ? s.displayName.trim().slice(0, 60) : null, order: order++, hidden: Boolean(s.hidden) };
    await db().infraSystemOverride.upsert({ where: { beszelId: s.id }, create: { beszelId: s.id, ...data }, update: data });
  }
  return NextResponse.json({ ok: true });
}
