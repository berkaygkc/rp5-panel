"use client";

import { useEffect, useRef, useState } from "react";
import { compose, hasPreemption, samePlacement } from "./compose";
import type { GridSize, OsData, Placement, WidgetConfig, WidgetMeta } from "./types";

/**
 * Sakin yeniden dizilim.
 *
 * Panonun her üç saniyede karışması felaket olurdu. Üç fren var: bir yerleşim
 * en az DWELL_MS kadar korunur, yeni yerleşim ancak gerçekten farklıysa
 * uygulanır, kritik puana ulaşan bir widget dışarıda kaldıysa bekleme atlanır.
 */
const DWELL_MS = 20_000;
const TICK_MS = 2000;

export function useComposition(
  widgets: WidgetMeta[],
  config: Record<string, WidgetConfig | undefined>,
  data: OsData,
  grid: GridSize
): Placement[] {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const committedAt = useRef(0);
  const latest = useRef({ widgets, config, data, grid, placements });
  // En güncel girdiler zamanlayıcıya buradan geçer; render sırasında ref yazılmaz
  useEffect(() => {
    latest.current = { widgets, config, data, grid, placements };
  });

  useEffect(() => {
    const evaluate = () => {
      const { widgets: w, config: c, data: d, grid: g, placements: current } = latest.current;
      if (!d.now) return;
      const next = compose({ widgets: w, config: c, data: d, grid: g });
      if (samePlacement(next, current)) return;
      const elapsed = Date.now() - committedAt.current;
      const urgent = hasPreemption(w, c, d, current);
      const firstRun = current.length === 0;
      if (!firstRun && !urgent && elapsed < DWELL_MS) return;
      committedAt.current = Date.now();
      setPlacements(next);
    };
    evaluate();
    const t = setInterval(evaluate, TICK_MS);
    return () => clearInterval(t);
  }, []);

  return placements;
}
