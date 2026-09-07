import { NowPlayingWidget } from "@/components/os/widgets/media";
import { ClaudeSessionsWidget, ClaudeUsageWidget } from "@/components/os/widgets/claude";
import { InboxWidget } from "@/components/os/widgets/mail";
import { ChatAttentionWidget } from "@/components/os/widgets/chat";
import { InfraHealthWidget } from "@/components/os/widgets/infra";
import { ShortcutsWidget } from "@/components/os/widgets/shortcuts";
import { AnalogClockWidget, DigitalClockWidget } from "@/components/os/widgets/clock";
import { WeatherWidget } from "@/components/os/widgets/weather";
import { SystemWidget } from "@/components/os/widgets/system";
import { isProblem } from "@/lib/types/infra";
import type { WidgetDef } from "./types";

/**
 * Widget kayıt defteri.
 *
 * Her widget kendi aciliyetini bilir: veriye bakar ve 0..100 arası bir sayı
 * döndürür. Sıfır dönmek "şu an gösterilecek bir şeyim yok" demektir ve widget
 * yer kaplamaz. Kullanıcının verdiği önem bu sayıyla harmanlanır; panoyu
 * kompozisyon motoru buna göre kurar.
 *
 * Yeni bir uygulama eklemek: widget bileşenini yaz, buraya bir kayıt ekle,
 * yönetim panelinde önceliğini ver. Kabuğu değiştirmek gerekmez.
 */
export const WIDGETS: WidgetDef[] = [
  {
    id: "media.nowPlaying",
    appId: "media",
    title: "Şu an çalıyor",
    sizes: ["2x2", "2x1", "1x1"],
    priority: 55,
    component: NowPlayingWidget,
    urgency: (d) => (!d.media.track ? 0 : d.media.playing ? 78 : 45),
  },
  {
    id: "claude.sessions",
    appId: "claude",
    title: "Claude oturumları",
    sizes: ["2x2", "1x2", "2x1", "1x1"],
    priority: 70,
    component: ClaudeSessionsWidget,
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
    component: ClaudeUsageWidget,
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
    sizes: ["2x2", "2x1", "1x1"],
    priority: 55,
    component: InboxWidget,
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
    component: ChatAttentionWidget,
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
    sizes: ["2x1", "1x1"],
    priority: 60,
    component: InfraHealthWidget,
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
    sizes: ["2x2", "2x1", "1x1"],
    priority: 45,
    component: ShortcutsWidget,
    urgency: () => 30,
  },
  {
    id: "system.core",
    appId: "system",
    title: "Sistem",
    sizes: ["1x1"],
    priority: 20,
    component: SystemWidget,
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
    component: AnalogClockWidget,
    urgency: () => 12,
  },
  {
    id: "clock.digital",
    appId: "clock",
    title: "Dijital saat",
    sizes: ["1x1"],
    priority: 22,
    filler: true,
    component: DigitalClockWidget,
    urgency: () => 10,
  },
  {
    id: "weather.now",
    appId: "weather",
    title: "Hava durumu",
    sizes: ["2x1", "1x1"],
    priority: 30,
    filler: true,
    component: WeatherWidget,
    urgency: (d) => (d.weather.available ? 14 : 0),
  },
];

const BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

export function widgetById(id: string): WidgetDef | undefined {
  return BY_ID.get(id);
}

/** Uygulama kimliği → insanca ad (yönetim paneli için) */
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

/** Kurulumda kullanılan varsayılan ayarlar */
export const DEFAULT_PINS: Record<string, { col: number; row: number; size: "1x2" }> = {
  "clock.analog": { col: 3, row: 0, size: "1x2" },
};
