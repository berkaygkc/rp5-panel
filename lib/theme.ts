"use client";

import { useSyncExternalStore } from "react";

/**
 * Tema deposu: <html data-theme> tek gerçek kaynak, localStorage kalıcı hafıza.
 * Hydration öncesi flaş olmasın diye app/layout.tsx içindeki küçük script
 * kaydedilmiş temayı sayfa çizilmeden uygular.
 */
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "rp5-theme";

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme, opts: { persist?: boolean } = {}): void {
  document.documentElement.dataset.theme = theme;
  if (opts.persist === false) {
    listeners.forEach((l) => l());
    return;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* özel mod / depolama kapalı */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
