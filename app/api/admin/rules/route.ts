import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";
import { refreshConfig } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";
const FIELDS = new Set(["text", "title", "body", "kind", "account"]);
const SEVERITIES = new Set(["info", "attention", "urgent"]);

interface RuleInput { id?: string; name?: string; enabled?: boolean; field?: string; pattern?: string; setSeverity?: string | null; setKind?: string | null; setScreen?: string | null }

function clean(r: RuleInput) {
  const name = String(r.name ?? "").trim().slice(0, 60);
  const pattern = String(r.pattern ?? "").trim().slice(0, 300);
  if (!name) return { error: "ad gerekli" };
  if (!pattern) return { error: "desen gerekli" };
  try { new RegExp(pattern, "i"); } catch { return { error: "geçersiz düzenli ifade" }; }
  return { data: {
    name, pattern, enabled: r.enabled !== false,
    field: FIELDS.has(String(r.field)) ? String(r.field) : "text",
    setSeverity: r.setSeverity && SEVERITIES.has(r.setSeverity) ? r.setSeverity : null,
    setKind: r.setKind ? String(r.setKind).trim().slice(0, 32) || null : null,
    setScreen: r.setScreen ? String(r.setScreen).trim().slice(0, 32) || null : null,
  } };
}

export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  return NextResponse.json({ rules: await db().noticeRule.findMany({ orderBy: { order: "asc" } }) });
}

export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const c = clean((await req.json().catch(() => ({}))) as RuleInput);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const order = await db().noticeRule.count();
  const rule = await db().noticeRule.create({ data: { ...c.data, order } });
  await refreshConfig();
  return NextResponse.json({ rule }, { status: 201 });
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as RuleInput & { reorder?: string[] };
  if (Array.isArray(body.reorder)) {
    let order = 0;
    for (const id of body.reorder) await db().noticeRule.update({ where: { id }, data: { order: order++ } }).catch(() => null);
    await refreshConfig();
    return NextResponse.json({ ok: true });
  }
  if (!body.id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const c = clean(body);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });
  const rule = await db().noticeRule.update({ where: { id: body.id }, data: c.data });
  await refreshConfig();
  return NextResponse.json({ rule });
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await db().noticeRule.delete({ where: { id } }).catch(() => null);
  await refreshConfig();
  return NextResponse.json({ ok: true });
}
