"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DrillHeader } from "@/components/ui/DrillHeader";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Sparkline } from "@/components/ui/Sparkline";
import { useContainerHistory } from "@/lib/data/useContainerHistory";
import { useContainerInfo, useContainerLogs } from "@/lib/data/useContainerDetail";
import type { LogLine } from "@/lib/types/infra";
import { useInfra } from "@/lib/data/useInfra";
import { useNow } from "@/lib/data/useNow";
import { fmtAgo } from "@/lib/format";
import { isProblem, type InfraContainer, type InfraSystem } from "@/lib/types/infra";

const TINT = "var(--color-teal)";

/* ── biçimleyiciler ── */

const fmtUptime = (sec: number) => {
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} g ${h} sa`;
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
};
const fmtRate = (bps: number) => {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${Math.round(bps / 1024)} KB/s`;
  return `${Math.round(bps)} B/s`;
};
const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
const pctColor = (p: number) => (p >= 90 ? "var(--color-err)" : p >= 75 ? "var(--color-warn)" : "var(--color-ink)");

function systemTone(s: InfraSystem): { color: string; label: string } {
  const broken = s.containers.filter(isProblem).length;
  if (s.status === "down") return { color: "var(--color-err)", label: "yanıt yok" };
  if (s.status === "paused") return { color: "var(--color-faint)", label: "duraklatıldı" };
  if (s.status === "pending") return { color: "var(--color-warn)", label: "bekleniyor" };
  if (broken > 0) return { color: "var(--color-err)", label: `${broken} sorunlu` };
  return { color: "var(--color-ok)", label: "sağlıklı" };
}
function containerTone(c: InfraContainer): { color: string; label: string } {
  if (!c.running) return { color: "var(--color-err)", label: "durdu" };
  if (c.health === "unhealthy") return { color: "var(--color-err)", label: "sağlıksız" };
  if (c.health === "starting") return { color: "var(--color-warn)", label: "başlıyor" };
  return { color: "var(--color-ok)", label: c.health === "healthy" ? "sağlıklı" : "çalışıyor" };
}

/** Karo/kart ortak yüzeyi — dokunulabilir, cam gradyan, basışta hafif küçülme */
function Tile({
  onTap,
  accent,
  className = "",
  children,
}: {
  onTap: () => void;
  /** Sorunlu öğe: kırmızı yıkama ve halka */
  accent?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <button
      onClick={onTap}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      className={`flex min-w-0 flex-col rounded-[18px] p-3.5 text-left ${className}`}
      style={{
        background: accent
          ? `color-mix(in srgb, ${accent} 12%, transparent)`
          : "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        boxShadow: accent
          ? `inset 0 0 0 1px color-mix(in srgb, ${accent} 30%, transparent)`
          : "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring), var(--card-shadow)",
        transform: pressed ? "scale(0.98)" : undefined,
        transition: "transform 120ms var(--ease-out-strong)",
      }}
    >
      {children}
    </button>
  );
}

/* ── Seviye 0: sunucu ızgarası (4×3) ── */

function ServerTile({ s, onTap }: { s: InfraSystem; onTap: () => void }) {
  const tone = systemTone(s);
  const problem = s.status === "down" || s.containers.some(isProblem);
  const stat = (label: string, v: number) => (
    <span className="leading-none">
      <span className="block text-[10.5px] font-medium text-faint">{label}</span>
      <span className="mt-0.5 block text-[19px] font-semibold tabular-nums tracking-[-0.01em]" style={{ color: pctColor(v) }}>
        %{Math.round(v)}
      </span>
    </span>
  );
  return (
    <Tile onTap={onTap} accent={problem ? "var(--color-err)" : undefined} className="h-full justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${s.status === "up" && !problem ? "animate-soft-pulse" : ""}`} style={{ background: tone.color }} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{s.name}</span>
        {s.status === "up" && <span className="shrink-0 text-[11px] tabular-nums text-faint">{fmtUptime(s.uptimeSec)}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex gap-4">
          {stat("İşlemci", s.cpu)}
          {stat("Bellek", s.memPct)}
          {stat("Disk", s.diskPct)}
        </div>
        <Sparkline
          values={s.cpuHistory}
          width={92}
          height={26}
          max={Math.max(20, ...s.cpuHistory)}
          color={problem ? "var(--color-err)" : TINT}
        />
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-faint">{s.containers.length} servis</span>
        <span className="text-faint">·</span>
        <span className="font-medium" style={{ color: tone.color }}>{tone.label}</span>
      </div>
    </Tile>
  );
}

/* ── Seviye 1: solda sabit sunucu özeti, sağda container kartları ── */

function MeterRow({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const p = Math.max(0, Math.min(100, value));
  const color = p >= 90 ? "var(--color-err)" : p >= 75 ? "var(--color-warn)" : TINT;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-dim">{label}</span>
        <span className="text-[18px] font-semibold tabular-nums tracking-[-0.01em]" style={{ color }}>%{Math.round(p)}</span>
      </div>
      <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, p)}%`, background: color, transition: "width 500ms var(--ease-out-strong)" }} />
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

function ServerSummary({ s, now }: { s: InfraSystem; now: number }) {
  const tone = systemTone(s);
  const broken = s.containers.filter(isProblem).length;
  return (
    <Card
      title="Sunucu"
      right={
        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: tone.color }}>
          <span className={`h-2 w-2 rounded-full ${s.status === "up" && broken === 0 ? "animate-soft-pulse" : ""}`} style={{ background: tone.color }} />
          {tone.label}
        </span>
      }
    >
      <ScrollArea>
        <div className="flex flex-col gap-3 pr-1">
          <div>
            <div className="truncate text-[15px] font-semibold">{s.name}</div>
            <div className="mt-0.5 text-[11.5px] text-faint">
              {s.host}{s.status === "up" ? ` · ${fmtUptime(s.uptimeSec)} açık` : ""}
            </div>
          </div>
          <MeterRow label="İşlemci" value={s.cpu} sub={s.load.length ? `yük ${s.load.map((l) => l.toFixed(2)).join(" · ")}` : undefined} />
          <MeterRow label="Bellek" value={s.memPct} sub={s.details ? `${s.details.memoryGb.toFixed(0)} GB toplam` : undefined} />
          <MeterRow label="Disk" value={s.diskPct} />
          <div>
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span className="text-faint">İşlemci · son 30 dk</span>
              {s.bandwidth && <span className="tabular-nums text-faint">↓ {fmtRate(s.bandwidth[0])} ↑ {fmtRate(s.bandwidth[1])}</span>}
            </div>
            <Sparkline values={s.cpuHistory} width={9999} height={40} max={Math.max(20, ...s.cpuHistory)} color={TINT} className="!w-full" />
          </div>
          {s.details && (
            <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11.5px]">
              <dt className="text-faint">Makine</dt><dd className="truncate">{s.details.hostname}</dd>
              <dt className="text-faint">Sistem</dt><dd className="truncate">{s.details.os}</dd>
              <dt className="text-faint">Çekirdek</dt><dd className="truncate">{s.details.kernel}</dd>
              <dt className="text-faint">İşlemci</dt><dd className="truncate">{s.details.cores} çekirdek / {s.details.threads} iş parçacığı{s.details.cpuModel ? ` · ${s.details.cpuModel}` : ""}</dd>
              <dt className="text-faint">Servisler</dt><dd>{s.containers.length} container{broken > 0 ? <span className="text-err"> · {broken} sorunlu</span> : " · hepsi çalışıyor"}</dd>
              <dt className="text-faint">Güncelleme</dt><dd>{fmtAgo(s.updatedAt, now)}</dd>
            </dl>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function ContainerTile({ c, onTap }: { c: InfraContainer; onTap: () => void }) {
  const tone = containerTone(c);
  const problem = isProblem(c);
  return (
    <Tile onTap={onTap} accent={problem ? "var(--color-err)" : undefined} className="h-full justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone.color }} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{c.name}</span>
      </div>
      <div className="truncate text-[11px] text-faint">{c.image || "—"}</div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] tabular-nums text-dim">
          %{c.cpu.toFixed(1)} · {fmtMb(c.memMb)}
        </span>
        <span className="text-[11px] font-medium" style={{ color: tone.color }}>{problem ? tone.label : c.status.replace(/^Up /, "")}</span>
      </div>
    </Tile>
  );
}

/* ── Seviye 2: container panosu ── */

function Panel({ label, value, unit, series, color, max }: {
  label: string; value: string; unit?: string; series: number[]; color: string; max?: number;
}) {
  return (
    <Card title={label} className="min-h-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] leading-none" style={{ color }}>{value}</span>
        {unit && <span className="text-[13px] text-dim">{unit}</span>}
      </div>
      <div className="mt-2 min-h-0 flex-1">
        <Sparkline values={series} width={9999} height={44} color={color} max={max} className="!w-full" />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-faint">
        <span>{series.length ? `son ${series.length} dk` : "geçmiş bekleniyor"}</span>
        <span>şimdi</span>
      </div>
    </Card>
  );
}

const LEVEL_COLOR: Record<string, string> = {
  fatal: "var(--color-err)",
  error: "var(--color-err)",
  warn: "var(--color-warn)",
  warning: "var(--color-warn)",
  info: "var(--color-teal)",
  debug: "var(--color-faint)",
  trace: "var(--color-faint)",
};

function LogRow({ l }: { l: LogLine }) {
  const color = (l.level && LEVEL_COLOR[l.level]) || "var(--color-faint)";
  const time = l.t ? new Date(l.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  return (
    <div className="flex items-baseline gap-2 font-mono text-[11.5px] leading-[1.45]">
      <span className="w-[62px] shrink-0 tabular-nums text-faint">{time}</span>
      <span className="w-[44px] shrink-0 truncate text-[10.5px] font-semibold uppercase tracking-wide" style={{ color }}>
        {l.level ?? ""}
      </span>
      <span className="min-w-0 flex-1 truncate text-dim">{l.text}</span>
    </div>
  );
}

const fmtWhen = (ms: number | null, now: number) => (ms ? fmtAgo(ms, now) + " önce" : "—");

function ContainerDashboard({ s, c, now }: { s: InfraSystem; c: InfraContainer; now: number }) {
  const { history, error: historyError } = useContainerHistory(s.id, c.name);
  const { data: logs, error: logsError } = useContainerLogs(s.id, c.id);
  const { data: info } = useContainerInfo(s.id, c.id);
  const tone = containerTone(c);
  const pts = history?.points ?? [];
  const cpu = pts.map((p) => p.cpu);
  const mem = pts.map((p) => p.memMb);
  const net = pts.map((p) => (p.rx ?? 0) + (p.tx ?? 0));
  const hasNet = pts.some((p) => p.rx !== null);
  const last = pts[pts.length - 1];
  const errorCount = logs ? logs.lines.filter((l) => l.level === "error" || l.level === "fatal").length : 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-4">
      <Card title="Container">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone.color }} />
          <span className="text-[15px] font-semibold" style={{ color: tone.color }}>{tone.label}</span>
          {info && info.restartCount > 0 && (
            <span className="ml-auto rounded-md bg-raised px-2 py-0.5 text-[11px] text-warn">{info.restartCount} yeniden başlatma</span>
          )}
        </div>
        <ScrollArea className="mt-3">
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
            <dt className="text-faint">Durum</dt><dd className="truncate">{c.status || "—"}</dd>
            <dt className="text-faint">Sağlık</dt><dd>
              {c.health === "none" ? "denetim yok" : tone.label}
              {info?.healthcheck?.interval ? <span className="text-faint"> · her {Math.round(info.healthcheck.interval)} sn</span> : null}
            </dd>
            <dt className="text-faint">Başladı</dt><dd>{fmtWhen(info?.startedAt ?? null, now)}</dd>
            <dt className="text-faint">Oluşturuldu</dt><dd>{fmtWhen(info?.createdAt ?? null, now)}</dd>
            {info?.finishedAt && !c.running && (<><dt className="text-faint">Durdu</dt><dd className="text-err">{fmtWhen(info.finishedAt, now)} · çıkış {info.exitCode}</dd></>)}
            <dt className="text-faint">İmaj</dt><dd className="truncate">{info?.image ?? c.image ?? "—"}</dd>
            <dt className="text-faint">Komut</dt><dd className="truncate font-mono text-[11.5px]">{info?.command ?? "—"}</dd>
            <dt className="text-faint">Portlar</dt><dd className="truncate">{(info?.ports.length ? info.ports.join(", ") : c.ports) || "—"}</dd>
            <dt className="text-faint">Yeniden başlat</dt><dd>{info?.restartPolicy || "—"}</dd>
            <dt className="text-faint">Ortam / mount</dt><dd className="tabular-nums">{info ? `${info.envCount} değişken · ${info.mountCount} mount` : "—"}</dd>
            <dt className="text-faint">Sunucu</dt><dd className="truncate">{s.name} · işlemci %{Math.round(s.cpu)} · bellek %{Math.round(s.memPct)}</dd>
          </dl>
        </ScrollArea>
        {historyError && <div className="mt-2 shrink-0 text-[11px] text-warn">Geçmiş alınamadı: {historyError}</div>}
      </Card>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className={`grid gap-4 ${hasNet ? "grid-cols-3" : "grid-cols-2"}`}>
          <Panel label="İşlemci" value={`%${(last?.cpu ?? c.cpu).toFixed(1)}`} series={cpu} color={TINT} />
          <Panel label="Bellek" value={fmtMb(last?.memMb ?? c.memMb)} series={mem} color="var(--color-indigo)" />
          {hasNet && (
            <Panel
              label="Ağ"
              value={`↓ ${fmtRate(last?.rx ?? 0)}`}
              unit={`↑ ${fmtRate(last?.tx ?? 0)}`}
              series={net}
              color="var(--color-purple)"
            />
          )}
        </div>

        <Card
          title="Loglar"
          right={
            <span className="flex items-center gap-3 text-[11px] text-faint">
              {errorCount > 0 && <span className="font-medium text-err">{errorCount} hata</span>}
              {logs && <span>son {logs.lines.length} satır</span>}
              {logs && <span>{fmtAgo(logs.updatedAt, now)}</span>}
            </span>
          }
        >
          {logsError ? (
            <div className="text-[12px] text-warn">Loglar alınamadı: {logsError}</div>
          ) : !logs ? (
            <div className="text-[12px] text-faint">Loglar getiriliyor…</div>
          ) : logs.lines.length === 0 ? (
            <div className="text-[12px] text-faint">Log yok</div>
          ) : (
            <ScrollArea stickToBottom bottomKey={c.id}>
              <div className="flex flex-col">
                {logs.lines.map((l, i) => <LogRow key={i} l={l} />)}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Ekran ── */

type View =
  | { level: 0 }
  | { level: 1; systemId: string }
  | { level: 2; systemId: string; container: string };

export default function InfraScreen() {
  const { data, stale } = useInfra();
  const now = useNow(20_000)?.getTime() ?? 0;
  const [view, setView] = useState<View>({ level: 0 });

  const system = view.level !== 0 ? (data.systems.find((s) => s.id === view.systemId) ?? null) : null;
  const container =
    view.level === 2 && system ? system.containers.find((c) => c.name === view.container) ?? null : null;

  const empty = (title: string, sub: string) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <Server size={40} strokeWidth={1.25} className="text-faint" />
      <div className="text-[17px] font-medium text-dim">{title}</div>
      <div className="max-w-[720px] text-[13px] text-faint">{sub}</div>
    </div>
  );

  let body: React.ReactNode;
  if (!data.configured) body = empty("Beszel bağlantısı tanımlı değil", ".env.local → BESZEL_URL, BESZEL_EMAIL, BESZEL_PASSWORD");
  else if (stale) body = empty("Panel backend'ine ulaşılamıyor", "yeniden deneniyor");
  else if (data.error && data.systems.length === 0) body = empty("Beszel'e ulaşılamıyor", data.error);
  else if (data.systems.length === 0) body = empty("Beszel'de sistem yok", "Hub'da \"Add System\" ile bir sunucu ekleyin");
  else if (view.level === 0) {
    const broken = data.systems.reduce((n, s) => n + s.containers.filter(isProblem).length, 0);
    const services = data.systems.reduce((n, s) => n + s.containers.length, 0);
    body = (
      <>
        <header className="mb-3 flex h-11 shrink-0 items-center justify-between">
          <span className="text-[15px] font-semibold">Sunucular</span>
          <span className="text-[12px] text-faint">
            {data.systems.length} sunucu · {services} servis{broken > 0 ? ` · ${broken} sorunlu` : ""} · {fmtAgo(data.updatedAt, now)}
          </span>
        </header>
        <ScrollArea>
          <div className="grid grid-cols-4 gap-3" style={{ gridAutoRows: "100px" }}>
            {data.systems.map((s) => (
              <ServerTile key={s.id} s={s} onTap={() => setView({ level: 1, systemId: s.id })} />
            ))}
          </div>
        </ScrollArea>
      </>
    );
  } else if (!system) body = empty("Sunucu bulunamadı", "Liste tazelendi; geri dönün");
  else if (view.level === 1) {
    body = (
      <>
        <DrillHeader
          crumbs={[{ label: "Altyapı", onTap: () => setView({ level: 0 }) }, { label: system.name }]}
          onBack={() => setView({ level: 0 })}
          right={<span className="text-[12px] text-faint">{system.containers.length} container</span>}
        />
        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-4">
          <ServerSummary s={system} now={now} />
          <ScrollArea>
            <div className="grid grid-cols-3 gap-3" style={{ gridAutoRows: "96px" }}>
              {system.containers.length === 0 && (
                <div className="col-span-3 py-10 text-center text-[13px] text-faint">Bu sunucuda container yok</div>
              )}
              {[...system.containers].sort((a, b) => Number(isProblem(b)) - Number(isProblem(a))).map((c) => (
                <ContainerTile key={c.id} c={c} onTap={() => setView({ level: 2, systemId: system.id, container: c.name })} />
              ))}
            </div>
          </ScrollArea>
        </div>
      </>
    );
  } else if (!container) body = empty("Container bulunamadı", "Liste tazelendi; geri dönün");
  else {
    body = (
      <>
        <DrillHeader
          crumbs={[
            { label: "Altyapı", onTap: () => setView({ level: 0 }) },
            { label: system.name, onTap: () => setView({ level: 1, systemId: system.id }) },
            { label: container.name },
          ]}
          onBack={() => setView({ level: 1, systemId: system.id })}
        />
        <ContainerDashboard s={system} c={container} now={now} />
      </>
    );
  }

  return (
    <div
      key={view.level}
      className="animate-card-in flex h-full flex-col p-5"
      style={{
        background: `radial-gradient(900px 320px at 30% -12%, color-mix(in srgb, ${TINT} 9%, transparent), transparent 60%)`,
      }}
    >
      {body}
    </div>
  );
}
