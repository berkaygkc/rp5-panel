"use client";

import { useMemo } from "react";
import { useKioskConfig } from "@/lib/config/ConfigContext";
import { CATALOG, DEFAULT_PINS } from "@/lib/os/catalog";
import type { WidgetConfig, WidgetSize } from "@/lib/os/types";

/**
 * Widget ayarları: veritabanındaki kullanıcı tercihi, kayıt defterindeki
 * varsayılanların üstüne biner. Kullanıcı dokunmadıysa widget kendi
 * varsayılanıyla çalışır, saat de kendi köşesinde durur.
 */
export function useWidgetConfig(): Record<string, WidgetConfig | undefined> {
  const stored = useKioskConfig().widgets;
  return useMemo(() => {
    const out: Record<string, WidgetConfig> = {};
    for (const def of CATALOG) {
      const row = stored[def.id];
      const pin = DEFAULT_PINS[def.id];
      out[def.id] = {
        id: def.id,
        enabled: row?.enabled ?? true,
        priority: row?.priority ?? def.priority,
        sizes: (row?.sizes as WidgetSize[] | undefined)?.length ? (row!.sizes as WidgetSize[]) : def.sizes,
        pinned: row
          ? (row.pinned as WidgetConfig["pinned"])
          : pin
            ? { col: pin.col, row: pin.row, size: pin.size }
            : null,
      };
    }
    return out;
  }, [stored]);
}
