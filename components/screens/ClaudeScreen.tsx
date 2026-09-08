"use client";

import { AlertTriangle, FolderOpen, GitBranch, Terminal, Wrench } from "lucide-react";
import { useState } from "react";
import { Module, Stage } from "@/components/ui/Stage";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Gauge } from "@/components/ui/Gauge";
import { getCore } from "@/lib/data/core";
import { useClaude } from "@/lib/data/useClaude";
import { useNow } from "@/lib/data/useNow";
import { fmtAgo, fmtTokens } from "@/lib/format";
import { fmtReset } from "@/lib/usageTime";
import type { ClaudeSession, FeedEvent, SessionStatus, Usage, UsageLimit } from "@/lib/types/claude";

const TINT = "var(--color-terracotta)";

const STATUS: Record<SessionStatus, { label: string; color: string }> = {
  working: { label: "çalışıyor", color: "var(--color-ok)" },
  waiting: { label: "sizi bekliyor", color: "var(--color-warn)" },
  closed: { label: "kapalı", color: "var(--color-faint)" },
};

/** "claude-fable-5-1" → "Fable 5.1" */
function modelLabel(model: string | null): string {
  if (!model) return "—";
  const parts = model.replace(/^claude-/, "").split("-");
  const family = parts[0] ? parts[0][0].toLocaleUpperCase("tr-TR") + parts[0].slice(1) : model;
  const version = parts.slice(1).filter((p) => /^\d{1,2}$/.test(p)).join(".");
  return version ? `${family} ${version}` : family;
}

const limitColor = (p: number) => (p >= 85 ? "var(--color-err)" : p >= 60 ? "var(--color-warn)" : TINT);
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

/* ── Oturum kartı ── */

function SessionCard({
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
  const [opening, setOpening] = useState(false);
  const meta = STATUS[s.status];
  const waiting = s.status === "waiting";
  const working = s.status === "working";

  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (opening || !s.cwd) return;
    setOpening(true);
    void getCore()
      .intent("shortcuts", "run", { id: `claude:${s.id}`, action: { kind: "project", path: s.cwd } })
      .finally(() => setOpening(false));
  };

  return (
    <button
      onClick={onSelect}
      className="flex w-full flex-col gap-1.5 rounded-[var(--r-md)] px-3 py-2.5 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.99]"
      style={{
        background: waiting
          ? "color-mix(in srgb, var(--color-warn) 12%, transparent)"
          : selected
            ? "var(--color-raised)"
            : undefined,
        boxShadow: waiting
          ? "inset 0 0 0 1px color-mix(in srgb, var(--color-warn) 26%, transparent)"
          : selected
            ? "inset 0 0 0 1px var(--card-ring)"
            : undefined,
      }}
    >
      <span className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${working ? "animate-soft-pulse" : ""}`}
          style={{ background: meta.color }}
        />
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{s.project}</span>
        <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtAgo(s.lastActiveAt, now)}</span>
      </span>

      {/* Bekleyen oturum sorusunu gösterir: ekranın en önemli satırı budur */}
      {waiting && s.activity?.text && (
        <span className="line-clamp-3 text-[12.5px] leading-snug" style={{ color: "var(--color-ink)" }}>
          {s.activity.text}
        </span>
      )}
      {working && (
        <span className="flex min-w-0 items-center gap-1.5">
          {s.activity?.kind === "tool" ? (
            <>
              <span
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
                style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
              >
                <Wrench size={9} strokeWidth={2.5} />
                {s.activity.tool}
              </span>
              <span className="min-w-0 truncate text-[12px] text-dim">{s.activity.text}</span>
            </>
          ) : (
            <span className="min-w-0 truncate text-[12px] text-dim">{s.activity?.text ?? "Çalışıyor"}</span>
          )}
        </span>
      )}
      {s.status === "closed" && <span className="truncate text-[12px] text-faint">{s.title}</span>}

      <span className="flex items-center gap-2.5 text-[10.5px] text-faint">
        {s.branch && (
          <span className="flex min-w-0 items-center gap-1">
            <GitBranch size={9} />
            <span className="truncate">{s.branch}</span>
          </span>
        )}
        <span className="tabular-nums">{s.parsing ? "…" : fmtTokens(s.tokens.output)} çıktı</span>
        {s.prompts > 0 && <span className="tabular-nums">{s.prompts} istem</span>}
        {waiting && s.cwd && (
          <span
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => e.key === "Enter" && open(e as unknown as React.MouseEvent)}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ background: "color-mix(in srgb, var(--color-warn) 20%, transparent)", color: "var(--color-warn)" }}
          >
            <FolderOpen size={10} />
            {opening ? "açılıyor" : "aç"}
          </span>
        )}
      </span>
    </button>
  );
}

/* ── Döküm ── */

function FeedBlock({ e, showTime }: { e: FeedEvent; showTime: boolean }) {
  const time = (
    <span className="w-[42px] shrink-0 pt-[3px] text-right text-[10.5px] tabular-nums text-faint">
      {showTime ? hhmm(e.ts) : ""}
    </span>
  );

  if (e.kind === "user") {
    return (
      <div className="flex gap-3">
        {time}
        <div className="min-w-0 flex-1 border-l-2 pl-3" style={{ borderColor: TINT }}>
          <p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-snug">{e.text}</p>
        </div>
      </div>
    );
  }
  if (e.kind === "assistant") {
    return (
      <div className="flex gap-3">
        {time}
        <p className="min-w-0 max-w-[72ch] flex-1 whitespace-pre-wrap break-words pl-3 text-[13px] leading-[1.55] text-dim">
          {e.text}
        </p>
      </div>
    );
  }
  if (e.kind === "tool") {
    return (
      <div className="flex gap-3">
        {time}
        <div className="flex min-w-0 flex-1 items-start gap-2 pl-3">
          <span
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold"
            style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
          >
            <Wrench size={10} strokeWidth={2.5} />
            {e.tool}
          </span>
          {e.text && <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] leading-snug text-dim">{e.text}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      {time}
      <p
        className="min-w-0 flex-1 truncate pl-3 font-mono text-[11.5px] leading-snug"
        style={{ color: e.error ? "var(--color-err)" : "var(--color-faint)" }}
      >
        {e.text}
      </p>
    </div>
  );
}

/* ── Plan ── */

function UsagePanel({ usage, now }: { usage: Usage; now: number }) {
  const primary: UsageLimit | undefined = usage.limits.find((l) => l.id === "session") ?? usage.limits[0];
  const rest = usage.limits.filter((l) => l !== primary);

  return (
    <Module
      className="pl-5"
      title="Plan"
      right={<span className="text-[11px] text-faint">{usage.updatedAt ? fmtAgo(usage.updatedAt, now) : "ölçülüyor"}</span>}
    >
      {!primary ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <AlertTriangle size={20} className="text-faint" />
          <div className="text-[13px] text-dim">{usage.error ? "Kullanım okunamadı" : "Ölçülüyor"}</div>
          {usage.error && <div className="max-w-[240px] text-[11px] leading-snug text-faint">{usage.error}</div>}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 items-center gap-4">
            <Gauge percent={primary.percent} size={104} thickness={9} color={limitColor(primary.percent)}>
              <span className="text-[24px] font-semibold tabular-nums tracking-[-0.03em]">%{primary.percent}</span>
              <span className="mt-0.5 text-[10px] text-faint">kullanıldı</span>
            </Gauge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{primary.label}</div>
              <div className="mt-1 text-[11.5px] leading-snug text-dim">{fmtReset(primary.resetsAt, now)}</div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 pr-2">
              {rest.map((l) => (
                <div key={l.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px]">{l.label}</span>
                    <span className="shrink-0 text-[12.5px] font-semibold tabular-nums" style={{ color: limitColor(l.percent) }}>
                      %{l.percent}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(2, l.percent)}%`, background: limitColor(l.percent), transition: "width 500ms var(--ease-out-strong)" }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-faint">{fmtReset(l.resetsAt, now)}</div>
                </div>
              ))}
              {usage.windows.map((w) => (
                <div key={w.id} className="rounded-[var(--r-sm)] px-2.5 py-2" style={{ background: "var(--quiet-wash)" }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11.5px] font-semibold">{w.label}</span>
                    <span className="text-[10.5px] tabular-nums text-dim">
                      {w.requests.toLocaleString("tr-TR")} istek · {w.sessions} oturum
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </Module>
  );
}

/* ── Ekran ── */

export default function ClaudeScreen() {
  const { data, stale, select } = useClaude();
  const now = useNow(20_000)?.getTime() ?? 0;

  const selected = data.sessions.find((s) => s.id === data.selectedId) ?? null;
  const ordered = [...data.sessions].sort((a, b) => {
    const rank = (s: ClaudeSession) => (s.status === "waiting" ? 0 : s.status === "working" ? 1 : 2);
    return rank(a) - rank(b) || b.lastActiveAt - a.lastActiveAt;
  });
  const live = ordered.filter((s) => s.status !== "closed");
  const closed = ordered.filter((s) => s.status === "closed");
  const { working, waiting } = data.stats;

  return (
    <Stage cols="360px minmax(0,1fr) 330px">
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
            <span className="flex items-center gap-2.5 text-[11px] tabular-nums">
              {waiting > 0 && <span style={{ color: "var(--color-warn)" }}>{waiting} bekliyor</span>}
              <span style={{ color: "var(--color-ok)" }}>{working} çalışıyor</span>
            </span>
          )
        }
      >
        {data.sessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Terminal size={20} className="text-faint" />
            <div className="text-[13px] text-dim">{stale ? "Cihaz bağlanınca oturumlar gelecek" : "Açık oturum yok"}</div>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1.5 pr-2">
              {live.map((s) => (
                <SessionCard key={s.id} s={s} selected={s.id === data.selectedId} now={now} onSelect={() => select(s.id)} />
              ))}
              {closed.length > 0 && (
                <>
                  <div className="mt-2 px-3 pb-1 text-[10.5px] font-medium text-faint">Kapananlar</div>
                  {closed.slice(0, 6).map((s) => (
                    <SessionCard key={s.id} s={s} selected={s.id === data.selectedId} now={now} onSelect={() => select(s.id)} />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </Module>

      {/* 2 — Döküm */}
      <Module
        className="px-5"
        title={selected ? selected.project : "Döküm"}
        right={
          selected && (
            <span className="flex items-center gap-2 text-[11px]">
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
              >
                {modelLabel(selected.model)}
              </span>
              <span style={{ color: STATUS[selected.status].color }}>{STATUS[selected.status].label}</span>
              <span className="tabular-nums text-faint">
                {fmtTokens(selected.tokens.output)} çıktı
                {typeof selected.costUsd === "number" ? ` · ~$${selected.costUsd.toFixed(0)}` : ""}
              </span>
            </span>
          )
        }
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Terminal size={20} className="text-faint" />
            <div className="text-[13px] text-dim">Dökümü görmek için bir oturum seç</div>
          </div>
        ) : data.feed.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-faint">Bu oturumda henüz olay yok</div>
        ) : (
          <ScrollArea className="min-h-0 flex-1" stickToBottom bottomKey={selected.id}>
            <div className="flex flex-col gap-2 pr-3">
              {data.feed.map((e, i) => (
                <FeedBlock key={`${e.ts}-${i}`} e={e} showTime={i === 0 || hhmm(e.ts) !== hhmm(data.feed[i - 1].ts)} />
              ))}
            </div>
          </ScrollArea>
        )}
      </Module>

      {/* 3 — Plan */}
      <UsagePanel usage={data.usage} now={now} />
    </Stage>
  );
}
