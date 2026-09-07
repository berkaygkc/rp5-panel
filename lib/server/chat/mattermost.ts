/**
 * Mattermost REST API v4 — kişisel erişim anahtarı ya da kullanıcı girişiyle, salt okunur.
 */
export interface MattermostConfig {
  url: string;
  token: string;
  login: string;
  password: string;
}
const TIMEOUT_MS = 8000;

export class MmError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function mmFetch<T>(url: string, token: string | null, path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/api/v4${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 401) throw new MmError("Mattermost kimliği reddedildi (anahtar geçersiz ya da oturum düştü)", 401);
    if (res.status === 403) throw new MmError("Mattermost: bu kullanıcının yetkisi yok", 403);
    if (!res.ok) throw new MmError(`Mattermost HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new MmError("Mattermost yanıt vermedi (zaman aşımı)", 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Kullanıcı adı/e-posta + parola ile oturum; token `Token` başlığında döner */
export async function mmLogin(url: string, login: string, password: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/api/v4/users/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login_id: login, password }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 401) throw new MmError("Mattermost: kullanıcı adı ya da parola yanlış", 401);
    if (!res.ok) throw new MmError(`Mattermost giriş HTTP ${res.status}`, res.status);
    const token = res.headers.get("token");
    if (!token) throw new MmError("Mattermost giriş yanıtında oturum anahtarı yok", 500);
    return token;
  } finally {
    clearTimeout(timer);
  }
}

export interface MmUser {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  nickname?: string;
}
export interface MmTeam {
  id: string;
  name: string;
  display_name: string;
}
export interface MmChannel {
  id: string;
  /** O açık, P özel, D doğrudan, G grup */
  type: "O" | "P" | "D" | "G";
  display_name: string;
  name: string;
  team_id: string;
  total_msg_count: number;
  total_msg_count_root?: number;
  last_post_at: number;
}
export interface MmMember {
  channel_id: string;
  msg_count: number;
  mention_count: number;
  mention_count_root?: number;
  msg_count_root?: number;
  last_viewed_at: number;
}
export interface MmPost {
  id: string;
  user_id: string;
  message: string;
  create_at: number;
  type: string;
  file_ids?: string[];
}
export interface MmPosts {
  order: string[];
  posts: Record<string, MmPost>;
}

export const mmDisplayName = (u: MmUser | undefined, fallback = "?") =>
  u ? u.nickname || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username : fallback;

/** Markdown izlerini sadeleştirilmiş tek satır önizleme */
export function mmText(p: MmPost | null | undefined): string {
  if (!p) return "";
  const t = p.message.replace(/```[\s\S]*?```/g, "[kod]").replace(/[*_~`>#]+/g, "").replace(/\s+/g, " ").trim();
  if (t) return t;
  return p.file_ids?.length ? "📎 dosya" : "";
}
