import { NextResponse } from "next/server";
import { getNoticeStore } from "@/lib/server/notices/store";

/**
 * Bildirimi kaldır. Hem üretici temizlemesi (durum düzeldi) hem kullanıcı
 * kapatması aynı uçtur; kiosk'tan kapatma kimlik gerektirmez — panel zaten
 * PIN ve (ileride) Tailscale arkasında.
 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/notices/[id]">) {
  const { id } = await ctx.params;
  const removed = getNoticeStore().clear(decodeURIComponent(id));
  return NextResponse.json({ removed });
}
