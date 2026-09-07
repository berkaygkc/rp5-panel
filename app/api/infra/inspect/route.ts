import { NextResponse } from "next/server";
import { getBeszelMonitor } from "@/lib/server/monitors/beszel";

export const dynamic = "force-dynamic";

/** docker inspect özeti: /api/infra/inspect?system=<id>&container=<docker id> */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const system = url.searchParams.get("system") ?? "";
  const container = url.searchParams.get("container") ?? "";
  if (!/^[a-z0-9]{10,20}$/i.test(system) || !/^[a-f0-9]{12,64}$/i.test(container)) {
    return NextResponse.json({ error: "system ve container (docker id) gerekli" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getBeszelMonitor().containerInfo(system, container));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
