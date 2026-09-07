import { NextResponse } from "next/server";
import { sessionCookieHeader } from "@/lib/server/admin/auth";

export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookieHeader(null) } });
}
