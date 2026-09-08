"use client";

import { useState } from "react";
import { Inbox, Mail, Paperclip, Star } from "lucide-react";
import { Module, Stage } from "@/components/ui/Stage";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useMail } from "@/lib/data/useMail";
import { useNow } from "@/lib/data/useNow";
import { fmtAgo, fmtWhen } from "@/lib/format";
import type { MailAccount, MailMessage } from "@/lib/types/mail";

const TINT = "var(--color-indigo)";

/** Gönderen rengi adresten türer: aynı kişi her zaman aynı renkte görünür */
const HUES: [string, string][] = [
  ["var(--color-blue)", "var(--color-indigo)"],
  ["var(--color-indigo)", "var(--color-purple)"],
  ["var(--color-purple)", "var(--color-pink)"],
  ["var(--color-orange)", "var(--color-yellow)"],
  ["var(--color-teal)", "var(--color-mint)"],
  ["var(--color-green)", "var(--color-teal)"],
];
function hue(key: string): [string, string] {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}
function initials(m: MailMessage): string {
  const name = m.fromName.replace(/["']/g, "").trim();
  if (name && !name.includes("@")) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toLocaleUpperCase("tr-TR");
  }
  return (m.fromAddress[0] ?? "?").toLocaleUpperCase("tr-TR");
}
function Avatar({ m, size }: { m: MailMessage; size: number }) {
  const [a, b] = hue(m.fromAddress || m.fromName);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
    >
      {size >= 24 && initials(m)}
    </span>
  );
}
const sender = (m: MailMessage) => m.fromName || m.fromAddress;
const shortAccount = (a: MailAccount) => (a.title.includes("@") ? a.title.split("@")[0] : a.title);

/* ── Liste satırı ── */

function MessageRow({ m, selected, now, onSelect }: { m: MailMessage; selected: boolean; now: number; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.99] ${
        selected ? "bg-raised" : "active:bg-card"
      }`}
    >
      <span className="relative shrink-0">
        <Avatar m={m} size={36} />
        {m.unseen && (
          <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full" style={{ background: TINT, boxShadow: "0 0 0 2px var(--color-night)" }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`min-w-0 flex-1 truncate text-[13.5px] ${m.unseen ? "font-semibold" : "font-medium text-dim"}`}>{sender(m)}</span>
          {m.starred && <Star size={11} className="shrink-0 text-warn" fill="currentColor" strokeWidth={0} />}
          {m.attachments > 0 && <Paperclip size={11} className="shrink-0 text-faint" />}
          <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtWhen(m.receivedAt, now)}</span>
        </span>
        <span className={`mt-0.5 block truncate text-[12.5px] ${m.unseen ? "" : "text-dim"}`}>{m.subject}</span>
        <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-faint">{m.preview}</span>
      </span>
    </button>
  );
}

/* ── Ekran ── */

export default function MailScreen() {
  const { data, stale } = useMail();
  const now = useNow(30_000)?.getTime() ?? 0;
  const [accountPk, setAccountPk] = useState<number | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [selectedPk, setSelectedPk] = useState<number | null>(null);

  const totalUnread = data.accounts.reduce((sum, a) => sum + a.unread, 0);
  const messages = data.messages.filter((m) => (accountPk === null || m.accountPk === accountPk) && (!unreadOnly || m.unseen));
  const selected = messages.find((m) => m.pk === selectedPk) ?? messages[0] ?? null;
  const account = selected ? data.accounts.find((a) => a.pk === selected.accountPk) : null;
  /** Aynı kişiden bekleyen diğer postalar — okuma bölmesinin altındaki bağlam */
  const alsoFrom = selected
    ? data.messages.filter((m) => m.pk !== selected.pk && m.fromAddress === selected.fromAddress).slice(0, 4)
    : [];

  const chip = (label: string, active: boolean, onTap: () => void, count?: number) => (
    <button
      onClick={onTap}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150"
      style={{ background: active ? `color-mix(in srgb, ${TINT} 18%, transparent)` : "var(--color-raised)", color: active ? TINT : "var(--color-dim)" }}
    >
      {label}
      {count !== undefined && <span className="tabular-nums opacity-70">{count}</span>}
    </button>
  );

  return (
    <Stage cols="216px minmax(0,1fr) 360px">
      {/* 1 — Kutular */}
      <Module
        divider={false}
        className="pr-5"
        title="Kutular"
        right={
          stale ? (
            <span className="h-2 w-2 rounded-full bg-warn" title="bağlantı yok" />
          ) : (
            <span className="text-[11px] tabular-nums text-faint">{totalUnread}</span>
          )
        }
      >
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 pr-2">
            <button
              onClick={() => setAccountPk(null)}
              className={`flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2 text-left ${accountPk === null ? "bg-raised" : "active:bg-card"}`}
            >
              <Inbox size={14} style={{ color: TINT }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">Tüm kutular</span>
              <span className="shrink-0 text-[11px] tabular-nums text-dim">{totalUnread}</span>
            </button>
            {data.accounts.map((a) => (
              <button
                key={a.pk}
                onClick={() => setAccountPk(a.pk)}
                className={`flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2 text-left ${accountPk === a.pk ? "bg-raised" : "active:bg-card"}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.unread > 0 ? TINT : "var(--color-track)" }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{shortAccount(a)}</span>
                {a.unread > 0 && <span className="shrink-0 text-[11px] tabular-nums text-dim">{a.unread}</span>}
              </button>
            ))}
          </div>
        </ScrollArea>
      </Module>

      {/* 2 — Liste */}
      <Module
        className="px-5"
        title="Gelen kutusu"
        right={
          <span className="flex items-center gap-1.5">
            {chip("Okunmamış", unreadOnly, () => setUnreadOnly(true), totalUnread)}
            {chip("Tümü", !unreadOnly, () => setUnreadOnly(false), data.messages.length)}
          </span>
        }
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${TINT} 12%, transparent)`, color: TINT }}>
              <Mail size={20} strokeWidth={1.75} />
            </span>
            <span className="text-[14px] text-dim">{unreadOnly ? "Okunmamış posta yok" : "Posta yok"}</span>
            {!stale && data.updatedAt > 0 && <span className="text-[11px] text-faint">{fmtAgo(data.updatedAt, now)} güncellendi</span>}
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pr-3">
              {messages.map((m) => (
                <MessageRow key={m.pk} m={m} selected={selected?.pk === m.pk} now={now} onSelect={() => setSelectedPk(m.pk)} />
              ))}
            </div>
          </ScrollArea>
        )}
      </Module>

      {/* 3 — Okuma */}
      <Module className="pl-5" title={selected ? "Posta" : "Önizleme"}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Mail size={20} className="text-faint" />
            <div className="text-[13px] text-dim">{stale ? "Cihaz bağlanınca posta gelecek" : "Bir posta seç"}</div>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1" bottomKey={String(selected.pk)}>
            <div className="flex flex-col gap-3 pr-2">
              <div className="flex items-start gap-3">
                <Avatar m={selected} size={44} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[14px] font-semibold">{sender(selected)}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-faint">{selected.fromAddress}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {account && <span className="rounded-md px-1.5 py-0.5 text-[10.5px] text-dim" style={{ background: "var(--quiet-wash)" }}>{shortAccount(account)}</span>}
                    <span className="text-[10.5px] tabular-nums text-faint">
                      {new Date(selected.receivedAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {selected.attachments > 0 && (
                      <span className="flex items-center gap-1 text-[10.5px] text-faint">
                        <Paperclip size={10} />
                        {selected.attachments} ek
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <h2 className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">{selected.subject}</h2>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-dim">{selected.preview || "Önizleme yok"}</p>

              {alsoFrom.length > 0 && (
                <div className="mt-1 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                  <div className="mb-1.5 text-[11px] font-medium text-faint">Aynı kişiden</div>
                  <div className="flex flex-col gap-1.5">
                    {alsoFrom.map((m) => (
                      <button key={m.pk} onClick={() => setSelectedPk(m.pk)} className="flex items-baseline gap-2 text-left">
                        <span className={`min-w-0 flex-1 truncate text-[12px] ${m.unseen ? "font-medium" : "text-dim"}`}>{m.subject}</span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtWhen(m.receivedAt, now)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10.5px] leading-snug text-faint">
                Panel yalnızca önizlemeyi okur; tam metin ve ekler Spark&apos;ta durur.
              </div>
            </div>
          </ScrollArea>
        )}
      </Module>
    </Stage>
  );
}
