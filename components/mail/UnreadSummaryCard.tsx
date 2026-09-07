"use client";

import { useState } from "react";
import { ChevronRight, Mail } from "lucide-react";
import { fmtWhen } from "@/lib/format";
import type { MailAccount, MailMessage } from "@/lib/types/mail";

const TINT = "var(--color-indigo)";

/**
 * Gönderen avatar paleti — Mesajlar'daki gibi yumuşak çift tonlu gradyanlar.
 * Renk gönderen adresinden türer: aynı kişi her zaman aynı renkte görünür,
 * göz zamanla kimin kim olduğunu okumadan tanır.
 */
const AVATAR_HUES: [string, string][] = [
  ["var(--color-blue)", "var(--color-indigo)"],
  ["var(--color-indigo)", "var(--color-purple)"],
  ["var(--color-purple)", "var(--color-pink)"],
  ["var(--color-orange)", "var(--color-yellow)"],
  ["var(--color-teal)", "var(--color-mint)"],
  ["var(--color-green)", "var(--color-teal)"],
];

function hueFor(key: string): [string, string] {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** "Ada Yılmaz" → "BM", "alert@…" → "A" */
function initials(m: MailMessage): string {
  const name = m.fromName.replace(/["']/g, "").trim();
  if (name && !name.includes("@")) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toLocaleUpperCase("tr-TR");
  }
  return (m.fromAddress[0] ?? "?").toLocaleUpperCase("tr-TR");
}

function Avatar({ m, size }: { m: MailMessage; size: number }) {
  const [a, b] = hueFor(m.fromAddress || m.fromName);
  return (
    <span
      className="flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        letterSpacing: "0.02em",
        background: `linear-gradient(135deg, ${a}, ${b})`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)",
      }}
    >
      {/* Küçük yığın avatarlarında baş harf okunmaz — Apple gibi boş renk diski kalır */}
      {size >= 26 && initials(m)}
    </span>
  );
}

const sender = (m: MailMessage) => m.fromName || m.fromAddress;
const shortAccount = (a: MailAccount) => (a.title.includes("@") ? a.title.split("@")[0] : a.title);

/**
 * Genel Bakış'taki posta kartı — bir "gelen kutusuna bakış".
 * İstatistik değil, postanın kendisi: en yeni okunmamış hero olarak (büyük avatar,
 * gönderen, konu, önizleme), ardından iki kompakt satır; altta "daha fazla"yı
 * anlatan avatar yığını ve sessiz bir hesap dökümü. Dokununca Posta ekranına gider.
 */
export function UnreadSummaryCard({
  accounts,
  messages,
  now,
  bare = false,
}: {
  accounts: MailAccount[];
  messages: MailMessage[];
  now: number;
  /** Açık sunum: yüzey yok, modül doğrudan alanın üstünde durur */
  bare?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const total = accounts.reduce((sum, a) => sum + a.unread, 0);
  if (total === 0) return null;

  // Liste zaten yeniden eskiye sıralı gelir
  const unread = messages.filter((m) => m.unseen);
  const hero = unread[0] ?? null;
  const compact = unread.slice(1, 3);
  const stack = unread.slice(3, 6);
  const shown = (hero ? 1 : 0) + compact.length;
  const more = Math.max(0, total - shown);
  const byAccount = accounts
    .filter((a) => a.unread > 0)
    .sort((a, b) => b.unread - a.unread)
    .slice(0, 3);

  const release = () => setPressed(false);

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("panel-goto", { detail: "mail" }))}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      aria-label={`${total} okunmamış posta — Posta ekranına git`}
      className={`flex h-full min-h-0 w-full flex-col text-left ${bare ? "" : "surface animate-card-in rounded-[var(--r-lg)] p-5"}`}
      style={{
        transform: pressed ? "scale(0.985)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13.5px] font-medium text-dim">
          <Mail size={14} style={{ color: TINT }} />
          Posta
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums leading-none"
            style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
          >
            {total}
          </span>
          <ChevronRight size={16} className="text-faint" />
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 py-2">
        {hero ? (
          // key: en yeni okunmamış değişince hero yeniden belirir — hareket değişimi anlatır
          <div key={hero.pk} className="animate-card-in flex items-start gap-3">
            <Avatar m={hero} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
                  {sender(hero)}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-faint">
                  {fmtWhen(hero.receivedAt, now)}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[13px]">{hero.subject}</div>
              {hero.preview && (
                <div className="mt-0.5 truncate text-[12px] leading-snug text-faint">{hero.preview}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-dim">Okunmamış postalar Spark&apos;ta bekliyor</div>
        )}

        {compact.map((m, i) => (
          <div
            key={m.pk}
            className="row-in flex items-center gap-3"
            style={{ animationDelay: `${80 + i * 50}ms` }}
          >
            <Avatar m={m} size={28} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{sender(m)}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-faint">
                  {fmtWhen(m.receivedAt, now)}
                </span>
              </div>
              <div className="truncate text-[12px] text-dim">{m.subject}</div>
            </div>
          </div>
        ))}
      </div>

      <footer className="flex shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap">
        {more > 0 && (
          <span className="flex items-center gap-2.5">
            {stack.length > 0 && (
              <span className="flex items-center">
                {stack.map((m, i) => (
                  <span
                    key={m.pk}
                    className="rounded-full"
                    style={{ marginLeft: i ? -8 : 0, boxShadow: "0 0 0 2px var(--color-night)" }}
                  >
                    <Avatar m={m} size={22} />
                  </span>
                ))}
              </span>
            )}
            <span className="text-[12px] font-medium text-dim">+{more} okunmamış daha</span>
          </span>
        )}
        <span className="ml-auto flex min-w-0 items-center gap-3 text-[11px] text-faint">
          {byAccount.map((a) => (
            <span key={a.pk} className="truncate">
              {shortAccount(a)}{" "}
              <span className="font-semibold tabular-nums text-dim">{a.unread}</span>
            </span>
          ))}
        </span>
      </footer>
    </button>
  );
}
