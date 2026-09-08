"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { AtSign, Hash, MessageCircle, MessagesSquare, Paperclip, UserRound, Users, type LucideIcon } from "lucide-react";
import { DrillHeader } from "@/components/ui/DrillHeader";
import { Module, Stage } from "@/components/ui/Stage";
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
const KIND_ICON: Record<ChatItemKind, LucideIcon> = {
  assigned: UserRound, mention: AtSign, dm: MessageCircle, group: Users, channel: Hash,
};

/** Bekleme süresi bu ekranın duygusu: uzadıkça renk sertleşir */
function waitTone(ms: number): string {
  if (ms > 60 * 60_000) return "var(--color-err)";
  if (ms > 15 * 60_000) return "var(--color-warn)";
  return "var(--color-dim)";
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toLocaleUpperCase("tr-TR");
}

function Avatar({ name, tint, size = 38 }: { name: string; tint: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `color-mix(in srgb, ${tint} 18%, transparent)`,
        color: tint,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tint} 22%, transparent)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

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
      style={{ ...style, transform: pressed ? "scale(0.99)" : undefined, transition: "transform 120ms var(--ease-out-strong), background-color 120ms" }}
    >
      {children}
    </button>
  );
}

/* ── Liste satırı ── */

function ConversationRow({ item, now, onTap }: { item: ChatItem; now: number; onTap: () => void }) {
  const s = SOURCE[item.source];
  const KindIcon = KIND_ICON[item.kind];
  const waited = item.waitingSince ? now - item.waitingSince : 0;
  const tone = waitTone(waited);
  const hot = item.mentions > 0;

  return (
    <Pressable
      onTap={onTap}
      className="flex w-full items-start gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-left active:bg-raised"
      style={waited > 15 * 60_000 ? { background: `color-mix(in srgb, ${tone} 8%, transparent)` } : undefined}
    >
      <Avatar name={item.title} tint={s.tint} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.01em]">{item.title}</span>
          <KindIcon size={11} className="shrink-0 text-faint" />
          {item.waitingSince && (
            <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: tone }}>
              {fmtAgo(item.waitingSince, now)}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-faint">{item.at ? fmtWhen(item.at, now) : ""}</span>
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
        <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-faint">
          <s.icon size={9} />
          {item.subtitle}
        </span>
      </span>
      {(hot || item.unread > 0) && (
        <span
          className="mt-1 min-w-[22px] shrink-0 rounded-full px-1.5 py-[1px] text-center text-[11px] font-bold text-white"
          style={{ background: hot ? "var(--color-err)" : s.tint }}
        >
          {hot ? `@${item.mentions}` : item.unread}
        </span>
      )}
    </Pressable>
  );
}

/* ── Kaynak durumu: başlıkta tek satır ── */

function SourceChip({ source, state, active, onTap }: { source: ChatSource; state: ChatSourceState; active: boolean; onTap: () => void }) {
  const s = SOURCE[source];
  const tone = !state.configured ? "var(--color-faint)" : state.error ? "var(--color-err)" : "var(--color-ok)";
  return (
    <button
      onClick={onTap}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150"
      style={{
        background: active ? `color-mix(in srgb, ${s.tint} 18%, transparent)` : "var(--color-raised)",
        color: active ? s.tint : "var(--color-dim)",
      }}
      title={state.error ?? (state.configured ? `${state.me ?? "bağlı"} · ${state.label ?? ""}` : "bağlı değil")}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "var(--color-ok)" ? "animate-soft-pulse" : ""}`} style={{ background: tone }} />
      {s.label}
      <span className="tabular-nums opacity-70">{state.items.filter((i) => i.unread > 0 || i.mentions > 0).length}</span>
    </button>
  );
}

/* ── Sohbet detayı ── */

function Bubble({ m, tint, now, grouped }: { m: ChatMessage; tint: string; now: number; grouped: boolean }) {
  if (m.system) return <p className="self-center px-3 py-0.5 text-center text-[11px] text-faint">{m.text}</p>;
  return (
    <div className={`flex max-w-[76%] flex-col ${m.mine ? "items-end self-end" : "items-start self-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
      {!grouped && (
        <span className="mb-1 px-1 text-[10.5px] text-faint">
          {m.from} · {fmtWhen(m.at, now)}
          {m.note ? " · özel not" : ""}
        </span>
      )}
      <span
        className="whitespace-pre-wrap break-words px-3.5 py-2 text-[13px] leading-[1.45]"
        style={{
          background: m.note
            ? "color-mix(in srgb, var(--color-warn) 14%, transparent)"
            : m.mine
              ? `color-mix(in srgb, ${tint} 22%, transparent)`
              : "var(--color-raised)",
          boxShadow: m.note ? "inset 0 0 0 1px color-mix(in srgb, var(--color-warn) 34%, transparent)" : undefined,
          borderRadius: m.mine ? "16px 16px 5px 16px" : "16px 16px 16px 5px",
        }}
      >
        {m.text}
        {m.attachments > 0 && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-faint">
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
  const waited = item.waitingSince ? now - item.waitingSince : 0;

  return (
    <div className="flex h-full flex-col p-5">
      <DrillHeader
        crumbs={[{ label: "Sohbet", onTap: onBack }, { label: item.title }]}
        onBack={onBack}
        right={
          <span className="flex items-center gap-2 text-[11px]">
            {item.waitingSince && (
              <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `color-mix(in srgb, ${waitTone(waited)} 16%, transparent)`, color: waitTone(waited) }}>
                {fmtAgo(item.waitingSince, now)} bekliyor
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: `color-mix(in srgb, ${s.tint} 16%, transparent)`, color: s.tint }}>
              <s.icon size={10} />
              {s.label}
            </span>
          </span>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)]">
        <Module title="Kim" divider={false} className="pr-5">
          <div className="mb-3 flex items-center gap-3">
            <Avatar name={item.title} tint={s.tint} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{item.title}</span>
              <span className="block truncate text-[11.5px] text-faint">{KIND_LABEL[item.kind]} · {item.subtitle}</span>
            </span>
          </div>
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            {(thread?.meta ?? []).map((m) => (
              <div key={m.label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-faint">{m.label}</dt>
                <dd className="min-w-0 truncate text-right">{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-auto break-all pt-3 text-[10.5px] leading-snug text-faint">{item.url.replace(/^https?:\/\//, "")}</p>
        </Module>

        <Module title="Konuşma" className="min-h-0 pl-5" right={thread && <span className="text-[11px] text-faint">son {thread.messages.length}</span>}>
          {error ? (
            <p className="text-[13px]" style={{ color: "var(--color-err)" }}>{error}</p>
          ) : !thread ? (
            <p className="text-[13px] text-faint">Mesajlar yükleniyor</p>
          ) : thread.messages.length === 0 ? (
            <p className="text-[13px] text-faint">Bu sohbette mesaj yok</p>
          ) : (
            <ScrollArea className="min-h-0 flex-1" stickToBottom bottomKey={item.id}>
              <div className="flex flex-col pr-3">
                {thread.messages.map((m, i) => {
                  const prev = thread.messages[i - 1];
                  const grouped = Boolean(prev && prev.mine === m.mine && prev.from === m.from && !prev.system && !m.system && m.at - prev.at < 5 * 60_000);
                  return <Bubble key={m.id} m={m} tint={s.tint} now={now} grouped={grouped} />;
                })}
              </div>
            </ScrollArea>
          )}
        </Module>
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

  const all = [...data.chatwoot.items, ...data.mattermost.items]
    .filter((i) => i.unread > 0 || i.mentions > 0)
    .sort((a, b) => b.priority - a.priority || (b.waitingSince ?? b.at) - (a.waitingSince ?? a.at));
  const items = filter ? all.filter((i) => i.source === filter) : all;
  const configured = data.chatwoot.configured || data.mattermost.configured;
  const selected = view.level === 1 ? (all.find((i) => i.id === view.id) ?? null) : null;
  const oldest = all.reduce((max, i) => (i.waitingSince && (max === 0 || i.waitingSince < max) ? i.waitingSince : max), 0);

  if (selected) return <ThreadView item={selected} now={now} onBack={() => setView({ level: 0 })} />;

  return (
    <Stage cols="minmax(0,1fr)">
      <Module
        divider={false}
        title="Yanıt bekleyenler"
        right={
          <span className="flex items-center gap-2">
            {oldest > 0 && (
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: waitTone(now - oldest) }}>
                en uzun {fmtAgo(oldest, now)}
              </span>
            )}
            <span className="mx-1 h-4 w-px" style={{ background: "var(--hairline)" }} />
            <button
              onClick={() => setFilter(null)}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: filter === null ? `color-mix(in srgb, ${TINT} 18%, transparent)` : "var(--color-raised)", color: filter === null ? TINT : "var(--color-dim)" }}
            >
              Tümü {all.length}
            </button>
            <SourceChip source="chatwoot" state={data.chatwoot} active={filter === "chatwoot"} onTap={() => setFilter(filter === "chatwoot" ? null : "chatwoot")} />
            <SourceChip source="mattermost" state={data.mattermost} active={filter === "mattermost"} onTap={() => setFilter(filter === "mattermost" ? null : "mattermost")} />
            <span className="ml-1 text-[10.5px] tabular-nums text-faint">{stale ? "bekleniyor" : data.updatedAt ? fmtAgo(data.updatedAt, now) : ""}</span>
          </span>
        }
      >
        {!configured ? (
          <Empty title="Sohbet kaynakları bağlı değil" sub="Yönetim panelinden Chatwoot ve Mattermost erişim bilgilerini girin." />
        ) : items.length === 0 ? (
          <Empty title="Kimse yanıt beklemiyor" sub={filter ? `${SOURCE[filter].label} sessiz` : "Atanmış sohbetler okundu, kimse sizi anmadı"} />
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 pr-3">
              {items.map((i) => (
                <ConversationRow key={i.id} item={i} now={now} onTap={() => setView({ level: 1, id: i.id })} />
              ))}
            </div>
          </ScrollArea>
        )}
      </Module>
    </Stage>
  );
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${TINT} 12%, transparent)`, color: TINT }}>
        <MessagesSquare size={22} strokeWidth={1.75} />
      </span>
      <span className="text-[15px] font-medium text-dim">{title}</span>
      <span className="max-w-[420px] text-[12.5px] text-faint">{sub}</span>
    </div>
  );
}
