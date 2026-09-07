"use client";

import { useEffect, useRef, useState } from "react";
import { surfaceFor, type SurfaceInfo } from "./grid";

/**
 * Yüzey ölçüsü. Izgara pencereden türer, sabit bir cihazdan değil: aynı arayüz
 * şeritte 4×2, masaüstünde 4×3, telefonda tek sütun olur.
 */
export function useSurface(): { ref: React.RefObject<HTMLDivElement | null>; info: SurfaceInfo } {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<SurfaceInfo>(() => surfaceFor(1973, 426));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return;
      const next = surfaceFor(Math.round(r.width), Math.round(r.height));
      setInfo((prev) =>
        prev.surface === next.surface && prev.grid.cols === next.grid.cols && prev.grid.rows === next.grid.rows ? prev : next
      );
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, info };
}
