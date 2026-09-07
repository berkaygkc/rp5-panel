"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SCREENS, SCREEN_COMPONENTS, type ScreenDef } from "@/lib/screens";
import { THEME_STORAGE_KEY, setTheme } from "@/lib/theme";
import type { ShortcutGroup } from "@/lib/types/shortcuts";

/** /api/config yanıtı (lib/server/config/kiosk.ts ile senkron) */
export interface KioskConfig {
  screens: { id: string; title: string; tint: string }[];
  shortcuts: ShortcutGroup[];
  lockTimeoutMs: number;
  defaultTheme: "dark" | "light";
  defaultRecents: string[];
  updatedAt: number;
}

const FALLBACK: KioskConfig = {
  screens: DEFAULT_SCREENS.map((s) => ({ id: s.id, title: s.title, tint: s.tint })),
  shortcuts: [],
  lockTimeoutMs: 2 * 60 * 60 * 1000,
  defaultTheme: "dark",
  defaultRecents: ["claude", "shortcuts"],
  updatedAt: 0,
};

const REFRESH_MS = 60_000;

const Ctx = createContext<{ config: KioskConfig; screens: ScreenDef[]; loaded: boolean }>({
  config: FALLBACK,
  screens: DEFAULT_SCREENS,
  loaded: false,
});

/**
 * Kiosk yapılandırması — yönetim panelinde yapılan her değişiklik (ekran sırası,
 * kısayollar, kilit süresi) buradan akar. Yükleme bitene kadar koddaki varsayılanlar.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<KioskConfig>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as KioskConfig;
        if (!alive) return;
        setConfig(json);
        setLoaded(true);
        // Kayıtlı tema yoksa yönetim panelindeki varsayılan uygulanır
        try {
          if (!localStorage.getItem(THEME_STORAGE_KEY)) setTheme(json.defaultTheme, { persist: false });
        } catch {
          /* depolama kapalı */
        }
      } catch {
        /* backend yoksa varsayılanlarla devam */
      }
    };
    void load();
    const t = window.setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const screens = useMemo<ScreenDef[]>(() => {
    const list = config.screens
      .filter((s) => SCREEN_COMPONENTS[s.id])
      .map((s) => ({ id: s.id, title: s.title, tint: s.tint, ...SCREEN_COMPONENTS[s.id] }));
    // Genel Bakış her zaman vardır ve ilk sıradadır (rail'in sabit karosu)
    const overview = list.find((s) => s.id === "overview") ?? DEFAULT_SCREENS[0];
    return [overview, ...list.filter((s) => s.id !== "overview")];
  }, [config.screens]);

  const value = useMemo(() => ({ config, screens, loaded }), [config, screens, loaded]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useKioskConfig = () => useContext(Ctx).config;
export const useScreens = () => useContext(Ctx).screens;
export const useConfigLoaded = () => useContext(Ctx).loaded;
