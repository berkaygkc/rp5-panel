import { NowPlayingWidget } from "@/components/os/widgets/media";
import { ClaudeSessionsWidget, ClaudeUsageWidget } from "@/components/os/widgets/claude";
import { InboxWidget } from "@/components/os/widgets/mail";
import { ChatAttentionWidget } from "@/components/os/widgets/chat";
import { InfraHealthWidget } from "@/components/os/widgets/infra";
import { ShortcutsWidget } from "@/components/os/widgets/shortcuts";
import { AnalogClockWidget, DigitalClockWidget } from "@/components/os/widgets/clock";
import { WeatherWidget } from "@/components/os/widgets/weather";
import { SystemWidget } from "@/components/os/widgets/system";
import { CATALOG } from "./catalog";
import type { WidgetDef, WidgetProps } from "./types";
import type { ComponentType } from "react";

/**
 * Kayıt defteri: katalogdaki tanımlara ekranda çizecek bileşeni bağlar.
 * Yeni uygulama eklemek için widget bileşenini yaz, kataloğa tanımını gir,
 * buraya bir satır ekle. Kabuğa dokunmak gerekmez.
 */
const COMPONENTS: Record<string, ComponentType<WidgetProps>> = {
  "media.nowPlaying": NowPlayingWidget,
  "claude.sessions": ClaudeSessionsWidget,
  "claude.usage": ClaudeUsageWidget,
  "mail.inbox": InboxWidget,
  "chat.attention": ChatAttentionWidget,
  "infra.health": InfraHealthWidget,
  "shortcuts.panel": ShortcutsWidget,
  "system.core": SystemWidget,
  "clock.analog": AnalogClockWidget,
  "clock.digital": DigitalClockWidget,
  "weather.now": WeatherWidget,
};

export const WIDGETS: WidgetDef[] = CATALOG.filter((w) => COMPONENTS[w.id]).map((w) => ({
  ...w,
  component: COMPONENTS[w.id],
}));

const BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

export function widgetById(id: string): WidgetDef | undefined {
  return BY_ID.get(id);
}

export { APP_NAMES, DEFAULT_PINS } from "./catalog";
