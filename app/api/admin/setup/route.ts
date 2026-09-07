import { NextResponse } from "next/server";
import { createSessionToken, isSetupDone, sessionCookieHeader, setAdminPassword } from "@/lib/server/admin/auth";

export const dynamic = "force-dynamic";

/** İlk kurulum: yönetici parolası (yalnızca bir kez) */
export async function POST(req: Request) {
  if (await isSetupDone()) return NextResponse.json({ error: "kurulum zaten yapıldı" }, { status: 409 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || password.length < 8)
    return NextResponse.json({ error: "parola en az 8 karakter olmalı" }, { status: 400 });
  await setAdminPassword(password);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(createSessionToken()) } });
}

export async function GET() {
  return NextResponse.json({ setupDone: await isSetupDone() });
}
