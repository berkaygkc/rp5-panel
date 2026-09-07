/**
 * Sohbet katmanı: Chatwoot (müşteri sohbetleri) ve Mattermost (ekip içi) tek
 * biçime indirgenir. Panel yalnızca "bakılması gereken" öğeleri görür.
 */
export type ChatSource = "chatwoot" | "mattermost";
export type ChatItemKind = "assigned" | "mention" | "dm" | "group" | "channel";

export interface ChatItem {
  /** `${source}:${ref}` — kararlı */
  id: string;
  source: ChatSource;
  /** Kaynağa özgü kimlik: Chatwoot sohbet no, Mattermost kanal id */
  ref: string;
  kind: ChatItemKind;
  /** Kişi ya da kanal adı */
  title: string;
  /** Gelen kutusu / takım / mesaj türü */
  subtitle: string;
  /** Son mesajı yazan */
  from: string | null;
  preview: string;
  /** Son etkinlik (ms) */
  at: number;
  unread: number;
  mentions: number;
  /** Müşteri ne zamandır yanıtımı bekliyor (ms) — Chatwoot */
  waitingSince: number | null;
  labels: string[];
  status: string | null;
  /** 3 acil (bana yazıldı), 2 kuyruk/grup, 1 arka plan */
  priority: number;
  /** Bilgisayarda açmak için derin bağlantı */
  url: string;
}

export interface ChatSourceState {
  configured: boolean;
  error: string | null;
  /** Hesap adı / sunucu adı */
  label: string | null;
  /** Bağlı kullanıcı */
  me: string | null;
  counts: Record<string, number>;
  items: ChatItem[];
  updatedAt: number;
}

export interface ChatState {
  chatwoot: ChatSourceState;
  mattermost: ChatSourceState;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  at: number;
  from: string;
  /** Benim (ajan/kullanıcı) yazdığım */
  mine: boolean;
  text: string;
  /** Chatwoot özel notu */
  note: boolean;
  attachments: number;
  /** Etkinlik satırı (atandı, çözüldü, katıldı …) */
  system: boolean;
}

export interface ChatThread {
  source: ChatSource;
  ref: string;
  title: string;
  url: string;
  meta: Array<{ label: string; value: string }>;
  messages: ChatMessage[];
  fetchedAt: number;
}

export const KIND_LABEL: Record<ChatItemKind, string> = {
  assigned: "Bana atandı",
  mention: "Bahsetme",
  dm: "Doğrudan mesaj",
  group: "Grup",
  channel: "Kanal",
};

export const EMPTY_SOURCE: ChatSourceState = { configured: false, error: null, label: null, me: null, counts: {}, items: [], updatedAt: 0 };
export const EMPTY_CHAT: ChatState = { chatwoot: EMPTY_SOURCE, mattermost: EMPTY_SOURCE, updatedAt: 0 };
