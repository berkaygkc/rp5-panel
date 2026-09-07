import { getNoticeStore } from "@/lib/server/notices/store";
import { getSettingSync } from "@/lib/server/config/settings";
import type {
  ContainerHealth,
  ContainerHistory,
  ContainerHistoryPoint,
  ContainerInfo,
  ContainerLogs,
  InfraContainer,
  InfraState,
  InfraSystem,
  SystemStatus,
} from "@/lib/types/infra";

/**
 * Beszel hub izleyicisi (Next içi üretici).
 * PocketBase REST API'sine panel için açılmış salt-okunur kullanıcıyla girer,
 * sistemleri/container'ları 30 sn'de bir çeker, ekran için önbelleğe alır ve
 * durum değişimlerini bildirim hub'ına yazar:
 *   sistem down → urgent (kalıcı, up olunca silinir)
 *   container unhealthy / durmuş → attention
 *   disk ≥ %90 → attention
 *
 * Kimlik .env.local'dan: BESZEL_URL, BESZEL_EMAIL, BESZEL_PASSWORD
 */
const INTERVAL_MS = 10_000;
/** Bir container bu kadar ardışık yoklamada listede yoksa "kayboldu" sayılır (yeniden oluşturma anları hariç) */
const MISSING_POLLS = 2;
const TIMEOUT_MS = 8000;
const DISK_WARN_PCT = 90;
/** Sunucu işlemci geçmişi (1 dk çözünürlük) kaç dakikada bir tazelenir ve kaç nokta tutulur */
const HISTORY_REFRESH_MS = 60_000;
const HISTORY_POINTS = 30;
/** Container geçmişi isteğe bağlı çekilir; bu kadar süre önbellekte kalır */
const CONTAINER_HISTORY_TTL_MS = 20_000;
const CONTAINER_HISTORY_POINTS = 60;
const LOGS_TTL_MS = 10_000;
const INFO_TTL_MS = 60_000;
/** Loglardan panele en fazla bu kadar satır (sondan) */
const LOG_LINES = 200;

interface PbList<T> {
  items: T[];
  totalItems: number;
}
interface PbSystem {
  id: string;
  name: string;
  host: string;
  status: SystemStatus;
  updated: string;
  info: Record<string, unknown> | string | null;
}
interface PbContainer {
  id: string;
  name: string;
  status: string;
  health: number;
  cpu: number;
  memory: number;
  net: number;
  image: string;
  ports: string;
  system: string;
}
interface PbStats {
  system: string;
  type: string;
  created: string;
  stats: unknown;
}
interface PbDetails {
  system: string;
  hostname: string;
  os_name: string;
  kernel: string;
  cores: number;
  threads: number;
  memory: number;
  cpu: string;
}

const HEALTH: Record<number, ContainerHealth> = { 0: "none", 1: "starting", 2: "healthy", 3: "unhealthy" };

/** Beszel bağlantısı: yönetim panelindeki ayar; boşsa .env.local yedeği */
function config(): { url: string; email: string; password: string } | null {
  const url = (getSettingSync("beszel.url") || process.env.BESZEL_URL || "").replace(/\/+$/, "");
  const email = getSettingSync("beszel.email") || process.env.BESZEL_EMAIL || "";
  const password = getSettingSync("beszel.password") || process.env.BESZEL_PASSWORD || "";
  return url && email && password ? { url, email, password } : null;
}

class BeszelMonitor {
  private state: InfraState = { configured: config() !== null, systems: [], updatedAt: 0, error: null };
  private token: string | null = null;
  private tokenAt = 0;
  private running = false;
  private lastStatus = new Map<string, SystemStatus>();
  private unhealthy = new Set<string>();
  /** sistem → container adı → kaç yoklamadır listede yok (Beszel durmuş container'ı düşürürse yakalanır) */
  private known = new Map<string, Map<string, number>>();
  private diskWarned = new Set<string>();
  private cpuHistory = new Map<string, number[]>();
  private historyAt = 0;
  private containerHistoryCache = new Map<string, ContainerHistory>();
  private logsCache = new Map<string, ContainerLogs>();
  private infoCache = new Map<string, ContainerInfo>();

  get snapshot(): InfraState {
    return this.state;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const cfg = config();
    if (!cfg) throw new Error("Beszel kimliği tanımlı değil");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${cfg.url}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          ...(this.token ? { authorization: this.token } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (res.status === 401 || res.status === 403) {
        this.token = null;
        throw new Error("Beszel kimliği reddedildi");
      }
      if (!res.ok) throw new Error(`Beszel HTTP ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** PocketBase kullanıcı girişi; token ~12 saatte bir tazelenir */
  private async ensureAuth(): Promise<void> {
    if (this.token && Date.now() - this.tokenAt < 12 * 3_600_000) return;
    const cfg = config()!;
    this.token = null;
    const res = await this.fetchJson<{ token: string }>("/api/collections/users/auth-with-password", {
      method: "POST",
      body: JSON.stringify({ identity: cfg.email, password: cfg.password }),
    });
    this.token = res.token;
    this.tokenAt = Date.now();
  }

  async refresh(): Promise<void> {
    if (this.running) return;
    const cfg = config();
    if (!cfg) {
      this.state = { configured: false, systems: [], updatedAt: Date.now(), error: null };
      return;
    }
    this.running = true;
    try {
      await this.ensureAuth();
      const [systems, containers, details] = await Promise.all([
        this.fetchJson<PbList<PbSystem>>("/api/collections/systems/records?perPage=200&sort=name"),
        this.fetchJson<PbList<PbContainer>>("/api/collections/containers/records?perPage=500&sort=name"),
        this.fetchJson<PbList<PbDetails>>("/api/collections/system_details/records?perPage=200"),
      ]);
      const detailsBySystem = new Map(details.items.map((d) => [d.system, d]));
      const containersBySystem = new Map<string, InfraContainer[]>();
      for (const c of containers.items) {
        const list = containersBySystem.get(c.system) ?? [];
        list.push({
          id: c.id,
          name: c.name,
          status: c.status ?? "",
          running: /^up\b/i.test(c.status ?? ""),
          health: HEALTH[c.health] ?? "none",
          cpu: Number(c.cpu) || 0,
          memMb: Number(c.memory) || 0,
          netMbps: Number(c.net) || 0,
          image: shortImage(c.image),
          ports: c.ports ?? "",
        });
        containersBySystem.set(c.system, list);
      }

      const mapped: InfraSystem[] = systems.items.map((s) => {
        const info = (typeof s.info === "string" ? safeJson(s.info) : s.info) ?? {};
        const d = detailsBySystem.get(s.id);
        const b = Array.isArray(info.b) ? (info.b as number[]) : null;
        return {
          id: s.id,
          name: s.name,
          host: s.host,
          status: s.status,
          updatedAt: Date.parse(s.updated) || Date.now(),
          cpu: num(info.cpu),
          memPct: num(info.mp),
          diskPct: num(info.dp),
          uptimeSec: num(info.u),
          load: Array.isArray(info.la) ? (info.la as number[]).map(Number) : [],
          bandwidth: b && b.length >= 2 ? [num(b[0]), num(b[1])] : null,
          cpuHistory: this.cpuHistory.get(s.id) ?? [],
          details: d
            ? {
                hostname: d.hostname ?? "",
                os: d.os_name ?? "",
                kernel: d.kernel ?? "",
                cores: Number(d.cores) || 0,
                threads: Number(d.threads) || 0,
                // Beszel bellek toplamını bayt olarak yazar
                memoryGb: (Number(d.memory) || 0) / 1_073_741_824,
                cpuModel: d.cpu ?? "",
              }
            : null,
          containers: (containersBySystem.get(s.id) ?? []).sort((a, b2) => a.name.localeCompare(b2.name)),
        };
      });

      if (Date.now() - this.historyAt > HISTORY_REFRESH_MS) {
        this.historyAt = Date.now();
        await this.refreshCpuHistory(mapped.map((m) => m.id));
        for (const m of mapped) m.cpuHistory = this.cpuHistory.get(m.id) ?? [];
      }
      this.state = { configured: true, systems: mapped, updatedAt: Date.now(), error: null };
      this.emitNotices(mapped);
    } catch (err) {
      this.state = {
        ...this.state,
        configured: true,
        updatedAt: Date.now(),
        error: (err as Error).message,
      };
    } finally {
      this.running = false;
    }
  }

  /** system_stats (1m) → sunucu başına son N işlemci değeri */
  private async refreshCpuHistory(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        try {
          const filter = encodeURIComponent(`system='${id}' && type='1m'`);
          const res = await this.fetchJson<PbList<PbStats>>(
            `/api/collections/system_stats/records?filter=${filter}&sort=-created&perPage=${HISTORY_POINTS}&fields=stats,created`
          );
          const series = res.items
            .map((r) => {
              const st = typeof r.stats === "string" ? safeJson(r.stats) : (r.stats as Record<string, unknown> | null);
              return st ? num(st.cpu) : 0;
            })
            .reverse();
          this.cpuHistory.set(id, series);
        } catch {
          /* geçmiş isteğe bağlı: hata anlık görüntüyü bozmasın */
        }
      })
    );
  }

  /** Bir container'ın son ~60 dakikası (container_stats 1m) — isteğe bağlı, 20 sn önbellek */
  async containerHistory(systemId: string, name: string): Promise<ContainerHistory> {
    const key = `${systemId}:${name}`;
    const cached = this.containerHistoryCache.get(key);
    if (cached && Date.now() - cached.updatedAt < CONTAINER_HISTORY_TTL_MS) return cached;
    await this.ensureAuth();
    const filter = encodeURIComponent(`system='${systemId}' && type='1m'`);
    const res = await this.fetchJson<PbList<PbStats>>(
      `/api/collections/container_stats/records?filter=${filter}&sort=-created&perPage=${CONTAINER_HISTORY_POINTS}&fields=stats,created`
    );
    const points: ContainerHistoryPoint[] = [];
    for (const r of res.items) {
      const arr = typeof r.stats === "string" ? safeJsonArray(r.stats) : (r.stats as unknown[] | null);
      const hit = (arr ?? []).find((e) => (e as { n?: string })?.n === name) as
        | { c?: number; m?: number; b?: number[] }
        | undefined;
      if (!hit) continue;
      points.push({
        t: Date.parse(r.created) || 0,
        cpu: num(hit.c),
        memMb: num(hit.m),
        rx: Array.isArray(hit.b) ? num(hit.b[0]) : null,
        tx: Array.isArray(hit.b) ? num(hit.b[1]) : null,
      });
    }
    points.reverse();
    const out: ContainerHistory = { systemId, name, points, updatedAt: Date.now() };
    this.containerHistoryCache.set(key, out);
    return out;
  }

  /** Beszel hub → agent: docker logs (son satırlar). 10 sn önbellek. */
  async containerLogs(systemId: string, containerId: string): Promise<ContainerLogs> {
    const key = `${systemId}:${containerId}`;
    const cached = this.logsCache.get(key);
    if (cached && Date.now() - cached.updatedAt < LOGS_TTL_MS) return cached;
    await this.ensureAuth();
    const res = await this.fetchJson<{ logs?: string }>(
      `/api/beszel/containers/logs?system=${encodeURIComponent(systemId)}&container=${encodeURIComponent(containerId)}`
    );
    const all = (res.logs ?? "").split("\n").filter((l) => l.trim().length > 0);
    const out: ContainerLogs = {
      systemId,
      containerId,
      lines: all.slice(-LOG_LINES).map(parseLogLine),
      total: all.length,
      updatedAt: Date.now(),
    };
    this.logsCache.set(key, out);
    return out;
  }

  /** Beszel hub → agent: docker inspect (özetlenmiş). 60 sn önbellek. */
  async containerInfo(systemId: string, containerId: string): Promise<ContainerInfo> {
    const key = `${systemId}:${containerId}`;
    const cached = this.infoCache.get(key);
    if (cached && Date.now() - cached.updatedAt < INFO_TTL_MS) return cached;
    await this.ensureAuth();
    const res = await this.fetchJson<{ info?: string }>(
      `/api/beszel/containers/info?system=${encodeURIComponent(systemId)}&container=${encodeURIComponent(containerId)}`
    );
    const j = (typeof res.info === "string" ? safeJson(res.info) : null) ?? {};
    const get = (path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), j);
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    const ports = Object.entries((get("NetworkSettings.Ports") as Record<string, unknown> | undefined) ?? {})
      .map(([k, v]) => {
        const binds = Array.isArray(v) ? (v as Array<{ HostIp?: string; HostPort?: string }>) : [];
        return binds.length ? `${binds.map((b) => `${b.HostIp ?? ""}:${b.HostPort ?? ""}`).join(",")}→${k}` : k;
      });
    const out: ContainerInfo = {
      systemId,
      containerId,
      createdAt: Date.parse(String(get("Created") ?? "")) || null,
      startedAt: Date.parse(String(get("State.StartedAt") ?? "")) || null,
      finishedAt: (() => { const t = Date.parse(String(get("State.FinishedAt") ?? "")); return t > 0 && t > 86_400_000 ? t : null; })(),
      restartCount: Number(get("RestartCount")) || 0,
      exitCode: Number(get("State.ExitCode")) || 0,
      restartPolicy: String(get("HostConfig.RestartPolicy.Name") ?? "") || null,
      image: String(get("Config.Image") ?? "") || null,
      command: [...arr(get("Config.Entrypoint")), ...arr(get("Config.Cmd"))].join(" ").slice(0, 200) || null,
      envCount: arr(get("Config.Env")).length,
      mountCount: arr(get("Mounts")).length,
      ports,
      healthcheck: get("Config.Healthcheck") ? {
        interval: Number(get("Config.Healthcheck.Interval")) / 1e9 || null,
        retries: Number(get("Config.Healthcheck.Retries")) || null,
      } : null,
      updatedAt: Date.now(),
    };
    this.infoCache.set(key, out);
    return out;
  }

  private emitNotices(systems: InfraSystem[]): void {
    const store = getNoticeStore();
    for (const s of systems) {
      const prev = this.lastStatus.get(s.id);
      this.lastStatus.set(s.id, s.status);
      const downId = `beszel:down:${s.id}`;
      if (s.status === "down") {
        if (prev !== "down") {
          store.push(
            {
              id: downId,
              kind: "server",
              severity: "urgent",
              title: `${s.name} yanıt vermiyor`,
              body: `${s.host} — Beszel agent'ına ulaşılamıyor`,
              screen: "infra",
              meta: { system: s.id },
            },
            "next:beszel"
          );
        }
      } else if (prev === "down") {
        store.clear(downId);
      }

      const diskId = `beszel:disk:${s.id}`;
      if (s.status === "up" && s.diskPct >= (getSettingSync("infra.diskWarnPct") || DISK_WARN_PCT)) {
        if (!this.diskWarned.has(s.id)) {
          this.diskWarned.add(s.id);
          store.push(
            {
              id: diskId,
              kind: "server",
              severity: "attention",
              title: `${s.name} diski doluyor`,
              body: `Disk %${Math.round(s.diskPct)}`,
              screen: "infra",
            },
            "next:beszel"
          );
        }
      } else if (this.diskWarned.delete(s.id)) {
        store.clear(diskId);
      }

      // Container'lar: durmuş / sağlıksız olanlar ve listeden kaybolanlar
      const seen = this.known.get(s.id) ?? new Map<string, number>();
      const present = new Set(s.containers.map((c) => c.name));
      for (const c of s.containers) seen.set(c.name, 0);
      for (const [name, missing] of seen) {
        if (!present.has(name)) seen.set(name, missing + 1);
      }
      this.known.set(s.id, seen);

      const problems = new Map<string, { title: string; body: string }>();
      for (const c of s.containers) {
        if (s.status !== "up") continue;
        if (c.health === "unhealthy") problems.set(c.name, { title: `${c.name} sağlıksız`, body: `${s.name} — ${c.status}` });
        else if (!c.running) problems.set(c.name, { title: `${c.name} durdu`, body: `${s.name} — ${c.status}` });
      }
      if (s.status === "up") {
        for (const [name, missing] of seen) {
          if (missing >= MISSING_POLLS) problems.set(name, { title: `${name} durdu`, body: `${s.name} — container listeden düştü` });
        }
      }
      for (const [name, p] of problems) {
        const key = `${s.id}:${name}`;
        if (this.unhealthy.has(key)) continue;
        this.unhealthy.add(key);
        store.push(
          { id: `beszel:container:${key}`, kind: "server", severity: "attention", title: p.title, body: p.body, screen: "infra" },
          "next:beszel"
        );
      }
      for (const key of [...this.unhealthy]) {
        if (!key.startsWith(s.id + ":")) continue;
        const name = key.slice(s.id.length + 1);
        if (!problems.has(name)) {
          this.unhealthy.delete(key);
          store.clear(`beszel:container:${key}`);
        }
      }
    }
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
/**
 * Docker log satırı: JSON ise (pino/winston/bunyan) seviye, zaman ve mesajı çıkar;
 * değilse ham bırak. Panel bunu okunur bir satıra çevirir.
 */
function parseLogLine(raw: string): { t: number | null; level: string | null; text: string } {
  const line = raw.replace(/^\d{4}-\d{2}-\d{2}T\S+\s/, ""); // docker --timestamps öneki
  if (!line.startsWith("{")) return { t: null, level: null, text: line.slice(0, 500) };
  const j = safeJson(line);
  if (!j) return { t: null, level: null, text: line.slice(0, 500) };
  const lvlRaw = j.level ?? j.lvl ?? j.severity;
  const PINO: Record<number, string> = { 10: "trace", 20: "debug", 30: "info", 40: "warn", 50: "error", 60: "fatal" };
  const level = typeof lvlRaw === "number" ? (PINO[lvlRaw] ?? String(lvlRaw)) : typeof lvlRaw === "string" ? lvlRaw.toLowerCase() : null;
  const tRaw = j.time ?? j.timestamp ?? j.ts ?? j["@timestamp"];
  const t = typeof tRaw === "number" ? (tRaw > 1e12 ? tRaw : tRaw * 1000) : typeof tRaw === "string" ? (Date.parse(tRaw) || null) : null;
  const msg = j.msg ?? j.message ?? j.event;
  const req = j.req && typeof j.req === "object" ? (j.req as { method?: string; url?: string }) : null;
  const res = j.res && typeof j.res === "object" ? (j.res as { statusCode?: number }) : null;
  let text = typeof msg === "string" ? msg : "";
  if (req?.method || req?.url) text = `${req.method ?? ""} ${req.url ?? ""}${res?.statusCode ? ` → ${res.statusCode}` : ""}${text ? ` · ${text}` : ""}`.trim();
  if (!text) {
    const rest = { ...j }; delete rest.level; delete rest.time; delete rest.pid; delete rest.hostname;
    text = JSON.stringify(rest).slice(0, 300);
  }
  return { t, level, text: text.slice(0, 500) };
}

/** "sha256:abc…" → "abc…"; "ghcr.io/org/app:1.2" → "app:1.2" */
const shortImage = (img: string | undefined) => {
  if (!img) return "";
  if (img.startsWith("sha256:")) return img.slice(7, 19);
  const last = img.split("/").pop() ?? img;
  return last.length > 40 ? last.slice(0, 40) + "…" : last;
};
const safeJsonArray = (s: string): unknown[] | null => {
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};
const safeJson = (s: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const g = globalThis as unknown as { __rp5Beszel?: BeszelMonitor; __rp5BeszelTimer?: boolean };

export function getBeszelMonitor(): BeszelMonitor {
  g.__rp5Beszel ??= new BeszelMonitor();
  return g.__rp5Beszel;
}

export function startBeszelMonitor(): void {
  if (g.__rp5BeszelTimer) return;
  g.__rp5BeszelTimer = true;
  const mon = getBeszelMonitor();
  void mon.refresh();
  // Aralık ayardan okunur; değişirse bir sonraki turda uygulanır
  const loop = () => {
    void mon.refresh().finally(() => setTimeout(loop, getSettingSync("infra.pollMs") || INTERVAL_MS));
  };
  setTimeout(loop, INTERVAL_MS);
}
