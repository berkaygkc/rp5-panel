import { NextResponse } from "next/server";
import { getBeszelMonitor } from "@/lib/server/monitors/beszel";

export const dynamic = "force-dynamic";

/** Altyapı anlık görüntüsü — Beszel izleyicisinin önbelleği (kiosk okur) */
export async function GET() {
  return NextResponse.json(getBeszelMonitor().snapshot);
}
