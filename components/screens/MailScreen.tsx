"use client";

import { useState } from "react";
import { Inbox, Mail, Paperclip, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useMail } from "@/lib/data/useMail";
import { useNow } from "@/lib/data/useNow";
import { fmtAgo, fmtWhen } from "@/lib/format";
import type { MailMessage } from "@/lib/types/mail";

const TINT = "var(--color-indigo)";

function MessageRow({
  m,
  selected,
  now,
  onSelect,
}: {
  m: MailMessage;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.99] ${
        selected ? "bg-raised" : "active:bg-card"
      }`}
    >
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: m.unseen ? TINT : "transparent" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`min-w-0 flex-1 truncate text-[13px] ${m.unseen ? "font-semibold" : "font-medium text-dim"}`}>
            {m.fromName || m.fromAddress}
          </span>
          {m.starred && <Star size={11} className="shrink-0 text-warn" fill="currentColor" strokeWidth={0} />}
          {m.attachments > 0 && <Paperclip size={11} className="shrink-0 text-faint" />}
          <span className="shrink-0 text-[11px] tabular-nums text-faint">{fmtWhen(m.receivedAt, now)}</span>
        </span>
        <span className={`mt-0.5 block truncate text-[13px] ${m.unseen ? "" : "text-dim"}`}>
          {m.subject}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-faint">{m.preview}</span>
      </span>
    </button>
  );
}

export default function MailScreen() {
  const { data, stale } = useMail();
  const now = useNow(30_000)?.getTime() ?? 0;
  const [accountPk, setAccountPk] = useState<number | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedPk, setSelectedPk] = useState<number | null>(null);

  const totalUnread = data.accounts.reduce((sum, a) => sum + a.unread, 0);
  const messages = data.messages.filter(
    (m) => (accountPk === null || m.accountPk === accountPk) && (!unreadOnly || m.unseen)
  );
  const selected = messages.find((m) => m.pk === selectedPk) ?? messages[0] ?? null;
  const account = selected ? data.accounts.find((a) => a.pk === selected.accountPk) : null;

  const filterButton = (label: string, active: boolean, onTap: () => void) => (
    <button
      onClick={onTap}
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150"
      style={{
        background: active ? `color-mix(in srgb, ${TINT} 18%, transparent)` : "var(--color-raised)",
        color: active ? TINT : "var(--color-dim)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="grid h-full grid-cols-[300px_minmax(0,1fr)_430px] gap-4 p-5"
      style={{
        background: `radial-gradient(900px 320px at 30% -12%, color-mix(in srgb, ${TINT} 9%, transparent), transparent 60%)`,
      }}
    >
      {/* 1 — Hesaplar */}
      <Card
        title="Posta Kutuları"
        right={
          stale ? (
            <span className="flex items-center gap-1.5 text-[11px] text-dim">
              <span className="h-2 w-2 rounded-full bg-warn" /> bağlantı yok
            </span>
          ) : (
            <span className="text-[11px] tabular-nums text-faint">{totalUnread} okunmamış</span>
          )
        }
      >
        <ScrollArea>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setAccountPk(null)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.99] ${
                accountPk === null ? "bg-raised" : "active:bg-card"
              }`}
            >
              <Inbox size={16} style={{ color: TINT }} />
              <span className="flex-1 text-[13px] font-semibold">Tüm gelen kutuları</span>
              {totalUnread > 0 && (
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: TINT }}>
                  {totalUnread}
                </span>
              )}
            </button>

            {data.accounts.map((a) => (
              <button
                key={a.pk}
                onClick={() => setAccountPk(a.pk)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-[0.99] ${
                  accountPk === a.pk ? "bg-raised" : "active:bg-card"
                }`}
              >
                <Mail size={15} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{a.title}</span>
                  {a.address && a.address !== a.title && (
                    <span className="block truncate text-[11px] text-faint">{a.address}</span>
                  )}
                </span>
                {a.unread > 0 && (
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: TINT }}>
                    {a.unread}
                  </span>
                )}
              </button>
            ))}

            {data.accounts.length === 0 && (
              <div className="py-8 text-center text-[13px] text-faint">
                {data.error ?? (stale ? "Ajan bağlanınca gelecek" : "Posta kutusu yok")}
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* 2 — Mesaj listesi */}
      <Card
        title="Gelen Kutusu"
        right={
          <span className="flex items-center gap-1.5">
            {filterButton("Tümü", !unreadOnly, () => setUnreadOnly(false))}
            {filterButton("Okunmamış", unreadOnly, () => setUnreadOnly(true))}
          </span>
        }
      >
        <ScrollArea>
          <div className="flex flex-col gap-0.5">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-faint">
                {unreadOnly ? "Okunmamış posta yok" : "Posta yok"}
              </div>
            ) : (
              messages.map((m) => (
                <MessageRow
                  key={m.pk}
                  m={m}
                  selected={selected?.pk === m.pk}
                  now={now}
                  onSelect={() => setSelectedPk(m.pk)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* 3 — Seçili posta */}
      <Card
        title={selected ? "Posta" : "Önizleme"}
        right={
          selected && (
            <span className="text-[11px] text-faint">
              {new Date(selected.receivedAt).toLocaleString("tr-TR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )
        }
      >
        {selected ? (
          <ScrollArea bottomKey={String(selected.pk)}>
            <div className="pr-1">
              <div className="text-[15px] font-semibold leading-snug">{selected.subject}</div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                <span className="font-medium">{selected.fromName || selected.fromAddress}</span>
                {selected.fromAddress && selected.fromName && (
                  <span className="text-faint">{selected.fromAddress}</span>
                )}
                {account && (
                  <span className="rounded-md bg-raised px-2 py-0.5 text-[11px] text-dim">
                    {account.title}
                  </span>
                )}
                {selected.attachments > 0 && (
                  <span className="flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-[11px] text-dim">
                    <Paperclip size={10} />
                    {selected.attachments} ek
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-dim">
                {selected.preview || "Önizleme yok"}
              </p>
              <div className="mt-3 text-[11px] text-faint">
                Tam metin ve ekler Spark&apos;ta — panel yalnızca önizleme gösterir.
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <Mail size={22} className="text-faint" />
            <div className="text-[13px] text-dim">
              {stale ? "Mac ajanına bağlanılamadı" : "Bir posta seç"}
            </div>
            {!stale && data.updatedAt > 0 && (
              <div className="text-[11px] text-faint">{fmtAgo(data.updatedAt, now)} güncellendi</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
