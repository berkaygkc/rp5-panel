import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";
import { getHub } from "@/lib/server/core/hub";
import { CAPABILITIES } from "@/lib/wire/protocol";

export const dynamic = "force-dynamic";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Cihaz listesi + santralin canlı görüntüsü */
export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const devices = await db().device.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const live = getHub().snapshot();
  const online = new Set(live.providers.map((p) => p.name));
  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      role: d.role,
      capabilities: JSON.parse(d.capabilities || "[]") as string[],
      lastSeenAt: d.lastSeenAt?.getTime() ?? null,
      revoked: d.revoked,
      createdAt: d.createdAt.getTime(),
      online: online.has(d.name),
    })),
    live,
    capabilities: CAPABILITIES,
  });
}

/** Yeni cihaz: anahtar bir kez döner, sonra yalnızca özeti saklanır */
export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { name, role, capabilities } = (await req.json().catch(() => ({}))) as {
    name?: string; role?: string; capabilities?: string[];
  };
  if (!name?.trim()) return NextResponse.json({ error: "ad gerekli" }, { status: 400 });
  const r = role === "surface" ? "surface" : "provider";
  const caps = (capabilities ?? []).filter((c) => (CAPABILITIES as readonly string[]).includes(c));
  const token = `rp5_${randomBytes(24).toString("hex")}`;
  const device = await db().device.create({
    data: { name: name.trim().slice(0, 60), role: r, tokenHash: sha256(token), capabilities: JSON.stringify(caps) },
  });
  return NextResponse.json({ id: device.id, token }, { status: 201 });
}

/** İptal et ya da geri aç */
export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id, revoked, name, capabilities } = (await req.json().catch(() => ({}))) as {
    id?: string; revoked?: boolean; name?: string; capabilities?: string[];
  };
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await db().device.update({
    where: { id },
    data: {
      ...(typeof revoked === "boolean" ? { revoked } : {}),
      ...(name?.trim() ? { name: name.trim().slice(0, 60) } : {}),
      ...(capabilities ? { capabilities: JSON.stringify(capabilities.filter((c) => (CAPABILITIES as readonly string[]).includes(c))) } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await db().device.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
