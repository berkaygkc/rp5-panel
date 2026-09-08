"use client";

import { useOsData } from "@/lib/data/useOsData";
import { isProblem } from "@/lib/types/infra";
import type { OsData } from "@/lib/os/types";

/**
 * Laboratuvarın ortak gerçeği.
 *
 * Üç tasarım yönü de aynı listeyi okur; aralarındaki fark yalnızca bu listeyi
 * nasıl gösterdikleridir. Böylece karşılaştırma dürüst olur: veri sabit,
 * dil değişken.
 */

export type LabSeverity = "critical" | "waiting" | "idle";
export type LabApp = "claude" | "chat" | "mail" | "infra" | "media" | "system";

export interface LabItem {
  id: string;
  app: LabApp;
  /** NE — işin kendisi */
  title: string;
  /** NEREDE — hangi bağlamda */
  where: string;
  /** Bir cümlelik ayrıntı; boş olabilir */
  detail: string;
  /** Ne zamandır bekliyor (epoch ms); yoksa null */
  since: number | null;
  /** DURUM — tek kelime, büyük harfle yazılacak */
  state: string;
  severity: LabSeverity;
}

export interface LabModel {
  os: OsData;
  /** Senden bir şey isteyenler, önem ve bekleme sırasına göre */
  items: LabItem[];
  /** Kendi kendine akan şeyler — arka plan malzemesi */
  ambient: {
    load: number[];
    loadLabel: string;
    mailTicks: number[];
    usagePct: number;
    usageLabel: string;
    servers: { name: string; worst: number; ok: boolean }[];
    /** Her sunucunun son yarım saatlik işlemci sırtı — ufkun altındaki manzara */
    ridges: { name: string; values: number[] }[];
    services: number;
  };
  criticals: number;
  waiting: number;
}

const SEV_RANK: Record<LabSeverity, number> = { critical: 0, waiting: 1, idle: 2 };

export function useLabModel(): LabModel {
  const os = useOsData();
  const items: LabItem[] = [];

  for (const s of os.claude.sessions) {
    if (s.status === "closed") continue;
    const waiting = s.status === "waiting";
    items.push({
      id: `claude:${s.id}`,
      app: "claude",
      title: s.project,
      where: "claude",
      detail: waiting
        ? s.activity?.kind === "assistant" && s.activity.text
          ? s.activity.text
          : "Sizi bekliyor"
        : s.activity?.kind === "tool"
          ? s.activity.text || `${s.activity.tool} çalıştırıyor`
          : s.activity?.text || "Çalışıyor",
      since: s.lastActiveAt,
      state: waiting ? "soruyor" : "çalışıyor",
      severity: waiting ? "waiting" : "idle",
    });
  }

  for (const sys of os.infra.systems) {
    if (sys.status === "down") {
      items.push({
        id: `infra:${sys.id}`,
        app: "infra",
        title: sys.name,
        where: sys.host,
        detail: "Sunucu yanıt vermiyor",
        since: sys.updatedAt,
        state: "yanıt yok",
        severity: "critical",
      });
    } else if (sys.diskPct >= 90) {
      items.push({
        id: `infra:${sys.id}:disk`,
        app: "infra",
        title: sys.name,
        where: "disk",
        detail: `Disk %${Math.round(sys.diskPct)} dolu`,
        since: null,
        state: `disk %${Math.round(sys.diskPct)}`,
        severity: "critical",
      });
    }
    for (const c of sys.containers) {
      if (!isProblem(c)) continue;
      items.push({
        id: `infra:${sys.id}:${c.id}`,
        app: "infra",
        title: c.name,
        where: sys.name,
        detail: c.running ? "Sağlık denetimi geçmiyor" : "Container durdu",
        since: null,
        state: c.running ? "sağlıksız" : "durdu",
        severity: "critical",
      });
    }
  }

  for (const c of [...os.chat.chatwoot.items, ...os.chat.mattermost.items]) {
    if (c.unread === 0 && c.mentions === 0) continue;
    items.push({
      id: `chat:${c.id}`,
      app: "chat",
      title: c.title,
      where: c.subtitle || "sohbet",
      detail: c.preview || "",
      since: c.waitingSince,
      state: c.mentions > 0 ? "bahsetti" : "yanıt bekliyor",
      severity: "waiting",
    });
  }

  const unread = os.mail.messages.filter((m) => m.unseen);
  if (unread.length > 0) {
    const m = unread[0];
    items.push({
      id: `mail:${m.pk}`,
      app: "mail",
      title: m.fromName || m.fromAddress,
      where: "posta",
      detail: m.subject,
      since: m.receivedAt,
      state: unread.length > 1 ? `${unread.length} okunmadı` : "okunmadı",
      severity: "idle",
    });
  }

  if (os.online.length === 0) {
    items.push({
      id: "system:offline",
      app: "system",
      title: "Mac ajanı",
      where: "çekirdek",
      detail: "Hiçbir cihaz bağlı değil",
      since: null,
      state: "bağlı değil",
      severity: "critical",
    });
  }

  items.sort(
    (a, b) =>
      SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
      (a.since ?? Infinity) - (b.since ?? Infinity)
  );

  const busiest = [...os.infra.systems].sort(
    (a, b) => Math.max(b.cpu, b.memPct, b.diskPct) - Math.max(a.cpu, a.memPct, a.diskPct)
  )[0];
  const limit = os.claude.usage.limits.find((l) => l.id === "session") ?? os.claude.usage.limits[0];

  return {
    os,
    items,
    criticals: items.filter((i) => i.severity === "critical").length,
    waiting: items.filter((i) => i.severity === "waiting").length,
    ambient: {
      load: busiest?.cpuHistory ?? [],
      loadLabel: busiest?.name ?? "",
      mailTicks: os.mail.messages.slice(0, 40).map((m) => m.receivedAt),
      usagePct: limit ? Math.round(limit.percent) : 0,
      usageLabel: limit?.label ?? "",
      servers: os.infra.systems.map((s) => ({
        name: s.name,
        worst: Math.max(s.cpu, s.memPct, s.diskPct),
        ok: s.status === "up" && !s.containers.some(isProblem) && s.diskPct < 90,
      })),
      ridges: os.infra.systems
        .filter((s) => s.cpuHistory.length > 1)
        .map((s) => ({ name: s.name, values: s.cpuHistory })),
      services: os.infra.systems.reduce((n, s) => n + s.containers.length, 0),
    },
  };
}

/** "42 dk", "3 sa", "az önce" — panoda da ufukta da aynı dil */
export function waited(since: number | null, now: number): string {
  if (!since || !now) return "";
  const s = Math.max(0, (now - since) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.round(s / 60)} dk`;
  if (s < 86_400) return `${Math.round(s / 3600)} sa`;
  return `${Math.round(s / 86_400)} gün`;
}
