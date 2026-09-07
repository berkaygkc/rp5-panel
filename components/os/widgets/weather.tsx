"use client";

import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, type LucideIcon } from "lucide-react";
import { Tile, TileHead } from "@/components/os/parts";
import type { WidgetProps } from "@/lib/os/types";

const TINT = "var(--color-mint)";

function iconFor(code: number): LucideIcon {
  if (code === 0 || code === 1) return Sun;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 95) return CloudLightning;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 51) return CloudRain;
  return Cloud;
}

/** Hava durumu — statik dolgu, boşluk oldukça durur */
export function WeatherWidget({ size, data }: WidgetProps) {
  const w = data.weather;
  if (!w.available) return null;
  const Icon = iconFor(w.code);

  if (size === "2x1") {
    return (
      <Tile tint={TINT} interactive={false}>
        <TileHead icon={Icon} title={w.place || "Hava durumu"} tint={TINT} />
        <div className="flex min-h-0 flex-1 items-center gap-4">
          <div className="text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{w.tempC}°</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{w.label}</div>
            <div className="mt-0.5 text-[11.5px] text-dim">Hissedilen {w.feelsC}°</div>
          </div>
          <div className="shrink-0 text-right text-[11.5px] tabular-nums text-dim">
            <div>En yüksek {w.high}°</div>
            <div className="mt-0.5">En düşük {w.low}°</div>
          </div>
        </div>
      </Tile>
    );
  }

  return (
    <Tile tint={TINT} interactive={false}>
      <TileHead icon={Icon} title={w.place || "Hava"} tint={TINT} />
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{w.tempC}°</div>
        <div className="mt-1.5 truncate text-[11.5px] text-dim">{w.label}</div>
        <div className="mt-1 text-[11px] tabular-nums text-faint">{w.high}° / {w.low}°</div>
      </div>
    </Tile>
  );
}
