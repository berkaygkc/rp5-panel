import net from "node:net";
import { getNoticeStore } from "@/lib/server/notices/store";

/**
 * Next içi üretici örneği: Mac ajanının WS portuna TCP ile dokunur.
 * İki ardışık başarısızlıkta "urgent" bildirim (kalıcı), ilk başarıda temizler.
 * Yeni monitör eklemek için bu dosyayı örnek alın ve instrumentation.ts'e kaydedin.
 */
const INTERVAL_MS = 30_000;
const TIMEOUT_MS = 3000;
const FAILS_BEFORE_ALERT = 2;
const NOTICE_ID = "system:agent-link";

function target(): { host: string; port: number } | null {
  // Env boşsa ajan panelle aynı makinede varsayılır (panel host türetimiyle uyumlu)
  const url = process.env.NEXT_PUBLIC_MEDIA_WS || "ws://127.0.0.1:17705";
  try {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port) || 17705 };
  } catch {
    return null;
  }
}

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(TIMEOUT_MS, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

export function startAgentLinkMonitor(): void {
  const g = globalThis as unknown as { __rp5AgentLinkMonitor?: boolean };
  if (g.__rp5AgentLinkMonitor) return;
  g.__rp5AgentLinkMonitor = true;

  const t = target();
  if (!t) return;
  let fails = 0;

  const tick = async () => {
    const ok = await probe(t.host, t.port);
    const store = getNoticeStore();
    if (ok) {
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
          title: "Mac ajanına ulaşılamıyor",
          body: `${t.host}:${t.port} yanıt vermiyor — medya, Claude ve posta akışı durdu`,
        },
        "next:agent-link"
      );
    }
  };

  void tick();
  setInterval(() => void tick(), INTERVAL_MS);
}
