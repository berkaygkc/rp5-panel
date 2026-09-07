import { NextResponse } from "next/server";
import { getChatMonitor } from "@/lib/server/monitors/chat";

export const dynamic = "force-dynamic";

/** Seçili sohbetin son mesajları: ?source=chatwoot|mattermost&ref=<id> */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const source = u.searchParams.get("source");
  const ref = u.searchParams.get("ref") ?? "";
  if ((source !== "chatwoot" && source !== "mattermost") || !ref) return NextResponse.json({ error: "source ve ref gerekli" }, { status: 400 });
  try {
    return NextResponse.json(await getChatMonitor().thread(source, ref));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
