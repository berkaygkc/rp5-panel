import { db } from "@/lib/server/db";
import { getSetting } from "./settings";

/** Kiosk'un açılışta aldığı yapılandırma (gizli hiçbir şey içermez) */
export interface KioskScreen {
  id: string;
  title: string;
  tint: string;
}
export interface KioskShortcutItem {
  id: string;
  label: string;
  sublabel: string | null;
  feedback: string;
  /** Son başarılı çalıştırma (ms) ve toplam sayı — çekirdek sayar */
  lastRunAt: number | null;
  runCount: number;
  run:
    | { kind: "project"; path: string }
    | { kind: "ssh"; host: string; port?: number; user?: string; via?: "termius" | "terminal" };
}
export interface KioskShortcutGroup {
  id: string;
  title: string;
  items: KioskShortcutItem[];
}
export interface KioskWidgetConfig {
  id: string;
  enabled: boolean;
  priority: number;
  sizes: string[];
  pinned: { col: number; row: number; size: string } | null;
}
export interface KioskConfig {
  screens: KioskScreen[];
  shortcuts: KioskShortcutGroup[];
  /** Widget ayarları; satırı olmayan widget kendi varsayılanıyla çalışır */
  widgets: Record<string, KioskWidgetConfig>;
  lockTimeoutMs: number;
  defaultTheme: "dark" | "light";
  defaultRecents: string[];
  updatedAt: number;
}

export async function getKioskConfig(): Promise<KioskConfig> {
  const d = db();
  const [screens, groups, widgetRows, lockTimeoutMs, defaultTheme, defaultRecents] = await Promise.all([
    d.screen.findMany({ where: { enabled: true }, orderBy: { order: "asc" } }),
    d.shortcutGroup.findMany({ orderBy: { order: "asc" }, include: { items: { where: { enabled: true }, orderBy: { order: "asc" } } } }),
    d.widgetSetting.findMany(),
    getSetting("lock.timeoutMs"),
    getSetting("theme.default"),
    getSetting("rail.defaultRecents"),
  ]);
  const widgets: Record<string, KioskWidgetConfig> = {};
  for (const w of widgetRows) {
    widgets[w.id] = {
      id: w.id,
      enabled: w.enabled,
      priority: w.priority,
      sizes: JSON.parse(w.sizes || "[]") as string[],
      pinned: w.pinCol !== null && w.pinRow !== null && w.pinSize ? { col: w.pinCol, row: w.pinRow, size: w.pinSize } : null,
    };
  }

  return {
    widgets,
    screens: screens.map((s) => ({ id: s.id, title: s.title, tint: s.tint })),
    shortcuts: groups.map((g) => ({
      id: g.id,
      title: g.title,
      items: g.items.map((i) => ({
        id: i.id,
        label: i.label,
        sublabel: i.sublabel,
        feedback: i.feedback,
        lastRunAt: i.lastRunAt ? i.lastRunAt.getTime() : null,
        runCount: i.runCount,
        run:
          i.kind === "project"
            ? { kind: "project" as const, path: i.path ?? "" }
            : {
                kind: "ssh" as const,
                host: i.host ?? "",
                port: i.port ?? undefined,
                user: i.user ?? undefined,
                via: (i.via as "termius" | "terminal" | null) ?? undefined,
              },
      })),
    })),
    lockTimeoutMs,
    defaultTheme,
    defaultRecents,
    updatedAt: Date.now(),
  };
}
