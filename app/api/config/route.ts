import { NextResponse } from "next/server";
import { getKioskConfig } from "@/lib/server/config/kiosk";

export const dynamic = "force-dynamic";

/** Kiosk yapılandırması: ekranlar, kısayollar, kilit süresi, varsayılan tema */
export async function GET() {
  return NextResponse.json(await getKioskConfig(), { headers: { "Cache-Control": "no-store" } });
}
