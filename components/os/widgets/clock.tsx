"use client";

import { Clock } from "lucide-react";
import AnalogClock from "@/components/clock/AnalogClock";
import { Tile } from "@/components/os/parts";
import type { WidgetProps } from "@/lib/os/types";

const DIAL: Record<string, number> = { "2x2": 300, "1x2": 240, "1x1": 138, "2x1": 130, "4x2": 320 };

/** Kadran — cihazın yüzü. Statik: her zaman yerleşebilir, boşluğu doldurur. */
export function AnalogClockWidget({ size, data }: WidgetProps) {
  const now = data.now ? new Date(data.now) : null;
  return (
    <Tile tint="var(--screen-tint)" interactive={false} className="items-center justify-center">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <AnalogClock size={DIAL[size] ?? 160} tint="var(--screen-tint)" />
      </div>
      {(size === "2x2" || size === "1x2") && (
        <div className="mt-1 shrink-0 text-center leading-tight">
          <div className="text-[14px] font-semibold">{now ? now.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) : " "}</div>
          <div className="text-[11.5px] text-dim">{now ? now.toLocaleDateString("tr-TR", { weekday: "long" }) : " "}</div>
        </div>
      )}
    </Tile>
  );
}

/** Dijital saat: tek bakışta okunan büyük rakamlar */
export function DigitalClockWidget({ data }: WidgetProps) {
  const now = data.now ? new Date(data.now) : null;
  return (
    <Tile tint="var(--screen-tint)" interactive={false}>
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="font-clock text-[46px] font-medium leading-none tracking-[-0.045em] tabular-nums">
          {now ? now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-dim">
          <Clock size={12} className="text-faint" />
          {now ? now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" }) : " "}
        </div>
      </div>
    </Tile>
  );
}
