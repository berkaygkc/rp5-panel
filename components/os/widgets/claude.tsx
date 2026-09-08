"use client";

import { Gauge as GaugeIcon, Sparkles, Wrench } from "lucide-react";
import { Metric, Pill, Tile, TileHead } from "@/components/os/parts";
import { Gauge } from "@/components/ui/Gauge";
import { fmtAgo } from "@/lib/format";
import type { WidgetProps } from "@/lib/os/types";
import type { ClaudeSession } from "@/lib/types/claude";

const TINT = "var(--color-terracotta)";
const WARN = "var(--color-warn)";

const step = (s: ClaudeSession): string => {
  const a = s.activity;
  if (s.status === "waiting") return a?.kind === "assistant" && a.text ? a.text : "Sizi bekliyor";
  if (!a) return "Çalışıyor";
  return a.kind === "tool" ? a.text || `${a.tool} çalıştırıyor` : a.text || "Çalışıyor";
};

/** Çalışan oturumun o anki aracı — küçük mono rozet */
function ToolChip({ s }: { s: ClaudeSession }) {
  if (s.activity?.kind !== "tool") return null;
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold"
      style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
    >
      <Wrench size={9} strokeWidth={2.5} />
      {s.activity.tool}
    </span>
  );
}

/**
 * Claude oturumları.
 *
 * Bu widget'ın işi tek bir soruyu cevaplamak: benden bir şey isteyen var mı?
 * Bekleyen oturum varsa sorusu kahraman olur, çalışanlar altında sessiz satırlar
 * halinde durur. Kimse beklemiyorsa yalnızca kimin ne yaptığı görünür.
 */
export function ClaudeSessionsWidget({ size, data }: WidgetProps) {
  const live = data.claude.sessions.filter((s) => s.status !== "closed");
  if (live.length === 0) return null;
  const waiting = live.filter((s) => s.status === "waiting");
  const working = live.filter((s) => s.status === "working");
  const hero = waiting[0] ?? null;

  if (size === "1x1") {
    return (
      <Tile tint={TINT} screen="claude">
        <TileHead icon={Sparkles} title="Claude" tint={TINT} trailing={waiting.length > 0 ? <Pill tint={WARN}>{waiting.length}</Pill> : undefined} />
        {hero ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="truncate text-[14px] font-semibold" style={{ color: WARN }}>{hero.project}</div>
            <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-dim">{step(hero)}</div>
          </div>
        ) : (
          <Metric value={live.length} label={live.length === 1 ? "oturum çalışıyor" : "oturum çalışıyor"} />
        )}
      </Tile>
    );
  }

  const rows = (hero ? [...waiting.slice(1), ...working] : working).slice(0, size === "1x2" ? 4 : 3);

  return (
    <Tile tint={TINT} screen="claude">
      <TileHead
        icon={Sparkles}
        title="Claude"
        tint={TINT}
        trailing={<Pill tint={waiting.length > 0 ? WARN : TINT}>{live.length}</Pill>}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        {hero && (
          <div
            className="shrink-0 rounded-[var(--r-md)] px-3 py-2.5"
            style={{
              background: "color-mix(in srgb, var(--color-warn) 12%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-warn) 26%, transparent)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: WARN }} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em]">{hero.project}</span>
              <span className="shrink-0 text-[10.5px] font-medium" style={{ color: WARN }}>sizi bekliyor</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug">{step(hero)}</p>
          </div>
        )}
        {/* Kahraman varsa satırlar hemen altına yaslanır; yoksa ortalanır. */}
        <div className={`flex min-h-0 flex-1 flex-col gap-2 ${hero ? "justify-start" : "justify-center"}`}>
          {rows.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.status === "working" ? "animate-soft-pulse" : ""}`}
                style={{ background: s.status === "waiting" ? WARN : "var(--color-ok)" }}
              />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[12.5px] font-semibold">{s.project}</span>
                  <ToolChip s={s} />
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-dim">{step(s)}</span>
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-faint">{fmtAgo(s.lastActiveAt, data.now)}</span>
            </div>
          ))}
          {live.length > rows.length + (hero ? 1 : 0) && (
            <span className="text-[11px] text-faint">ve {live.length - rows.length - (hero ? 1 : 0)} oturum daha</span>
          )}
        </div>
      </div>
    </Tile>
  );
}

/** Plan kullanımı — halka gösterge, tek bakışta ne kadar kaldığı */
export function ClaudeUsageWidget({ data }: WidgetProps) {
  const limit = data.claude.usage.limits.find((l) => l.id === "session") ?? data.claude.usage.limits[0];
  if (!limit) return null;
  const pct = Math.round(limit.percent);
  const color = pct >= 85 ? "var(--color-err)" : pct >= 60 ? WARN : TINT;
  return (
    <Tile tint={TINT} screen="claude">
      <TileHead icon={GaugeIcon} title="Plan" tint={TINT} />
      <div className="flex min-h-0 flex-1 items-center gap-3.5">
        <Gauge percent={pct} size={82} thickness={8} color={color}>
          <span className="text-[19px] font-semibold tabular-nums tracking-[-0.03em]">%{pct}</span>
        </Gauge>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium">{limit.label}</div>
          <div className="mt-1 text-[11px] leading-snug text-faint">
            {pct >= 85 ? "limite yaklaşıyor" : pct >= 60 ? "yarısını geçti" : "bol bol var"}
          </div>
        </div>
      </div>
    </Tile>
  );
}
