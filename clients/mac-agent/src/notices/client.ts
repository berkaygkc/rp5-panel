/**
 * Bildirim üretici istemcisi — panelin Next backend'ine POST/DELETE.
 * Hub ajan değil panel: CI webhook'u, Next içi monitörler ve bu ajan aynı uca yazar.
 * PANEL_URL ve PANEL_NOTICE_TOKEN .env'den gelir (env.ts → loadDotEnv).
 */
import type { NoticeInput } from "./types.js";

const TIMEOUT_MS = 4000;
let lastWarn = 0;
let warnedNoToken = false;

function config(): { url: string; token: string } {
  return {
    url: (process.env.PANEL_URL ?? "http://127.0.0.1:3012").replace(/\/+$/, ""),
    token: process.env.PANEL_NOTICE_TOKEN ?? "",
  };
}

async function call(method: "POST" | "DELETE", path: string, body?: unknown): Promise<boolean> {
  const { url, token } = config();
  if (!token) {
    if (!warnedNoToken) {
      warnedNoToken = true;
      console.warn("[notice] PANEL_NOTICE_TOKEN tanımlı değil — bildirimler gönderilmiyor (.env)");
    }
    return false;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-notice-source": "agent",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    const now = Date.now();
    if (now - lastWarn > 60_000) {
      lastWarn = now;
      console.warn(`[notice] panele ulaşılamadı (${(err as Error).message}) — ${url}`);
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function postNotice(n: NoticeInput): Promise<boolean> {
  return call("POST", "/api/notices", n);
}

export function clearNotice(id: string): Promise<boolean> {
  return call("DELETE", `/api/notices/${encodeURIComponent(id)}`);
}
