/** Panelin bildirim sözleşmesi (lib/notices/types.ts) — üretici tarafı kopyası */
export type NoticeSeverity = "info" | "attention" | "urgent";

/** Bildirimin taşıdığı eylem: yüzeyde düğme, çekirdek üzerinden cihaza gider */
export interface NoticeAction {
  id: string;
  label: string;
  capability: string;
  action: string;
  args?: Record<string, unknown>;
  dismiss?: boolean;
}

export interface NoticeInput {
  id: string;
  title: string;
  kind?: string;
  severity?: NoticeSeverity;
  body?: string;
  screen?: string;
  ttlMs?: number;
  meta?: Record<string, string>;
  actions?: NoticeAction[];
}
