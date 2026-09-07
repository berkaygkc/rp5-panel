import { getNoticeStore } from "@/lib/server/notices/store";
import { getSettingSync } from "@/lib/server/config/settings";
import type { NoticeInput } from "@/lib/notices/types";
import { EMPTY_SOURCE, type ChatItem, type ChatSource, type ChatSourceState, type ChatState, type ChatThread } from "@/lib/types/chat";
import {
  cwConversation, cwConversations, cwInboxes, cwItem, cwMessages, cwNotifications, cwProfile, cwThread,
  type ChatwootConfig, type CwProfile,
} from "@/lib/server/chat/chatwoot";
import {
  MmError, mmDisplayName, mmFetch, mmLogin, mmText,
  type MattermostConfig, type MmChannel, type MmMember, type MmPost, type MmPosts, type MmTeam, type MmUser,
} from "@/lib/server/chat/mattermost";

/**
 * Sohbet izleyicisi (Next içi üretici): Chatwoot ve Mattermost'u aralıklı yoklar,
 * "bakılması gereken" öğeleri tek listeye indirger, ekran için önbelleğe alır ve
 * dikkat katmanına yazar:
 *   bana atanmış sohbette okunmamış müşteri mesajı → attention
 *   atanmamış sohbet eşikten uzun bekliyor         → attention (tek toplu bildirim)
 *   Mattermost bahsetme / doğrudan mesaj           → attention
 * Kullanıcının kiosk'ta kapattığı bildirim, içeriği değişmedikçe yeniden çalmaz.
 */
const PREVIEW_LIMIT = 12;
const CACHE_MS = 10 * 60_000;
const THREAD_TTL_MS = 8000;

function cwConfig(): Omit<ChatwootConfig, "accountId"> & { accountId: number } | null {
  const url = (getSettingSync("chatwoot.url") || "").replace(/\/+$/, "");
  const token = getSettingSync("chatwoot.token") || "";
  return url && token ? { url, token, accountId: Number(getSettingSync("chatwoot.accountId")) || 0 } : null;
}
function mmConfig(): MattermostConfig | null {
  const url = (getSettingSync("mattermost.url") || "").replace(/\/+$/, "");
  const token = getSettingSync("mattermost.token") || "";
  const login = getSettingSync("mattermost.login") || "";
  const password = getSettingSync("mattermost.password") || "";
  if (!url) return null;
  if (!token && !(login && password)) return null;
  return { url, token, login, password };
}

interface MmRaw {
  ch: MmChannel;
  team: MmTeam;
  unread: number;
  mentions: number;
  priority: number;
}

class ChatMonitor {
  private state: ChatState = { chatwoot: { ...EMPTY_SOURCE }, mattermost: { ...EMPTY_SOURCE }, updatedAt: 0 };
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Chatwoot önbellekleri
  private cwKey = "";
  private profile: CwProfile | null = null;
  private profileAt = 0;
  private inboxes = new Map<number, string>();
  private inboxesAt = 0;
  // Mattermost önbellekleri
  private mmKey = "";
  private session: string | null = null;
  private me: MmUser | null = null;
  private users = new Map<string, MmUser>();
  // Bildirim durumu
  private noticed = new Set<string>();
  private dismissed = new Map<string, string>();
  private threads = new Map<string, ChatThread>();

  get snapshot(): ChatState {
    return this.state;
  }

  /* ── Chatwoot ── */

  private async chatwootConfigured(): Promise<ChatwootConfig | null> {
    const base = cwConfig();
    if (!base) return null;
    const key = `${base.url}|${base.token}|${base.accountId}`;
    if (key !== this.cwKey) {
      this.cwKey = key;
      this.profile = null;
      this.inboxes.clear();
      this.inboxesAt = 0;
    }
    if (!this.profile || Date.now() - this.profileAt > CACHE_MS) {
      this.profile = await cwProfile(base);
      this.profileAt = Date.now();
    }
    const accountId = base.accountId || this.profile.accounts[0]?.id;
    if (!accountId) throw new Error("Chatwoot: bu kullanıcı hiçbir hesaba üye değil");
    return { ...base, accountId };
  }

  private async pollChatwoot(): Promise<ChatSourceState> {
    const cfg = await this.chatwootConfigured();
    if (!cfg) return { ...EMPTY_SOURCE };
    if (Date.now() - this.inboxesAt > CACHE_MS) {
      try {
        const r = await cwInboxes(cfg);
        this.inboxes = new Map(r.payload.map((i) => [i.id, i.name]));
        this.inboxesAt = Date.now();
      } catch {
        /* gelen kutusu adları isteğe bağlı */
      }
    }
    // Yalnızca bana atanmış açık sohbetler; atanmamış kuyruk bilinçli olarak okunmaz
    const [mine, notif] = await Promise.all([cwConversations(cfg, "me"), cwNotifications(cfg).catch(() => null)]);
    const items: ChatItem[] = mine.data.payload.map((c) => cwItem(c, this.inboxes, cfg));
    let mentions = 0;
    for (const n of notif?.data.payload ?? []) {
      if (n.read_at || n.notification_type !== "conversation_mention") continue;
      mentions++;
      const it = items.find((i) => i.ref === String(n.primary_actor_id));
      if (it) {
        it.mentions++;
        it.priority = 3;
      }
    }
    const profile = this.profile;
    return {
      configured: true,
      error: null,
      label: profile?.accounts.find((a) => a.id === cfg.accountId)?.name ?? `Hesap ${cfg.accountId}`,
      me: profile?.name ?? null,
      counts: {
        mine: mine.data.meta.mine_count,
        waiting: items.filter((i) => i.unread > 0).length,
        mentions,
        oldestWaitMs: items.reduce((max, i) => (i.unread > 0 && i.waitingSince ? Math.max(max, Date.now() - i.waitingSince) : max), 0),
      },
      items,
      updatedAt: Date.now(),
    };
  }

  /* ── Mattermost ── */

  private async mmToken(cfg: MattermostConfig): Promise<string> {
    const key = `${cfg.url}|${cfg.token}|${cfg.login}|${cfg.password}`;
    if (key !== this.mmKey) {
      this.mmKey = key;
      this.session = null;
      this.me = null;
      this.users.clear();
    }
    if (cfg.token) return cfg.token;
    if (!this.session) this.session = await mmLogin(cfg.url, cfg.login, cfg.password);
    return this.session;
  }

  private async resolveUsers(call: <T>(path: string, init?: RequestInit) => Promise<T>, ids: string[]): Promise<void> {
    const missing = [...new Set(ids)].filter((id) => id && !this.users.has(id));
    if (!missing.length) return;
    try {
      const users = await call<MmUser[]>("/users/ids", { method: "POST", body: JSON.stringify(missing) });
      for (const u of users) this.users.set(u.id, u);
    } catch {
      /* ad çözülemezse kimlik gösterilir */
    }
  }

  private mmItem(r: MmRaw, me: MmUser, post: MmPost | null, url: string): ChatItem {
    const { ch, team } = r;
    const kind = r.mentions > 0 ? "mention" : ch.type === "D" ? "dm" : ch.type === "G" ? "group" : "channel";
    let title = ch.display_name || ch.name;
    let link = `${url}/${team.name}/channels/${ch.name}`;
    if (ch.type === "D") {
      const other = ch.name.split("__").find((id) => id !== me.id) ?? "";
      const u = this.users.get(other);
      title = mmDisplayName(u, "Doğrudan mesaj");
      if (u) link = `${url}/${team.name}/messages/@${u.username}`;
    }
    const from = post ? mmDisplayName(this.users.get(post.user_id), "Biri") : null;
    return {
      id: `mattermost:${ch.id}`,
      source: "mattermost",
      ref: ch.id,
      kind,
      title,
      subtitle: ch.type === "D" ? "Doğrudan mesaj" : ch.type === "G" ? "Grup mesajı" : team.display_name,
      from: post && post.user_id === me.id ? "Ben" : from,
      preview: mmText(post),
      at: ch.last_post_at || post?.create_at || 0,
      unread: r.unread,
      mentions: r.mentions,
      waitingSince: null,
      labels: [],
      status: null,
      priority: r.priority,
      url: link,
    };
  }

  private async pollMattermostOnce(cfg: MattermostConfig): Promise<ChatSourceState> {
    const token = await this.mmToken(cfg);
    const call = <T,>(path: string, init?: RequestInit) => mmFetch<T>(cfg.url, token, path, init);
    if (!this.me) this.me = await call<MmUser>("/users/me");
    const me = this.me;
    const teams = await call<MmTeam[]>("/users/me/teams");
    const channels = new Map<string, { ch: MmChannel; team: MmTeam }>();
    const members = new Map<string, MmMember>();
    await Promise.all(
      teams.map(async (team) => {
        const [chs, mems] = await Promise.all([
          call<MmChannel[]>(`/users/${me.id}/teams/${team.id}/channels`),
          call<MmMember[]>(`/users/${me.id}/teams/${team.id}/channels/members`),
        ]);
        for (const ch of chs) if (!channels.has(ch.id)) channels.set(ch.id, { ch, team });
        for (const m of mems) if (!members.has(m.channel_id)) members.set(m.channel_id, m);
      })
    );
    const includeChannels = getSettingSync("chat.includeChannels");
    const raw: MmRaw[] = [];
    let unreadChannels = 0;
    let totalMentions = 0;
    for (const { ch, team } of channels.values()) {
      const m = members.get(ch.id);
      if (!m) continue;
      const unread = Math.max(0, (ch.total_msg_count ?? 0) - (m.msg_count ?? 0));
      const mentions = Math.max(m.mention_count ?? 0, m.mention_count_root ?? 0);
      if (unread === 0 && mentions === 0) continue;
      if (ch.type === "O" || ch.type === "P") unreadChannels++;
      totalMentions += mentions;
      const priority = mentions > 0 || ch.type === "D" ? 3 : ch.type === "G" ? 2 : 1;
      if (mentions > 0 || ch.type === "D" || ch.type === "G" || includeChannels) raw.push({ ch, team, unread, mentions, priority });
    }
    raw.sort((a, b) => b.priority - a.priority || b.ch.last_post_at - a.ch.last_post_at);
    const top = raw.slice(0, PREVIEW_LIMIT);
    const need: string[] = [];
    for (const r of top) if (r.ch.type === "D") need.push(...r.ch.name.split("__").filter((id) => id !== me.id));
    const previews = new Map<string, MmPost | null>();
    await Promise.all(
      top.map(async (r) => {
        try {
          const p = await call<MmPosts>(`/channels/${r.ch.id}/posts?per_page=1`);
          const post = p.order[0] ? (p.posts[p.order[0]] ?? null) : null;
          previews.set(r.ch.id, post);
          if (post) need.push(post.user_id);
        } catch {
          previews.set(r.ch.id, null);
        }
      })
    );
    await this.resolveUsers(call, need);
    const items = top.map((r) => this.mmItem(r, me, previews.get(r.ch.id) ?? null, cfg.url));
    let host = cfg.url;
    try {
      host = new URL(cfg.url).host;
    } catch {
      /* ham adres */
    }
    return {
      configured: true,
      error: null,
      label: host,
      me: mmDisplayName(me),
      counts: {
        mentions: totalMentions,
        dms: items.filter((i) => i.kind === "dm" || (i.kind === "mention" && i.subtitle === "Doğrudan mesaj")).length,
        channels: unreadChannels,
        teams: teams.length,
      },
      items,
      updatedAt: Date.now(),
    };
  }

  private async pollMattermost(): Promise<ChatSourceState> {
    const cfg = mmConfig();
    if (!cfg) return { ...EMPTY_SOURCE };
    try {
      return await this.pollMattermostOnce(cfg);
    } catch (err) {
      // Oturum düştüyse bir kez yeniden giriş dene (yalnızca parola ile girişte)
      if (err instanceof MmError && err.status === 401 && !cfg.token && this.session) {
        this.session = null;
        this.me = null;
        return this.pollMattermostOnce(cfg);
      }
      throw err;
    }
  }

  /* ── Döngü ── */

  private keep(prev: ChatSourceState, err: unknown): ChatSourceState {
    return { ...prev, configured: true, error: (err as Error).message || String(err), updatedAt: Date.now() };
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const [cw, mm] = await Promise.all([
        this.pollChatwoot().catch((e) => this.keep(this.state.chatwoot, e)),
        this.pollMattermost().catch((e) => this.keep(this.state.mattermost, e)),
      ]);
      this.state = { chatwoot: cw, mattermost: mm, updatedAt: Date.now() };
      this.syncNotices();
    } finally {
      this.running = false;
    }
  }

  private syncNotices(): void {
    const store = getNoticeStore();
    const s = this.state;
    const ttlMs = Math.max(Number(getSettingSync("chat.pollMs")) * 3, 90_000);
    const wanted = new Map<string, NoticeInput>();
    const base = { kind: "chat", severity: "attention" as const, screen: "chat", ttlMs };

    if (s.chatwoot.configured && !s.chatwoot.error) {
      if (getSettingSync("chat.noticeAssigned")) {
        for (const i of s.chatwoot.items) {
          if (i.kind !== "assigned" || (i.unread === 0 && i.mentions === 0)) continue;
          wanted.set(`chat:cw:${i.ref}`, {
            ...base,
            id: `chat:cw:${i.ref}`,
            title: i.mentions > 0 ? `${i.title} sohbetinde senden bahsedildi` : `${i.title} yazdı`,
            body: [i.subtitle, i.preview].filter(Boolean).join(": "),
            meta: { source: "chatwoot", inbox: i.subtitle, account: "" },
          });
        }
      }
    }
    if (s.mattermost.configured && !s.mattermost.error && getSettingSync("chat.noticeMentions")) {
      for (const i of s.mattermost.items) {
        if (i.kind !== "mention" && i.kind !== "dm") continue;
        wanted.set(`chat:mm:${i.ref}`, {
          ...base,
          id: `chat:mm:${i.ref}`,
          title: i.kind === "dm" ? `${i.title} mesaj gönderdi` : `${i.from ?? "Biri"} seni ${i.title} kanalında andı`,
          body: i.preview || i.subtitle,
          meta: { source: "mattermost" },
        });
      }
    }

    const live = new Set(store.snapshot().map((n) => n.id));
    for (const id of [...this.noticed]) {
      if (!wanted.has(id)) {
        store.clear(id);
        this.noticed.delete(id);
        this.dismissed.delete(id);
      }
    }
    for (const [id, n] of wanted) {
      const sig = `${n.title}|${n.body ?? ""}`;
      if (this.noticed.has(id) && !live.has(id)) this.dismissed.set(id, sig); // kullanıcı kapattı
      if (this.dismissed.get(id) === sig) continue;
      store.push(n, "next:chat");
      this.noticed.add(id);
    }
  }

  /** Detay: sohbetin son mesajları (kısa süreli önbellek) */
  async thread(source: ChatSource, ref: string): Promise<ChatThread> {
    const key = `${source}:${ref}`;
    const cached = this.threads.get(key);
    if (cached && Date.now() - cached.fetchedAt < THREAD_TTL_MS) return cached;
    let t: ChatThread;
    if (source === "chatwoot") {
      const cfg = await this.chatwootConfigured();
      if (!cfg) throw new Error("Chatwoot bağlı değil");
      const [c, m] = await Promise.all([cwConversation(cfg, ref), cwMessages(cfg, ref)]);
      t = cwThread(cfg, c, m.payload, this.inboxes.get(c.inbox_id) ?? `Gelen kutusu ${c.inbox_id}`);
    } else {
      const cfg = mmConfig();
      if (!cfg) throw new Error("Mattermost bağlı değil");
      const token = await this.mmToken(cfg);
      const call = <T,>(path: string, init?: RequestInit) => mmFetch<T>(cfg.url, token, path, init);
      if (!this.me) this.me = await call<MmUser>("/users/me");
      const me = this.me;
      const [ch, p] = await Promise.all([call<MmChannel>(`/channels/${ref}`), call<MmPosts>(`/channels/${ref}/posts?per_page=40`)]);
      const posts = p.order.map((id) => p.posts[id]).filter(Boolean).sort((a, b) => a.create_at - b.create_at);
      await this.resolveUsers(call, [...posts.map((x) => x.user_id), ...ch.name.split("__")]);
      const item = this.state.mattermost.items.find((i) => i.ref === ref);
      const other = ch.type === "D" ? this.users.get(ch.name.split("__").find((id) => id !== me.id) ?? "") : undefined;
      const title = ch.type === "D" ? mmDisplayName(other, "Doğrudan mesaj") : ch.display_name || ch.name;
      const meta: ChatThread["meta"] = [
        { label: "Tür", value: ch.type === "D" ? "Doğrudan mesaj" : ch.type === "G" ? "Grup" : ch.type === "P" ? "Özel kanal" : "Açık kanal" },
      ];
      if (item?.subtitle && ch.type !== "D" && ch.type !== "G") meta.push({ label: "Takım", value: item.subtitle });
      if (other?.username) meta.push({ label: "Kullanıcı", value: `@${other.username}` });
      if (item) meta.push({ label: "Okunmamış", value: String(item.unread) }, { label: "Bahsetme", value: String(item.mentions) });
      t = {
        source: "mattermost",
        ref,
        title,
        url: item?.url ?? cfg.url,
        meta,
        messages: posts.map((x) => ({
          id: x.id,
          at: x.create_at,
          from: x.user_id === me.id ? "Ben" : mmDisplayName(this.users.get(x.user_id), x.user_id.slice(0, 6)),
          mine: x.user_id === me.id,
          text: x.type && x.type.startsWith("system_") ? mmText(x) || x.type.replace("system_", "").replace(/_/g, " ") : x.message.trim(),
          note: false,
          attachments: x.file_ids?.length ?? 0,
          system: Boolean(x.type && x.type.startsWith("system_")),
        })),
        fetchedAt: Date.now(),
      };
    }
    this.threads.set(key, t);
    return t;
  }

  async refreshNow(): Promise<ChatState> {
    await this.tick();
    return this.state;
  }

  start(): void {
    if (this.timer) return;
    const loop = async () => {
      await this.tick().catch(() => {});
      this.timer = setTimeout(loop, Math.max(10_000, Number(getSettingSync("chat.pollMs")) || 30_000));
    };
    this.timer = setTimeout(loop, 1500);
  }
}

const g = globalThis as unknown as { __rp5ChatMonitor?: ChatMonitor };

export function getChatMonitor(): ChatMonitor {
  if (!g.__rp5ChatMonitor) g.__rp5ChatMonitor = new ChatMonitor();
  return g.__rp5ChatMonitor;
}

export function startChatMonitor(): void {
  getChatMonitor().start();
}
