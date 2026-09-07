"use client";

import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { fmtAgo } from "@/lib/format";
import { fmtReset } from "@/lib/usageTime";
import type { ClaudeSession, Usage } from "@/lib/types/claude";

const TINT = "var(--color-terracotta)";
const MAX_ROWS = 3;

/** İkinci satır: oturumun şu an yaptığı şey — Live Activity'nin "güncel adım"ı */
function currentStep(s: ClaudeSession): string {
  const a = s.activity;
  if (s.status === "waiting") {
    return a?.kind === "assistant" && a.text ? a.text : "Sizi bekliyor";
  }
  if (!a) return "Çalışıyor";
  if (a.kind === "tool") return `${a.tool} çalıştırıyor`;
  return a.text || "Çalışıyor";
}

/**
 * Genel Bakış'taki Claude kartı — bir Live Activity yığını.
 * Bekleyen oturum ("bana ihtiyacı var") kehribar karo olarak öne çıkar; çalışanlar
 * sessiz, nabız atan satırlardır. Altta oturum limiti ince bir çizgi olarak durur.
 * Dokununca Claude ekranına gider.
 */
export function LiveSessionsCard({
  sessions,
  usage,
  now,
}: {
  sessions: ClaudeSession[];
  usage: Usage;
  now: number;
}) {
  const [pressed, setPressed] = useState(false);
  const live = sessions.filter((s) => s.status !== "closed");
  if (live.length === 0) return null;

  // Sizi bekleyenler önce — dikkat gerektiren şey en üstte
  const ordered = [...live].sort((a, b) => {
    if (a.status !== b.status) return a.status === "waiting" ? -1 : 1;
    return b.lastActiveAt - a.lastActiveAt;
  });
  const rows = ordered.slice(0, MAX_ROWS);
  const overflow = ordered.length - rows.length;
  const limit = usage.limits.find((l) => l.id === "session") ?? null;
  const limitColor = (p: number) =>
    p >= 85 ? "var(--color-err)" : p >= 60 ? "var(--color-warn)" : TINT;

  const release = () => setPressed(false);

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("panel-goto", { detail: "claude" }))}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      aria-label={`${live.length} canlı Claude oturumu — Claude ekranına git`}
      className="animate-card-in flex h-full min-h-0 w-full flex-col rounded-[26px] p-5 text-left"
      style={{
        background: "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        boxShadow:
          "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring), var(--card-shadow)",
        transform: pressed ? "scale(0.985)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13.5px] font-medium text-dim">
          <Sparkles size={14} style={{ color: TINT }} />
          Claude
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums leading-none"
            style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
          >
            {live.length}
          </span>
          <ChevronRight size={16} className="text-faint" />
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 py-2">
        {rows.map((s, i) => {
          const waiting = s.status === "waiting";
          return (
            <div
              key={s.id}
              className="row-in flex items-start gap-3 rounded-[14px] px-3 py-2.5"
              style={{
                animationDelay: `${i * 50}ms`,
                background: waiting
                  ? "color-mix(in srgb, var(--color-warn) 11%, transparent)"
                  : undefined,
                boxShadow: waiting
                  ? "inset 0 0 0 1px color-mix(in srgb, var(--color-warn) 24%, transparent)"
                  : undefined,
              }}
            >
              <span
                className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${
                  waiting ? "" : "animate-soft-pulse"
                }`}
                style={{
                  background: waiting ? "var(--color-warn)" : "var(--color-ok)",
                  boxShadow: waiting
                    ? "0 0 0 3px color-mix(in srgb, var(--color-warn) 28%, transparent)"
                    : undefined,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
                    {s.project}
                  </span>
                  <span
                    className="shrink-0 text-[11px] font-medium"
                    style={{ color: waiting ? "var(--color-warn)" : "var(--color-ok)" }}
                  >
                    {waiting ? "bekliyor" : "çalışıyor"}
                  </span>
                </span>
                <span className="mt-0.5 flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 truncate text-[12.5px] ${waiting ? "" : "text-dim"}`}>
                    {currentStep(s)}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-faint">
                    {fmtAgo(s.lastActiveAt, now)}
                  </span>
                </span>
              </span>
            </div>
          );
        })}
        {overflow > 0 && (
          <div className="px-3 text-[12px] text-faint">+{overflow} oturum daha</div>
        )}
      </div>

      {limit && (
        <footer className="shrink-0">
          <div className="h-[3px] overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, limit.percent)}%`,
                background: limitColor(limit.percent),
                transition: "width 400ms var(--ease-out-strong)",
              }}
            />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px]">
            <span className="text-dim">
              Oturum limiti{" "}
              <span className="font-semibold tabular-nums" style={{ color: limitColor(limit.percent) }}>
                %{limit.percent}
              </span>
            </span>
            <span className="truncate text-faint">{fmtReset(limit.resetsAt, now)}</span>
          </div>
        </footer>
      )}
    </button>
  );
}
