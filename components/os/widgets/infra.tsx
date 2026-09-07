"use client";

import { Server } from "lucide-react";
import { Metric, Tile, TileHead } from "@/components/os/parts";
import { Sparkline } from "@/components/ui/Sparkline";
import { isProblem } from "@/lib/types/infra";
import type { WidgetProps } from "@/lib/os/types";

const TINT = "var(--color-teal)";

/** Sunucu sağlığı: sessizken tek satır, sorun varsa adıyla */
export function InfraHealthWidget({ size, data }: WidgetProps) {
  const systems = data.infra.systems;
  if (!data.infra.configured || systems.length === 0) return null;
  const down = systems.filter((s) => s.status === "down");
  const broken = systems.flatMap((s) => s.containers.filter(isProblem).map((c) => ({ c, s })));
  const services = systems.reduce((n, s) => n + s.containers.length, 0);
  const bad = down.length > 0 || broken.length > 0;
  const tone = bad ? "var(--color-err)" : undefined;

  const headline = down.length > 0
    ? `${down[0].name} yanıt vermiyor`
    : broken.length > 0
      ? `${broken[0].c.name} ${broken[0].c.running ? "sağlıksız" : "durdu"}`
      : `${systems.length} sunucu · ${services} servis`;

  if (size === "1x1") {
    return (
      <Tile tint={TINT} screen="infra">
        <TileHead icon={Server} title="Altyapı" tint={TINT} />
        <Metric
          value={bad ? down.length + broken.length : `${systems.length}`}
          label={bad ? headline : "sunucu sağlıklı"}
          tone={tone}
        />
      </Tile>
    );
  }

  return (
    <Tile tint={TINT} screen="infra">
      <TileHead icon={Server} title="Altyapı" tint={TINT} />
      <div className="flex min-h-0 flex-1 items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-[-0.01em]" style={tone ? { color: tone } : undefined}>
            {headline}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11.5px] text-dim">
            {systems.slice(0, 4).map((s) => (
              <span key={s.id} className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${s.status === "up" ? "animate-soft-pulse" : ""}`}
                  style={{ background: s.status === "up" ? "var(--color-ok)" : "var(--color-err)" }}
                />
                <span className="truncate">{s.name}</span>
              </span>
            ))}
          </div>
        </div>
        {systems[0]?.cpuHistory?.length > 1 && (
          <Sparkline values={systems[0].cpuHistory} width={92} height={30} color={bad ? "var(--color-err)" : TINT} />
        )}
      </div>
    </Tile>
  );
}
