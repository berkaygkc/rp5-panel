/**
 * Spark Desktop mail okuyucu.
 *
 * Spark bir Electron uygulaması; AppleScript sözlüğü yok. Ancak yerel veri
 * deposu düz SQLite: ~/Library/Application Support/Spark Desktop/core-data/messages.sqlite
 * Buraya SALT OKUNUR bağlanılır (mode=ro) — Spark'ın kendi yazımı etkilenmez.
 *
 * Not: Bu veritabanı tam gövdeleri tutmaz, yalnızca ~250 karakterlik önizleme
 * (shortBody) vardır. Panel bir "bakış" yüzeyi olduğu için bu yeterlidir.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearNotice, postNotice } from "../notices/client.js";
import { agentConfig } from "../config.js";

const DB = path.join(
  os.homedir(),
  "Library/Application Support/Spark Desktop/core-data/messages.sqlite"
);
const QUERY_TIMEOUT_MS = 8000;
const MESSAGE_LIMIT = 80;
/** Spark'ın takım/çalışma alanı hesabı — posta kutusu değil */
const TEAM_ACCOUNT_TYPE = 30;
/** Panelde gösterilmeyecek hesaplar — yönetim panelinden (mail.excludedAddresses) */
function isExcluded(address: string): boolean {
  return agentConfig().mailExcludedAddresses.some((p) => {
    try { return new RegExp(p, "i").test(address); } catch { return false; }
  });
}

export interface MailAccount {
  pk: number;
  title: string;
  address: string | null;
  unread: number;
}

export interface MailMessage {
  pk: number;
  accountPk: number;
  fromName: string;
  fromAddress: string;
  subject: string;
  preview: string;
  /** ms */
  receivedAt: number;
  unseen: boolean;
  starred: boolean;
  attachments: number;
}

export interface MailWire {
  available: boolean;
  accounts: MailAccount[];
  messages: MailMessage[];
  updatedAt: number;
  error: string | null;
}

function query<T>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    execFile(
      "sqlite3",
      ["-readonly", "-json", `file:${DB}?mode=ro`, sql],
      { timeout: QUERY_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        const text = stdout.trim();
        if (!text) return resolve([]);
        try {
          resolve(JSON.parse(text) as T[]);
        } catch (e) {
          reject(e as Error);
        }
      }
    );
  });
}

/** `"Ad Soyad" <adres@x.com>` → { name, address } */
function parseFrom(raw: string | null): { name: string; address: string } {
  const value = (raw ?? "").trim();
  if (!value) return { name: "", address: "" };
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), address: m[2].trim() };
  return value.includes("@") ? { name: "", address: value } : { name: value, address: "" };
}

/** additionalInfo JSON'undan hesap adresi */
function addressOf(info: string | null): string | null {
  if (!info) return null;
  try {
    const j = JSON.parse(info) as { accountAddress?: unknown };
    return typeof j.accountAddress === "string" && j.accountAddress ? j.accountAddress : null;
  } catch {
    return null;
  }
}

interface RawAccount {
  pk: number;
  accountTitle: string | null;
  additionalInfo: string | null;
  unread: number;
}

interface RawMessage {
  pk: number;
  accountPk: number;
  messageFrom: string | null;
  subject: string | null;
  shortBody: string | null;
  receivedDate: number;
  unseen: number;
  starred: number;
  numberOfFileAttachments: number;
}

export class MailMonitor {
  private cache: MailWire = {
    available: false,
    accounts: [],
    messages: [],
    updatedAt: 0,
    error: null,
  };
  private running = false;
  /** İlk yüklemedeki okunmamışlar temel alınır; bildirim yalnızca sonradan gelenler için */
  private unseenBaseline: Set<number> | null = null;
  /** Bir tazelemede en fazla bu kadar bildirim (toplu senkron sel yapmasın) */
  private static readonly MAX_NOTICES_PER_REFRESH = 5;

  /** Yeni okunmamış → bildirim; okunan/kaybolan → temizle. Önemi panel kuralları belirler. */
  private emitMailNotices(messages: MailMessage[], accountOf: Map<number, string>): void {
    const current = new Set(messages.filter((m) => m.unseen).map((m) => m.pk));
    const prev = this.unseenBaseline;
    this.unseenBaseline = current;
    if (!prev) return;
    let sent = 0;
    for (const m of messages) {
      if (!m.unseen || prev.has(m.pk)) continue;
      if (sent++ >= agentConfig().mailMaxNoticesPerRefresh) break;
      void postNotice({
        id: `mail:${m.pk}`,
        kind: "mail",
        severity: "info",
        title: m.fromName || m.fromAddress,
        body: m.subject,
        screen: "mail",
        ttlMs: 15 * 60_000,
        meta: { account: accountOf.get(m.accountPk) ?? "", from: m.fromAddress },
      });
    }
    for (const pk of prev) if (!current.has(pk)) void clearNotice(`mail:${pk}`);
  }

  get wire(): MailWire {
    return this.cache;
  }

  async refresh(): Promise<MailWire | null> {
    if (this.running) return null;
    if (!existsSync(DB)) {
      this.cache = { ...this.cache, available: false, error: "Spark Desktop bulunamadı" };
      return this.cache;
    }
    this.running = true;
    try {
      // Önce hesaplar: hariç tutulanların pk'leri mesaj sorgusunu da daraltır
      const rawAccounts = await query<RawAccount>(
        `SELECT a.pk, a.accountTitle, a.additionalInfo,
                (SELECT COUNT(*) FROM messages m
                  WHERE m.accountPk = a.pk AND m.inInbox = 1 AND m.unseen = 1) AS unread
           FROM accounts a
          WHERE a.accountType <> ${TEAM_ACCOUNT_TYPE}
          ORDER BY a.orderNumber`
      );

      const accounts = rawAccounts.filter((a) => {
        const address = addressOf(a.additionalInfo);
        return !(address && isExcluded(address));
      });
      const allowed = accounts.map((a) => Number(a.pk)).filter((pk) => Number.isFinite(pk));

      const messages = allowed.length
        ? await query<RawMessage>(
            `SELECT pk, accountPk, messageFrom, subject, shortBody, receivedDate,
                    unseen, starred, numberOfFileAttachments
               FROM messages
              WHERE inInbox = 1 AND accountPk IN (${allowed.join(",")})
              ORDER BY receivedDate DESC
              LIMIT ${agentConfig().mailMessageLimit || MESSAGE_LIMIT}`
          )
        : [];

      const mapped: MailMessage[] = messages.map((m) => {
        const from = parseFrom(m.messageFrom);
        return {
          pk: m.pk,
          accountPk: m.accountPk,
          fromName: from.name || from.address,
          fromAddress: from.address,
          subject: (m.subject ?? "").trim() || "(konu yok)",
          preview: (m.shortBody ?? "").replace(/\s+/g, " ").trim(),
          receivedAt: Number(m.receivedDate) * 1000,
          unseen: Boolean(m.unseen),
          starred: Boolean(m.starred),
          attachments: Number(m.numberOfFileAttachments) || 0,
        };
      });
      const accountOf = new Map(
        accounts.map((a) => [Number(a.pk), addressOf(a.additionalInfo) ?? a.accountTitle ?? ""] as const)
      );
      this.emitMailNotices(mapped, accountOf);

      this.cache = {
        available: true,
        accounts: accounts.map((a) => ({
          pk: a.pk,
          address: addressOf(a.additionalInfo),
          title: a.accountTitle?.trim() || addressOf(a.additionalInfo) || "Posta kutusu",
          unread: Number(a.unread) || 0,
        })),
        messages: mapped,
        updatedAt: Date.now(),
        error: null,
      };
      return this.cache;
    } catch (err) {
      this.cache = {
        ...this.cache,
        updatedAt: Date.now(),
        error: (err as Error).message.split("\n")[0],
      };
      return this.cache;
    } finally {
      this.running = false;
    }
  }
}
