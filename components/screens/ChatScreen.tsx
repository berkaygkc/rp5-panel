"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { AtSign, Hash, MessageCircle, MessagesSquare, Paperclip, UserRound, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DrillHeader } from "@/components/ui/DrillHeader";
import { IconChip } from "@/components/ui/IconChip";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useChat } from "@/lib/data/useChat";
import { useChatThread } from "@/lib/data/useChatThread";
import { useNow } from "@/lib/data/useNow";
import { fmtAgo, fmtWhen } from "@/lib/format";
import { KIND_LABEL, type ChatItem, type ChatItemKind, type ChatMessage, type ChatSource, type ChatSourceState } from "@/lib/types/chat";

const TINT = "var(--color-green)";
const SOURCE: Record<ChatSource, { label: string; tint: string; icon: LucideIcon }> = {
  chatwoot: { label: "Chatwoot", tint: "var(--color-blue)", icon: MessagesSquare },
  mattermost: { label: "Mattermost", tint: "var(--color-indigo)", icon: MessageCircle },
};
const KIND_ICON: Record<ChatItemKind, LucideIcon> = { assigned: UserRound, mention: AtSign, dm: MessageCircle, group: Users, channel: Hash };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toLocaleUpperCase("tr-TR");
}

/** Basılınca hafifçe küçülen dokunulabilir yüzey */
function Pressable({ onTap, className = "", style, children }: { onTap: () => void; className?: string; style?: CSSProperties; children: ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <button
      onClick={onTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      className={className}
      style={{ ...style, transform: pressed ? "scale(0.985)" : undefined, transition: "transform 120ms var(--ease-out-strong), background-color 120ms" }}
    >
      {children}
    </button>
  );
}

function Avatar({ name, tint, size = 40 }: { name: string; tint: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}
    >
      {initials(name)}
    </span>
  );
}

function SourceChip({ source }: { source: ChatSource }) {
  const s = SOURCE[source];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${s.tint} 16%, transparent)`, color: s.tint }}>
      <Icon size={11} strokeWidth={2.5} />
      {s.label}
    </span>
  );
}

/* ── Seviye 0: kaynak kartları + dikkat listesi ── */

function SourceCard({ source, state, active, now, onTap }: { source: ChatSource; state: ChatSourceState; active: boolean; now: number; onTap: () => void }) {
  const s = SOURCE[source];
  const tone = !state.configured
    ? { color: "var(--color-faint)", label: "bağlı değil" }
    : state.error
      ? { color: "var(--color-err)", label: "hata" }
      : { color: "var(--color-ok)", label: state.me ?? "bağlı" };
  const c = state.counts;
  const stats: Array<[string, number, boolean]> =
    source === "chatwoot"
      ? [["Bana atanan", c.mine ?? 0, false], ["Yanıt bekleyen", c.waiting ?? 0, (c.waiting ?? 0) > 0], ["Bahsetme", c.mentions ?? 0, (c.mentions ?? 0) > 0]]
      : [["Bahsetme", c.mentions ?? 0, (c.mentions ?? 0) > 0], ["Mesaj", c.dms ?? 0, (c.dms ?? 0) > 0], ["Kanal", c.channels ?? 0, false]];
  // En uzun bekleyen müşteri: kartın altında tek satırlık rapor
  const oldest = source === "chatwoot" ? (c.oldestWaitMs ?? 0) : 0;
  return (
    <Pressable
      onTap={onTap}
      className="flex min-h-0 flex-1 flex-col justify-between rounded-[22px] p-4 text-left"
      style={{
        background: active ? `color-mix(in srgb, ${s.tint} 12%, transparent)` : "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        boxShadow: active
          ? `inset 0 0 0 1px color-mix(in srgb, ${s.tint} 35%, transparent)`
          : "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring), var(--card-shadow)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <IconChip icon={s.icon} tint={s.tint} size={34} iconSize={17} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{s.label}</span>
          <span className="block truncate text-[11.5px] text-faint">{state.configured ? `${state.label ?? ""}${state.me ? ` · ${state.me}` : ""}` : "yönetim panelinden bağla"}</span>
        </span>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.color }} title={tone.label} />
      </div>
      {state.configured && !state.error ? (
        <div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map(([label, value, warn]) => (
              <span key={label} className="leading-none">
                <span className="block text-[10.5px] font-medium text-faint">{label}</span>
                <span className="mt-1 block text-[21px] font-semibold tabular-nums tracking-[-0.01em]" style={{ color: warn ? s.tint : "var(--color-ink)" }}>
                  {value}
                </span>
              </span>
            ))}
          </div>
          {oldest > 0 && now > 0 && (
            <div className="mt-2.5 text-[11px] text-faint">
              En uzun bekleyen <span style={{ color: "var(--color-warn)" }}>{fmtAgo(now - oldest, now)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] leading-snug" style={{ color: state.error ? "var(--color-err)" : "var(--color-faint)" }}>
          {state.error ?? "Yönetim paneli → Sohbet sayfasından erişim bilgilerini girin."}
        </p>
      )}
    </Pressable>
  );
}

function ItemRow({ item, now, onTap }: { item: ChatItem; now: number; onTap: () => void }) {
  const s = SOURCE[item.source];
  const KindIcon = KIND_ICON[item.kind];
  const hot = item.unread > 0 || item.mentions > 0;
  return (
    <Pressable onTap={onTap} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left active:bg-raised">
      <Avatar name={item.title} tint={s.tint} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`min-w-0 truncate text-[14px] ${hot ? "font-semibold" : "font-medium text-dim"}`}>{item.title}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold" style={{ background: `color-mix(in srgb, ${s.tint} 14%, transparent)`, color: s.tint }}>
            <KindIcon size={10} strokeWidth={2.5} />
            {KIND_LABEL[item.kind]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-dim">
          {item.from && item.preview ? (
            <>
              <span className="text-ink">{item.from}:</span> {item.preview}
            </>
          ) : (
            item.preview || item.subtitle
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-faint">
          {s.label} · {item.subtitle}
          {item.waitingSince ? ` · ${fmtAgo(item.waitingSince, now)} bekliyor` : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] tabular-nums text-faint">{item.at ? fmtWhen(item.at, now) : ""}</span>
        {hot && (
          <span className="min-w-[22px] rounded-full px-1.5 py-[1px] text-center text-[11px] font-bold text-white" style={{ background: item.mentions > 0 ? "var(--color-err)" : s.tint }}>
            {item.mentions > 0 ? `@${item.mentions}` : item.unread}
          </span>
        )}
      </span>
    </Pressable>
  );
}

function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${TINT} 12%, transparent)`, color: TINT }}>
        {icon}
      </span>
      <span className="text-[15px] font-medium text-dim">{title}</span>
      <span className="max-w-[420px] text-[12.5px] text-faint">{sub}</span>
    </div>
  );
}

/* ── Seviye 1: sohbet detayı ── */

function Bubble({ m, tint, now }: { m: ChatMessage; tint: string; now: number }) {
  if (m.system) return <p className="self-center px-3 text-center text-[11px] text-faint">{m.text}</p>;
  return (
    <div className={`flex max-w-[78%] flex-col ${m.mine ? "self-end items-end" : "self-start items-start"}`}>
      <span className="mb-0.5 px-1 text-[10.5px] text-faint">
        {m.from} · {fmtWhen(m.at, now)}
        {m.note ? " · özel not" : ""}
      </span>
      <span
        className="whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13px] leading-snug"
        style={{
          background: m.note ? "color-mix(in srgb, var(--color-warn) 14%, transparent)" : m.mine ? `color-mix(in srgb, ${tint} 22%, transparent)` : "var(--color-raised)",
          boxShadow: m.note ? "inset 0 0 0 1px color-mix(in srgb, var(--color-warn) 40%, transparent)" : undefined,
        }}
      >
        {m.text}
        {m.attachments > 0 && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-faint">
            <Paperclip size={11} />
            {m.attachments}
          </span>
        )}
      </span>
    </div>
  );
}

function ThreadView({ item, now, onBack }: { item: ChatItem; now: number; onBack: () => void }) {
  const { thread, error } = useChatThread(item.source, item.ref);
  const s = SOURCE[item.source];
  return (
    <div
      className="flex h-full flex-col p-5"
      style={{ background: `radial-gradient(900px 320px at 30% -12%, color-mix(in srgb, ${s.tint} 9%, transparent), transparent 60%)` }}
    >
      <DrillHeader crumbs={[{ label: "Sohbet", onTap: onBack }, { label: item.title }]} onBack={onBack} right={<SourceChip source={item.source} />} />
      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-4">
        <Card title="Bilgi" compact>
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={item.title} tint={s.tint} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{item.title}</span>
              <span className="block truncate text-[11.5px] text-faint">
                {KIND_LABEL[item.kind]} · {item.subtitle}
              </span>
            </span>
          </div>
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            {(thread?.meta ?? []).map((m) => (
              <div key={m.label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-faint">{m.label}</dt>
                <dd className="min-w-0 truncate text-right">{m.value}</dd>
              </div>
            ))}
            {item.waitingSince && (
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-faint">Bekliyor</dt>
                <dd className="text-right" style={{ color: "var(--color-warn)" }}>{fmtAgo(item.waitingSince, now)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-auto break-all pt-3 text-[10.5px] leading-snug text-faint">{item.url.replace(/^https?:\/\//, "")}</p>
        </Card>
        <Card title="Mesajlar" compact className="min-h-0" right={thread && <span className="text-[11.5px] text-faint">son {thread.messages.length}</span>}>
          {error ? (
            <p className="text-[13px]" style={{ color: "var(--color-err)" }}>{error}</p>
          ) : !thread ? (
            <p className="text-[13px] text-faint">Mesajlar yükleniyor</p>
          ) : thread.messages.length === 0 ? (
            <p className="text-[13px] text-faint">Bu sohbette mesaj yok</p>
          ) : (
            <ScrollArea className="min-h-0 flex-1" stickToBottom bottomKey={item.id}>
              <div className="flex flex-col gap-2 pr-3">
                {thread.messages.map((m) => (
                  <Bubble key={m.id} m={m} tint={s.tint} now={now} />
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Ekran ── */

type View = { level: 0 } | { level: 1; id: string };

export default function ChatScreen() {
  const { data, stale } = useChat();
  const now = useNow(15_000)?.getTime() ?? 0;
  const [view, setView] = useState<View>({ level: 0 });
  const [filter, setFilter] = useState<ChatSource | null>(null);

  const all = [...data.chatwoot.items, ...data.mattermost.items].sort((a, b) => b.priority - a.priority || b.at - a.at);
  const items = filter ? all.filter((i) => i.source === filter) : all;
  const configured = data.chatwoot.configured || data.mattermost.configured;
  const selected = view.level === 1 ? (all.find((i) => i.id === view.id) ?? null) : null;

  if (selected) return <ThreadView item={selected} now={now} onBack={() => setView({ level: 0 })} />;

  const chip = (label: string, active: boolean, onTap: () => void) => (
    <button
      onClick={onTap}
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150"
      style={{ background: active ? `color-mix(in srgb, ${TINT} 18%, transparent)` : "var(--color-raised)", color: active ? TINT : "var(--color-dim)" }}
    >
      {label}
    </button>
  );
  const hot = items.filter((i) => i.unread > 0 || i.mentions > 0).length;

  return (
    <div
      className="grid h-full grid-cols-[300px_minmax(0,1fr)] gap-4 p-5"
      style={{ background: `radial-gradient(900px 320px at 30% -12%, color-mix(in srgb, ${TINT} 9%, transparent), transparent 60%)` }}
    >
      <div className="flex min-h-0 flex-col gap-4">
        <SourceCard source="chatwoot" state={data.chatwoot} active={filter === "chatwoot"} now={now} onTap={() => setFilter(filter === "chatwoot" ? null : "chatwoot")} />
        <SourceCard source="mattermost" state={data.mattermost} active={filter === "mattermost"} now={now} onTap={() => setFilter(filter === "mattermost" ? null : "mattermost")} />
      </div>
      <Card
        title="Dikkat gerektirenler"
        className="min-h-0"
        right={
          <span className="flex items-center gap-2">
            {hot > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: TINT }}>
                {hot}
              </span>
            )}
            {chip("Tümü", filter === null, () => setFilter(null))}
            {chip("Chatwoot", filter === "chatwoot", () => setFilter("chatwoot"))}
            {chip("Mattermost", filter === "mattermost", () => setFilter("mattermost"))}
            <span className="ml-1 text-[11px] tabular-nums text-faint">{stale ? "bağlantı bekleniyor" : data.updatedAt ? fmtAgo(data.updatedAt, now) : ""}</span>
          </span>
        }
      >
        {!configured ? (
          <EmptyState icon={<MessagesSquare size={22} strokeWidth={1.75} />} title="Sohbet kaynakları bağlı değil" sub="Yönetim paneli → Sohbet sayfasından Chatwoot ve Mattermost erişim bilgilerini girin; bakmanız gerekenler burada toplanır." />
        ) : items.length === 0 ? (
          <EmptyState icon={<MessagesSquare size={22} strokeWidth={1.75} />} title="Bakman gereken bir şey yok" sub={filter ? `${SOURCE[filter].label} sessiz` : "Atanmış sohbetler okundu, kimse senden bahsetmedi"} />
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pr-3">
              {items.map((i) => (
                <ItemRow key={i.id} item={i} now={now} onTap={() => setView({ level: 1, id: i.id })} />
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
