import { NextResponse } from "next/server";
import { getChatMonitor } from "@/lib/server/monitors/chat";

export const dynamic = "force-dynamic";

/** Sohbet anlık görüntüsü — izleyicinin önbelleği (kiosk okur) */
export async function GET() {
  return NextResponse.json(getChatMonitor().snapshot);
}
