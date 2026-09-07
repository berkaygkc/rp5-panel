/** Claude plan kullanımındaki "Sep 2 at 6:39pm" biçimli sıfırlanma zamanı → yerel ifade. */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parseReset(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/([A-Za-z]{3})\w*\s+(\d{1,2})\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  const hour = (Number(m[3]) % 12) + (/pm/i.test(m[5]) ? 12 : 0);
  const now = new Date();
  const d = new Date(now.getFullYear(), month, Number(m[2]), hour, Number(m[4] ?? 0));
  // Yıl sınırında geriye düşmesin
  if (d.getTime() < now.getTime() - 200 * 86_400_000) d.setFullYear(now.getFullYear() + 1);
  return d;
}

export function fmtReset(raw: string | null, now: number): string {
  const d = parseReset(raw);
  if (!d) return raw ?? "";
  const mins = Math.round((d.getTime() - now) / 60_000);
  if (mins <= 0) return "sıfırlanıyor";
  if (mins < 90) return `${mins} dk sonra sıfırlanır`;
  if (mins < 20 * 60) return `${Math.round(mins / 60)} sa sonra sıfırlanır`;
  return `${d.toLocaleDateString("tr-TR", { weekday: "long" })} ${d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })} sıfırlanır`;
}
