/**
 * Bildirim sözleşmesi — üretici kim olursa olsun (Mac ajanı, Next içi monitörler,
 * dış webhook'lar) aynı biçim. Panel yalnızca bu tipi bilir.
 */

export type NoticeSeverity = "info" | "attention" | "urgent";

/**
 * Bildirimin taşıdığı eylem. Yüzeyde bir düğme olur; dokunulduğunda çekirdek
 * bunu ilgili yeteneği sunan cihaza yönlendirir. Böylece "konteyneri yeniden
 * başlat" ya da "projeyi aç" panelden değil, işi yapan cihazdan yürür.
 */
export interface NoticeAction {
  id: string;
  label: string;
  capability: string;
  action: string;
  args?: Record<string, unknown>;
  /** Eylem başarılıysa bildirimi kapat */
  dismiss?: boolean;
}

export interface Notice {
  /** Kararlı kimlik — aynı olay iki kez çalmaz; durum değişince bu id ile temizlenir */
  id: string;
  /** Panelde ikon/renk anahtarı: claude, mail, ci, server, system … (bilinmeyen → genel) */
  kind: string;
  severity: NoticeSeverity;
  title: string;
  body?: string;
  /** Dokununca gidilecek panel ekranı (lib/screens.ts kimliği) */
  screen?: string;
  /** Üretici etiketi: agent, next:agent-link, webhook:github … */
  source: string;
  ts: number;
  /** null → kalıcı (urgent): yalnızca üretici temizler ya da kullanıcı kapatır */
  expiresAt: number | null;
  /** Kurallar için serbest alanlar (hesap, repo, host …) */
  meta?: Record<string, string>;
  /** Yüzeyde düğme olarak çıkan eylemler (en fazla ikisi gösterilir) */
  actions?: NoticeAction[];
}

/** Üreticilerin gönderdiği (POST gövdesi) */
export interface NoticeInput {
  id: string;
  title: string;
  kind?: string;
  severity?: NoticeSeverity;
  body?: string;
  screen?: string;
  /** ms; verilmezse öneme göre varsayılan; urgent'ta yok sayılır (kalıcı) */
  ttlMs?: number;
  meta?: Record<string, string>;
  actions?: NoticeAction[];
}

export type NoticeEvent =
  | { type: "snapshot"; notices: Notice[] }
  | { type: "notice"; notice: Notice }
  | { type: "clear"; id: string };

export const SEVERITY_RANK: Record<NoticeSeverity, number> = { urgent: 3, attention: 2, info: 1 };
