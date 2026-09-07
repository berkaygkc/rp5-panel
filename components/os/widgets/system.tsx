"use client";

import { Cpu } from "lucide-react";
import { Metric, Tile, TileHead } from "@/components/os/parts";
import type { WidgetProps } from "@/lib/os/types";

const TINT = "var(--color-purple)";

/** Çekirdek bağlantısı: hangi yetenekler çevrimiçi. Kopunca yüksek puanla öne çıkar. */
export function SystemWidget({ data }: WidgetProps) {
  const online = data.online.length;
  return (
    <Tile tint={TINT} interactive={false}>
      <TileHead icon={Cpu} title="Sistem" tint={TINT} />
      {online === 0 ? (
        <Metric value="—" label="Hiçbir cihaz bağlı değil" tone="var(--color-err)" />
      ) : (
        <Metric value={online} label={`yetenek çevrimiçi: ${data.online.join(", ")}`} />
      )}
    </Tile>
  );
}
