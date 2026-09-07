/**
 * Ajan yapılandırması — panelin yönetim veritabanından (GET /api/agent/config).
 * Panel ulaşılamazsa varsayılanlarla devam eder; 60 sn'de bir tazelenir.
 */
export interface AgentConfig {
  mailExcludedAddresses: string[];
  mailMaxNoticesPerRefresh: number;
  mailMessageLimit: number;
  claudeWaitNoticeMs: number;
}

const DEFAULTS: AgentConfig = {
  mailExcludedAddresses: ["@gmail\\.com$"],
  mailMaxNoticesPerRefresh: 5,
  mailMessageLimit: 80,
  claudeWaitNoticeMs: 3 * 60_000,
};

let current: AgentConfig = { ...DEFAULTS };
let warned = false;

export function agentConfig(): AgentConfig {
  return current;
}

export async function refreshAgentConfig(): Promise<void> {
  const url = (process.env.PANEL_URL ?? "http://127.0.0.1:3012").replace(/\/+$/, "");
  const token = process.env.PANEL_NOTICE_TOKEN ?? "";
  if (!token) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${url}/api/agent/config`, { headers: { authorization: `Bearer ${token}` }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as Partial<AgentConfig>;
    current = {
      mailExcludedAddresses: Array.isArray(j.mailExcludedAddresses) ? j.mailExcludedAddresses.map(String) : DEFAULTS.mailExcludedAddresses,
      mailMaxNoticesPerRefresh: Number(j.mailMaxNoticesPerRefresh) || DEFAULTS.mailMaxNoticesPerRefresh,
      mailMessageLimit: Number(j.mailMessageLimit) || DEFAULTS.mailMessageLimit,
      claudeWaitNoticeMs: Number(j.claudeWaitNoticeMs) || DEFAULTS.claudeWaitNoticeMs,
    };
    warned = false;
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(`[config] panel yapılandırması alınamadı (${(err as Error).message}); varsayılanlarla devam`);
    }
  } finally {
    clearTimeout(timer);
  }
}
