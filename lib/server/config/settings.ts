import { db } from "@/lib/server/db";

/**
 * Ayar katmanı — tek doğruluk kaynağı veritabanı (Setting tablosu, JSON değerler).
 * Sıcak yollar (bildirim kuralı, Beszel yoklaması, kilit) senkron okumaya ihtiyaç
 * duyduğu için bir bellek önbelleği tutulur; instrumentation'daki yükleyici 3 sn'de
 * bir tazeler, yönetim paneli yazınca anında yeniler.
 */
export const SETTING_DEFAULTS = {
  "pin.code": "1234",
  "lock.timeoutMs": 2 * 60 * 60 * 1000,
  "theme.default": "dark" as "dark" | "light",
  "rail.defaultRecents": ["claude", "shortcuts"] as string[],
  "claude.waitNoticeMs": 3 * 60 * 1000,
  "mail.excludedAddresses": ["@gmail\\.com$"] as string[],
  "mail.maxNoticesPerRefresh": 5,
  "mail.messageLimit": 80,
  "infra.diskWarnPct": 90,
  "infra.pollMs": 10_000,
  "beszel.url": "http://localhost:8090",
  "beszel.email": "",
  "beszel.password": "",
  "chatwoot.url": "",
  "chatwoot.token": "",
  "chatwoot.accountId": 0,
  "mattermost.url": "",
  "mattermost.token": "",
  "mattermost.login": "",
  "mattermost.password": "",
  "chat.pollMs": 30_000,
  "chat.noticeAssigned": true,
  "chat.noticeMentions": true,
  "chat.includeChannels": false,
  "weather.lat": 0,
  "weather.lon": 0,
  "weather.place": "",
  "admin.setupDone": false,
  "admin.passwordHash": "",
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

/** Panele/dışarıya asla verilmeyecek anahtarlar */
export const SECRET_KEYS: SettingKey[] = ["beszel.password", "admin.passwordHash", "pin.code", "chatwoot.token", "mattermost.token", "mattermost.password"];

export interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  field: string;
  pattern: string;
  setSeverity: string | null;
  setKind: string | null;
  setScreen: string | null;
}

interface Cache {
  settings: Settings;
  rules: RuleRow[];
  at: number;
}

const TTL_MS = 3000;
const g = globalThis as unknown as { __rp5Config?: Cache; __rp5ConfigLoader?: boolean };

function parse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function refreshConfig(): Promise<Cache> {
  const [rows, rules] = await Promise.all([
    db().setting.findMany(),
    db().noticeRule.findMany({ orderBy: { order: "asc" } }),
  ]);
  const settings = { ...SETTING_DEFAULTS } as Settings;
  for (const r of rows) {
    if (r.key in SETTING_DEFAULTS) (settings as Record<string, unknown>)[r.key] = parse(r.value);
  }
  g.__rp5Config = { settings, rules, at: Date.now() };
  return g.__rp5Config;
}

async function ensure(): Promise<Cache> {
  if (!g.__rp5Config || Date.now() - g.__rp5Config.at > TTL_MS) return refreshConfig();
  return g.__rp5Config;
}

/** Ayar (asenkron, taze) */
export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await ensure()).settings[key];
}

/** Ayar (senkron, önbellekten) — yükleyici çalışmadan önce varsayılanı döner */
export function getSettingSync<K extends SettingKey>(key: K): Settings[K] {
  return (g.__rp5Config?.settings ?? (SETTING_DEFAULTS as Settings))[key];
}

export function getRulesSync(): RuleRow[] {
  return g.__rp5Config?.rules ?? [];
}

export async function getAllSettings(): Promise<Settings> {
  return (await refreshConfig()).settings;
}

export async function setSettings(entries: Partial<Record<SettingKey, unknown>>): Promise<void> {
  const d = db();
  for (const [key, value] of Object.entries(entries)) {
    if (!(key in SETTING_DEFAULTS)) continue;
    await d.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
  }
  await refreshConfig();
}

/** Arka plan yükleyici: sıcak yollar için önbelleği sıcak tutar */
export function startConfigLoader(): void {
  if (g.__rp5ConfigLoader) return;
  g.__rp5ConfigLoader = true;
  void refreshConfig().catch(() => {});
  setInterval(() => void refreshConfig().catch(() => {}), TTL_MS);
}
