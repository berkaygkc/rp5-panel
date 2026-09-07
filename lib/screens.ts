import type { ComponentType } from "react";
import { ChatIcon, ClaudeIcon, GaugeIcon, MailIcon, ServerIcon, WidgetIcon, type RailIconProps } from "@/components/icons/RailIcons";
import OverviewScreen from "@/components/screens/OverviewScreen";
import ShortcutsScreen from "@/components/screens/ShortcutsScreen";
import ClaudeScreen from "@/components/screens/ClaudeScreen";
import MailScreen from "@/components/screens/MailScreen";
import InfraScreen from "@/components/screens/InfraScreen";
import ChatScreen from "@/components/screens/ChatScreen";

export interface ScreenDef {
  id: string;
  title: string;
  component: ComponentType;
  /** Rail ve menüdeki uygulama ikonu (animasyonlu duotone paket) */
  icon: ComponentType<RailIconProps>;
  /** Ekranın kimlik rengi — rail/menü ikonu ve ambient parıltı bundan türer */
  tint: string;
}

/**
 * Ekran bileşenleri koddadır; sıra, başlık, renk ve görünürlük yönetim
 * panelinden (veritabanı → /api/config) gelir. Yeni ekran eklemek için:
 * 1. components/screens/ altına bileşeni yaz, buraya kimliğiyle kaydet
 * 2. Yönetim panelinde ekranı ekle (ya da tohumla) — menü, rail ve swipe kendiliğinden çalışır.
 */
export const SCREEN_COMPONENTS: Record<string, Pick<ScreenDef, "component" | "icon">> = {
  overview: { component: OverviewScreen, icon: GaugeIcon },
  shortcuts: { component: ShortcutsScreen, icon: WidgetIcon },
  claude: { component: ClaudeScreen, icon: ClaudeIcon },
  mail: { component: MailScreen, icon: MailIcon },
  infra: { component: InfraScreen, icon: ServerIcon },
  chat: { component: ChatScreen, icon: ChatIcon },
};

/** Yapılandırma yüklenene kadar kullanılan varsayılan liste */
export const DEFAULT_SCREENS: ScreenDef[] = [
  { id: "overview", title: "Genel Bakış", tint: "var(--color-blue)", ...SCREEN_COMPONENTS.overview },
  { id: "shortcuts", title: "Kısayollar", tint: "var(--color-orange)", ...SCREEN_COMPONENTS.shortcuts },
  { id: "claude", title: "Claude", tint: "var(--color-terracotta)", ...SCREEN_COMPONENTS.claude },
  { id: "mail", title: "Posta", tint: "var(--color-indigo)", ...SCREEN_COMPONENTS.mail },
  { id: "infra", title: "Altyapı", tint: "var(--color-teal)", ...SCREEN_COMPONENTS.infra },
  { id: "chat", title: "Sohbet", tint: "var(--color-green)", ...SCREEN_COMPONENTS.chat },
];
