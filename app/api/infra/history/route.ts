import { NextResponse } from "next/server";
import { getBeszelMonitor } from "@/lib/server/monitors/beszel";

export const dynamic = "force-dynamic";

/** Bir container'ın zaman serisi: /api/infra/history?system=<id>&container=<ad> */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const system = url.searchParams.get("system") ?? "";
  const container = url.searchParams.get("container") ?? "";
  if (!/^[a-z0-9]{10,20}$/i.test(system) || !container || container.length > 120) {
    return NextResponse.json({ error: "system ve container gerekli" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getBeszelMonitor().containerHistory(system, container));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
