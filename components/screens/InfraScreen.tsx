"use client";

import { useState } from "react";
import { ChevronRight, Server } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DrillHeader } from "@/components/ui/DrillHeader";
import { Gauge } from "@/components/ui/Gauge";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Sparkline } from "@/components/ui/Sparkline";
import { Stage, Module, modulePad } from "@/components/ui/Stage";
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
/** Docker'ın "Up 4 days (healthy)" biçimini kısa Türkçeye çevirir. */
const UP_UNITS: [RegExp, string][] = [
  [/^seconds?$/, "sn"],
  [/^minutes?$/, "dk"],
  [/^hours?$/, "sa"],
  [/^days?$/, "gün"],
  [/^weeks?$/, "hafta"],
  [/^months?$/, "ay"],
  [/^years?$/, "yıl"],
];
function fmtUp(status: string): string {
  const raw = status.replace(/^Up\s+/i, "").replace(/\s*\(.*\)\s*$/, "").trim();
  const m = /^(?:About\s+)?(an?|\d+)\s+([A-Za-z]+)/i.exec(raw);
  if (!m) return raw;
  const n = /^an?$/i.test(m[1]) ? "1" : m[1];
  const unit = UP_UNITS.find(([re]) => re.test(m[2].toLowerCase()))?.[1] ?? m[2];
  return `${n} ${unit}`;
}
const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);

/** Yük rengi: %75 uyarı, %90 hata. Altında renk yok — sakin kalsın. */
const loadColor = (p: number) => (p >= 90 ? "var(--color-err)" : p >= 75 ? "var(--color-warn)" : TINT);

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

function Dot({ color, pulse = false, size = 7 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span
      className={`shrink-0 rounded-full ${pulse ? "animate-soft-pulse" : ""}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}

/** Dokunulabilir satır: kutu yok, yalnızca basışta yükselen bir yıkama. */
function Row({
  onTap,
  alarm = false,
  className = "",
  style,
  children,
}: {
  onTap: () => void;
  alarm?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full min-w-0 text-left transition-colors duration-100 active:bg-[var(--color-raised)] ${className}`}
      style={{
        background: alarm ? "color-mix(in srgb, var(--color-err) 8%, transparent)" : undefined,
        boxShadow: alarm ? "inset 2px 0 0 var(--color-err)" : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ── Seviye 0: filo tablosu ──
 * Sunucular satır satır dizilir; işlemci/bellek/disk sütunları bütün satırlarda
 * hizalıdır, böylece sunucular dikeyde tek bakışta karşılaştırılır. */

const FLEET_COLS = "232px repeat(3, 150px) minmax(96px, 1fr) 122px 18px";

function Meter({ value }: { value: number }) {
  const p = Math.max(0, Math.min(100, value));
  const color = loadColor(p);
  return (
    <div className="flex flex-col justify-center gap-[7px] pr-4">
      <span
        className="text-[15px] font-semibold leading-none tabular-nums tracking-[-0.01em]"
        style={{ color: p >= 75 ? color : "var(--color-ink)" }}
      >
        %{Math.round(p)}
      </span>
      <span className="block h-[3px] overflow-hidden rounded-full" style={{ background: "var(--color-track)" }}>
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(2, p)}%`, background: color, transition: "width 500ms var(--ease-out-strong)" }}
        />
      </span>
    </div>
  );
}

function FleetHead() {
  return (
    <div
      className="grid h-7 shrink-0 items-center gap-0 text-[10.5px] text-faint"
      style={{ gridTemplateColumns: FLEET_COLS }}
    >
      <span className="pl-3">Sunucu</span>
      <span>İşlemci</span>
      <span>Bellek</span>
      <span>Disk</span>
      <span>son 30 dk</span>
      <span className="text-right">Servisler</span>
      <span />
    </div>
  );
}

function ServerRow({ s, onTap }: { s: InfraSystem; onTap: () => void }) {
  const tone = systemTone(s);
  const alarm = s.status === "down" || s.containers.some(isProblem);
  return (
    <Row onTap={onTap} alarm={alarm} className="grid h-[56px] items-center" style={{ gridTemplateColumns: FLEET_COLS }}>
      <span className="flex min-w-0 items-center gap-2.5 pl-3">
        <Dot color={tone.color} pulse={s.status === "up" && !alarm} />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold leading-tight">{s.name}</span>
          <span className="block truncate text-[11px] leading-tight text-faint">
            {s.host}
            {s.status === "up" ? ` · ${fmtUptime(s.uptimeSec)}` : ""}
          </span>
        </span>
      </span>
      <Meter value={s.cpu} />
      <Meter value={s.memPct} />
      <Meter value={s.diskPct} />
      <Sparkline
        values={s.cpuHistory}
        width={9999}
        height={28}
        max={Math.max(20, ...s.cpuHistory)}
        color={alarm ? "var(--color-err)" : TINT}
        className="!w-full pr-5"
      />
      <span className="text-right leading-tight">
        <span className="block text-[12.5px] tabular-nums text-dim">{s.containers.length} servis</span>
        <span className="block text-[11px] font-medium" style={{ color: tone.color }}>
          {tone.label}
        </span>
      </span>
      <ChevronRight size={15} strokeWidth={2} className="text-faint" />
    </Row>
  );
}

/* ── Seviye 0: sol sütun, hüküm ── */

interface Fault {
  key: string;
  systemId: string;
  systemName: string;
  title: string;
  label: string;
  container?: string;
}

function Verdict({
  faults,
  systems,
  services,
  onOpen,
}: {
  faults: Fault[];
  systems: number;
  services: number;
  onOpen: (f: Fault) => void;
}) {
  if (faults.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5">
          <Dot color="var(--color-ok)" pulse size={9} />
          <span className="text-[19px] font-semibold tracking-[-0.01em]">Her şey yolunda</span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-dim">
          {systems} sunucudaki {services} servisin hepsi ayakta. Bir şey bozulursa burada adıyla yazar.
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-[34px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-err">
          {faults.length}
        </span>
        <span className="text-[13px] text-dim">{faults.length === 1 ? "sorun" : "sorun"} bekliyor</span>
      </div>
      <ScrollArea className="mt-2.5">
        <div className="flex flex-col divide-hairline-y">
          {faults.map((f) => (
            <Row key={f.key} onTap={() => onOpen(f)} className="flex items-center gap-2.5 py-2 pr-1">
              <Dot color="var(--color-err)" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">{f.title}</span>
                <span className="block truncate text-[11px] leading-tight text-faint">{f.systemName}</span>
              </span>
              <span className="shrink-0 text-[11px] font-medium text-err">{f.label}</span>
            </Row>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ── Seviye 1: sunucu künyesi ── */

function Ring({ label, value }: { label: string; value: number }) {
  const p = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Gauge percent={p} size={74} thickness={7} color={loadColor(p)}>
        <span className="text-[15px] font-semibold tabular-nums tracking-[-0.02em]">%{Math.round(p)}</span>
      </Gauge>
      <span className="text-[11px] text-faint">{label}</span>
    </div>
  );
}

function ServerSummary({ s, now }: { s: InfraSystem; now: number }) {
  const tone = systemTone(s);
  const broken = s.containers.filter(isProblem).length;
  return (
    <>
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <Dot color={tone.color} pulse={s.status === "up" && broken === 0} size={8} />
          <span className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.01em]">{s.name}</span>
        </div>
        <div className="mt-0.5 truncate pl-[18px] text-[11.5px] text-faint">
          {s.host}
          {s.status === "up" ? ` · ${fmtUptime(s.uptimeSec)} açık` : ` · ${tone.label}`}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 justify-between">
        <Ring label="İşlemci" value={s.cpu} />
        <Ring label="Bellek" value={s.memPct} />
        <Ring label="Disk" value={s.diskPct} />
      </div>

      <div className="mt-4 shrink-0">
        <div className="mb-1 flex items-baseline justify-between text-[11px] text-faint">
          <span>son 30 dk</span>
          {s.bandwidth && (
            <span className="tabular-nums">
              ↓ {fmtRate(s.bandwidth[0])} ↑ {fmtRate(s.bandwidth[1])}
            </span>
          )}
        </div>
        <Sparkline values={s.cpuHistory} width={9999} height={38} max={Math.max(20, ...s.cpuHistory)} color={TINT} className="!w-full" />
      </div>

      <ScrollArea className="mt-3">
        <dl className="grid grid-cols-[78px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[11.5px]">
          {s.load.length > 0 && (
            <>
              <dt className="text-faint">Yük</dt>
              <dd className="tabular-nums">{s.load.map((l) => l.toFixed(2)).join("  ")}</dd>
            </>
          )}
          {s.details && (
            <>
              <dt className="text-faint">Makine</dt>
              <dd className="truncate">{s.details.hostname}</dd>
              <dt className="text-faint">Sistem</dt>
              <dd className="truncate">{s.details.os}</dd>
              <dt className="text-faint">Çekirdek</dt>
              <dd className="truncate">{s.details.kernel}</dd>
              <dt className="text-faint">İşlemci</dt>
              <dd className="truncate">
                {s.details.cores} çekirdek / {s.details.threads} iş parçacığı
                {s.details.cpuModel ? ` · ${s.details.cpuModel}` : ""}
              </dd>
              <dt className="text-faint">Bellek</dt>
              <dd className="tabular-nums">{s.details.memoryGb.toFixed(0)} GB</dd>
            </>
          )}
          <dt className="text-faint">Güncelleme</dt>
          <dd>{fmtAgo(s.updatedAt, now)}</dd>
        </dl>
      </ScrollArea>
    </>
  );
}

/* ── Seviye 1: container listesi ── */

function ContainerRow({ c, onTap }: { c: InfraContainer; onTap: () => void }) {
  const tone = containerTone(c);
  const problem = isProblem(c);
  return (
    <Row onTap={onTap} alarm={problem} className="flex h-[52px] items-center gap-2.5 border-t border-[var(--hairline)] pl-3 pr-3">
      <Dot color={tone.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">{c.name}</span>
        <span className="block truncate text-[11px] leading-tight text-faint">{c.image || c.status || "—"}</span>
      </span>
      <span className="shrink-0 text-right leading-tight">
        <span className="block text-[12px] tabular-nums text-dim">%{c.cpu.toFixed(1)}</span>
        <span className="block text-[11px] tabular-nums text-faint">{fmtMb(c.memMb)}</span>
      </span>
      <span className="w-[62px] shrink-0 text-right text-[11px] font-medium" style={{ color: problem ? tone.color : "var(--color-faint)" }}>
        {problem ? tone.label : fmtUp(c.status)}
      </span>
    </Row>
  );
}

/* ── Seviye 2: container panosu ── */

function Metric({
  label,
  value,
  unit,
  series,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  series: number[];
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] text-faint">{label}</span>
      <span className="mt-1 block truncate text-[21px] font-semibold leading-none tabular-nums tracking-[-0.02em]" style={{ color }}>
        {value}
      </span>
      <span className="mt-[3px] block h-[13px] truncate text-[11px] tabular-nums leading-none text-faint">{unit ?? ""}</span>
      <Sparkline values={series} width={9999} height={34} color={color} className="!w-full mt-2" />
    </div>
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

/** Arka arkaya yinelenen satırlar tek satırda toplanır; sayaç kaç kez tekrarlandığını söyler. */
function groupLogs(lines: LogLine[]): { l: LogLine; n: number }[] {
  const out: { l: LogLine; n: number }[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && prev.l.text === l.text && prev.l.level === l.level) out[out.length - 1] = { l, n: prev.n + 1 };
    else out.push({ l, n: 1 });
  }
  return out;
}

function LogRow({ l, n, showTime }: { l: LogLine; n: number; showTime: boolean }) {
  const color = (l.level && LEVEL_COLOR[l.level]) || "var(--color-faint)";
  const loud = l.level === "error" || l.level === "fatal" || l.level === "warn" || l.level === "warning";
  const time = l.t ? new Date(l.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  return (
    <div className="flex items-baseline gap-2 font-mono text-[11.5px] leading-[1.5]">
      {showTime && <span className="w-[58px] shrink-0 tabular-nums text-faint">{time}</span>}
      <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: loud ? color : "transparent" }} />
      <span className={`min-w-0 flex-1 truncate ${loud ? "" : "text-dim"}`} style={loud ? { color } : undefined}>
        {l.text}
      </span>
      {n > 1 && (
        <span className="shrink-0 rounded-full bg-raised px-1.5 text-[10px] tabular-nums leading-[1.5] text-faint">×{n}</span>
      )}
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
    <div className="stage-in grid min-h-0 flex-1" style={{ gridTemplateColumns: "372px minmax(0, 1fr)" }}>
      <Module divider={false} className="pr-5">
        <div className="shrink-0">
          <div className="flex items-center gap-2">
            <Dot color={tone.color} size={8} pulse={c.running && !isProblem(c)} />
            <span className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.01em]">{c.name}</span>
            {info && info.restartCount > 0 && (
              <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 text-[10.5px] text-warn">
                {info.restartCount}× yeniden başladı
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate pl-[18px] text-[11.5px]" style={{ color: tone.color }}>
            {tone.label}
            <span className="text-faint">{c.status ? ` · ${fmtUp(c.status)} önce başladı` : ""}</span>
          </div>
        </div>

        <div className="mt-3.5 grid shrink-0 gap-4" style={{ gridTemplateColumns: hasNet ? "repeat(3, minmax(0,1fr))" : "repeat(2, minmax(0,1fr))" }}>
          <Metric label="İşlemci" value={`%${(last?.cpu ?? c.cpu).toFixed(1)}`} series={cpu} color={TINT} />
          <Metric label="Bellek" value={fmtMb(last?.memMb ?? c.memMb)} series={mem} color="var(--color-indigo)" />
          {hasNet && (
            <Metric label="Ağ" value={`↓${fmtRate(last?.rx ?? 0)}`} unit={`↑${fmtRate(last?.tx ?? 0)}`} series={net} color="var(--color-purple)" />
          )}
        </div>
        {historyError && <div className="mt-1 shrink-0 text-[11px] text-warn">Geçmiş alınamadı: {historyError}</div>}

        <ScrollArea className="mt-3.5">
          <dl className="grid grid-cols-[86px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[11.5px]">
            <dt className="text-faint">Başladı</dt>
            <dd>{fmtWhen(info?.startedAt ?? null, now)}</dd>
            {info?.finishedAt && !c.running && (
              <>
                <dt className="text-faint">Durdu</dt>
                <dd className="text-err">
                  {fmtWhen(info.finishedAt, now)} · çıkış {info.exitCode}
                </dd>
              </>
            )}
            <dt className="text-faint">Sağlık</dt>
            <dd>
              {c.health === "none" ? "denetim yok" : tone.label}
              {info?.healthcheck?.interval ? <span className="text-faint"> · her {Math.round(info.healthcheck.interval)} sn</span> : null}
            </dd>
            <dt className="text-faint">İmaj</dt>
            <dd className="truncate">{info?.image ?? c.image ?? "—"}</dd>
            <dt className="text-faint">Komut</dt>
            <dd className="truncate font-mono text-[11px]">{info?.command ?? "—"}</dd>
            <dt className="text-faint">Portlar</dt>
            <dd className="truncate">{(info?.ports.length ? info.ports.join(", ") : c.ports) || "—"}</dd>
            <dt className="text-faint">Politika</dt>
            <dd>{info?.restartPolicy || "—"}</dd>
            <dt className="text-faint">Ortam</dt>
            <dd className="tabular-nums">{info ? `${info.envCount} değişken · ${info.mountCount} mount` : "—"}</dd>
            <dt className="text-faint">Sunucu</dt>
            <dd className="truncate">
              {s.name} · işlemci %{Math.round(s.cpu)} · bellek %{Math.round(s.memPct)}
            </dd>
          </dl>
        </ScrollArea>
      </Module>

      <Card
        title="Loglar"
        className="ml-5"
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
              {groupLogs(logs.lines).map((g, i) => (
                <LogRow key={i} l={g.l} n={g.n} showTime={logs.lines.some((x) => x.t !== null)} />
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
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

  const system = view.level !== 0 ? data.systems.find((s) => s.id === view.systemId) ?? null : null;
  const container = view.level === 2 && system ? system.containers.find((c) => c.name === view.container) ?? null : null;

  const empty = (title: string, sub: string) => (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
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
    const services = data.systems.reduce((n, s) => n + s.containers.length, 0);
    const faults: Fault[] = [];
    for (const s of data.systems) {
      if (s.status === "down" || s.status === "paused") {
        faults.push({ key: s.id, systemId: s.id, systemName: s.host, title: s.name, label: systemTone(s).label });
      } else {
        const strain = ([
          ["disk", s.diskPct],
          ["bellek", s.memPct],
          ["işlemci", s.cpu],
        ] as const).find(([, v]) => v >= 90);
        if (strain) {
          faults.push({
            key: `${s.id}:${strain[0]}`,
            systemId: s.id,
            systemName: s.host,
            title: s.name,
            label: `${strain[0]} %${Math.round(strain[1])}`,
          });
        }
      }
      for (const c of s.containers) {
        if (isProblem(c)) {
          faults.push({
            key: `${s.id}/${c.id}`,
            systemId: s.id,
            systemName: s.name,
            title: c.name,
            label: containerTone(c).label,
            container: c.name,
          });
        }
      }
    }
    const openFault = (f: Fault) =>
      setView(f.container ? { level: 2, systemId: f.systemId, container: f.container } : { level: 1, systemId: f.systemId });

    body = (
      <Stage cols="284px minmax(0, 1fr)">
        <Module title="Durum" divider={false} className={modulePad(0, 2)}>
          <Verdict faults={faults} systems={data.systems.length} services={services} onOpen={openFault} />
          <div className="mt-3 shrink-0 border-t border-[var(--hairline)] pt-2.5 text-[11px] text-faint">
            {data.systems.length} sunucu · {services} servis
            <br />
            {fmtAgo(data.updatedAt, now)} güncellendi
          </div>
        </Module>

        <Module
          title="Filo"
          className={modulePad(1, 2)}
          right={data.error ? <span className="text-[11px] text-warn">{data.error}</span> : undefined}
        >
          <FleetHead />
          <ScrollArea>
            <div className="flex flex-col divide-hairline-y">
              {[...data.systems]
                .sort((a, b) => Number(systemTone(b).color === "var(--color-err)") - Number(systemTone(a).color === "var(--color-err)"))
                .map((s) => (
                  <ServerRow key={s.id} s={s} onTap={() => setView({ level: 1, systemId: s.id })} />
                ))}
            </div>
          </ScrollArea>
        </Module>
      </Stage>
    );
  } else if (!system) body = empty("Sunucu bulunamadı", "Liste tazelendi; geri dönün");
  else if (view.level === 1) {
    const sorted = [...system.containers].sort((a, b) => Number(isProblem(b)) - Number(isProblem(a)));
    const broken = system.containers.filter(isProblem).length;
    body = (
      <div className="flex h-full flex-col p-5">
        <DrillHeader
          crumbs={[{ label: "Altyapı", onTap: () => setView({ level: 0 }) }, { label: system.name }]}
          onBack={() => setView({ level: 0 })}
          right={
            <span className="text-[12px] text-faint">
              {system.containers.length} servis
              {broken > 0 ? <span className="text-err"> · {broken} sorunlu</span> : null}
            </span>
          }
        />
        <div className="stage-in grid min-h-0 flex-1" style={{ gridTemplateColumns: "312px minmax(0, 1fr)" }}>
          <Module divider={false} className="pr-5">
            <ServerSummary s={system} now={now} />
          </Module>
          <Module title="Servisler" className="pl-5">
            {sorted.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-faint">Bu sunucuda container yok</div>
            ) : (
              <ScrollArea>
                <div className="grid grid-cols-2 gap-x-5">
                  {sorted.map((c) => (
                    <ContainerRow
                      key={c.id}
                      c={c}
                      onTap={() => setView({ level: 2, systemId: system.id, container: c.name })}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </Module>
        </div>
      </div>
    );
  } else if (!container) body = empty("Container bulunamadı", "Liste tazelendi; geri dönün");
  else {
    body = (
      <div className="flex h-full flex-col p-5">
        <DrillHeader
          crumbs={[
            { label: "Altyapı", onTap: () => setView({ level: 0 }) },
            { label: system.name, onTap: () => setView({ level: 1, systemId: system.id }) },
            { label: container.name },
          ]}
          onBack={() => setView({ level: 1, systemId: system.id })}
        />
        <ContainerDashboard s={system} c={container} now={now} />
      </div>
    );
  }

  return (
    <div key={view.level} className="h-full">
      {body}
    </div>
  );
}
