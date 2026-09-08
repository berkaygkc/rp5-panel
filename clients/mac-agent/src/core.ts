import { WebSocket } from "ws";
import type { ClientMsg, ServerMsg } from "./wire.js";
import { WIRE_VERSION } from "./wire.js";

/**
 * Çekirdek bağlantısı.
 *
 * Ajan artık sunucu değil, istemcidir: açılışta panelin adresine kendisi bağlanır.
 * Bu sayede Mac'te açık port gerekmez, NAT arkasında çalışır ve panel uzak bir
 * sunucuda olsa bile aynı kod çalışır. Bağlantı koparsa artan aralıklarla döner.
 */
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30_000;

export interface CoreHandlers {
  /** Çekirdek bir iş istedi; sonucu döndürün */
  onInvoke(capability: string, action: string, args: unknown): Promise<{ ok: boolean; message?: string; data?: unknown }>;
  /** Bağlantı kurulduğunda tazelenecek durumlar */
  onReady(): void;
}

export class CoreLink {
  private ws: WebSocket | null = null;
  private retry = RETRY_MIN_MS;
  private closed = false;
  private ready = false;

  constructor(
    private url: string,
    private token: string,
    private name: string,
    private capabilities: string[],
    private handlers: CoreHandlers
  ) {}

  get connected(): boolean {
    return this.ready;
  }

  start(): void {
    this.dial();
  }

  stop(): void {
    this.closed = true;
    this.ws?.close();
  }

  /** Alan durumu yayınla; bağlantı yoksa sessizce düşer (çekirdek son değeri saklar) */
  publish(domain: string, payload: unknown): void {
    this.send({ t: "state", domain, payload });
  }

  private send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private dial(): void {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on("open", () => {
      this.retry = RETRY_MIN_MS;
      this.send({
        t: "hello",
        v: WIRE_VERSION,
        role: "provider",
        token: this.token,
        name: this.name,
        capabilities: this.capabilities,
      });
    });

    ws.on("message", (raw) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(raw)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.t === "welcome") {
        this.ready = true;
        console.log(`[core] bağlandı: ${this.url} — ${msg.name}`);
        this.handlers.onReady();
        return;
      }
      if (msg.t === "error") {
        console.error(`[core] reddedildi: ${msg.code} — ${msg.message}`);
        return;
      }
      if (msg.t === "invoke") {
        void this.handlers
          .onInvoke(msg.capability, msg.action, msg.args)
          .then((r) => this.send({ t: "ack", id: msg.id, ok: r.ok, message: r.message, data: r.data }))
          .catch((e: Error) => this.send({ t: "ack", id: msg.id, ok: false, message: e.message }));
      }
    });

    const reconnect = () => {
      this.ready = false;
      this.ws = null;
      if (this.closed) return;
      const wait = this.retry;
      this.retry = Math.min(this.retry * 2, RETRY_MAX_MS);
      setTimeout(() => this.dial(), wait);
    };

    ws.on("close", () => {
      if (this.ready) console.log("[core] bağlantı koptu, yeniden denenecek");
      reconnect();
    });
    ws.on("error", (err: Error) => {
      if (this.ready || this.retry === RETRY_MIN_MS) console.error(`[core] bağlantı hatası: ${err.message}`);
    });
  }
}

/** http(s)://host:port → ws(s)://host:port/ws */
export function coreSocketUrl(panelUrl: string): string {
  const u = new URL(panelUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = "";
  return u.toString();
}
