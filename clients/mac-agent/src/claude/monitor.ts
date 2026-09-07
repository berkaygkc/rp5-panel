/**
 * Claude Code oturum izleyici.
 * - ~/.claude/projects altındaki son 14 günün JSONL dökümlerini keşfeder,
 *   artımlı ve bütçeli parse eder (2 GB'lık arşivi her seferinde okumaz).
 * - Çalışan CLI süreçleriyle eşleştirip durum çıkarır:
 *   working (dosya son 12 sn'de büyüdü) / waiting (süreç canlı, dosya durgun) / closed.
 * - Seçilen oturumun dosyasını kuyruktan izleyip canlı akış olayları üretir.
 */
import { promises as fs, watchFile, unwatchFile, type Stats } from "node:fs";
import os from "node:os";
import path from "node:path";
import { addTokens, emptyTokens, feedEventsOf, parseLine, usageOf, type RawRecord } from "./parse.js";
import { readLiveSessions } from "./liveSessions.js";
import { clearNotice, postNotice } from "../notices/client.js";
import { agentConfig } from "../config.js";
import type {
  ClaudeSessionWire,
  ClaudeStats,
  FeedEvent,
  SessionActivity,
  SessionStatus,
  Tokens,
} from "./types.js";

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");
const RECENT_DAYS = 14;
const WORKING_WINDOW_MS = 12_000;
/** Bekleyen oturum bu kadar cevapsız kalırsa bildirilir — normal sohbet duraksaması değil, unutulmuş oturum */
const WAIT_NOTICE_MS = 3 * 60_000;
/** "Meşgul" bayrağı varken bu kadar sessizlik hâlâ çalışıyor sayılır (uzun düşünme/araç) */
const BUSY_GRACE_MS = 90_000;
/** Tarama başına en fazla bu kadar bayt parse edilir; kalan sonraki turda */
const PARSE_BUDGET_BYTES = 48 * 1024 * 1024;
const CLOSED_LIMIT = 12;
const FEED_TAIL_BYTES = 400 * 1024;
const FEED_KEEP = 40;
const HOUR = 3_600_000;
/** Arka plan otomasyon oturumları (claude-mem observer vb.) listeye girmez */
const EXCLUDE_SLUG_RE = /observer-sessions|claude-mem|rp5-agent/;

interface MsgUsage {
  tokens: Tokens;
  hour: number;
}

interface SessionCache {
  id: string;
  path: string;
  slug: string;
  size: number;
  mtimeMs: number;
  birthMs: number;
  offset: number;
  partial: string;
  /** message.id → son görülen usage (tekilleştirme) */
  messages: Map<string, MsgUsage>;
  tokens: Tokens;
  hourly: Map<number, Tokens>;
  prompts: number;
  model: string | null;
  cwd: string | null;
  branch: string | null;
  title: string | null;
  firstPrompt: string | null;
  startedAt: number | null;
  lastActiveAt: number | null;
  costUsd: number | null;
  linesAdded: number;
  linesRemoved: number;
  activity: SessionActivity | null;
  lastPrompt: string | null;
}

interface FeedSub {
  sessionId: string;
  path: string;
  offset: number;
  partial: string;
  listener: (curr: Stats) => void;
}

export interface ClaudeSnapshot {
  sessions: ClaudeSessionWire[];
  stats: ClaudeStats;
}

type FeedSender = (msg: { type: "claudeFeed"; sessionId: string; events: FeedEvent[]; reset: boolean }) => void;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function subTokens(a: Tokens, b: Tokens): void {
  a.input -= b.input;
  a.output -= b.output;
  a.cacheRead -= b.cacheRead;
  a.cacheWrite -= b.cacheWrite;
}

function emptyStats(): ClaudeStats {
  return { today: emptyTokens(), last5h: emptyTokens(), working: 0, waiting: 0, todayCostUsd: 0 };
}

async function readRange(file: string, start: number, length: number): Promise<string> {
  const fh = await fs.open(file, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await fh.close();
  }
}

export class ClaudeMonitor {
  private cache = new Map<string, SessionCache>();
  private feeds = new Map<object, FeedSub>();
  private last: ClaudeSnapshot = { sessions: [], stats: emptyStats() };
  /** Önceki tarama durumu (ilk tarama: bayat bildirim temizliği) */
  private lastStatus: Map<string, SessionStatus> | null = null;
  /** Oturum ne zamandır bekliyor (bu ajan örneğinin gördüğü kadarıyla) */
  private waitingSince = new Map<string, number>();
  /** Bildirimi gönderilmiş bekleyen oturumlar */
  private notified = new Set<string>();
  /** Ön plandaki VSCode çalışma alanı bu proje mi? (index.ts FrontmostMonitor ile bağlar) */
  isInFront: (project: string) => boolean = () => false;

  /**
   * Bekleme bildirimi: oturum en az WAIT_NOTICE_MS boyunca girdi bekliyorsa ve
   * ön plandaki VSCode çalışma alanı değilse "sizi bekliyor" (attention).
   * Tekrar çalışınca/kapanınca aynı kimlik temizlenir. Açılışta önceki ajan
   * örneğinden kalmış bildirimler de temizlenir (durum yeniden değerlendirilir).
   */
  private emitTransitions(all: ClaudeSessionWire[]): void {
    const now = Date.now();
    if (!this.lastStatus) {
      // İlk tarama: bayat "bekliyor" bildirimlerini sil, sayaçları sıfırdan başlat
      for (const s of all) void clearNotice(`claude:waiting:${s.id}`);
    }
    const current = new Map(all.map((s) => [s.id, s.status] as const));
    this.lastStatus = current;

    for (const s of all) {
      const id = `claude:waiting:${s.id}`;
      if (s.status !== "waiting") {
        if (this.waitingSince.delete(s.id) || this.notified.delete(s.id)) void clearNotice(id);
        continue;
      }
      const since = this.waitingSince.get(s.id) ?? now;
      this.waitingSince.set(s.id, since);
      if (this.notified.has(s.id) || now - since < (agentConfig().claudeWaitNoticeMs || WAIT_NOTICE_MS)) continue;
      // Önünüzde duran projeyi dürtme: bakmayı bırakınca bir sonraki taramada bildirilir
      if (this.isInFront(s.project)) continue;
      this.notified.add(s.id);
      void postNotice({
        id,
        kind: "claude",
        severity: "attention",
        title: `${s.project} sizi bekliyor`,
        body: s.activity?.kind === "assistant" && s.activity.text ? s.activity.text : (s.lastPrompt ?? undefined),
        screen: "claude",
        ttlMs: 60 * 60_000,
        meta: { session: s.id, project: s.project },
      });
    }
    for (const sid of [...this.waitingSince.keys()]) {
      if (!current.has(sid)) {
        this.waitingSince.delete(sid);
        this.notified.delete(sid);
        void clearNotice(`claude:waiting:${sid}`);
      }
    }
  }

  get snapshot(): ClaudeSnapshot {
    return this.last;
  }

  async scan(): Promise<ClaudeSnapshot> {
    const now = Date.now();
    const cutoff = now - RECENT_DAYS * 86_400_000;

    // 1. Dosya keşfi (stat ucuzdur; içerik henüz okunmaz)
    const found: SessionCache[] = [];
    let slugs: string[] = [];
    try {
      slugs = await fs.readdir(PROJECTS_DIR);
    } catch {
      return this.last;
    }
    for (const slug of slugs) {
      if (EXCLUDE_SLUG_RE.test(slug)) continue;
      const dir = path.join(PROJECTS_DIR, slug);
      let files: string[];
      try {
        files = await fs.readdir(dir);
      } catch {
        continue;
      }
      for (const f of files) {
        if (!f.endsWith(".jsonl")) continue;
        const p = path.join(dir, f);
        let st: Stats;
        try {
          st = await fs.stat(p);
        } catch {
          continue;
        }
        if (st.mtimeMs < cutoff) continue;
        let c = this.cache.get(p);
        if (!c) {
          c = {
            id: f.slice(0, -6),
            path: p,
            slug,
            size: 0,
            mtimeMs: 0,
            birthMs: st.birthtimeMs || st.ctimeMs,
            offset: 0,
            partial: "",
            messages: new Map(),
            tokens: emptyTokens(),
            hourly: new Map(),
            prompts: 0,
            model: null,
            cwd: null,
            branch: null,
            title: null,
            firstPrompt: null,
            startedAt: null,
            lastActiveAt: null,
            costUsd: null,
            linesAdded: 0,
            linesRemoved: 0,
            activity: null,
            lastPrompt: null,
          };
          this.cache.set(p, c);
        }
        if (st.size < c.offset) {
          // Dosya kısalmış (nadiren): baştan parse et
          c.offset = 0;
          c.partial = "";
        }
        c.size = st.size;
        c.mtimeMs = st.mtimeMs;
        found.push(c);
      }
    }

    // 2. Artımlı parse — en yeni önce, bütçe dahilinde
    found.sort((a, b) => b.mtimeMs - a.mtimeMs);
    let budget = PARSE_BUDGET_BYTES;
    for (const c of found) {
      if (c.offset >= c.size || budget <= 0) continue;
      const chunk = Math.min(c.size - c.offset, budget);
      await this.parseRange(c, chunk);
      budget -= chunk;
    }

    // 3. Canlı oturumlar — Claude Code'un kendi kaydı (~/.claude/sessions/<pid>.json).
    // Oturum kimliği doğrudan geldiği için döküm dosyası hangi proje klasöründe
    // olursa olsun (worktree, taşınmış proje) doğru eşleşir.
    const liveList = await readLiveSessions(EXCLUDE_SLUG_RE);
    const live = new Map(liveList.map((l) => [l.sessionId, l]));
    const byId = new Map(found.map((c) => [c.id, c]));

    // Canlı bilgiyi önbelleğe işle: ad, çalışma dizini ve durum buradan gelir
    for (const l of liveList) {
      const c = byId.get(l.sessionId);
      if (c) {
        c.cwd = l.cwd;
        if (l.name) c.title = l.name;
      }
    }
    // Aynı proje klasöründeki cwd'siz oturumlar için sözlük
    const slugCwd = new Map<string, string>();
    for (const c of found) if (c.cwd) slugCwd.set(c.slug, c.cwd);
    for (const c of found) if (!c.cwd) c.cwd = slugCwd.get(c.slug) ?? null;

    // 4. Tel verisi
    const all = found.map((c) => {
      const l = live.get(c.id);
      // Meşgul bayrağı Claude Code'dan gelir; dosya son saniyelerde büyüdüyse
      // de çalışıyor sayılır (bayrak güncellenmeden önceki an)
      // Çalışıyor kararının asıl kanıtı dökümün büyümesidir; Claude Code'un
      // "meşgul" bayrağı yalnızca uzun sessizliklerde destek olarak kullanılır.
      const active =
        now - c.mtimeMs < WORKING_WINDOW_MS || (l?.busy === true && now - c.mtimeMs < BUSY_GRACE_MS);
      const status: SessionStatus = l ? (active ? "working" : "waiting") : "closed";
      return this.toWire(c, status);
    });
    // Dökümü henüz oluşmamış canlı oturumlar (yeni açılmış) da görünsün
    const seen = new Set(all.map((s) => s.id));
    for (const l of liveList) {
      if (seen.has(l.sessionId)) continue;
      all.push({
        id: l.sessionId,
        project: path.basename(l.cwd),
        cwd: l.cwd,
        branch: null,
        title: l.name ?? "Yeni oturum",
        status: l.busy ? "working" : "waiting",
        model: null,
        prompts: 0,
        tokens: emptyTokens(),
        costUsd: null,
        linesAdded: 0,
        linesRemoved: 0,
        startedAt: l.startedAt ?? Date.now(),
        lastActiveAt: l.updatedAt ?? Date.now(),
        parsing: false,
        activity: null,
        lastPrompt: null,
      });
    }

    this.emitTransitions(all);

    const open = all.filter((s) => s.status !== "closed");
    // İçeriği hiç olmayan kapalı kayıtlar (yalnızca bridge işareti) listeyi kirletmesin
    const closed = all
      .filter((s) => s.status === "closed" && (s.prompts > 0 || s.tokens.output > 0))
      .slice(0, CLOSED_LIMIT);

    this.last = { sessions: [...open, ...closed], stats: this.computeStats(found, all, now) };
    return this.last;
  }

  private async parseRange(c: SessionCache, length: number): Promise<void> {
    const text = c.partial + (await readRange(c.path, c.offset, length));
    c.offset += length;
    const lines = text.split("\n");
    // Son parça satır sonuyla bitmiyorsa yarımdır — bir sonraki tura sakla
    c.partial = text.endsWith("\n") ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      const rec = parseLine(line);
      if (rec) this.applyRecord(c, rec);
    }
  }

  private applyRecord(c: SessionCache, rec: RawRecord): void {
    if (typeof rec.cwd === "string" && !c.cwd) c.cwd = rec.cwd;
    if (typeof rec.gitBranch === "string") c.branch = rec.gitBranch;
    const ts = typeof rec.timestamp === "string" ? Date.parse(rec.timestamp) : NaN;
    if (Number.isFinite(ts)) {
      c.startedAt ??= ts;
      c.lastActiveAt = Math.max(c.lastActiveAt ?? 0, ts);
    }

    switch (rec.type) {
      case "ai-title":
        if (typeof rec.aiTitle === "string") c.title = rec.aiTitle;
        break;
      case "user":
        if (!rec.isMeta && typeof rec.message?.content === "string") {
          const text = rec.message.content.trim();
          c.prompts++;
          c.firstPrompt ??= clip(text.split("\n")[0], 90);
          c.lastPrompt = clip(text.split("\n")[0], 140);
          if (Number.isFinite(ts)) c.activity = { kind: "user", text: c.lastPrompt, ts };
        }
        break;
      case "assistant": {
        if (typeof rec.message?.model === "string") c.model = rec.message.model;
        if (Array.isArray(rec.message?.content) && Number.isFinite(ts)) {
          for (const block of rec.message.content) {
            if (block?.type === "tool_use") {
              c.activity = { kind: "tool", tool: String(block.name ?? "araç"), text: "", ts };
            } else if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
              c.activity = { kind: "assistant", text: clip(block.text.trim().split("\n")[0], 140), ts };
            }
          }
        }
        const usage = usageOf(rec);
        const id = rec.message?.id;
        if (!usage || typeof id !== "string") break;
        const hour = Number.isFinite(ts) ? Math.floor(ts / HOUR) : Math.floor(Date.now() / HOUR);
        const prev = c.messages.get(id);
        if (prev) {
          subTokens(c.tokens, prev.tokens);
          const b = c.hourly.get(prev.hour);
          if (b) subTokens(b, prev.tokens);
        }
        c.messages.set(id, { tokens: usage, hour });
        addTokens(c.tokens, usage);
        let bucket = c.hourly.get(hour);
        if (!bucket) c.hourly.set(hour, (bucket = emptyTokens()));
        addTokens(bucket, usage);
        break;
      }
      case "cost-state":
        if (typeof rec.totalCostUSD === "number") c.costUsd = rec.totalCostUSD;
        if (typeof rec.totalLinesAdded === "number") c.linesAdded = rec.totalLinesAdded;
        if (typeof rec.totalLinesRemoved === "number") c.linesRemoved = rec.totalLinesRemoved;
        break;
    }
  }

  private toWire(c: SessionCache, status: SessionStatus): ClaudeSessionWire {
    const project = c.cwd ? path.basename(c.cwd) : c.slug.split("-").filter(Boolean).pop() ?? c.slug;
    return {
      id: c.id,
      project,
      cwd: c.cwd ?? "",
      branch: c.branch && c.branch !== "HEAD" ? c.branch : null,
      title: c.title ?? c.firstPrompt ?? "Adsız oturum",
      status,
      model: c.model,
      prompts: c.prompts,
      tokens: { ...c.tokens },
      costUsd: c.costUsd,
      linesAdded: c.linesAdded,
      linesRemoved: c.linesRemoved,
      startedAt: c.startedAt ?? c.birthMs,
      lastActiveAt: Math.max(c.lastActiveAt ?? 0, c.mtimeMs),
      parsing: c.offset < c.size,
      activity: c.activity,
      lastPrompt: c.lastPrompt,
    };
  }

  private computeStats(found: SessionCache[], wire: ClaudeSessionWire[], now: number): ClaudeStats {
    const stats = emptyStats();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const todayHour = Math.floor(dayStart.getTime() / HOUR);
    const fiveHoursAgoHour = Math.floor((now - 5 * HOUR) / HOUR);
    for (const c of found) {
      for (const [hour, t] of c.hourly) {
        if (hour >= todayHour) addTokens(stats.today, t);
        if (hour >= fiveHoursAgoHour) addTokens(stats.last5h, t);
      }
      if (c.costUsd !== null && (c.lastActiveAt ?? c.mtimeMs) >= dayStart.getTime()) {
        stats.todayCostUsd += c.costUsd;
      }
    }
    stats.working = wire.filter((s) => s.status === "working").length;
    stats.waiting = wire.filter((s) => s.status === "waiting").length;
    return stats;
  }

  /* ── Canlı akış ── */

  async subscribeFeed(client: object, sessionId: string, send: FeedSender): Promise<void> {
    this.unsubscribeFeed(client);
    const c = [...this.cache.values()].find((s) => s.id === sessionId);
    if (!c) {
      send({ type: "claudeFeed", sessionId, events: [], reset: true });
      return;
    }

    // Kuyruk: son ~400 KB, ilk yarım satır atılır
    const size = (await fs.stat(c.path)).size;
    const start = Math.max(0, size - FEED_TAIL_BYTES);
    let text = await readRange(c.path, start, size - start);
    if (start > 0) text = text.slice(text.indexOf("\n") + 1);
    const events = this.eventsFrom(text.split("\n")).slice(-FEED_KEEP);
    send({ type: "claudeFeed", sessionId, events, reset: true });

    const sub: FeedSub = { sessionId, path: c.path, offset: size, partial: "", listener: () => {} };
    sub.listener = (curr: Stats) => {
      if (curr.size < sub.offset) {
        sub.offset = 0;
        sub.partial = "";
      }
      if (curr.size <= sub.offset) return;
      const from = sub.offset;
      const len = curr.size - from;
      sub.offset = curr.size;
      void readRange(sub.path, from, len).then((chunk) => {
        const merged = sub.partial + chunk;
        const lines = merged.split("\n");
        sub.partial = merged.endsWith("\n") ? "" : (lines.pop() ?? "");
        const fresh = this.eventsFrom(lines);
        if (fresh.length) send({ type: "claudeFeed", sessionId, events: fresh, reset: false });
      });
    };
    watchFile(c.path, { interval: 600 }, sub.listener);
    this.feeds.set(client, sub);
  }

  unsubscribeFeed(client: object): void {
    const sub = this.feeds.get(client);
    if (!sub) return;
    unwatchFile(sub.path, sub.listener);
    this.feeds.delete(client);
  }

  private eventsFrom(lines: string[]): FeedEvent[] {
    const out: FeedEvent[] = [];
    for (const line of lines) {
      const rec = parseLine(line);
      if (rec) out.push(...feedEventsOf(rec));
    }
    return out;
  }
}
