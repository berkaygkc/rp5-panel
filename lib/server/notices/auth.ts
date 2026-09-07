import { timingSafeEqual } from "node:crypto";

/**
 * Üretici kimliği: paylaşılan token (NOTICE_TOKEN). Token tanımlı değilse
 * yazma uçları kapalıdır (fail-closed) — panel ileride internete açılacak.
 */
export function producerAuthorized(req: Request): { ok: true } | { ok: false; status: number; reason: string } {
  const expected = process.env.NOTICE_TOKEN ?? "";
  if (!expected) return { ok: false, status: 503, reason: "NOTICE_TOKEN tanımlı değil" };
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, reason: "token geçersiz" };
  return { ok: true };
}
