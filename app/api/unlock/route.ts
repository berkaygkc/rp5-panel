import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSetting } from "@/lib/server/config/settings";

export const dynamic = "force-dynamic";

/** Basit hız sınırı: IP başına dakikada 8 deneme */
const attempts = new Map<string, { n: number; at: number }>();

/** PIN sunucuda doğrulanır; kiosk JS'inde PIN yoktur */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip) ?? { n: 0, at: now };
  if (now - a.at > 60_000) { a.n = 0; a.at = now; }
  if (a.n >= 8) return NextResponse.json({ ok: false, error: "çok fazla deneme, 1 dk bekleyin" }, { status: 429 });
  a.n++;
  attempts.set(ip, a);

  let pin = "";
  try {
    pin = String(((await req.json()) as { pin?: unknown }).pin ?? "");
  } catch {
    /* boş */
  }
  const expected = String(await getSetting("pin.code"));
  const x = Buffer.from(pin), y = Buffer.from(expected);
  const ok = x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
  if (ok) attempts.delete(ip);
  return NextResponse.json({ ok });
}
