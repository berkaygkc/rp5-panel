/**
 * Mac ajanının WebSocket adresi.
 * Öncelik: NEXT_PUBLIC_MEDIA_WS (açıkça verilmişse). Verilmemişse panelin
 * yüklendiği host kullanılır — panel ve ajan aynı makinede çalıştığı için
 * Mac'in IP'si değişse de bağlantı kopmaz (kiosk .local adıyla açılır).
 */
export const AGENT_PORT = 17705;

export function agentWsUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_MEDIA_WS;
  if (configured) return configured;
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (!host) return null;
  return `ws://${host}:${AGENT_PORT}`;
}
