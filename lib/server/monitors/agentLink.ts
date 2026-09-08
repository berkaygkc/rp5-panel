import { getHub } from "@/lib/server/core/hub";
import { getNoticeStore } from "@/lib/server/notices/store";

/**
 * Sağlayıcı bağlantısı gözcüsü.
 *
 * Ajan artık dışarıdan yoklanmaz: çekirdeğe kendisi bağlanır. Bu yüzden sağlık
 * ölçüsü de santralin kendi görüntüsüdür. İki tur üst üste hiçbir sağlayıcı
 * yoksa kalıcı bir bildirim düşer, ilk bağlantıda temizlenir.
 */
const INTERVAL_MS = 30_000;
const FAILS_BEFORE_ALERT = 2;
const NOTICE_ID = "system:agent-link";

export function startAgentLinkMonitor(): void {
  const g = globalThis as unknown as { __rp5AgentLinkMonitor?: boolean };
  if (g.__rp5AgentLinkMonitor) return;
  g.__rp5AgentLinkMonitor = true;

  let fails = 0;

  const tick = () => {
    const providers = getHub().snapshot().providers;
    const store = getNoticeStore();
    if (providers.length > 0) {
      fails = 0;
      store.clear(NOTICE_ID);
      return;
    }
    fails++;
    if (fails >= FAILS_BEFORE_ALERT) {
      store.push(
        {
          id: NOTICE_ID,
          kind: "system",
          severity: "urgent",
          title: "Hiçbir cihaz bağlı değil",
          body: "Mac ajanı çekirdeğe bağlanamıyor — medya, Claude, posta ve kısayollar durdu",
        },
        "next:agent-link"
      );
    }
  };

  setTimeout(tick, 5000);
  setInterval(tick, INTERVAL_MS);
}
