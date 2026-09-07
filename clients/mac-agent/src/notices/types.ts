/** Panelin bildirim sözleşmesi (lib/notices/types.ts) — üretici tarafı kopyası */
export type NoticeSeverity = "info" | "attention" | "urgent";

export interface NoticeInput {
  id: string;
  title: string;
  kind?: string;
  severity?: NoticeSeverity;
  body?: string;
  screen?: string;
  ttlMs?: number;
  meta?: Record<string, string>;
}
