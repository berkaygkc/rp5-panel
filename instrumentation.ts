/**
 * Sunucu başlangıcı: Next içi monitörler burada kaydedilir (bir kez çalışır).
 * Yeni monitör → lib/server/monitors/ altına yaz, buraya bir satır ekle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startConfigLoader } = await import("./lib/server/config/settings");
    startConfigLoader();
    const { startAgentLinkMonitor } = await import("./lib/server/monitors/agentLink");
    startAgentLinkMonitor();
    const { startBeszelMonitor } = await import("./lib/server/monitors/beszel");
    startBeszelMonitor();
    const { startChatMonitor } = await import("./lib/server/monitors/chat");
    startChatMonitor();
  }
}
