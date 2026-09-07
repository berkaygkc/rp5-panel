import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import {
  DOMAIN_WATCH,
  WIRE_VERSION,
  type ClientMsg,
  type DeviceRole,
  type PresencePayload,
  type ServerMsg,
} from "@/lib/wire/protocol";

/**
 * Çekirdek — bu işletim sisteminin santrali.
 *
 * Tek bir soket ucu iki rolü karşılar. Sağlayıcılar (Mac ajanı) dışarı bağlanır
 * ve yetenek sunar; yüzeyler (Pi, telefon, tarayıcı) durumu izler ve niyet
 * gönderir. Yüzey hiçbir zaman bir sağlayıcıyı doğrudan tanımaz: niyet çekirdeğe
 * gelir, yeteneğe göre yönlendirilir, sonuç geri taşınır.
 *
 * Durumun tek sahibi burasıdır. Her alanın son değeri saklandığı için yeni
 * bağlanan bir yüzey ekranı boş açmaz; bağlantı kopan bir sağlayıcı da
 * yüzeylere sessizce değil, varlık yayınıyla bildirilir.
 */

const HELLO_TIMEOUT_MS = 8000;
const HEARTBEAT_MS = 20_000;
const INTENT_TIMEOUT_MS = 12_000;

interface Conn {
  id: number;
  ws: WebSocket;
  role: DeviceRole | null;
  deviceId: string | null;
  name: string;
  capabilities: Set<string>;
  domains: Set<string>;
  alive: boolean;
  remote: string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

class Hub {
  private wss = new WebSocketServer({ noServer: true });
  private conns = new Set<Conn>();
  /** Alan → son yayınlanan değer. Yeni yüzey anında dolu ekran görür. */
  private cache = new Map<string, unknown>();
  /** Bekleyen niyetler: id → isteği yapan yüzey */
  private pending = new Map<string, { origin: Conn; timer: NodeJS.Timeout }>();
  private seq = 0;

  constructor() {
    setInterval(() => this.heartbeat(), HEARTBEAT_MS);
  }

  /* ── Bağlantı kabulü ── */

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, req));
  }

  private accept(ws: WebSocket, req: IncomingMessage): void {
    const conn: Conn = {
      id: ++this.seq,
      ws,
      role: null,
      deviceId: null,
      name: "?",
      capabilities: new Set(),
      domains: new Set(),
      alive: true,
      remote: req.socket.remoteAddress ?? "?",
    };
    this.conns.add(conn);

    // Kimliğini tanıtmayan bağlantı asılı kalmaz
    const helloTimer = setTimeout(() => {
      if (!conn.role) this.close(conn, "protocol", "hello beklendi");
    }, HELLO_TIMEOUT_MS);

    ws.on("message", (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw)) as ClientMsg;
      } catch {
        return;
      }
      void this.onMessage(conn, msg, helloTimer);
    });
    ws.on("pong", () => { conn.alive = true; });
    ws.on("close", () => this.drop(conn));
    ws.on("error", () => this.drop(conn));
  }

  private async onMessage(conn: Conn, msg: ClientMsg, helloTimer: NodeJS.Timeout): Promise<void> {
    if (msg.t === "hello") {
      clearTimeout(helloTimer);
      await this.onHello(conn, msg);
      return;
    }
    if (!conn.role) return; // tanıtmadan konuşamaz

    switch (msg.t) {
      case "sub":
        this.onSubscribe(conn, msg.domains);
        return;
      case "intent":
        this.onIntent(conn, msg.id, msg.capability, msg.action, msg.args);
        return;
      case "state":
        if (conn.role === "provider") this.publish(msg.domain, msg.payload);
        return;
      case "ack":
        this.onAck(msg.id, msg.ok, msg.message, msg.data);
        return;
      default:
        return;
    }
  }

  private async onHello(conn: Conn, msg: { role: DeviceRole; token?: string; name: string; capabilities?: string[] }): Promise<void> {
    const role: DeviceRole = msg.role === "provider" ? "provider" : "surface";
    const device = msg.token ? await this.verify(msg.token) : null;

    // Sağlayıcı her zaman anahtar ister; yüzey şimdilik serbest (kayıt fazında sıkılaşacak)
    if (role === "provider" && !device) {
      this.close(conn, "unauthorized", "geçersiz cihaz anahtarı");
      return;
    }
    if (msg.token && !device) {
      this.close(conn, "unauthorized", "geçersiz cihaz anahtarı");
      return;
    }

    conn.role = role;
    conn.deviceId = device?.id ?? null;
    conn.name = device?.name ?? msg.name ?? (role === "provider" ? "sağlayıcı" : "yüzey");
    if (role === "provider") for (const c of msg.capabilities ?? []) conn.capabilities.add(c);

    if (device) {
      await db()
        .device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
        .catch(() => null);
    }

    this.send(conn, {
      t: "welcome",
      v: WIRE_VERSION,
      deviceId: conn.deviceId ?? `anon-${conn.id}`,
      name: conn.name,
      capabilities: this.onlineCapabilities(),
    });
    console.log(`[core] ${role} bağlandı: ${conn.name} (${conn.remote})${conn.capabilities.size ? ` — ${[...conn.capabilities].join(", ")}` : ""}`);

    // Sağlayıcı geldiyse, hâlihazırda izlenen alanlar için izlemeyi başlat
    if (role === "provider") this.syncWatches();
    this.publishPresence();
  }

  private async verify(token: string) {
    const hash = sha256(token);
    const device = await db().device.findFirst({ where: { tokenHash: hash, revoked: false } }).catch(() => null);
    return device;
  }

  /* ── Abonelik ve yayın ── */

  private onSubscribe(conn: Conn, domains: string[]): void {
    conn.domains = new Set(domains.filter((d) => typeof d === "string").slice(0, 32));
    // Yeni abone ekranı boş açmasın: elde ne varsa hemen ver
    for (const d of conn.domains) {
      if (d === "presence") this.send(conn, { t: "event", domain: "presence", payload: this.presence() });
      else if (this.cache.has(d)) this.send(conn, { t: "event", domain: d, payload: this.cache.get(d) });
    }
    this.syncWatches();
  }

  /** Bir alanı izleyen yüzey var mı; sağlayıcıdaki izlemeyi buna göre aç/kapat */
  private syncWatches(): void {
    for (const [domain, watch] of Object.entries(DOMAIN_WATCH)) {
      if (!watch) continue;
      const wanted = [...this.conns].some((c) => c.role === "surface" && c.domains.has(domain));
      const provider = this.providerFor(watch.capability);
      if (!provider) continue;
      const key = `${watch.capability}:${watch.action}`;
      const current = this.watchState.get(key) ?? false;
      const next = wanted || this.watchWantedByOther(watch.capability, domain);
      if (next === current) continue;
      this.watchState.set(key, next);
      this.send(provider, { t: "invoke", id: randomUUID(), capability: watch.capability, action: watch.action, args: { on: next } });
    }
  }

  private watchState = new Map<string, boolean>();

  /** Aynı yeteneği paylaşan başka bir alan hâlâ izleniyor mu */
  private watchWantedByOther(capability: string, exclude: string): boolean {
    return Object.entries(DOMAIN_WATCH).some(([domain, w]) =>
      w && w.capability === capability && domain !== exclude &&
      [...this.conns].some((c) => c.role === "surface" && c.domains.has(domain))
    );
  }

  /** Sağlayıcıdan gelen durumu sakla ve ilgili yüzeylere dağıt */
  publish(domain: string, payload: unknown): void {
    this.cache.set(domain, payload);
    for (const c of this.conns) {
      if (c.role === "surface" && c.domains.has(domain)) this.send(c, { t: "event", domain, payload });
    }
  }

  private presence(): PresencePayload {
    const providers = [...this.conns]
      .filter((c) => c.role === "provider")
      .map((c) => ({ name: c.name, capabilities: [...c.capabilities] }));
    return {
      providers,
      capabilities: this.onlineCapabilities(),
      surfaces: [...this.conns].filter((c) => c.role === "surface").length,
    };
  }

  private publishPresence(): void {
    this.publish("presence", this.presence());
  }

  private onlineCapabilities(): string[] {
    const caps = new Set<string>();
    for (const c of this.conns) if (c.role === "provider") for (const cap of c.capabilities) caps.add(cap);
    return [...caps];
  }

  /* ── Niyet yönlendirme ── */

  private providerFor(capability: string): Conn | null {
    for (const c of this.conns) if (c.role === "provider" && c.capabilities.has(capability)) return c;
    return null;
  }

  private onIntent(origin: Conn, id: string, capability: string, action: string, args: unknown): void {
    const provider = this.providerFor(capability);
    if (!provider) {
      this.send(origin, { t: "ack", id, ok: false, message: `${capability} sunan bir cihaz bağlı değil` });
      return;
    }
    const timer = setTimeout(() => {
      this.pending.delete(id);
      this.send(origin, { t: "ack", id, ok: false, message: "cihaz zamanında yanıt vermedi" });
    }, INTENT_TIMEOUT_MS);
    this.pending.set(id, { origin, timer });
    this.send(provider, { t: "invoke", id, capability, action, args });
  }

  private onAck(id: string, ok: boolean, message?: string, data?: unknown): void {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    this.send(p.origin, { t: "ack", id, ok, message, data });
  }

  /* ── Alt seviye ── */

  private send(conn: Conn, msg: ServerMsg): void {
    if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify(msg));
  }

  private close(conn: Conn, code: "unauthorized" | "protocol", message: string): void {
    this.send(conn, { t: "error", code, message });
    conn.ws.close();
    this.drop(conn);
  }

  private drop(conn: Conn): void {
    if (!this.conns.delete(conn)) return;
    if (conn.role) console.log(`[core] ${conn.role} ayrıldı: ${conn.name}`);
    // Sağlayıcı düştüyse izleme durumu sıfırlanır; dönerse yeniden kurulur
    if (conn.role === "provider") {
      this.watchState.clear();
      this.publishPresence();
      this.syncWatches();
    } else if (conn.role === "surface") {
      this.syncWatches();
      this.publishPresence();
    }
  }

  private heartbeat(): void {
    for (const c of this.conns) {
      if (!c.alive) {
        c.ws.terminate();
        this.drop(c);
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }

  /* ── Dışarıya açık küçük yüzey (API route'ları için) ── */

  snapshot() {
    return {
      providers: this.presence().providers,
      surfaces: this.presence().surfaces,
      domains: [...this.cache.keys()],
      capabilities: this.onlineCapabilities(),
    };
  }
}

const g = globalThis as unknown as { __rp5Hub?: Hub };

export function getHub(): Hub {
  if (!g.__rp5Hub) g.__rp5Hub = new Hub();
  return g.__rp5Hub;
}

/** server.mjs bunu globalThis üzerinden çağırır */
export function startHub(): void {
  getHub();
  console.log("[core] santral hazır");
}
