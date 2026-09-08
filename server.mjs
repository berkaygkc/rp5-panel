/**
 * Çekirdek sunucu.
 *
 * Next'in route handler'ları WebSocket yükseltmesi yapamaz; bu yüzden HTTP
 * sunucusunu biz açıyoruz ve /ws yükseltmelerini santrale devrediyoruz.
 * Santralin kendisi TypeScript tarafında (lib/server/core/hub.ts) yaşar ve
 * instrumentation ile aynı süreçte kurulur; buraya yalnızca soket geçer.
 *
 * Bu dosya Next derleyicisinden geçmez: düz Node ESM olarak yazılmalıdır.
 */
import { createServer } from "node:http";
import next from "next";

const port = parseInt(process.env.PORT ?? "3012", 10);
const dev = process.env.NODE_ENV !== "production";

const server = createServer();
const app = next({ dev, httpServer: server });
const handle = app.getRequestHandler();

await app.prepare();

server.on("request", (req, res) => handle(req, res));

server.on("upgrade", (req, socket, head) => {
  const url = req.url ?? "";
  if (!url.startsWith("/ws")) return; // Next'in kendi yükseltmeleri (HMR) ona kalsın
  const hub = globalThis.__rp5Hub;
  if (!hub) {
    socket.destroy();
    return;
  }
  hub.handleUpgrade(req, socket, head);
});

server.listen(port, () => {
  console.log(`[rp5] çekirdek ${dev ? "geliştirme" : "üretim"} modunda http://localhost:${port}`);
});
