"use client";

import { useLayoutEffect, useRef } from "react";
import type { Placement } from "@/lib/os/types";
import { widgetById } from "@/lib/os/registry";
import type { OsData } from "@/lib/os/types";

/**
 * Izgara — pencere yöneticisi.
 *
 * Yerleşim değiştiğinde widget'lar yerlerine ışınlanmaz: FLIP ile kaydıkları
 * görülür, yeni gelen ölçeklenerek belirir. Yalnızca transform ve opacity
 * kullanılır; azaltılmış hareket tercihinde hepsi kapanır.
 */
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

export function WidgetGrid({
  placements,
  data,
  cols,
  rows,
  scroll,
}: {
  placements: Placement[];
  data: OsData;
  cols: number;
  rows: number;
  scroll: boolean;
}) {
  const refs = useRef(new Map<string, HTMLDivElement>());
  const prev = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, DOMRect>();
    for (const [id, el] of refs.current) next.set(id, el.getBoundingClientRect());
    if (!reduce) {
      for (const [id, el] of refs.current) {
        const before = prev.current.get(id);
        const after = next.get(id);
        if (!after) continue;
        if (!before) {
          // Yeni gelen widget: hiçlikten değil, biraz küçükten belirir
          el.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE });
          continue;
        }
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        const resized = Math.abs(before.width - after.width) > 1 || Math.abs(before.height - after.height) > 1;
        if (resized) {
          el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 240, easing: "ease" });
        } else if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 320, easing: EASE });
        }
      }
    }
    prev.current = next;
  }, [placements]);

  return (
    <div
      className={`grid h-full w-full gap-4 ${scroll ? "overflow-y-auto" : ""}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: scroll ? `repeat(${rows}, minmax(150px, 1fr))` : `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {placements.map((p) => {
        const def = widgetById(p.widgetId);
        if (!def) return null;
        const Widget = def.component;
        return (
          <div
            key={p.widgetId}
            ref={(el) => {
              if (el) refs.current.set(p.widgetId, el);
              else refs.current.delete(p.widgetId);
            }}
            className="min-h-0 min-w-0"
            style={{
              gridColumn: `${p.col + 1} / span ${p.w}`,
              gridRow: `${p.row + 1} / span ${p.h}`,
            }}
          >
            <Widget size={p.size} data={data} />
          </div>
        );
      })}
    </div>
  );
}
