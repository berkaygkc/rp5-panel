/**
 * Çekirdek tel protokolü — v1.
 *
 * Topoloji: Next çekirdektir. Herkes ona bağlanır, kimse kimseye doğrudan
 * bağlanmaz. İki rol vardır:
 *   sağlayıcı (provider) — Mac ajanı gibi yetenek sunan cihaz. Dışarı bağlanır,
 *                          açık port gerektirmez, NAT arkasında çalışır.
 *   yüzey    (surface)   — Pi, telefon, tarayıcı. Durumu izler, niyet gönderir.
 *
 * Yüzey bir sağlayıcıya doğrudan komut vermez: çekirdeğe niyet bildirir,
 * çekirdek yeteneğe bakıp doğru sağlayıcıya yönlendirir ve sonucu geri taşır.
 *
 * Bu dosyanın bir kopyası clients/mac-agent/src/wire.ts içindedir; ikisi
 * senkron tutulmalıdır (npm run check:wire).
 */

export const WIRE_VERSION = 1;

export type DeviceRole = "provider" | "surface";

/** Sağlayıcıların sunabileceği yetenekler */
export const CAPABILITIES = ["media", "shortcuts", "claude", "mail"] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * Durum alanları. Bir sağlayıcı bunları yayınlar, yüzeyler abone olur.
 * Çekirdek her alanın son değerini saklar; yeni bağlanan yüzey anında dolu gelir.
 */
export const DOMAINS = [
  "media",
  "claude.sessions",
  "claude.usage",
  "claude.feed",
  "mail",
  "presence",
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Bir alanın canlı kalması için sağlayıcıda izleme gerektirip gerektirmediği */
export const DOMAIN_WATCH: Record<string, { capability: Capability; action: string } | undefined> = {
  "claude.sessions": { capability: "claude", action: "watch" },
  "claude.usage": { capability: "claude", action: "watch" },
  mail: { capability: "mail", action: "watch" },
};

/* ── İstemciden çekirdeğe ── */

export interface HelloMsg {
  t: "hello";
  v: number;
  role: DeviceRole;
  /** Cihaz anahtarı. Sağlayıcılarda zorunlu; yüzeylerde ayara bağlı. */
  token?: string;
  name: string;
  /** Sağlayıcı: sunduğu yetenekler */
  capabilities?: string[];
  /** Yüzey: ekran ölçüsü, ileride ızgara türetimi için */
  viewport?: { w: number; h: number };
}

/** Yüzey: hangi alanları izlemek istiyorum */
export interface SubMsg {
  t: "sub";
  domains: string[];
}

/** Yüzey: bir yetenekten iş iste */
export interface IntentMsg {
  t: "intent";
  id: string;
  capability: string;
  action: string;
  args?: unknown;
}

/** Sağlayıcı: alan durumu yayınla */
export interface StateMsg {
  t: "state";
  domain: string;
  payload: unknown;
}

/** Sağlayıcı: yönlendirilmiş niyetin sonucu */
export interface AckMsg {
  t: "ack";
  id: string;
  ok: boolean;
  message?: string;
  data?: unknown;
}

export type ClientMsg = HelloMsg | SubMsg | IntentMsg | StateMsg | AckMsg | { t: "pong" };

/* ── Çekirdekten istemciye ── */

export interface WelcomeMsg {
  t: "welcome";
  v: number;
  deviceId: string;
  name: string;
  /** Yüzeye: şu an çevrimiçi yetenekler */
  capabilities?: string[];
}

/** Çekirdek → yüzey: alan durumu */
export interface EventMsg {
  t: "event";
  domain: string;
  payload: unknown;
}

/** Çekirdek → sağlayıcı: yönlendirilmiş niyet */
export interface InvokeMsg {
  t: "invoke";
  id: string;
  capability: string;
  action: string;
  args?: unknown;
}

export interface ErrorMsg {
  t: "error";
  code: "unauthorized" | "protocol" | "no-provider" | "timeout";
  message: string;
}

export type ServerMsg = WelcomeMsg | EventMsg | InvokeMsg | AckMsg | ErrorMsg | { t: "ping" };

/** Yüzeylere yayınlanan varlık bilgisi: hangi sağlayıcılar bağlı */
export interface PresencePayload {
  providers: Array<{ name: string; capabilities: string[] }>;
  capabilities: string[];
  surfaces: number;
}
