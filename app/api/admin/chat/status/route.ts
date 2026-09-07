import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin/auth";
import { getChatMonitor } from "@/lib/server/monitors/chat";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  return NextResponse.json(getChatMonitor().snapshot);
}

/** Şimdi yenile: bir yoklama turu çalıştırır ve sonucu döner */
export async function POST(req: Request) {
  const denied = requireAdmin(req); if (denied) return denied;
  return NextResponse.json(await getChatMonitor().refreshNow());
}
