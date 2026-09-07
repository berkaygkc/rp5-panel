/** Claude Code izleme tipleri — clients/mac-agent/src/claude/types.ts ile senkron. */

export interface Tokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type SessionStatus = "working" | "waiting" | "closed";

/** Oturumdaki son olay — "şu an ne yapıyor" satırı */
export interface SessionActivity {
  kind: "tool" | "assistant" | "user";
  text: string;
  tool?: string;
  ts: number;
}

export interface ClaudeSession {
  id: string;
  project: string;
  cwd: string;
  branch: string | null;
  title: string;
  status: SessionStatus;
  model: string | null;
  prompts: number;
  tokens: Tokens;
  costUsd: number | null;
  linesAdded: number;
  linesRemoved: number;
  startedAt: number;
  lastActiveAt: number;
  parsing: boolean;
  activity: SessionActivity | null;
  lastPrompt: string | null;
}

export interface ClaudeStats {
  today: Tokens;
  last5h: Tokens;
  working: number;
  waiting: number;
  todayCostUsd: number;
}

export type FeedKind = "user" | "assistant" | "tool" | "result";

export interface FeedEvent {
  ts: number;
  kind: FeedKind;
  text: string;
  tool?: string;
  error?: boolean;
}

/* ── Plan kullanım limitleri (claude -p "/usage" çıktısı) ── */

export interface UsageLimit {
  id: string;
  label: string;
  /** 0–100 */
  percent: number;
  /** "Sep 2 at 6:39pm" ham metni */
  resetsAt: string | null;
}

export interface UsageWindow {
  id: "24h" | "7d";
  label: string;
  requests: number;
  sessions: number;
  notes: string[];
}

export interface Usage {
  limits: UsageLimit[];
  windows: UsageWindow[];
  updatedAt: number;
  error: string | null;
}

export interface ClaudeState {
  sessions: ClaudeSession[];
  stats: ClaudeStats;
  selectedId: string | null;
  feed: FeedEvent[];
  usage: Usage;
}
