"use client";

import { Sparkles, Gauge } from "lucide-react";
import { Metric, Pill, Tile, TileHead } from "@/components/os/parts";
import { fmtAgo } from "@/lib/format";
import type { WidgetProps } from "@/lib/os/types";
import type { ClaudeSession } from "@/lib/types/claude";

const TINT = "var(--color-terracotta)";

const step = (s: ClaudeSession) => {
  const a = s.activity;
  if (s.status === "waiting") return a?.kind === "assistant" && a.text ? a.text : "Sizi bekliyor";
  if (!a) return "Çalışıyor";
  return a.kind === "tool" ? `${a.tool} çalıştırıyor` : a.text || "Çalışıyor";
};

/** Canlı Claude Code oturumları: bekleyen önce, çalışan nabızla */
export function ClaudeSessionsWidget({ size, data }: WidgetProps) {
  const live = data.claude.sessions.filter((s) => s.status !== "closed");
  if (live.length === 0) return null;
  const waiting = live.filter((s) => s.status === "waiting").length;
  const ordered = [...live].sort((a, b) => {
    if (a.status !== b.status) return a.status === "waiting" ? -1 : 1;
    return b.lastActiveAt - a.lastActiveAt;
  });

  if (size === "1x1") {
    return (
      <Tile tint={TINT} screen="claude">
        <TileHead icon={Sparkles} title="Claude" tint={TINT} trailing={waiting > 0 ? <Pill tint="var(--color-warn)">{waiting}</Pill> : undefined} />
        <Metric
          value={live.length}
          label={waiting > 0 ? `${waiting} oturum sizi bekliyor` : "oturum çalışıyor"}
          tone={waiting > 0 ? "var(--color-warn)" : undefined}
        />
      </Tile>
    );
  }

  const rows = ordered.slice(0, size === "2x2" ? 3 : size === "1x2" ? 4 : 1);
  return (
    <Tile tint={TINT} screen="claude">
      <TileHead icon={Sparkles} title="Claude" tint={TINT} trailing={<Pill tint={waiting > 0 ? "var(--color-warn)" : TINT}>{live.length}</Pill>} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5">
        {rows.map((s) => {
          const isWaiting = s.status === "waiting";
          return (
            <div
              key={s.id}
              className="flex items-start gap-2.5 rounded-[12px] px-2.5 py-2"
              style={
                isWaiting
                  ? {
                      background: "color-mix(in srgb, var(--color-warn) 12%, transparent)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-warn) 26%, transparent)",
                    }
                  : undefined
              }
            >
              <span
                className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${isWaiting ? "" : "animate-soft-pulse"}`}
                style={{ background: isWaiting ? "var(--color-warn)" : "var(--color-ok)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-[-0.01em]">{s.project}</span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtAgo(s.lastActiveAt, data.now)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-dim">{step(s)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}

/** Plan kullanımı: oturum limiti tek sayı olarak */
export function ClaudeUsageWidget({ data }: WidgetProps) {
  const limit = data.claude.usage.limits.find((l) => l.id === "session") ?? data.claude.usage.limits[0];
  if (!limit) return null;
  const pct = Math.round(limit.percent);
  const tone = pct >= 85 ? "var(--color-err)" : pct >= 60 ? "var(--color-warn)" : undefined;
  return (
    <Tile tint={TINT} screen="claude">
      <TileHead icon={Gauge} title="Plan kullanımı" tint={TINT} />
      <Metric value={`%${pct}`} label={limit.label} tone={tone} />
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: tone ?? TINT }} />
      </div>
    </Tile>
  );
}
