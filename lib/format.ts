/** Sayı ve süre biçimleyicileri — tr-TR. */

/** Saniyeyi "m:ss" biçimine çevirir (medya süreleri). */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Token sayısını kompakt yazar: 1.240.000 → "1,2M", 41.300 → "41K" */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + "M";
  if (n >= 1_000) return Math.round(n / 1_000).toLocaleString("tr-TR") + "K";
  return Math.round(n).toLocaleString("tr-TR");
}

/** Göreli zaman: "az önce", "3 dk", "2 sa", "dün", "5 gün" */
export function fmtAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 45) return "az önce";
  if (s < 3600) return `${Math.round(s / 60)} dk`;
  if (s < 86_400) return `${Math.round(s / 3600)} sa`;
  const d = Math.round(s / 86_400);
  return d === 1 ? "dün" : `${d} gün`;
}

/** Posta zamanı: bugünse saat, bu haftaysa gün adı, değilse gün ay */
export function fmtWhen(ms: number, now: number): string {
  const d = new Date(ms);
  if (now <= 0) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (now - ms < 6 * 86_400_000) return d.toLocaleDateString("tr-TR", { weekday: "short" });
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
