import type { ChatItem, ChatMessage, ChatThread } from "@/lib/types/chat";

/**
 * Chatwoot Application API (v1) — kullanıcı erişim anahtarıyla, salt okunur.
 * Anahtar: Profil Ayarları → Erişim Anahtarı. İstekler `api_access_token` başlığıyla gider.
 */
export interface ChatwootConfig {
  url: string;
  token: string;
  accountId: number;
}
const TIMEOUT_MS = 8000;

export async function cwFetch<T>(cfg: Pick<ChatwootConfig, "url" | "token">, path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      headers: { api_access_token: cfg.token, accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new Error("Chatwoot erişim anahtarı reddedildi");
    if (res.status === 404) throw new Error("Chatwoot: hesap ya da kayıt bulunamadı (hesap kimliğini kontrol edin)");
    if (!res.ok) throw new Error(`Chatwoot HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("Chatwoot yanıt vermedi (zaman aşımı)");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface CwProfile {
  id: number;
  name: string;
  email: string;
  accounts: Array<{ id: number; name: string; role: string }>;
}
interface CwSender {
  id?: number;
  name?: string;
  email?: string | null;
  phone_number?: string | null;
}
export interface CwMessage {
  id: number;
  content: string | null;
  /** 0 gelen (müşteri), 1 giden (ajan), 2 etkinlik, 3 şablon */
  message_type: number;
  created_at: number;
  private?: boolean;
  sender?: { name?: string; type?: string } | null;
  attachments?: unknown[];
}
export interface CwConversation {
  id: number;
  inbox_id: number;
  status: string;
  priority?: string | null;
  unread_count: number;
  last_activity_at: number;
  created_at: number;
  waiting_since?: number | null;
  labels?: string[];
  messages?: CwMessage[];
  last_non_activity_message?: CwMessage | null;
  meta?: { sender?: CwSender; assignee?: { name?: string } | null; channel?: string };
}
/** Yanıttaki sayaçlardan yalnızca bana atananı okuruz */
export interface CwMeta {
  mine_count: number;
}
interface CwList {
  data: { meta: CwMeta; payload: CwConversation[] };
}
export interface CwNotification {
  id: number;
  notification_type: string;
  read_at: string | null;
  primary_actor_id: number;
  primary_actor_type: string;
  push_message_title?: string;
  created_at: number;
}
interface CwNotifications {
  data: { meta: { unread_count: number; count: number }; payload: CwNotification[] };
}

export const cwProfile = (cfg: Pick<ChatwootConfig, "url" | "token">) => cwFetch<CwProfile>(cfg, "/api/v1/profile");
export const cwConversations = (cfg: ChatwootConfig, assignee: "me" | "all") =>
  cwFetch<CwList>(cfg, `/api/v1/accounts/${cfg.accountId}/conversations?status=open&assignee_type=${assignee}&sort_by=last_activity_at_desc&page=1`);
export const cwInboxes = (cfg: ChatwootConfig) =>
  cwFetch<{ payload: Array<{ id: number; name: string; channel_type: string }> }>(cfg, `/api/v1/accounts/${cfg.accountId}/inboxes`);
export const cwNotifications = (cfg: ChatwootConfig) =>
  cwFetch<CwNotifications>(cfg, `/api/v1/accounts/${cfg.accountId}/notifications?page=1`);
export const cwConversation = (cfg: ChatwootConfig, id: string) =>
  cwFetch<CwConversation>(cfg, `/api/v1/accounts/${cfg.accountId}/conversations/${id}`);
export const cwMessages = (cfg: ChatwootConfig, id: string) =>
  cwFetch<{ payload: CwMessage[] }>(cfg, `/api/v1/accounts/${cfg.accountId}/conversations/${id}/messages`);

export const cwUrl = (cfg: ChatwootConfig, id: number | string) => `${cfg.url}/app/accounts/${cfg.accountId}/conversations/${id}`;

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const msgText = (m?: CwMessage | null) => clean(m?.content) || (m?.attachments?.length ? "📎 ek" : "");

const STATUS_TR: Record<string, string> = { open: "açık", pending: "beklemede", snoozed: "ertelendi", resolved: "çözüldü" };

/** Bana atanmış bir sohbeti panel biçimine indirger */
export function cwItem(c: CwConversation, inboxes: Map<number, string>, cfg: ChatwootConfig): ChatItem {
  const last = c.last_non_activity_message ?? c.messages?.[c.messages.length - 1] ?? null;
  const sender = c.meta?.sender;
  const title = clean(sender?.name) || clean(sender?.email) || clean(sender?.phone_number) || `Sohbet #${c.id}`;
  const fromCustomer = last?.message_type === 0;
  return {
    id: `chatwoot:${c.id}`,
    source: "chatwoot",
    ref: String(c.id),
    kind: "assigned",
    title,
    subtitle: inboxes.get(c.inbox_id) ?? `Gelen kutusu ${c.inbox_id}`,
    from: last ? (fromCustomer ? title : clean(last.sender?.name) || "Ajan") : null,
    preview: msgText(last),
    at: (c.last_activity_at || c.created_at) * 1000,
    unread: c.unread_count ?? 0,
    mentions: 0,
    waitingSince: c.waiting_since ? c.waiting_since * 1000 : null,
    labels: c.labels ?? [],
    status: STATUS_TR[c.status] ?? c.status ?? null,
    priority: (c.unread_count ?? 0) > 0 ? 3 : 1,
    url: cwUrl(cfg, c.id),
  };
}

export function cwThread(cfg: ChatwootConfig, c: CwConversation, msgs: CwMessage[], inboxName: string): ChatThread {
  const sender = c.meta?.sender;
  const title = clean(sender?.name) || clean(sender?.email) || `Sohbet #${c.id}`;
  const messages: ChatMessage[] = [...msgs]
    .sort((a, b) => a.created_at - b.created_at)
    .map((m) => ({
      id: String(m.id),
      at: m.created_at * 1000,
      from: m.message_type === 0 ? title : clean(m.sender?.name) || "Ajan",
      mine: m.message_type === 1,
      text: clean(m.content),
      note: Boolean(m.private),
      attachments: m.attachments?.length ?? 0,
      system: m.message_type === 2,
    }));
  const meta: ChatThread["meta"] = [
    { label: "Gelen kutusu", value: inboxName },
    { label: "Durum", value: STATUS_TR[c.status] ?? c.status },
    { label: "Atanan", value: clean(c.meta?.assignee?.name) || "kimse" },
  ];
  if (sender?.email) meta.push({ label: "E-posta", value: sender.email });
  if (sender?.phone_number) meta.push({ label: "Telefon", value: sender.phone_number });
  if (c.priority) meta.push({ label: "Öncelik", value: c.priority });
  if (c.labels?.length) meta.push({ label: "Etiketler", value: c.labels.join(", ") });
  meta.push({ label: "Açılış", value: new Date(c.created_at * 1000).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) });
  return { source: "chatwoot", ref: String(c.id), title, url: cwUrl(cfg, c.id), meta, messages, fetchedAt: Date.now() };
}
