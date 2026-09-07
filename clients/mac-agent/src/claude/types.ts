/**
 * Claude Code izleme — tel tipleri.
 * Paneldeki karşılığı: lib/types/claude.ts — senkron tutun.
 */
export interface Tokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type SessionStatus = "working" | "waiting" | "closed";

/** Oturumda en son olan şey — "şu an ne yapıyor" satırı */
export interface SessionActivity {
  kind: "tool" | "assistant" | "user";
  text: string;
  tool?: string;
  ts: number;
}

export interface ClaudeSessionWire {
  id: string;
  /** Proje klasörünün adı (cwd'nin son parçası) */
  project: string;
  cwd: string;
  branch: string | null;
  title: string;
  status: SessionStatus;
  model: string | null;
  /** Kullanıcı prompt sayısı */
  prompts: number;
  tokens: Tokens;
  /** Claude Code'un kendi yazdığı cost-state'ten; yoksa null */
  costUsd: number | null;
  linesAdded: number;
  linesRemoved: number;
  startedAt: number;
  lastActiveAt: number;
  /** Token toplamı henüz hesaplanmadıysa (büyük dosya, arka planda) */
  parsing: boolean;
  /** Son etkinlik (araç çağrısı / yanıt / prompt) */
  activity: SessionActivity | null;
  /** Son kullanıcı prompt'u — detay başlığında gösterilir */
  lastPrompt: string | null;
}

export interface ClaudeStats {
  today: Tokens;
  last5h: Tokens;
  working: number;
  waiting: number;
  /** Bugün için cost-state'lerden toplanabilen maliyet (eksik olabilir) */
  todayCostUsd: number;
}

export type FeedKind = "user" | "assistant" | "tool" | "result";

export interface FeedEvent {
  ts: number;
  kind: FeedKind;
  text: string;
  /** kind === "tool" için araç adı */
  tool?: string;
  /** kind === "result" için hata mı */
  error?: boolean;
}
