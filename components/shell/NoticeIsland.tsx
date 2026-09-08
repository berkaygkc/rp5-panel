"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Mail,
  MessageCircle,
  Server,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNow } from "@/lib/data/useNow";
import { getCore } from "@/lib/data/core";
import { SEVERITY_RANK, type Notice } from "@/lib/notices/types";

const KIND: Record<string, { icon: LucideIcon; tint: string }> = {
  claude: { icon: Sparkles, tint: "var(--color-terracotta)" },
  mail: { icon: Mail, tint: "var(--color-indigo)" },
  ci: { icon: Workflow, tint: "var(--color-orange)" },
  server: { icon: Server, tint: "var(--color-teal)" },
  system: { icon: AlertTriangle, tint: "var(--color-red)" },
  chat: { icon: MessageCircle, tint: "var(--color-green)" },
};
const FALLBACK = { icon: Bell, tint: "var(--color-ink)" };

/** info/attention bu kadar süre genişler, sonra ikona çekilir; urgent hiç çekilmez */
const EXPAND_MS = 7000;
const SWIPE_DISMISS_PX = 24;
const WIDTH_MS = 280;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function accent(n: Notice): string {
  if (n.severity === "urgent") return "var(--color-err)";
  if (n.severity === "attention") return "var(--color-warn)";
  return (KIND[n.kind] ?? FALLBACK).tint;
}

/**
 * Dynamic Island: ekranlardan bağımsız, içerik alanının üst ortasında yüzen kapsül.
 * En önemli bildirim genişler; info/attention 7 sn sonra ikona çekilir ve altındaki
 * ekranı örtmez, urgent kullanıcı kapatana kadar açık kalır. Toplanmışken dokunmak
 * geri açar, açıkken ilgili ekrana gider; yukarı kaydırmak kapatır.
 * Kilitliyken içerik göstermez, yalnızca sayı.
 */
export default function NoticeIsland({
  notices,
  locked,
  onOpen,
  onDismiss,
}: {
  notices: Notice[];
  locked: boolean;
  onOpen: (screen: string) => void;
  onDismiss: (id: string) => void;
}) {
  const now = useNow(10_000)?.getTime() ?? 0;
  const active = notices
    .filter((n) => n.expiresAt === null || now === 0 || n.expiresAt > now)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.ts - a.ts);
  const top = active[0] ?? null;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const prevWidth = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  // Yeni "en önemli" bildirim gelince genişle; urgent değilse bir süre sonra kapsüle çekil
  useEffect(() => {
    if (!top) return;
    const timers: number[] = [window.setTimeout(() => setExpandedId(top.id), 0)];
    if (top.severity !== "urgent") {
      timers.push(window.setTimeout(() => setExpandedId(null), EXPAND_MS));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [top?.id, top?.severity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Genişlik geçişi: FLIP (dock ile aynı yöntem) — kapsül doğal genişliğinde kalır
  const expanded = !locked && top !== null && expandedId === top.id;
  useIsoLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const next = el.getBoundingClientRect().width;
    const prev = prevWidth.current;
    prevWidth.current = next;
    if (prev === null || Math.abs(prev - next) < 1) return;
    el.animate([{ width: `${prev}px` }, { width: `${next}px` }], {
      duration: WIDTH_MS,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }, [expanded, top?.id, active.length]);

  if (!top) return null;

  const meta = KIND[top.kind] ?? FALLBACK;
  const Icon = meta.icon;
  const color = accent(top);

  const activate = () => {
    if (locked) return;
    if (!expanded) {
      setExpandedId(top.id);
      return;
    }
    if (top.screen) onOpen(top.screen);
    if (top.severity !== "urgent") onDismiss(top.id);
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div
        ref={shellRef}
        key={top.id + (expanded ? ":x" : ":c")}
        role="status"
        aria-live="polite"
        onPointerDown={(e) => {
          swipeStartY.current = e.clientY;
        }}
        onPointerUp={(e) => {
          const start = swipeStartY.current;
          swipeStartY.current = null;
          if (start !== null && start - e.clientY > SWIPE_DISMISS_PX) {
            onDismiss(top.id);
            return;
          }
          activate();
        }}
        className={`island-in surface-shell pointer-events-auto flex h-12 w-max max-w-[640px] items-center overflow-hidden rounded-full ${
          expanded ? "gap-3 pl-2 pr-3" : "gap-0 px-2"
        }`}
        style={{
          outline: top.severity === "urgent" ? `2px solid color-mix(in srgb, ${color} 45%, transparent)` : undefined,
          touchAction: "none",
        }}
      >
        <span
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <Icon size={16} strokeWidth={2.25} />
          {/* Toplanmış haldeyken sayı ikonun üstünde durur; kapsül dar kalsın diye */}
          {!expanded && active.length > 1 && (
            <span
              className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9.5px] font-bold tabular-nums leading-none text-white"
              style={{ background: color }}
            >
              {active.length}
            </span>
          )}
        </span>

        {expanded ? (
          <>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13.5px] font-semibold">{top.title}</span>
              {top.body && (
                <span className="block truncate text-[11.5px] text-dim">{top.body}</span>
              )}
            </span>
            {/* Bildirimin taşıdığı eylemler: dokunulunca çekirdek işi yapan cihaza yollar */}
            {(top.actions ?? []).slice(0, 2).map((act) => (
              <button
                key={act.id}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  void getCore()
                    .intent(act.capability, act.action, act.args)
                    .then((ack) => {
                      if (ack.ok && act.dismiss !== false) onDismiss(top.id);
                    });
                }}
                className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold active:scale-95"
                style={{
                  background: `color-mix(in srgb, ${color} 20%, transparent)`,
                  color,
                  transition: "transform 120ms var(--ease-out-strong)",
                }}
              >
                {act.label}
              </button>
            ))}
            {active.length > 1 && (
              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-[11px] font-semibold tabular-nums text-dim">
                +{active.length - 1}
              </span>
            )}
            <button
              aria-label="Bildirimi kapat"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(top.id);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-dim active:bg-raised"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </>
        ) : locked ? (
          <span className="flex min-w-0 items-center gap-2 pl-2 pr-1">
            <span className="text-[13px] font-semibold tabular-nums">{active.length} bildirim</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
