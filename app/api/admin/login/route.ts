import { NextResponse } from "next/server";
import { createSessionToken, isSetupDone, sessionCookieHeader, verifyPassword } from "@/lib/server/admin/auth";
import { getSetting } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";
const attempts = new Map<string, { n: number; at: number }>();

export async function POST(req: Request) {
  if (!(await isSetupDone())) return NextResponse.json({ error: "önce kurulum" }, { status: 409 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip) ?? { n: 0, at: now };
  if (now - a.at > 10 * 60_000) { a.n = 0; a.at = now; }
  if (a.n >= 10) return NextResponse.json({ error: "çok fazla deneme; 10 dk bekleyin" }, { status: 429 });
  a.n++; attempts.set(ip, a);

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const stored = String(await getSetting("admin.passwordHash"));
  if (typeof password !== "string" || !verifyPassword(password, stored))
    return NextResponse.json({ error: "parola yanlış" }, { status: 401 });
  attempts.delete(ip);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(createSessionToken()) } });
}
