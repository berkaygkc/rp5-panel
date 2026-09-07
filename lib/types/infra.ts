/** Altyapı (Beszel) tipleri — panel tarafı. */

export type SystemStatus = "up" | "down" | "paused" | "pending";
export type ContainerHealth = "healthy" | "unhealthy" | "starting" | "none";

export interface InfraContainer {
  id: string;
  name: string;
  /** Docker'ın metni: "Up 2 days", "Exited (1) 3 hours ago" */
  status: string;
  running: boolean;
  health: ContainerHealth;
  cpu: number;
  memMb: number;
  /** MB/s (Beszel net alanı) */
  netMbps: number;
  image: string;
  ports: string;
}

export interface InfraSystem {
  id: string;
  name: string;
  host: string;
  status: SystemStatus;
  updatedAt: number;
  cpu: number;
  memPct: number;
  diskPct: number;
  uptimeSec: number;
  load: number[];
  /** [rx, tx] bayt/sn */
  bandwidth: [number, number] | null;
  /** Son ~30 dakikanın işlemci yüzdesi (1 dk çözünürlük, eskiden yeniye) */
  cpuHistory: number[];
  details: {
    hostname: string;
    os: string;
    kernel: string;
    cores: number;
    threads: number;
    memoryGb: number;
    cpuModel: string;
  } | null;
  containers: InfraContainer[];
}

export interface InfraState {
  /** Beszel adresi ve kimliği tanımlı mı */
  configured: boolean;
  systems: InfraSystem[];
  updatedAt: number;
  error: string | null;
}

/** Bir container'ın zaman serisi (eskiden yeniye) */
export interface ContainerHistoryPoint {
  t: number;
  cpu: number;
  memMb: number;
  /** bayt/sn; Beszel vermediyse null */
  rx: number | null;
  tx: number | null;
}

export interface ContainerHistory {
  systemId: string;
  name: string;
  points: ContainerHistoryPoint[];
  updatedAt: number;
}

/** Sorunlu container: durmuş ya da sağlıksız; "başlıyor" geçici, sorun sayılmaz */
export const isProblem = (c: Pick<InfraContainer, "running" | "health">) =>
  !c.running || c.health === "unhealthy";

export interface LogLine {
  t: number | null;
  level: string | null;
  text: string;
}

export interface ContainerLogs {
  systemId: string;
  containerId: string;
  lines: LogLine[];
  total: number;
  updatedAt: number;
}

/** docker inspect'ten özet — panelin künye kartı için */
export interface ContainerInfo {
  systemId: string;
  containerId: string;
  createdAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  restartCount: number;
  exitCode: number;
  restartPolicy: string | null;
  image: string | null;
  command: string | null;
  envCount: number;
  mountCount: number;
  ports: string[];
  healthcheck: { interval: number | null; retries: number | null } | null;
  updatedAt: number;
}
