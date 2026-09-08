"use client";

import { Server } from "lucide-react";
import { Pill, Tile, TileHead } from "@/components/os/parts";
import { Sparkline } from "@/components/ui/Sparkline";
import { isProblem, type InfraSystem } from "@/lib/types/infra";
import type { WidgetProps } from "@/lib/os/types";

const TINT = "var(--color-teal)";
const ERR = "var(--color-err)";

const load = (p: number) => (p >= 90 ? ERR : p >= 75 ? "var(--color-warn)" : TINT);
const worst = (s: InfraSystem) => Math.max(s.cpu, s.memPct, s.diskPct);

/** İnce yük çubuğu — sayı yanında değil, altında; satır yüksekliği sabit kalsın. */
function Bar({ value, width = "100%" }: { value: number; width?: string }) {
  const p = Math.max(0, Math.min(100, value));
  return (
    <span className="block h-[3px] overflow-hidden rounded-full" style={{ background: "var(--color-track)", width }}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(2, p)}%`, background: load(p), transition: "width 500ms var(--ease-out-strong)" }}
      />
    </span>
  );
}

function Cell({ value }: { value: number }) {
  const p = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <span className="flex flex-col gap-[5px]">
      <span className="text-[12px] font-semibold leading-none tabular-nums" style={{ color: p >= 75 ? load(p) : "var(--color-ink)" }}>
        %{p}
      </span>
      <Bar value={p} />
    </span>
  );
}

/** Ekrandaki filo tablosunun küçük hali: sütunlar satırlar arasında hizalı. */
function FleetRow({ s, columns }: { s: InfraSystem; columns: boolean }) {
  const broken = s.containers.filter(isProblem).length;
  const alarm = s.status !== "up" || broken > 0 || worst(s) >= 90;
  return (
    <div
      className="grid h-[30px] items-center gap-3"
      style={{ gridTemplateColumns: columns ? "minmax(0,1fr) 54px 54px 54px" : "minmax(0,1fr) 62px" }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full"
          style={{ background: alarm ? ERR : "var(--color-ok)" }}
        />
        <span className="min-w-0 truncate text-[12px] font-medium">{s.name}</span>
      </span>
      {columns ? (
        <>
          <Cell value={s.cpu} />
          <Cell value={s.memPct} />
          <Cell value={s.diskPct} />
        </>
      ) : (
        <Cell value={worst(s)} />
      )}
    </div>
  );
}

/** Sunucu sağlığı: sessizken filonun nabzı, sorun varsa doğrudan sorunun adı. */
export function InfraHealthWidget({ size, data }: WidgetProps) {
  const systems = data.infra.systems;
  if (!data.infra.configured || systems.length === 0) return null;

  const faults: { title: string; where: string; label: string }[] = [];
  for (const s of systems) {
    if (s.status === "down") faults.push({ title: s.name, where: s.host, label: "yanıt yok" });
    else if (s.diskPct >= 90) faults.push({ title: s.name, where: "disk", label: `%${Math.round(s.diskPct)}` });
    for (const c of s.containers.filter(isProblem)) {
      faults.push({ title: c.name, where: s.name, label: c.running ? "sağlıksız" : "durdu" });
    }
  }
  const services = systems.reduce((n, s) => n + s.containers.length, 0);
  const bad = faults.length > 0;
  const busiest = [...systems].sort((a, b) => worst(b) - worst(a))[0];
  const ordered = [...systems].sort((a, b) => {
    const fa = a.status !== "up" || a.containers.some(isProblem) || worst(a) >= 90;
    const fb = b.status !== "up" || b.containers.some(isProblem) || worst(b) >= 90;
    return Number(fb) - Number(fa) || worst(b) - worst(a);
  });

  const head = (
    <TileHead
      icon={Server}
      title="Altyapı"
      tint={TINT}
      trailing={bad ? <Pill tint={ERR}>{faults.length}</Pill> : <span className="text-[11px] tabular-nums text-faint">{services}</span>}
    />
  );

  /* Küçük yuva: tek cümlelik hüküm, altında filonun nabzı. */
  if (size === "1x1") {
    return (
      <Tile tint={TINT} screen="infra">
        {head}
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {bad ? (
            <>
              <div className="truncate text-[15px] font-semibold leading-tight" style={{ color: ERR }}>
                {faults[0].title}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-dim">
                {faults[0].where} · {faults[0].label}
              </div>
              {faults.length > 1 && (
                <div className="mt-0.5 text-[11px] text-faint">ve {faults.length - 1} sorun daha</div>
              )}
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold leading-tight">Filo sakin</div>
              <div className="mt-0.5 text-[11.5px] text-dim">
                {systems.length} sunucu · {services} servis
              </div>
            </>
          )}
          <div className="mt-2.5 flex flex-wrap gap-[5px]">
            {ordered.map((s) => (
              <span
                key={s.id}
                className="h-[7px] w-[7px] rounded-full"
                style={{
                  background:
                    s.status !== "up" || s.containers.some(isProblem) || worst(s) >= 90 ? ERR : "var(--color-ok)",
                }}
              />
            ))}
          </div>
        </div>
      </Tile>
    );
  }

  /* Geniş ve kısa: bir hüküm satırı, yanında en yüklü sunucunun eğrisi. */
  if (size === "2x1") {
    return (
      <Tile tint={TINT} screen="infra">
        {head}
        <div className="flex min-h-0 flex-1 items-center gap-4">
          <div className="min-w-0 flex-1">
            {bad ? (
              <>
                <div className="truncate text-[15px] font-semibold leading-tight" style={{ color: ERR }}>
                  {faults[0].title} · {faults[0].label}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-dim">
                  {faults[0].where}
                  {faults.length > 1 ? ` · ve ${faults.length - 1} sorun daha` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="truncate text-[15px] font-semibold leading-tight">Filo sakin</div>
                <div className="mt-0.5 truncate text-[11.5px] text-dim">
                  {systems.length} sunucu · {services} servis ayakta
                </div>
              </>
            )}
            <div className="mt-2 flex flex-col gap-1">
              {ordered.slice(0, 2).map((s) => (
                <FleetRow key={s.id} s={s} columns />
              ))}
            </div>
          </div>
          {busiest?.cpuHistory?.length > 1 && (
            <Sparkline
              values={busiest.cpuHistory}
              width={104}
              height={54}
              max={Math.max(20, ...busiest.cpuHistory)}
              color={bad ? ERR : TINT}
            />
          )}
        </div>
      </Tile>
    );
  }

  /* Büyük yuva: uygulamanın filo tablosunun küçük hali. */
  const columns = size === "2x2";
  return (
    <Tile tint={TINT} screen="infra">
      {head}
      <div className="shrink-0">
        {bad ? (
          <div className="truncate text-[15px] font-semibold leading-tight" style={{ color: ERR }}>
            {faults.length} sorun bekliyor
          </div>
        ) : (
          <div className="truncate text-[15px] font-semibold leading-tight">Filo sakin</div>
        )}
        <div className="mt-0.5 truncate text-[11.5px] text-dim">
          {bad ? `${faults[0].title} · ${faults[0].label}` : `${systems.length} sunucu · ${services} servis`}
        </div>
      </div>
      <div
        className="mt-2 grid shrink-0 gap-3 text-[10px] text-faint"
        style={{ gridTemplateColumns: columns ? "minmax(0,1fr) 54px 54px 54px" : "minmax(0,1fr) 62px" }}
      >
        <span />
        {columns ? (
          <>
            <span>işlemci</span>
            <span>bellek</span>
            <span>disk</span>
          </>
        ) : (
          <span>en yüklü</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {ordered.slice(0, columns ? 6 : 7).map((s) => (
          <FleetRow key={s.id} s={s} columns={columns} />
        ))}
      </div>
    </Tile>
  );
}
