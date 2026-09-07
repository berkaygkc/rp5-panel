"use client";

import { AlertTriangle, Terminal, Wrench } from "lucide-react";
import { Module, Stage } from "@/components/ui/Stage";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useClaude } from "@/lib/data/useClaude";
import { useNow } from "@/lib/data/useNow";
import { fmtAgo, fmtTokens } from "@/lib/format";
import { fmtReset } from "@/lib/usageTime";
import type {
  ClaudeSession,
  FeedEvent,
  SessionStatus,
  Usage,
  UsageLimit,
} from "@/lib/types/claude";

const TINT = "var(--color-terracotta)";

const STATUS: Record<SessionStatus, { label: string; color: string }> = {
  working: { label: "çalışıyor", color: "var(--color-ok)" },
  waiting: { label: "bekliyor", color: "var(--color-warn)" },
  closed: { label: "kapalı", color: "var(--color-faint)" },
};

/** "claude-fable-5-1" → "Fable 5.1", "claude-haiku-4-5-20251001" → "Haiku 4.5" */
function modelLabel(model: string | null): string {
  if (!model) return "—";
  const parts = model.replace(/^claude-/, "").split("-");
  const family = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : model;
  const version = parts.slice(1).filter((p) => /^\d{1,2}$/.test(p)).join(".");
  return version ? `${family} ${version}` : family;
}

const barColor = (p: number) =>
  p >= 85 ? "var(--color-err)" : p >= 60 ? "var(--color-warn)" : TINT;

function LimitBar({ limit, now }: { limit: UsageLimit; now: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] font-medium">{limit.label}</span>
        <span
          className="shrink-0 text-[15px] font-semibold tabular-nums"
          style={{ color: barColor(limit.percent) }}
        >
          %{limit.percent}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, limit.percent)}%`,
            background: barColor(limit.percent),
            transition: "width 400ms var(--ease-out-strong)",
          }}
        />
      </div>
      <div className="mt-1 text-[11px] text-faint">{fmtReset(limit.resetsAt, now)}</div>
    </div>
  );
}

function UsageCard({ usage, now }: { usage: Usage; now: number }) {
  const ready = usage.limits.length > 0;
  return (
    <Module
      className="pl-5"
      title="Plan Kullanımı"
      right={
        <span className="text-[11px] text-faint">
          {usage.updatedAt ? fmtAgo(usage.updatedAt, now) : "ölçülüyor…"}
        </span>
      }
    >
      {!ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle size={22} className="text-faint" />
          <div className="text-[13px] text-dim">
            {usage.error ? "Kullanım okunamadı" : "Kullanım ölçülüyor…"}
          </div>
          {usage.error && <div className="text-[11px] text-faint">{usage.error}</div>}
        </div>
      ) : (
        <ScrollArea>
          <div className="flex flex-col gap-3.5">
            {usage.limits.map((l) => (
              <LimitBar key={l.id} limit={l} now={now} />
            ))}

            {usage.windows.map((w) => (
              <div key={w.id} className="rounded-xl bg-raised px-3 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-semibold">{w.label}</span>
                  <span className="text-[11px] tabular-nums text-dim">
                    {w.requests.toLocaleString("tr-TR")} istek · {w.sessions} oturum
                  </span>
                </div>
                {w.notes[0] && (
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-faint">
                    {w.notes[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Module>
  );
}

/* ── Oturum listesi ── */

function SessionRow({
  s,
  selected,
  now,
  onSelect,
}: {
  s: ClaudeSession;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const meta = STATUS[s.status];
  const live = s.status !== "closed";
  const secondLine =
    live && s.activity
      ? s.activity.kind === "tool"
        ? `${s.activity.tool} çalıştırıyor`
        : s.activity.text
      : s.title;

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.99] ${
        selected ? "bg-raised" : "active:bg-card"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.status === "working" ? "animate-soft-pulse" : ""}`}
        style={{ background: meta.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[14px] font-semibold">{s.project}</span>
          {live && (
            <span className="shrink-0 text-[11px]" style={{ color: meta.color }}>
              {meta.label}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-dim">
          {secondLine}
        </span>
      </span>
      <span className="shrink-0 text-right leading-tight">
        <span className="block text-[13px] font-medium tabular-nums text-dim">
          {s.parsing ? "…" : fmtTokens(s.tokens.output)}
        </span>
        <span className="block text-[11px] text-faint">{fmtAgo(s.lastActiveAt, now)}</span>
      </span>
    </button>
  );
}

/* ── Canlı akış satırları ── */

function FeedRow({ e }: { e: FeedEvent }) {
  if (e.kind === "user") {
    return (
      <div className="flex gap-2.5">
        <span className="mt-1 w-[3px] shrink-0 self-stretch rounded-full" style={{ background: TINT }} />
        <p className="line-clamp-3 min-w-0 break-words text-[13px] leading-snug">{e.text}</p>
      </div>
    );
  }
  if (e.kind === "assistant") {
    return (
      <p className="line-clamp-2 min-w-0 break-words pl-[13px] text-[13px] leading-snug text-dim">{e.text}</p>
    );
  }
  if (e.kind === "tool") {
    return (
      <div className="flex min-w-0 items-start gap-2 pl-[13px]">
        <span
          className="mt-px flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
          style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
        >
          <Wrench size={10} strokeWidth={2.5} />
          {e.tool}
        </span>
        {e.text && (
          <span className="min-w-0 flex-1 truncate text-[12px] leading-snug text-dim">{e.text}</span>
        )}
      </div>
    );
  }
  return (
    <p
      className={`min-w-0 truncate pl-[13px] text-[12px] leading-snug ${
        e.error ? "text-err" : "text-faint"
      }`}
    >
      ↳ {e.text}
    </p>
  );
}

/* ── Ekran ── */

export default function ClaudeScreen() {
  const { data, stale, select } = useClaude();
  const now = useNow(20_000)?.getTime() ?? 0;

  const selected = data.sessions.find((s) => s.id === data.selectedId) ?? null;
  const live = data.sessions.filter((s) => s.status !== "closed");
  const closed = data.sessions.filter((s) => s.status === "closed");
  const { working, waiting } = data.stats;
  const total = Math.max(1, data.sessions.length);

  return (
    <Stage cols="400px minmax(0,1fr) 390px">
      {/* 1 — Oturumlar */}
      <Module
        divider={false}
        className="pr-5"
        title="Oturumlar"
        right={
          stale ? (
            <span className="flex items-center gap-1.5 text-[11px] text-dim">
              <span className="h-2 w-2 rounded-full bg-warn" /> bağlantı yok
            </span>
          ) : (
            <span className="text-[11px] tabular-nums text-faint">{data.sessions.length}</span>
          )
        }
      >
        {/* Durum dağılımı — aktif / bekleyen / kapalı */}
        <div className="mb-3 shrink-0">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-raised">
            <span
              style={{
                width: `${(working / total) * 100}%`,
                background: "var(--color-ok)",
                transition: "width 400ms var(--ease-out-strong)",
              }}
            />
            <span
              style={{
                width: `${(waiting / total) * 100}%`,
                background: "var(--color-warn)",
                transition: "width 400ms var(--ease-out-strong)",
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px]">
            <span className="text-ok">{working} çalışıyor</span>
            <span className="text-warn">{waiting} bekliyor</span>
            <span className="text-faint">{closed.length} kapalı</span>
          </div>
        </div>

        <ScrollArea>
          <div className="flex flex-col gap-0.5">
            {data.sessions.length === 0 && (
              <div className="py-8 text-center text-[13px] text-faint">
                {stale ? "Ajan bağlanınca oturumlar gelecek" : "Son 14 günde oturum yok"}
              </div>
            )}
            {live.map((s) => (
              <SessionRow
                key={s.id}
                s={s}
                selected={s.id === data.selectedId}
                now={now}
                onSelect={() => select(s.id)}
              />
            ))}
            {closed.length > 0 && live.length > 0 && (
              <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Kapalı
              </div>
            )}
            {closed.map((s) => (
              <SessionRow
                key={s.id}
                s={s}
                selected={s.id === data.selectedId}
                now={now}
                onSelect={() => select(s.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </Module>

      {/* 2 — Seçili oturumun akışı */}
      <Module
        className="px-5"
        title={selected ? selected.project : "Akış"}
        right={
          selected && (
            <span className="flex items-center gap-2 text-[11px]">
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
              >
                {modelLabel(selected.model)}
              </span>
              <span style={{ color: STATUS[selected.status].color }}>
                {STATUS[selected.status].label}
              </span>
            </span>
          )
        }
      >
        {selected ? (
          <>
            {/* Yapılandırılmış özet — üst üste binen tek satır yerine ayrı künyeler */}
            <div className="mb-2.5 shrink-0">
              <div className="truncate text-[13px] font-medium">{selected.title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {[
                  selected.branch,
                  `${selected.prompts} prompt`,
                  `${fmtTokens(selected.tokens.output)} çıktı`,
                  `${fmtTokens(selected.tokens.cacheRead)} önbellek`,
                  selected.costUsd !== null ? `~$${selected.costUsd.toFixed(0)}` : null,
                  selected.linesAdded + selected.linesRemoved > 0
                    ? `+${selected.linesAdded} −${selected.linesRemoved}`
                    : null,
                ]
                  .filter(Boolean)
                  .map((chip) => (
                    <span
                      key={chip as string}
                      className="rounded-md bg-raised px-2 py-0.5 text-[11px] tabular-nums text-dim"
                    >
                      {chip}
                    </span>
                  ))}
              </div>
            </div>

            <ScrollArea stickToBottom bottomKey={selected.id}>
              <div className="flex flex-col gap-2 pb-1">
                {data.feed.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-faint">
                    {selected.status === "working" ? "Akış bekleniyor…" : "Bu oturumda olay yok"}
                  </div>
                ) : (
                  data.feed.map((e, i) => <FeedRow key={`${e.ts}-${i}`} e={e} />)
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Terminal size={22} className="text-faint" />
            <div className="text-[13px] text-dim">Akışı görmek için bir oturum seç</div>
          </div>
        )}
      </Module>

      {/* 3 — Plan kullanımı */}
      <UsageCard usage={data.usage} now={now} />
    </Stage>
  );
}
