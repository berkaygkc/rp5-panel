import { getNoticeStore } from "@/lib/server/notices/store";
import type { NoticeEvent } from "@/lib/notices/types";

export const dynamic = "force-dynamic";

/** Canlı akış (SSE): önce anlık görüntü, sonra her değişiklik; 20 sn'de bir kalp atışı */
export async function GET(req: Request) {
  const store = getNoticeStore();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (ev: NoticeEvent) => write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);

      send({ type: "snapshot", notices: store.snapshot() });
      const unsubscribe = store.subscribe(send);
      const heartbeat = setInterval(() => write(": hb\n\n"), 20_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* zaten kapalı */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
