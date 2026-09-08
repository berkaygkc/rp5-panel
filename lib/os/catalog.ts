import { isProblem } from "@/lib/types/infra";
import type { WidgetMeta } from "./types";

/**
 * Widget kataloğu — bileşensiz, saf tanımlar.
 *
 * Aciliyet kuralları burada yaşar: her widget kendi verisine bakıp 0..100 arası
 * bir sayı döndürür. Kompozisyon motoru ve yönetim panelindeki senaryo
 * simülasyonu aynı katalogla çalışır, bu yüzden panoda göreceğiniz şeyle
 * panelde denediğiniz şey birebir aynıdır.
 */
export const CATALOG: WidgetMeta[] = [
  {
    id: "media.nowPlaying",
    appId: "media",
    title: "Şu an çalıyor",
    sizes: ["2x2", "2x1", "1x1"],
    priority: 55,
    urgency: (d) => (!d.media.track ? 0 : d.media.playing ? 78 : 45),
  },
  {
    id: "claude.sessions",
    appId: "claude",
    title: "Claude oturumları",
    sizes: ["2x2", "1x2", "2x1", "1x1"],
    priority: 70,
    urgency: (d) => {
      const live = d.claude.sessions.filter((s) => s.status !== "closed");
      if (live.length === 0) return 0;
      return live.some((s) => s.status === "waiting") ? 95 : 62;
    },
  },
  {
    id: "claude.usage",
    appId: "claude",
    title: "Plan kullanımı",
    sizes: ["1x1"],
    priority: 35,
    urgency: (d) => {
      const limit = d.claude.usage.limits.find((l) => l.id === "session") ?? d.claude.usage.limits[0];
      if (!limit) return 0;
      if (limit.percent >= 85) return 74;
      if (limit.percent >= 60) return 42;
      return 18;
    },
  },
  {
    id: "mail.inbox",
    appId: "mail",
    title: "Gelen kutusu",
    sizes: ["2x2", "2x1", "1x2", "1x1"],
    priority: 55,
    urgency: (d) => {
      const unread = d.mail.accounts.reduce((n, a) => n + a.unread, 0);
      if (unread === 0) return 0;
      return Math.min(40 + unread * 4, 72);
    },
  },
  {
    id: "chat.attention",
    appId: "chat",
    title: "Yanıt bekleyenler",
    sizes: ["2x2", "1x2", "2x1", "1x1"],
    priority: 65,
    urgency: (d) => {
      const items = [...d.chat.chatwoot.items, ...d.chat.mattermost.items].filter((i) => i.unread > 0 || i.mentions > 0);
      if (items.length === 0) return 0;
      if (items.some((i) => i.mentions > 0)) return 88;
      const waited = items.some((i) => i.waitingSince && d.now - i.waitingSince > 15 * 60_000);
      return waited ? 80 : 58;
    },
  },
  {
    id: "infra.health",
    appId: "infra",
    title: "Sunucu sağlığı",
    sizes: ["2x2", "2x1", "1x2", "1x1"],
    priority: 60,
    urgency: (d) => {
      if (!d.infra.configured || d.infra.systems.length === 0) return 0;
      if (d.infra.systems.some((s) => s.status === "down")) return 100;
      if (d.infra.systems.some((s) => s.containers.some(isProblem))) return 86;
      return 22;
    },
  },
  {
    id: "shortcuts.panel",
    appId: "shortcuts",
    title: "Kısayollar",
    sizes: ["2x2", "2x1", "1x2", "1x1"],
    priority: 45,
    urgency: () => 30,
  },
  {
    id: "system.core",
    appId: "system",
    title: "Sistem",
    sizes: ["1x1"],
    priority: 20,
    // Hiçbir cihaz bağlı değilse bu, panonun en önemli bilgisidir
    urgency: (d) => (d.online.length === 0 ? 96 : 8),
  },
  {
    id: "clock.analog",
    appId: "clock",
    title: "Kadran",
    sizes: ["2x2", "1x2", "1x1"],
    priority: 30,
    filler: true,
    urgency: () => 12,
  },
  {
    id: "clock.digital",
    appId: "clock",
    title: "Dijital saat",
    sizes: ["1x1"],
    priority: 22,
    filler: true,
    urgency: () => 10,
  },
  {
    id: "weather.now",
    appId: "weather",
    title: "Hava durumu",
    sizes: ["2x1", "1x1"],
    priority: 30,
    filler: true,
    urgency: (d) => (d.weather.available ? 14 : 0),
  },
];


export const CATALOG_BY_ID = new Map(CATALOG.map((w) => [w.id, w]));

/** Uygulama kimliği → insanca ad */
export const APP_NAMES: Record<string, string> = {
  media: "Medya",
  claude: "Claude",
  mail: "Posta",
  chat: "Sohbet",
  infra: "Altyapı",
  shortcuts: "Kısayollar",
  clock: "Saat",
  weather: "Hava durumu",
  system: "Sistem",
};

/** Kurulumda kullanılan varsayılan sabit yuvalar */
export const DEFAULT_PINS: Record<string, { col: number; row: number; size: "1x2" }> = {
  "clock.analog": { col: 3, row: 0, size: "1x2" },
};
