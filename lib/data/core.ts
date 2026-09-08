"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WIRE_VERSION, type ClientMsg, type ServerMsg } from "@/lib/wire/protocol";

/**
 * Yüzeyin çekirdek bağlantısı.
 *
 * Panel artık hiçbir cihaza doğrudan bağlanmaz: tek bir sokete bağlanır ve
 * ilgilendiği alanlara abone olur. İş isteyeceği zaman niyet gönderir, çekirdek
 * doğru sağlayıcıya yönlendirir. Aynı sayfa içindeki tüm ekranlar bu tek
 * bağlantıyı paylaşır.
 */

type Listener = () => void;
export interface Ack {
  ok: boolean;
  message?: string;
  data?: unknown;
}

const INTENT_TIMEOUT_MS = 10_000;
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 15_000;

class CoreClient {
  private ws: WebSocket | null = null;
  private retryMs = RETRY_MIN_MS;
  private timer: number | undefined;
  /** Alan → kaç bileşen izliyor */
  private refs = new Map<string, number>();
  private values = new Map<string, unknown>();
  private watchers = new Map<string, Set<(payload: unknown) => void>>();
  private listeners = new Set<Listener>();
  private acks = new Map<string, { resolve: (a: Ack) => void; timer: number }>();
  private seq = 0;
  connected = false;

  constructor() {
    this.subscribe = this.subscribe.bind(this);
    this.getConnected = this.getConnected.bind(this);
    if (typeof window !== "undefined") this.connect();
  }

  /* ── React köprüsü ── */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  getConnected(): boolean {
    return this.connected;
  }
  getValue(domain: string): unknown {
    return this.values.get(domain);
  }
  private emit(): void {
    for (const l of this.listeners) l();
  }

  /** Bir alanı izlemeye başla; dönen fonksiyon aboneliği bırakır */
  watch(domain: string, cb?: (payload: unknown) => void): () => void {
    this.refs.set(domain, (this.refs.get(domain) ?? 0) + 1);
    if (cb) {
      if (!this.watchers.has(domain)) this.watchers.set(domain, new Set());
      this.watchers.get(domain)!.add(cb);
      const cached = this.values.get(domain);
      if (cached !== undefined) cb(cached);
    }
    this.sendSub();
    return () => {
      const n = (this.refs.get(domain) ?? 1) - 1;
      if (n <= 0) this.refs.delete(domain);
      else this.refs.set(domain, n);
      if (cb) this.watchers.get(domain)?.delete(cb);
      this.sendSub();
    };
  }

  /** Bir yetenekten iş iste; çekirdek yönlendirir, onay geri gelir */
  intent(capability: string, action: string, args?: unknown): Promise<Ack> {
    if (!this.connected || !this.ws) {
      return Promise.resolve({ ok: false, message: "Panele bağlanılamadı" });
    }
    const id = `i${++this.seq}`;
    return new Promise<Ack>((resolve) => {
      const timer = window.setTimeout(() => {
        this.acks.delete(id);
        resolve({ ok: false, message: "Cihaz zamanında yanıt vermedi" });
      }, INTENT_TIMEOUT_MS);
      this.acks.set(id, { resolve, timer });
      this.send({ t: "intent", id, capability, action, args });
    });
  }

  /* ── Bağlantı ── */

  private url(): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }

  private send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private sendSub(): void {
    if (this.connected) this.send({ t: "sub", domains: [...this.refs.keys()] });
  }

  private connect(): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url());
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.send({
        t: "hello",
        v: WIRE_VERSION,
        role: "surface",
        name: document.title || "Yüzey",
        viewport: { w: window.innerWidth, h: window.innerHeight },
      });
    };

    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.t === "welcome") {
        this.connected = true;
        this.retryMs = RETRY_MIN_MS;
        this.sendSub();
        this.emit();
        return;
      }
      if (msg.t === "event") {
        this.values.set(msg.domain, msg.payload);
        const set = this.watchers.get(msg.domain);
        if (set) for (const cb of set) cb(msg.payload);
        this.emit();
        return;
      }
      if (msg.t === "ack") {
        const pending = this.acks.get(msg.id);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        this.acks.delete(msg.id);
        pending.resolve({ ok: msg.ok, message: msg.message, data: msg.data });
      }
    };

    ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.emit();
      this.scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleRetry(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
  }
}

const g = globalThis as unknown as { __rp5Core?: CoreClient };

export function getCore(): CoreClient {
  if (!g.__rp5Core) g.__rp5Core = new CoreClient();
  return g.__rp5Core;
}

/** Çekirdeğe bağlı mıyız */
export function useCoreConnected(): boolean {
  const core = getCore();
  return useSyncExternalStore(core.subscribe, core.getConnected, () => false);
}

/** Bir alanın son değeri. Bağlantı yoksa ya da veri gelmediyse stale döner. */
export function useDomain<T>(domain: string, fallback: T): { data: T; stale: boolean } {
  const core = getCore();
  useEffect(() => core.watch(domain), [core, domain]);
  const value = useSyncExternalStore(
    core.subscribe,
    () => core.getValue(domain) as T | undefined,
    () => undefined
  );
  const connected = useSyncExternalStore(core.subscribe, core.getConnected, () => false);
  return { data: value ?? fallback, stale: !connected || value === undefined };
}

/** Bir yeteneği sunan sağlayıcı şu an bağlı mı */
export function useCapability(capability: string): boolean {
  const { data } = useDomain<{ capabilities: string[] }>("presence", EMPTY_PRESENCE);
  return data.capabilities.includes(capability);
}

const EMPTY_PRESENCE = { capabilities: [] as string[] };
