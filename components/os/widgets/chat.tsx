"use client";

import { AtSign, MessageCircle, MessagesSquare, UserRound, type LucideIcon } from "lucide-react";
import { Pill, Tile, TileHead } from "@/components/os/parts";
import { fmtAgo } from "@/lib/format";
import type { WidgetProps } from "@/lib/os/types";
import type { ChatItem, ChatItemKind } from "@/lib/types/chat";

const TINT = "var(--color-green)";
const KIND_ICON: Record<ChatItemKind, LucideIcon> = { assigned: UserRound, mention: AtSign, dm: MessageCircle, group: MessagesSquare, channel: MessagesSquare };

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toLocaleUpperCase("tr-TR");
}

/** Bekleme rengi ekrandakiyle aynı eşiklerde: çeyrek saatte sararır, saatte kızarır. */
function waitTone(ms: number): string {
  if (ms > 60 * 60_000) return "var(--color-err)";
  if (ms > 15 * 60_000) return "var(--color-warn)";
  return "var(--color-faint)";
}

/** Yanıt bekleyen sohbetler: müşteri ve ekip tek listede */
export function ChatAttentionWidget({ size, data }: WidgetProps) {
  const items = [...data.chat.chatwoot.items, ...data.chat.mattermost.items]
    .filter((i) => i.unread > 0 || i.mentions > 0)
    .sort((a, b) => b.priority - a.priority || b.at - a.at);
  if (items.length === 0) return null;

  const oldest = items.reduce((max: ChatItem | null, i) => (i.waitingSince && (!max?.waitingSince || i.waitingSince < max.waitingSince) ? i : max), null);

  const longest = oldest?.waitingSince ? data.now - oldest.waitingSince : 0;

  /* Küçük yuva: sayı değil, en uzun bekleyenin adı — asıl soru o. */
  if (size === "1x1") {
    const hero = oldest ?? items[0];
    return (
      <Tile tint={TINT} screen="chat">
        <TileHead icon={MessagesSquare} title="Sohbet" tint={TINT} trailing={<Pill tint={TINT}>{items.length}</Pill>} />
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <span className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{hero.title}</span>
          <span className="mt-0.5 truncate text-[11.5px] text-dim">{hero.preview || hero.subtitle}</span>
          {longest > 0 && (
            <span className="mt-1.5 text-[11.5px] font-medium tabular-nums" style={{ color: waitTone(longest) }}>
              {fmtAgo(oldest!.waitingSince!, data.now)} bekliyor
            </span>
          )}
        </div>
      </Tile>
    );
  }

  const rows = items.slice(0, size === "1x2" ? 4 : 3);
  return (
    <Tile tint={TINT} screen="chat">
      <TileHead
        icon={MessagesSquare}
        title="Sohbet"
        tint={TINT}
        trailing={
          longest > 0 ? (
            <span className="text-[11px] font-medium tabular-nums" style={{ color: waitTone(longest) }}>
              en uzun {fmtAgo(oldest!.waitingSince!, data.now)}
            </span>
          ) : (
            <Pill tint={TINT}>{items.length}</Pill>
          )
        }
      />
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        {rows.map((i) => {
          const Icon = KIND_ICON[i.kind];
          const waited = i.waitingSince ? data.now - i.waitingSince : 0;
          const tone = waitTone(waited);
          const hot = waited > 60 * 60_000;
          return (
            <div
              key={i.id}
              className="flex items-center gap-2.5 rounded-[var(--r-md)]"
              style={hot ? { background: "color-mix(in srgb, var(--color-err) 8%, transparent)", padding: "4px 6px", margin: "-4px -6px" } : undefined}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ background: `color-mix(in srgb, ${TINT} 16%, transparent)`, color: TINT }}
              >
                {initials(i.title)}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-semibold">{i.title}</span>
                  <Icon size={10} className="shrink-0 text-faint" />
                  {waited > 0 && (
                    <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: tone }}>
                      {fmtAgo(i.waitingSince!, data.now)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-dim">{i.preview || i.subtitle}</span>
              </span>
              {(i.mentions > 0 || i.unread > 0) && (
                <Pill tint={i.mentions > 0 ? "var(--color-err)" : TINT}>{i.mentions > 0 ? `@${i.mentions}` : i.unread}</Pill>
              )}
            </div>
          );
        })}
      </div>
    </Tile>
  );
}
