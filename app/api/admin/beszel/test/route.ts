import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { getAllSettings } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";

/** Beszel bağlantı testi: kayıtlı (ya da gönderilen) kimlikle giriş dener */
export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { url?: string; email?: string; password?: string };
  const s = await getAllSettings();
  const url = (body.url || s["beszel.url"]).replace(/\/+$/, "");
  const email = body.email || s["beszel.email"];
  const password = body.password && body.password !== "••••••" ? body.password : s["beszel.password"];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${url}/api/collections/users/auth-with-password`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: email, password }), signal: ctrl.signal,
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `giriş reddedildi (HTTP ${res.status})` });
    const { token } = (await res.json()) as { token: string };
    const list = await fetch(`${url}/api/collections/systems/records?perPage=50`, { headers: { authorization: token }, signal: ctrl.signal });
    const j = (await list.json()) as { totalItems?: number; items?: Array<{ name: string; status: string }> };
    return NextResponse.json({ ok: true, systems: (j.items ?? []).map((x) => `${x.name} (${x.status})`) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message });
  } finally {
    clearTimeout(timer);
  }
}
