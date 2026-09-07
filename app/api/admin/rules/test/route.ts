import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { db } from "@/lib/server/db";
import { applyRules, ruleMatches } from "@/lib/server/notices/rules";
import type { NoticeInput } from "@/lib/notices/types";

export const dynamic = "force-dynamic";

/** Örnek bir bildirimi kurallardan geçir: hangi kurallar eşleşti, sonuç ne */
export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Partial<NoticeInput>;
  const input: NoticeInput = {
    id: "test",
    title: String(body.title ?? ""),
    body: body.body ? String(body.body) : undefined,
    kind: body.kind ? String(body.kind) : "system",
    severity: body.severity && ["info", "attention", "urgent"].includes(body.severity) ? body.severity : "info",
    meta: body.meta && typeof body.meta === "object" ? body.meta : undefined,
  };
  const rules = await db().noticeRule.findMany({ orderBy: { order: "asc" } });
  const matched = rules.filter((r) => r.enabled && ruleMatches(r, input)).map((r) => r.name);
  return NextResponse.json({ matched, result: applyRules(input, rules) });
}
