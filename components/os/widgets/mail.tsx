"use client";

import { Mail } from "lucide-react";
import { Metric, Pill, Tile, TileHead } from "@/components/os/parts";
import { fmtWhen } from "@/lib/format";
import type { WidgetProps } from "@/lib/os/types";
import type { MailMessage } from "@/lib/types/mail";

const TINT = "var(--color-indigo)";
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
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {size >= 26 && initials(m)}
    </span>
  );
}
const sender = (m: MailMessage) => m.fromName || m.fromAddress;

/** Gelen kutusuna bakış: istatistik değil, postanın kendisi */
export function InboxWidget({ size, data }: WidgetProps) {
  const total = data.mail.accounts.reduce((n, a) => n + a.unread, 0);
  if (total === 0) return null;
  const unread = data.mail.messages.filter((m) => m.unseen);
  const hero = unread[0];

  /* Küçük yuva: sayı başlıkta durur, gövde en yeni postayı gösterir. */
  if (size === "1x1") {
    return (
      <Tile tint={TINT} screen="mail">
        <TileHead icon={Mail} title="Posta" tint={TINT} trailing={<Pill tint={TINT}>{total}</Pill>} />
        {hero ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="flex items-center gap-2.5">
              <Avatar m={hero} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-tight">{sender(hero)}</span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtWhen(hero.receivedAt, data.now)}</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-dim">{hero.subject}</div>
          </div>
        ) : (
          <Metric value={total} label="okunmamış" />
        )}
      </Tile>
    );
  }

  /* Dar ve uzun yuva: kahraman yok, dört posta alt alta. */
  if (size === "1x2") {
    return (
      <Tile tint={TINT} screen="mail">
        <TileHead icon={Mail} title="Posta" tint={TINT} trailing={<Pill tint={TINT}>{total}</Pill>} />
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
          {unread.slice(0, 4).map((m) => (
            <div key={m.pk} className="flex items-center gap-2.5">
              <Avatar m={m} size={28} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{sender(m)}</span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtWhen(m.receivedAt, data.now)}</span>
                </div>
                <div className="truncate text-[11.5px] text-dim">{m.subject}</div>
              </div>
            </div>
          ))}
        </div>
      </Tile>
    );
  }

  const rows = unread.slice(size === "2x2" ? 1 : 0, size === "2x2" ? 3 : 2);
  return (
    <Tile tint={TINT} screen="mail">
      <TileHead icon={Mail} title="Posta" tint={TINT} trailing={<Pill tint={TINT}>{total}</Pill>} />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
        {size === "2x2" && hero && (
          <div className="flex items-start gap-3">
            <Avatar m={hero} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em]">{sender(hero)}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtWhen(hero.receivedAt, data.now)}</span>
              </div>
              <div className="mt-0.5 truncate text-[12.5px]">{hero.subject}</div>
              {hero.preview && <div className="mt-0.5 truncate text-[11.5px] leading-snug text-faint">{hero.preview}</div>}
            </div>
          </div>
        )}
        {rows.map((m) => (
          <div key={m.pk} className="flex items-center gap-2.5">
            <Avatar m={m} size={26} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{sender(m)}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-faint">{fmtWhen(m.receivedAt, data.now)}</span>
              </div>
              <div className="truncate text-[11.5px] text-dim">{m.subject}</div>
            </div>
          </div>
        ))}
      </div>
    </Tile>
  );
}
