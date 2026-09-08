import type { OsData } from "./types";

/**
 * Senaryolar — yönetim panelindeki "panoyu dene" için sahte veri.
 *
 * Kompozisyon saf bir fonksiyon olduğu için, burada üretilen veriyle panelde
 * göreceğiniz dizilim cihazdakiyle birebir aynıdır. Bir sunucu düştüğünde
 * panonun neye benzeyeceğini görmek için sunucunun düşmesini beklemek gerekmez.
 */
export type ScenarioId = "calm" | "music" | "claude" | "outage" | "busy" | "offline";

const base = (): OsData => ({
  now: Date.now(),
  media: { track: null, playing: false, positionSec: 0, positionAt: 0, volume: 50, source: "system", outputDevice: null },
  claude: { sessions: [], stats: { today: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, last5h: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, working: 0, waiting: 0, todayCostUsd: 0 }, selectedId: null, feed: [], usage: { limits: [{ id: "session", label: "Oturum limiti", percent: 32, resetsAt: null }], windows: [], updatedAt: Date.now(), error: null } },
  mail: { available: true, accounts: [], messages: [], updatedAt: Date.now(), error: null },
  chat: {
    updatedAt: Date.now(),
    chatwoot: { configured: true, error: null, label: "", me: "", counts: {}, items: [], updatedAt: Date.now() },
    mattermost: { configured: true, error: null, label: "", me: "", counts: {}, items: [], updatedAt: Date.now() },
  },
  infra: {
    configured: true,
    systems: [
      {
        id: "s1", name: "api-prod", host: "", status: "up", updatedAt: Date.now(),
        cpu: 12, memPct: 40, diskPct: 55, uptimeSec: 9000, load: [0.2, 0.3, 0.2],
        bandwidth: null, cpuHistory: [10, 12, 11, 14, 12], containers: [],
        details: { hostname: "api-prod", os: "", kernel: "", cores: 4, threads: 8, memoryGb: 8, cpuModel: "" },
      } as unknown as OsData["infra"]["systems"][number],
    ],
    updatedAt: Date.now(),
    error: null,
  },
  notices: [],
  weather: { available: true, place: "Ev", tempC: 21, feelsC: 20, code: 1, label: "Az bulutlu", high: 26, low: 15, updatedAt: Date.now(), error: null },
  online: ["media", "shortcuts", "claude", "mail"],
});

const withMusic = (d: OsData): OsData => ({
  ...d,
  media: { ...d.media, playing: true, track: { id: "t", title: "Northern Lights", artist: "Aurora Fields", album: "", durationSec: 254, artworkUrl: null, artColors: ["#5b6cff", "#8b5cf6"] } },
});
const withClaude = (d: OsData, waiting: boolean): OsData => ({
  ...d,
  claude: {
    ...d.claude,
    sessions: [
      { id: "a", project: "mimforge", status: waiting ? "waiting" : "working", lastActiveAt: Date.now() - 60_000, model: "", activity: null, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
      { id: "b", project: "rp5-panel", status: "working", lastActiveAt: Date.now() - 20_000, model: "", activity: null, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
    ] as OsData["claude"]["sessions"],
  },
});
const withMail = (d: OsData, unread: number): OsData => ({
  ...d,
  mail: { ...d.mail, accounts: [{ pk: 1, title: "posta", unread, address: "" }] as OsData["mail"]["accounts"] },
});
const withChat = (d: OsData, mentions: boolean): OsData => ({
  ...d,
  chat: {
    ...d.chat,
    chatwoot: {
      ...d.chat.chatwoot,
      items: [{ id: "c1", source: "chatwoot", ref: "1", kind: "assigned", title: "Ayşe Demir", subtitle: "Web", from: "Ayşe", preview: "Faturayı alamadım", at: Date.now() - 600_000, unread: 2, mentions: mentions ? 1 : 0, waitingSince: Date.now() - 1_200_000, labels: [], status: "açık", priority: 3, url: "" }],
    },
  },
});
const withOutage = (d: OsData): OsData => ({
  ...d,
  infra: { ...d.infra, systems: [{ ...d.infra.systems[0], status: "down" }] },
});

export const SCENARIOS: Array<{ id: ScenarioId; label: string; build: () => OsData }> = [
  { id: "calm", label: "Sakin — hiçbir şey olmuyor", build: () => base() },
  { id: "music", label: "Müzik çalıyor", build: () => withMusic(base()) },
  { id: "claude", label: "Claude sizi bekliyor", build: () => withClaude(base(), true) },
  { id: "outage", label: "Sunucu düştü", build: () => withOutage(base()) },
  { id: "busy", label: "Her şey birden", build: () => withChat(withMail(withClaude(withMusic(base()), true), 6), true) },
  { id: "offline", label: "Hiçbir cihaz bağlı değil", build: () => ({ ...base(), online: [] }) },
];
