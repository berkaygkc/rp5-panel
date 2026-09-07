import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyRules } from "./rules";
import type { Notice, NoticeEvent, NoticeInput, NoticeSeverity } from "@/lib/notices/types";

/**
 * Bildirim deposu — süreç başına tek örnek (globalThis: dev'de HMR modülü
 * yeniden yüklese de dinleyiciler ve liste korunur). Diske yazar: urgent'lar
 * sunucu yeniden başlasa da kullanıcı kapatana kadar geri gelir.
 */

const DATA_FILE = path.join(process.env.PANEL_DATA_DIR ? path.resolve(process.env.PANEL_DATA_DIR) : path.join(process.cwd(), ".data"), "notices.json");
const DEFAULT_TTL: Record<NoticeSeverity, number | null> = {
  info: 2 * 60_000,
  attention: 30 * 60_000,
  urgent: null,
};

type Listener = (ev: NoticeEvent) => void;

class NoticeStore {
  private map = new Map<string, Notice>();
  private listeners = new Set<Listener>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.load();
  }

  snapshot(): Notice[] {
    this.expire();
    return [...this.map.values()].sort((a, b) => b.ts - a.ts);
  }

  /** Kural uygula, tekrarı bastır, yayınla. Döner: eklendi/güncellendi mi */
  push(raw: NoticeInput, source: string): { notice: Notice; changed: boolean } {
    const input = applyRules(raw);
    const severity: NoticeSeverity = input.severity ?? "info";
    const ttl = severity === "urgent" ? null : (input.ttlMs ?? DEFAULT_TTL[severity]);
    const prev = this.map.get(input.id);
    const notice: Notice = {
      id: input.id,
      kind: input.kind ?? "system",
      severity,
      title: input.title,
      body: input.body,
      screen: input.screen,
      source,
      ts: prev?.ts ?? Date.now(),
      expiresAt: ttl === null ? null : Date.now() + ttl,
      meta: input.meta,
    };
    const same =
      prev &&
      prev.severity === notice.severity &&
      prev.title === notice.title &&
      prev.body === notice.body &&
      prev.kind === notice.kind;
    if (same) {
      // Aynı olay tekrar bildirildi: süresini tazele, panele yeniden çaldırma
      if (prev.expiresAt !== null && notice.expiresAt !== null) prev.expiresAt = notice.expiresAt;
      this.persist();
      return { notice: prev, changed: false };
    }
    if (!prev) notice.ts = Date.now();
    this.map.set(notice.id, notice);
    this.emit({ type: "notice", notice });
    this.persist();
    return { notice, changed: true };
  }

  clear(id: string): boolean {
    if (!this.map.delete(id)) return false;
    this.emit({ type: "clear", id });
    this.persist();
    return true;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(ev: NoticeEvent) {
    for (const fn of this.listeners) {
      try {
        fn(ev);
      } catch {
        /* kopmuş abone */
      }
    }
  }

  private expire() {
    const now = Date.now();
    for (const [id, n] of this.map) {
      if (n.expiresAt !== null && n.expiresAt <= now) {
        this.map.delete(id);
        this.emit({ type: "clear", id });
      }
    }
  }

  private load() {
    try {
      if (!existsSync(DATA_FILE)) return;
      const list = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Notice[];
      const now = Date.now();
      for (const n of list) if (n.expiresAt === null || n.expiresAt > now) this.map.set(n.id, n);
    } catch {
      /* bozuk dosya: temiz başla */
    }
  }

  private persist() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        writeFileSync(DATA_FILE, JSON.stringify([...this.map.values()], null, 2));
      } catch {
        /* disk yazılamadı: bellekte devam */
      }
    }, 200);
  }
}

const g = globalThis as unknown as { __rp5NoticeStore?: NoticeStore };

export function getNoticeStore(): NoticeStore {
  g.__rp5NoticeStore ??= new NoticeStore();
  return g.__rp5NoticeStore;
}
