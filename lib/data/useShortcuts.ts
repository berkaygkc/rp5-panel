"use client";

import { useKioskConfig } from "@/lib/config/ConfigContext";
import type { ShortcutGroup } from "@/lib/types/shortcuts";

/** Kısayollar yönetim panelinden (veritabanı → /api/config) */
export function useShortcuts(): { data: ShortcutGroup[] } {
  return { data: useKioskConfig().shortcuts };
}
